import { Layout } from '@/components/Layout';

export const Tools = () => {
  return (
    <Layout>
      <div className="text-center py-12">
        <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
          <span className="text-2xl">🔧</span>
        </div>
        <h3 className="text-lg font-semibold text-text-primary mb-2">
          Tools Coming Soon
        </h3>
        <p className="text-text-secondary">
          Tool management features will be available in the next update.
        </p>
      </div>
    </Layout>
  );
};

export default Tools;