import { useState, useEffect } from 'react';

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
        const response = await fetch('https://ohzbghitbjryfpmucgju.supabase.co/functions/v1/server/version');
        
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