import { Search, Plus } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useLocation } from 'react-router-dom';

const getPageTitle = (pathname: string) => {
  switch (pathname) {
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
      return 'Agents';
  }
};

export const ModernHeader = () => {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  return (
    <header className="bg-white border-b border-gray-200 px-6 py-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 mb-1">
            {pageTitle}
          </h1>
          <p className="text-gray-600">
            Create and manage AI agents for your multi-agent workflows.
          </p>
        </div>
        
        <div className="flex items-center space-x-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search dashboard..."
              className="pl-10 w-80 bg-white border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            />
          </div>
          
          <Button className="bg-blue-600 hover:bg-blue-700 text-white">
            <Plus className="w-4 h-4 mr-2" />
            CREATE
          </Button>
        </div>
      </div>
    </header>
  );
};