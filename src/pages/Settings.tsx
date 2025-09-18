import { Layout } from '@/components/Layout';

const Settings = () => {
  return (
    <Layout>
      <div className="space-y-8 pb-16">
        <div className="text-center py-12">
          <h1 className="text-2xl font-bold text-text-primary mb-4">Settings</h1>
          <p className="text-text-secondary mb-8">
            Manage your configuration and preferences
          </p>
          <div className="space-y-4 max-w-md mx-auto">
            <p className="text-sm text-text-tertiary">
              Model providers can be managed from the <strong>Models</strong> page
            </p>
            <p className="text-sm text-text-tertiary">
              Tool providers (MCP servers) can be managed from the <strong>Tools</strong> page
            </p>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Settings;