import { Layout } from '@/components/Layout';
import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';

const Logout = () => {
  const navigate = useNavigate();

  useEffect(() => {
    // In a real app, you would handle logout logic here
    // For now, just redirect back to agents
    const timer = setTimeout(() => {
      navigate('/agents');
    }, 2000);

    return () => clearTimeout(timer);
  }, [navigate]);

  return (
    <Layout>
      <div className="p-6 text-center">
        <h2 className="text-xl font-semibold text-text-primary mb-4">Logging out...</h2>
        <p className="text-text-secondary">You will be redirected shortly.</p>
      </div>
    </Layout>
  );
};

export default Logout;