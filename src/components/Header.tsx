import { useLocation, useParams, Link } from 'react-router-dom';
import { Menu, ChevronRight, User, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

interface HeaderProps {
  onToggleSidebar: () => void;
  sidebarCollapsed: boolean;
}

const getBreadcrumbs = (pathname: string, params?: any) => {
  const breadcrumbs = [];
  
  if (pathname === '/' || pathname === '/agents') {
    breadcrumbs.push({ text: 'Agents', href: '/agents' });
  } else if (pathname.startsWith('/agents/') && params?.id) {
    breadcrumbs.push({ text: 'Agents', href: '/agents' });
    breadcrumbs.push({ text: 'Agent', href: `/agents/${params.id}` });
  } else if (pathname === '/chats') {
    breadcrumbs.push({ text: 'Chats', href: '/chats' });
  } else if (pathname.startsWith('/chats/') && params?.id) {
    breadcrumbs.push({ text: 'Chats', href: '/chats' });
    if (pathname.includes('/messages/')) {
      breadcrumbs.push({ text: 'Chat', href: `/chats/${params.id}` });
      breadcrumbs.push({ text: 'Message', href: pathname });
    } else {
      breadcrumbs.push({ text: 'Chat', href: `/chats/${params.id}` });
    }
  } else if (pathname === '/models') {
    breadcrumbs.push({ text: 'Models', href: '/models' });
  } else if (pathname.startsWith('/models/') && params?.id) {
    breadcrumbs.push({ text: 'Models', href: '/models' });
    breadcrumbs.push({ text: 'Model', href: `/models/${params.id}` });
  } else if (pathname === '/tools') {
    breadcrumbs.push({ text: 'Tools', href: '/tools' });
  } else if (pathname.startsWith('/tools/') && params?.id) {
    breadcrumbs.push({ text: 'Tools', href: '/tools' });
    breadcrumbs.push({ text: 'Tool', href: `/tools/${params.id}` });
  } else if (pathname === '/traces') {
    breadcrumbs.push({ text: 'Traces', href: '/traces' });
  } else if (pathname.startsWith('/traces/') && params?.id) {
    breadcrumbs.push({ text: 'Traces', href: '/traces' });
    breadcrumbs.push({ text: 'Trace', href: `/traces/${params.id}` });
  } else if (pathname === '/settings') {
    breadcrumbs.push({ text: 'Settings', href: '/settings' });
  } else if (pathname === '/settings/api-keys') {
    breadcrumbs.push({ text: 'Settings', href: '/settings' });
    breadcrumbs.push({ text: 'API Keys', href: '/settings/api-keys' });
  } else if (pathname === '/settings/model-providers') {
    breadcrumbs.push({ text: 'Settings', href: '/settings' });
    breadcrumbs.push({ text: 'Model Providers', href: '/settings/model-providers' });
  } else if (pathname === '/settings/mcp_servers') {
    breadcrumbs.push({ text: 'Settings', href: '/settings' });
    breadcrumbs.push({ text: 'MCP Servers', href: '/settings/mcp_servers' });
  } else if (pathname.startsWith('/settings/mcp_servers/') && params?.id) {
    breadcrumbs.push({ text: 'Settings', href: '/settings' });
    breadcrumbs.push({ text: 'MCP Servers', href: '/settings/mcp_servers' });
    breadcrumbs.push({ text: 'Server Details', href: `/settings/mcp_servers/${params.id}` });
  } else {
    breadcrumbs.push({ text: 'Dashboard', href: '/' });
  }
  
  return breadcrumbs;
};

export const Header = ({ onToggleSidebar, sidebarCollapsed }: HeaderProps) => {
  const location = useLocation();
  const params = useParams();
  const { user, profile, signOut } = useAuth();
  const breadcrumbs = getBreadcrumbs(location.pathname, params);

  const handleSignOut = async () => {
    await signOut();
  };

  const userInitials = profile?.full_name 
    ? profile.full_name.split(' ').map(name => name[0]).join('').toUpperCase()
    : user?.email?.charAt(0).toUpperCase() || 'U';

  const displayName = profile?.full_name || profile?.username || user?.email?.split('@')[0] || 'User';

  return (
    <header className="bg-surface border-b border-border px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="flex h-8 w-8 p-0"
          >
            <Menu className="w-4 h-4" />
          </Button>
          
          {/* Breadcrumbs */}
          <nav className="flex items-center space-x-1 text-sm">
            {breadcrumbs.map((crumb, index) => (
              <div key={crumb.href} className="flex items-center">
                {index > 0 && (
                  <ChevronRight className="w-4 h-4 text-text-tertiary mx-1" />
                )}
                {index === breadcrumbs.length - 1 ? (
                  <span className="text-text-primary font-medium">{crumb.text}</span>
                ) : (
                  <Link 
                    to={crumb.href} 
                    className="text-text-secondary hover:text-text-primary transition-colors"
                  >
                    {crumb.text}
                  </Link>
                )}
              </div>
            ))}
          </nav>
        </div>
        
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-lg font-bold text-text-primary">
              Timestep AI
            </h1>
          </div>
          
          <div className="text-sm text-text-tertiary">
            v0.2.3
          </div>

          {/* User Menu */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" className="relative h-8 w-8 rounded-full">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile?.avatar_url} alt={displayName} />
                  <AvatarFallback className="bg-primary text-primary-foreground">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent className="w-56" align="end" forceMount>
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col space-y-1">
                  <p className="text-sm font-medium leading-none">{displayName}</p>
                  <p className="text-xs leading-none text-muted-foreground">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={handleSignOut}>
                <LogOut className="mr-2 h-4 w-4" />
                <span>Sign out</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  );
};