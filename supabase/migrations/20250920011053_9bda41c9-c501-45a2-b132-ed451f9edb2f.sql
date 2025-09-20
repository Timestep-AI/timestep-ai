-- Critical Security Fix 1: Restrict profile access to users' own profiles only
-- Remove the overly permissive policy that allows public access to all profiles
DROP POLICY IF EXISTS "Public profiles are viewable by everyone." ON public.profiles;

-- Create a more secure policy that only allows users to view their own profile
CREATE POLICY "Users can view their own profile" 
ON public.profiles 
FOR SELECT 
USING (auth.uid() = id);

-- Critical Security Fix 2: Update database functions with proper search_path
-- Fix create_encrypted_api_key function
CREATE OR REPLACE FUNCTION public.create_encrypted_api_key(p_name text, p_provider text, p_key text, p_passphrase text)
 RETURNS api_keys
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  result api_keys;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  insert into api_keys (user_id, name, provider, key_encrypted)
  values (
    auth.uid(),
    p_name,
    p_provider,
    pgp_sym_encrypt(p_key, p_passphrase)
  )
  returning * into result;

  return result;
end;
$function$;

-- Fix update_encrypted_api_key function
CREATE OR REPLACE FUNCTION public.update_encrypted_api_key(p_id uuid, p_name text DEFAULT NULL::text, p_provider text DEFAULT NULL::text, p_key text DEFAULT NULL::text, p_passphrase text DEFAULT NULL::text)
 RETURNS api_keys
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  result api_keys;
  current_record api_keys;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select * into current_record from api_keys where id = p_id and user_id = auth.uid();
  if current_record is null then
    raise exception 'API key not found or access denied';
  end if;

  update api_keys set
    name = coalesce(p_name, current_record.name),
    provider = coalesce(p_provider, current_record.provider),
    key_encrypted = case 
      when p_key is not null and p_passphrase is not null then 
        pgp_sym_encrypt(p_key, p_passphrase)
      else 
        current_record.key_encrypted 
    end,
    updated_at = timezone('utc'::text, now())
  where id = p_id
  returning * into result;

  return result;
end;
$function$;

-- Fix get_decrypted_api_key function
CREATE OR REPLACE FUNCTION public.get_decrypted_api_key(p_id uuid, p_passphrase text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  encrypted_key text;
  decrypted_key text;
begin
  if auth.uid() is null then
    raise exception 'Not authenticated';
  end if;

  select key_encrypted into encrypted_key
  from api_keys 
  where id = p_id and user_id = auth.uid();

  if encrypted_key is null then
    raise exception 'API key not found or access denied';
  end if;

  begin
    decrypted_key := pgp_sym_decrypt(encrypted_key::bytea, p_passphrase);
    return decrypted_key;
  exception when others then
    raise exception 'Failed to decrypt API key - invalid passphrase or corrupted data';
  end;
end;
$function$;

-- Fix get_decrypted_api_key_service_role function
CREATE OR REPLACE FUNCTION public.get_decrypted_api_key_service_role(p_id uuid, p_passphrase text)
 RETURNS text
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
declare
  encrypted_key text;
  decrypted_key text;
begin
  -- No auth.uid() check for service role access
  -- This function should only be called by Edge Functions with service role key
  
  select key_encrypted into encrypted_key
  from api_keys 
  where id = p_id;

  if encrypted_key is null then
    raise exception 'API key not found';
  end if;

  begin
    decrypted_key := pgp_sym_decrypt(encrypted_key::bytea, p_passphrase);
    return decrypted_key;
  exception when others then
    raise exception 'Failed to decrypt API key - invalid passphrase or corrupted data';
  end;
end;
$function$;

-- Fix compute_trace_metrics function
CREATE OR REPLACE FUNCTION public.compute_trace_metrics()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path = public
AS $function$
BEGIN
  -- Compute duration if end_time is set
  IF NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) * 1000;
  END IF;
  
  -- Update span count for the trace (only on insert/delete of spans)
  IF TG_TABLE_NAME = 'spans' THEN
    IF TG_OP = 'INSERT' THEN
      UPDATE traces 
      SET span_count = span_count + 1 
      WHERE id = NEW.trace_id;
    ELSIF TG_OP = 'DELETE' THEN
      UPDATE traces 
      SET span_count = span_count - 1 
      WHERE id = OLD.trace_id;
    END IF;
  END IF;
  
  -- Compute span duration
  IF TG_TABLE_NAME = 'spans' AND NEW.end_time IS NOT NULL AND NEW.start_time IS NOT NULL THEN
    NEW.duration_ms = EXTRACT(EPOCH FROM (NEW.end_time - NEW.start_time)) * 1000;
  END IF;
  
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$function$;

-- Fix create_invite function
CREATE OR REPLACE FUNCTION public.create_invite(invite_email text)
 RETURNS invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  invite_record public.invites;
  current_user_id UUID;
  user_invite_record public.user_invites;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create invites';
  END IF;
  
  -- Check if user has invites remaining
  SELECT * INTO user_invite_record 
  FROM public.user_invites 
  WHERE user_id = current_user_id;
  
  IF user_invite_record IS NULL OR user_invite_record.invites_remaining <= 0 THEN
    RAISE EXCEPTION 'No invites remaining';
  END IF;
  
  -- Check if email is already invited
  IF EXISTS (SELECT 1 FROM public.invites WHERE email = invite_email) THEN
    RAISE EXCEPTION 'Email already invited';
  END IF;
  
  -- Create the invite
  INSERT INTO public.invites (email, invited_by, token)
  VALUES (invite_email, current_user_id, encode(gen_random_bytes(32), 'hex'))
  RETURNING * INTO invite_record;
  
  -- Decrease invite count
  UPDATE public.user_invites 
  SET invites_remaining = invites_remaining - 1,
      updated_at = NOW()
  WHERE user_id = current_user_id;
  
  RETURN invite_record;
END;
$function$;

-- Fix initialize_first_user function
CREATE OR REPLACE FUNCTION public.initialize_first_user()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  admin_user_id UUID;
BEGIN
  -- Get the first user (admin)
  SELECT id INTO admin_user_id 
  FROM auth.users 
  ORDER BY created_at ASC 
  LIMIT 1;
  
  IF admin_user_id IS NOT NULL THEN
    -- Give admin 3 invites
    INSERT INTO public.user_invites (user_id, invites_remaining)
    VALUES (admin_user_id, 3)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
END;
$function$;