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
    { label: "Active Users", value: "42", change: "+5%", icon: Users },
    { label: "Database Queries", value: "1.2K", change: "+12%", icon: Database },
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
            <p className="text-text-secondary">
              Monitor and manage your AI platform
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Badge variant="outline" className="text-green-600 border-green-200">
              <CheckCircle className="w-3 h-3 mr-1" />
              All Systems Operational
            </Badge>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {systemStats.map((stat, index) => (
            <Card key={index}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.label}
                </CardTitle>
                <stat.icon className="h-4 w-4 text-text-tertiary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className="text-xs text-green-600 flex items-center">
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
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Activity className="w-5 h-5 mr-2" />
                System Status
              </CardTitle>
              <CardDescription>
                Current status of core system components
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm">API Gateway</span>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Database</span>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Authentication</span>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">File Storage</span>
                  <Badge className="bg-yellow-100 text-yellow-800">Degraded</Badge>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm">Model Inference</span>
                  <Badge className="bg-green-100 text-green-800">Operational</Badge>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Recent Activity */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <BarChart3 className="w-5 h-5 mr-2" />
                Recent Activity
              </CardTitle>
              <CardDescription>
                Latest system events and user actions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {recentActivities.map((activity, index) => (
                  <div key={index} className="flex items-center space-x-3 text-sm">
                    <div className="flex-shrink-0">
                      {activity.status === 'success' ? (
                        <CheckCircle className="w-4 h-4 text-green-500" />
                      ) : (
                        <AlertTriangle className="w-4 h-4 text-red-500" />
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{activity.action}</p>
                      <p className="text-text-tertiary truncate">{activity.user}</p>
                    </div>
                    <div className="text-text-tertiary text-xs">
                      {activity.time}
                    </div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Admin Sections */}
        <div className="space-y-8">
          {/* Model Providers Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Database className="w-5 h-5 mr-2" />
                  Model Providers
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = '/admin/model_providers'}
                >
                  View All
                </Button>
              </CardTitle>
              <CardDescription>
                Manage AI model providers and their configurations
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Database className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                <p className="text-text-secondary mb-4">Configure model providers to enable AI functionality</p>
                <Button onClick={() => window.location.href = '/admin/model_providers'}>
                  Manage Model Providers
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Tool Providers Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Settings className="w-5 h-5 mr-2" />
                  Tool Providers (MCP Servers)
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = '/admin/tool_providers'}
                >
                  View All
                </Button>
              </CardTitle>
              <CardDescription>
                Manage MCP servers that provide tools and capabilities
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Settings className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                <p className="text-text-secondary mb-4">Configure tool providers to extend system capabilities</p>
                <Button onClick={() => window.location.href = '/admin/tool_providers'}>
                  Manage Tool Providers
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* User Settings Section */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <div className="flex items-center">
                  <Users className="w-5 h-5 mr-2" />
                  User Settings
                </div>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.location.href = '/admin/user_settings'}
                >
                  View Settings
                </Button>
              </CardTitle>
              <CardDescription>
                Manage user accounts, permissions, and system preferences
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center py-8">
                <Users className="w-8 h-8 text-text-tertiary mx-auto mb-2" />
                <p className="text-text-secondary mb-4">Configure user management and system settings</p>
                <Button onClick={() => window.location.href = '/admin/user_settings'}>
                  Manage User Settings
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </Layout>
  );
};

export default Admin;