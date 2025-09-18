import { Layout } from '@/components/Layout';
import { ApiKeysSection } from '@/components/ApiKeysSection';
import { McpServersSection } from '@/components/McpServersSection';
import { ModelProvidersSection } from '@/components/ModelProvidersSection';

const Settings = () => {
  return (
    <Layout>
      <div className="space-y-8 pb-16">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-text-primary mb-2">Settings</h1>
          <p className="text-text-secondary">
            Configure your API keys, model providers, and MCP servers.
          </p>
        </div>

        <div className="space-y-8">
          <ApiKeysSection />
          <ModelProvidersSection />
          <McpServersSection />
        </div>
      </div>
    </Layout>
  );
};

export default Settings;