import { Layout } from '@/components/Layout';
import { Cpu } from 'lucide-react';

export const Models = () => {
  return (
    <Layout>
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
          <Cpu className="text-4xl text-text-tertiary" />
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Models Coming Soon
        </h3>
        <p className="text-text-secondary">
          AI model management features will be available in the next update.
        </p>
      </div>
    </Layout>
  );
};

export default Models;