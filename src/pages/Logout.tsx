import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { Loader2 } from 'lucide-react';

const Logout = () => {
  const navigate = useNavigate();
  const { signOut } = useAuth();

  useEffect(() => {
    const handleLogout = async () => {
      try {
        await signOut();
        navigate('/auth');
      } catch (error) {
        console.error('Error signing out:', error);
        navigate('/auth');
      }
    };

    handleLogout();
  }, [signOut, navigate]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4 text-primary" />
        <h2 className="text-xl font-semibold text-text-primary mb-4">Signing out...</h2>
        <p className="text-text-secondary">Please wait while we sign you out.</p>
      </div>
    </div>
  );
};

export default Logout;