// Ambient types to satisfy TypeScript during build-only checks.
// This file does not affect runtime behavior of edge functions.

// Provide a minimal Deno global so references like Deno.env.get compile.
declare const Deno: {
  env: { get: (name: string) => string | undefined };
};

// Stub for jsr supabase client types used only for typing in this repo's build.
declare module 'jsr:@supabase/supabase-js@2' {
  export type SupabaseClient = any;
}
