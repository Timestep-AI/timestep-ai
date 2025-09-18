import { Layout } from '@/components/Layout';
import { McpServersSection } from '@/components/McpServersSection';
import { ModelProvidersSection } from '@/components/ModelProvidersSection';

const Settings = () => {
  return (
    <Layout>
      <div className="space-y-8 pb-16">
        <div className="space-y-8">
          <ModelProvidersSection />
          <McpServersSection />
        </div>
      </div>
    </Layout>
  );
};

export default Settings;