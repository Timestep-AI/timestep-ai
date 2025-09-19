import { Layout } from '@/components/Layout';
import { useEffect, useState } from 'react';
import { ModelProvider, modelProvidersService } from '@/services/modelProvidersService';
import { MCPServer } from '@/types/mcpServer';
import { mcpServersService } from '@/services/mcpServersService';
import { ModelProviderRow } from '@/components/ModelProviderRow';
import { MCPServerRow } from '@/components/MCPServerRow';
import { Separator } from '@/components/ui/separator';
import { Server, Bot } from 'lucide-react';

const Settings = () => {
  const [modelProviders, setModelProviders] = useState<ModelProvider[]>([]);
  const [mcpServers, setMcpServers] = useState<MCPServer[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [providers, servers] = await Promise.all([
          modelProvidersService.getAll(),
          mcpServersService.getAll()
        ]);
        setModelProviders(providers);
        setMcpServers(servers);
      } catch (error) {
        console.error('Error fetching settings data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  return (
    <Layout>
      <div className="space-y-8 pb-16">
        <div className="text-center py-8">
          <h1 className="text-2xl font-bold text-text-primary mb-4">Settings</h1>
          <p className="text-text-secondary mb-8">
            Manage your configuration and preferences
          </p>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <p className="text-text-secondary">Loading...</p>
          </div>
        ) : (
          <div className="space-y-8">
            {/* Model Providers Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Bot className="w-5 h-5 text-text-primary" />
                <h2 className="text-lg font-semibold text-text-primary">Model Providers</h2>
              </div>
              <div className="space-y-2">
                {modelProviders.length > 0 ? (
                  modelProviders.map((provider) => (
                    <ModelProviderRow key={provider.id} provider={provider} />
                  ))
                ) : (
                  <p className="text-text-tertiary text-sm py-4">No model providers configured</p>
                )}
              </div>
            </div>

            <Separator />

            {/* MCP Servers Section */}
            <div className="space-y-4">
              <div className="flex items-center space-x-2">
                <Server className="w-5 h-5 text-text-primary" />
                <h2 className="text-lg font-semibold text-text-primary">Tool Providers (MCP Servers)</h2>
              </div>
              <div className="space-y-2">
                {mcpServers.length > 0 ? (
                  mcpServers.map((server) => (
                    <MCPServerRow key={server.id} server={server} />
                  ))
                ) : (
                  <p className="text-text-tertiary text-sm py-4">No MCP servers configured</p>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </Layout>
  );
};

export default Settings;