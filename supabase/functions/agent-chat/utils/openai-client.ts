// OpenAI Client Utility
// Uses the OpenAI library to interact with our openai-polyfill endpoints
import OpenAI from 'https://esm.sh/openai@4';

/**
 * Create an OpenAI client configured to use our openai-polyfill endpoints
 */
export function createOpenAIClient(supabaseUrl: string, userJwt: string): OpenAI {
  // Point to our openai-polyfill edge function
  const baseURL = `${supabaseUrl}/functions/v1/openai-polyfill`;

  return new OpenAI({
    apiKey: userJwt, // Use JWT as API key for authentication
    baseURL,
    defaultHeaders: {
      'Authorization': `Bearer ${userJwt}`,
    },
  });
}
