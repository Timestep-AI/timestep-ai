import { cn } from '@/lib/utils';
import { 
  Users, 
  MessageSquare, 
  Cpu, 
  Wrench, 
  Activity,
  Menu
} from 'lucide-react';
import { useState } from 'react';
import { useLocation, Link } from 'react-router-dom';

const navItems = [
  { icon: Users, label: 'Agents', path: '/agents' },
  { icon: MessageSquare, label: 'Chats', path: '/chats' },
  { icon: Cpu, label: 'Models', path: '/models' },
  { icon: Wrench, label: 'Tools', path: '/tools' },
  { icon: Activity, label: 'Traces', path: '/traces' },
];

export const ModernSidebar = () => {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const location = useLocation();

  return (
    <div
      className={cn(
        'bg-white border-r border-gray-200 transition-all duration-300 ease-in-out shadow-sm',
        isCollapsed ? 'w-16' : 'w-64'
      )}
    >
      <div className="flex flex-col h-screen">
        {/* Header */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center justify-between">
            {!isCollapsed && (
              <div className="flex items-center space-x-2">
                <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center">
                  <Cpu className="w-5 h-5 text-white" />
                </div>
                <div>
                  <h1 className="text-lg font-bold text-gray-900">
                    Timestep AI
                  </h1>
                  <p className="text-xs text-gray-500">v0.2.3</p>
                </div>
              </div>
            )}
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
            >
              <Menu className="w-4 h-4 text-gray-600" />
            </button>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4">
          <ul className="space-y-2">
            {navItems.map(({ icon: Icon, label, path }) => (
              <li key={path}>
                <Link
                  to={path}
                  className={cn(
                    'flex items-center space-x-3 px-3 py-2 rounded-lg transition-all duration-200',
                    'hover:bg-gray-100 group',
                    location.pathname === path
                      ? 'bg-blue-50 text-blue-700 border-r-2 border-blue-600'
                      : 'text-gray-600 hover:text-gray-900'
                  )}
                >
                  <Icon className="w-5 h-5 flex-shrink-0" />
                  {!isCollapsed && (
                    <span className="font-medium">{label}</span>
                  )}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          {!isCollapsed && (
            <div className="text-xs text-gray-500">
              Create and manage AI agents for your multi-agent workflows.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};