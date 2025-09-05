import { cn } from '@/lib/utils';
import { 
  Users, 
  MessageSquare, 
  Cpu, 
  Wrench, 
  Activity,
  LogOut,
  Settings,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';
import { useState } from 'react';

const navItems = [
  { icon: Users, label: 'Agents', path: '/agents' },
  { icon: MessageSquare, label: 'Chats', path: '/chats' },
  { icon: Cpu, label: 'Models', path: '/models' },
  { icon: Wrench, label: 'Tools', path: '/tools' },
  { icon: Activity, label: 'Traces', path: '/traces' },
];

const accountItems = [
  { icon: LogOut, label: 'Logout', path: '/logout' },
  { icon: Settings, label: 'Settings', path: '/settings' },
];

export const Sidebar = () => {
  const location = useLocation();
  const [isCollapsed, setIsCollapsed] = useState(true);

  const isActive = (path: string) => {
    if (path === '/agents') {
      return location.pathname === '/' || location.pathname === '/agents';
    }
    return location.pathname === path;
  };

  return (
    <div className={cn(
      "bg-background border-r border-border transition-all duration-300 hidden md:block relative",
      isCollapsed ? "w-16" : "w-64"
    )}>
      <div className="flex flex-col h-screen">
        {/* Collapse Toggle */}
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          className="absolute -right-3 top-6 z-10 w-6 h-6 bg-surface border border-border rounded-full flex items-center justify-center hover:bg-surface-elevated transition-colors"
        >
          {isCollapsed ? (
            <ChevronRight className="w-3 h-3 text-text-secondary" />
          ) : (
            <ChevronLeft className="w-3 h-3 text-text-secondary" />
          )}
        </button>

        {/* Main Navigation */}
        <nav className="flex-1 p-4">
          <div className="mb-6">
            {!isCollapsed && (
              <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
                ABSTRACTIONS
              </p>
            )}
            <ul className="space-y-1">
              {navItems.map(({ icon: Icon, label, path }) => (
                <li key={path}>
                  <Link
                    to={path}
                    title={isCollapsed ? label : undefined}
                    className={cn(
                      'flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
                      'hover:bg-surface-elevated group',
                      isActive(path)
                        ? 'bg-primary text-primary-foreground'
                        : 'text-text-secondary hover:text-text-primary',
                      isCollapsed && 'justify-center'
                    )}
                  >
                    <Icon className="w-4 h-4 flex-shrink-0" />
                    {!isCollapsed && (
                      <span className="font-medium">{label}</span>
                    )}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </nav>

        {/* Account Section */}
        <div className="p-4 border-t border-border">
          {!isCollapsed && (
            <p className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3">
              ACCOUNT
            </p>
          )}
          <ul className="space-y-1">
            {accountItems.map(({ icon: Icon, label, path }) => (
              <li key={path}>
                <Link
                  to={path}
                  title={isCollapsed ? label : undefined}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200 text-sm',
                    'hover:bg-surface-elevated group',
                    location.pathname === path
                      ? 'bg-primary text-primary-foreground'
                      : 'text-text-secondary hover:text-text-primary',
                    isCollapsed && 'justify-center'
                  )}
                >
                  <Icon className="w-4 h-4 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="font-medium">{label}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
};