import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';

const getPageTitle = (pathname: string) => {
  switch (pathname) {
    case '/':
    case '/agents':
      return 'Agents';
    case '/chats':
      return 'Chats';
    case '/models':
      return 'Models';
    case '/tools':
      return 'Tools';
    case '/traces':
      return 'Traces';
    default:
      return 'Dashboard';
  }
};

export const Header = () => {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="bg-surface border-b border-border px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <div>
            <h1 className="text-lg font-bold text-text-primary">
              Timestep AI
            </h1>
          </div>
        </div>
        
        <div className="flex items-center space-x-4">
          <Button className="bg-gradient-primary hover:opacity-90 text-primary-foreground shadow-glow">
            <Plus className="w-4 h-4 mr-2" />
            CREATE
          </Button>

          <div className="text-sm text-text-tertiary">
            v0.2.3
          </div>
        </div>
      </div>
    </header>
  );
};