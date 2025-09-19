import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Database, 
  CheckCircle
} from "lucide-react";

const Admin = () => {
  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Admin Dashboard</h1>
            <p className="text-muted-foreground">
              Monitor and manage your AI platform
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge className="bg-success/20 text-success border-success/30 hover:bg-success/30">
              <CheckCircle className="w-3 h-3 mr-1" />
              All Systems Operational
            </Badge>
          </div>
        </div>

        {/* Model Providers Section */}
        <Card className="bg-surface border-border">
          <CardHeader>
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center text-foreground">
                <Database className="w-5 h-5 mr-2" />
                Model Providers
              </div>
              <Button 
                variant="outline" 
                size="sm"
                onClick={() => window.location.href = '/admin/model_providers'}
                className="text-primary border-border hover:bg-accent"
              >
                View All
              </Button>
            </CardTitle>
            <CardDescription className="text-muted-foreground">
              Manage AI model providers and their configurations
            </CardDescription>
          </CardHeader>
        </Card>
      </div>
    </Layout>
  );
};

export default Admin;