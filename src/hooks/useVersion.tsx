import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface VersionInfo {
  version?: string;
  runtime?: string;
  error?: string;
}

export const useVersion = () => {
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchVersion = async () => {
      try {
        const { data: { session } } = await supabase.auth.getSession();
        
        if (!session?.access_token) {
          setVersionInfo({ error: 'Not authenticated' });
          setLoading(false);
          return;
        }

        const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ohzbghitbjryfpmucgju.supabase.co";
        const response = await fetch(`${supabaseUrl}/functions/v1/server/version`, {
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json'
          }
        });
        
        if (response.ok) {
          const data = await response.json();
          setVersionInfo(data);
        } else {
          console.warn('Failed to fetch version info');
          setVersionInfo({ error: 'Failed to fetch version' });
        }
      } catch (error) {
        console.warn('Error fetching version:', error);
        setVersionInfo({ error: 'Network error' });
      } finally {
        setLoading(false);
      }
    };

    fetchVersion();
  }, []);

  return {
    version: versionInfo.version,
    runtime: versionInfo.runtime,
    loading,
    error: versionInfo.error
  };
};