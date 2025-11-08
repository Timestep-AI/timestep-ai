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
    const pythonBackendUrl = import.meta.env.VITE_PYTHON_BACKEND_URL;
    if (!pythonBackendUrl) {
      throw new Error('VITE_PYTHON_BACKEND_URL environment variable is required');
    }
    // Remove trailing slash and append /api/v1
    const cleanUrl = pythonBackendUrl.replace(/\/+$/, '');
    return `${cleanUrl}/api/v1`;
  } else {
    // TypeScript backend (Supabase Edge Functions)
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
    if (!supabaseUrl) {
      throw new Error('VITE_SUPABASE_URL environment variable is required');
    }
    // Remove trailing slash and append /functions/v1
    const cleanUrl = supabaseUrl.replace(/\/+$/, '');
    return `${cleanUrl}/functions/v1`;
  }
};

/**
 * Get the chatkit URL for the selected backend
 */
export const getChatKitUrl = (backendType?: BackendType): string => {
  const baseUrl = getBackendBaseUrl(backendType);
  return `${baseUrl}/agents`;
};
