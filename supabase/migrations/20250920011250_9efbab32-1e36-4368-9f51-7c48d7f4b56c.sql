-- Fix remaining database functions with proper search_path
-- Fix use_invite function
CREATE OR REPLACE FUNCTION public.use_invite(invite_token text)
 RETURNS invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  invite_record public.invites;
BEGIN
  -- Find the invite
  SELECT * INTO invite_record 
  FROM public.invites 
  WHERE token = invite_token 
    AND used_at IS NULL 
    AND expires_at > NOW();
  
  IF invite_record IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite token';
  END IF;
  
  -- Mark invite as used
  UPDATE public.invites 
  SET used_at = NOW(),
      updated_at = NOW()
  WHERE id = invite_record.id;
  
  RETURN invite_record;
END;
$function$;

-- Fix handle_new_user function
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  user_count INTEGER;
BEGIN
  -- Get current user count (including the new user)
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- If this is the first user, give them admin privileges
  IF user_count = 1 THEN
    INSERT INTO public.user_invites (user_id, invites_remaining)
    VALUES (NEW.id, 3)
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    -- For subsequent users, verify they have a valid invite
    IF NOT EXISTS (
      SELECT 1 FROM public.invites 
      WHERE email = NEW.email 
        AND used_at IS NULL 
        AND expires_at > NOW()
    ) THEN
      -- Check if invite exists but is expired or used
      IF EXISTS (SELECT 1 FROM public.invites WHERE email = NEW.email AND used_at IS NOT NULL) THEN
        RAISE EXCEPTION 'INVITE_ALREADY_USED: This invitation has already been used.';
      ELSIF EXISTS (SELECT 1 FROM public.invites WHERE email = NEW.email AND expires_at <= NOW()) THEN
        RAISE EXCEPTION 'INVITE_EXPIRED: This invitation has expired. Please request a new invitation.';
      ELSE
        RAISE EXCEPTION 'INVITE_REQUIRED: This email address requires a valid invitation to sign up. Please contact an existing user for an invitation.';
      END IF;
    END IF;
    
    -- Mark the specific invite as used based on the invitation metadata
    -- The user metadata contains 'invited_by' which tells us who sent the invite
    UPDATE public.invites 
    SET used_at = NOW(), updated_at = NOW()
    WHERE email = NEW.email 
      AND used_at IS NULL 
      AND invited_by = (NEW.user_metadata->>'invited_by')::UUID;
    
    -- Give new user 3 invites
    INSERT INTO public.user_invites (user_id, invites_remaining)
    VALUES (NEW.id, 3)
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$function$;

-- Fix can_email_signup function
CREATE OR REPLACE FUNCTION public.can_email_signup(check_email text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  user_count INTEGER;
  has_invite BOOLEAN;
BEGIN
  -- Check if this is the first user (admin)
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- If this is the first user, allow signup
  IF user_count = 0 THEN
    RETURN TRUE;
  END IF;
  
  -- For subsequent users, check if they have a valid invite
  SELECT EXISTS (
    SELECT 1 FROM public.invites 
    WHERE email = check_email 
      AND used_at IS NULL 
      AND expires_at > NOW()
  ) INTO has_invite;
  
  RETURN has_invite;
END;
$function$;

-- Fix create_invite_for_email function
CREATE OR REPLACE FUNCTION public.create_invite_for_email(invite_email text)
 RETURNS invites
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  current_user_id UUID;
  user_invite_record public.user_invites;
  invite_record public.invites;
  inviter_email TEXT;
BEGIN
  -- Get current user ID and email
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to create invites';
  END IF;
  
  -- Get inviter's email for the invitation
  SELECT email INTO inviter_email FROM auth.users WHERE id = current_user_id;
  
  -- Check if user has invites remaining
  SELECT * INTO user_invite_record 
  FROM public.user_invites 
  WHERE user_id = current_user_id;
  
  IF user_invite_record IS NULL OR user_invite_record.invites_remaining <= 0 THEN
    RAISE EXCEPTION 'No invites remaining';
  END IF;
  
  -- Check if email is already invited or registered
  IF EXISTS (SELECT 1 FROM public.invites WHERE email = invite_email) THEN
    RAISE EXCEPTION 'Email already invited';
  END IF;
  
  IF EXISTS (SELECT 1 FROM auth.users WHERE email = invite_email) THEN
    RAISE EXCEPTION 'Email already registered';
  END IF;
  
  -- Create the invite with explicit token generation
  INSERT INTO public.invites (email, invited_by, token)
  VALUES (invite_email, current_user_id, encode(gen_random_bytes(32), 'hex'))
  RETURNING * INTO invite_record;
  
  -- Decrease invite count
  UPDATE public.user_invites 
  SET invites_remaining = invites_remaining - 1,
      updated_at = NOW()
  WHERE user_id = current_user_id;
  
  -- Send invitation email using Supabase Edge Function (commented out for now)
  -- This would need to be implemented as an Edge Function call
  
  RETURN invite_record;
END;
$function$;

-- Fix use_invite_and_setup_user function
CREATE OR REPLACE FUNCTION public.use_invite_and_setup_user(user_email text, user_id uuid)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  user_count INTEGER;
BEGIN
  -- Get current user count
  SELECT COUNT(*) INTO user_count FROM auth.users;
  
  -- If this is the first user, give them admin privileges
  IF user_count = 1 THEN
    INSERT INTO public.user_invites (user_id, invites_remaining)
    VALUES (user_id, 3)
    ON CONFLICT (user_id) DO NOTHING;
    RETURN TRUE;
  END IF;
  
  -- For subsequent users, mark invite as used and give them invites
  UPDATE public.invites 
  SET used_at = NOW(), updated_at = NOW()
  WHERE email = user_email AND used_at IS NULL;
  
  -- Give new user 3 invites
  INSERT INTO public.user_invites (user_id, invites_remaining)
  VALUES (user_id, 3)
  ON CONFLICT (user_id) DO NOTHING;
  
  RETURN TRUE;
END;
$function$;

-- Fix decrease_user_invites function
CREATE OR REPLACE FUNCTION public.decrease_user_invites()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path = public
AS $function$
DECLARE
  current_user_id UUID;
  user_invite_record public.user_invites;
BEGIN
  -- Get current user ID
  current_user_id := auth.uid();
  
  IF current_user_id IS NULL THEN
    RAISE EXCEPTION 'User must be authenticated to decrease invites';
  END IF;
  
  -- Check if user has invites remaining
  SELECT * INTO user_invite_record 
  FROM public.user_invites 
  WHERE user_id = current_user_id;
  
  IF user_invite_record IS NULL OR user_invite_record.invites_remaining <= 0 THEN
    RETURN FALSE;
  END IF;
  
  -- Decrease invite count
  UPDATE public.user_invites 
  SET invites_remaining = invites_remaining - 1,
      updated_at = NOW()
  WHERE user_id = current_user_id;
  
  RETURN TRUE;
END;
$function$;