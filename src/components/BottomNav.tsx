import { cn } from '@/lib/utils';
import { 
  Users, 
  MessageSquare, 
  Cpu, 
  Wrench, 
  Activity
} from 'lucide-react';
import { useLocation, Link } from 'react-router-dom';

const navItems = [
  { icon: Users, label: 'Agents', path: '/agents' },
  { icon: MessageSquare, label: 'Chats', path: '/chats' },
  { icon: Cpu, label: 'Models', path: '/models' },
  { icon: Wrench, label: 'Tools', path: '/tools' },
  { icon: Activity, label: 'Traces', path: '/traces' },
];

export const BottomNav = () => {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/agents') {
      return location.pathname === '/' || location.pathname === '/agents';
    }
    return location.pathname === path;
  };

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-surface border-t border-muted-foreground/60 z-50 h-16">
      <div className="flex items-center justify-around h-full py-2">
        {navItems.map(({ icon: Icon, label, path }) => (
          <Link
            key={path}
            to={path}
            className={cn(
              'flex flex-col items-center space-y-1 py-2 px-3 rounded-lg transition-all duration-200 min-w-0 flex-1',
              isActive(path)
                ? 'text-primary'
                : 'text-text-secondary'
            )}
          >
            <Icon className="w-5 h-5 flex-shrink-0" />
            <span className="text-xs font-medium truncate">{label}</span>
          </Link>
        ))}
      </div>
    </nav>
  );
};