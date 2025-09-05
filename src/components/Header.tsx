import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
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
          <div className="flex items-center space-x-2">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
              <span className="text-primary-foreground font-bold text-sm">T</span>
            </div>
            <div>
              <h1 className="text-lg font-bold text-text-primary">
                Timestep AI
              </h1>
            </div>
          </div>
          {pageTitle !== 'Dashboard' && (
            <div className="text-text-secondary">
              Create and manage AI agents for your multi-agent workflows.
            </div>
          )}
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative hidden md:block">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-text-tertiary" />
            <Input
              placeholder="Search dashboard..."
              className="pl-10 w-80 bg-background border-border"
            />
          </div>
          
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