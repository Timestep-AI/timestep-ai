import { useState, useEffect } from "react";
import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Plus, Search, Server } from "lucide-react";
import { ModelProviderRow } from "@/components/ModelProviderRow";
import { modelProvidersService, type ModelProvider } from "@/services/modelProvidersService";

export default function ModelProviders() {
  const [providers, setProviders] = useState<ModelProvider[]>([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchProviders = async () => {
      try {
        const data = await modelProvidersService.getAll();
        setProviders(data);
      } catch (error) {
        console.error("Error fetching model providers:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchProviders();
  }, []);

  const filteredProviders = providers.filter(provider =>
    provider.provider.toLowerCase().includes(searchTerm.toLowerCase()) ||
    provider.description?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const activeProviders = filteredProviders.filter(p => p.is_active);
  const inactiveProviders = filteredProviders.filter(p => !p.is_active);

  if (loading) {
    return (
      <Layout>
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-3xl font-bold tracking-tight">Model Providers</h1>
              <p className="text-muted-foreground">
                Configure and manage AI model providers
              </p>
            </div>
          </div>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto"></div>
            <p className="mt-4 text-muted-foreground">Loading model providers...</p>
          </div>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Model Providers</h1>
            <p className="text-muted-foreground">
              Configure and manage AI model providers
            </p>
          </div>
          <Button 
            onClick={() => window.location.href = '/admin/model_providers'}
            className="flex items-center gap-2"
          >
            <Plus className="w-4 h-4" />
            Add Provider
          </Button>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search model providers..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Stats */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Providers</CardTitle>
              <Server className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{filteredProviders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Active Providers</CardTitle>
              <Badge className="bg-success/20 text-success border-success/30">Active</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-success">{activeProviders.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Inactive Providers</CardTitle>
              <Badge variant="secondary">Inactive</Badge>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-muted-foreground">{inactiveProviders.length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Active Providers */}
        {activeProviders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5" />
                Active Providers
              </CardTitle>
              <CardDescription>
                Currently configured and active model providers
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {activeProviders.map((provider) => (
                  <ModelProviderRow key={provider.id} provider={provider} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Inactive Providers */}
        {inactiveProviders.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Server className="w-5 h-5 text-muted-foreground" />
                Inactive Providers
              </CardTitle>
              <CardDescription>
                Providers that are configured but not currently active
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {inactiveProviders.map((provider) => (
                  <ModelProviderRow key={provider.id} provider={provider} />
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Empty State */}
        {filteredProviders.length === 0 && (
          <Card>
            <CardContent className="text-center py-12">
              <Server className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">No Model Providers Found</h3>
              <p className="text-muted-foreground mb-4">
                {searchTerm ? "No providers match your search criteria." : "Get started by adding your first model provider."}
              </p>
              <Button onClick={() => window.location.href = '/admin/model_providers'}>
                <Plus className="w-4 h-4 mr-2" />
                Add Provider
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </Layout>
  );
}