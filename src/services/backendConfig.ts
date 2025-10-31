export type BackendType = 'python' | 'typescript';

const BACKEND_STORAGE_KEY = 'timestep_backend_type';

/**
 * Get the current backend preference from localStorage
 * Defaults to 'typescript' if not set
 */
export const getBackendType = (): BackendType => {
  if (typeof window === 'undefined') {
    return 'typescript';
  }
  
  const stored = localStorage.getItem(BACKEND_STORAGE_KEY);
  if (stored === 'python' || stored === 'typescript') {
    return stored;
  }
  
  return 'typescript'; // Default to TypeScript backend
};

/**
 * Set the backend preference in localStorage
 */
export const setBackendType = (type: BackendType): void => {
  if (typeof window === 'undefined') {
    return;
  }
  
  localStorage.setItem(BACKEND_STORAGE_KEY, type);
};

/**
 * Get the base URL for the selected backend
 */
export const getBackendBaseUrl = (backendType?: BackendType): string => {
  const type = backendType || getBackendType();
  
  if (type === 'python') {
    return 'http://127.0.0.1:8000';
  } else {
    // TypeScript backend (Supabase Edge Functions)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
    return `${supabaseUrl}/functions/v1/agent-chat`;
  }
};

/**
 * Get the chatkit URL for the selected backend
 */
export const getChatKitUrl = (backendType?: BackendType): string => {
  const baseUrl = getBackendBaseUrl(backendType);
  return `${baseUrl}/agents`;
};
