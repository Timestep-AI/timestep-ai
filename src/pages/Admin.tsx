import { Layout } from "@/components/Layout";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { 
  Users, 
  Database, 
  Activity, 
  Shield, 
  Settings, 
  BarChart3,
  AlertTriangle,
  CheckCircle
} from "lucide-react";

const Admin = () => {
  const systemStats = [
    { label: "API Requests", value: "8.4K", change: "+8%", icon: Activity },
    { label: "System Health", value: "98.5%", change: "+0.1%", icon: Shield },
  ];

  const recentActivities = [
    { action: "User registration", user: "alice@example.com", time: "2 minutes ago", status: "success" },
    { action: "Model deployment", user: "system", time: "15 minutes ago", status: "success" },
    { action: "Database backup", user: "system", time: "1 hour ago", status: "success" },
    { action: "Failed login attempt", user: "unknown@attacker.com", time: "2 hours ago", status: "error" },
  ];

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

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {systemStats.map((stat, index) => (
            <Card key={index} className="bg-surface border-border">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
                <CardTitle className="text-sm font-medium text-foreground">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent className="pb-4">
                <div className="text-2xl font-bold text-foreground mb-1">{stat.value}</div>
                <p className="text-xs text-success flex items-center">
                  <span className="mr-1">↗</span>
                  {stat.change} from last hour
                </p>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Main Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* System Status */}
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="flex items-center text-foreground">
                <Activity className="w-5 h-5 mr-2" />
                System Status
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Current status of core system components
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">API Gateway</span>
                  <Badge className="bg-success/20 text-success border-success/30">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Database</span>
                  <Badge className="bg-success/20 text-success border-success/30">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Authentication</span>
                  <Badge className="bg-success/20 text-success border-success/30">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">File Storage</span>
                  <Badge className="bg-warning/20 text-warning border-warning/30">Degraded</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-foreground">Model Inference</span>
                  <Badge className="bg-success/20 text-success border-success/30">Operational</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card className="bg-surface border-border">
            <CardHeader>
              <CardTitle className="flex items-center text-foreground">
                <BarChart3 className="w-5 h-5 mr-2" />
                Recent Activity
              </CardTitle>
              <CardDescription className="text-muted-foreground">
                Latest system events and user actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3 text-sm">
                    <div className="flex-shrink-0">
                      {activity.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-success" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-destructive" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate text-foreground">{activity.action}</p>
                      <p className="text-muted-foreground truncate">{activity.user}</p>
                    </div>
                    <div className="text-muted-foreground text-xs">
                      {activity.time}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
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