import { useLocation, useParams, Link } from 'react-router-dom';
import { Menu, ChevronRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

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
  } else if (pathname === '/models') {
    breadcrumbs.push({ text: 'Models', href: '/models' });
  } else if (pathname === '/tools') {
    breadcrumbs.push({ text: 'Tools', href: '/tools' });
  } else if (pathname === '/traces') {
    breadcrumbs.push({ text: 'Traces', href: '/traces' });
  } else {
    breadcrumbs.push({ text: 'Dashboard', href: '/' });
  }
  
  return breadcrumbs;
};

export const Header = ({ onToggleSidebar, sidebarCollapsed }: HeaderProps) => {
  const location = useLocation();
  const params = useParams();
  const breadcrumbs = getBreadcrumbs(location.pathname, params);

  return (
    <header className="bg-surface border-b border-border px-6 py-3">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={onToggleSidebar}
            className="hidden md:flex h-8 w-8 p-0"
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
        </div>
      </div>
    </header>
  );
};