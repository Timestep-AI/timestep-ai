import { cn } from '@/lib/utils';
import { 
  Users, 
  MessageSquare, 
  Cpu, 
  Wrench, 
  Activity,
  LogOut,
  Shield
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

interface SidebarProps {
  isCollapsed: boolean;
  onClose?: () => void;
}

const navItems = [
  { icon: Users, label: 'Agents', path: '/agents' },
  { icon: MessageSquare, label: 'Chats', path: '/chats' },
  { icon: Cpu, label: 'Models', path: '/models' },
  { icon: Wrench, label: 'Tools', path: '/tools' },
  { icon: Activity, label: 'Traces', path: '/traces' },
];

const accountItems = [
  { icon: Shield, label: 'Admin', path: '/admin' },
  { icon: LogOut, label: 'Logout', path: '/logout' },
];

export const Sidebar = ({ isCollapsed, onClose }: SidebarProps) => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/agents') {
      return location.pathname === '/' || location.pathname === '/agents';
    }
    return location.pathname === path;
  };

  return (
    <>
      {/* Mobile overlay backdrop */}
      {!isCollapsed && (
        <div 
          className="fixed inset-0 bg-black/20 z-40 md:hidden"
          onClick={onClose}
        />
      )}
      
      <div className={cn(
        "bg-background border-r border-muted-foreground/60 transition-all duration-300 fixed left-0 top-0 h-full z-50",
        // On mobile: show/hide based on collapsed state, on desktop: always show with width changes
        isCollapsed 
          ? "w-16 hidden md:block" 
          : "w-64",
        // On mobile when not collapsed, slide in from left
        !isCollapsed && "md:block"
      )}>
        <div className="flex flex-col h-full">
        {/* Main Navigation */}
        <nav className="flex-1 p-4 pt-16">
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
        <div className="p-4 border-t border-muted-foreground/60 pb-20">
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
    </>
  );
};