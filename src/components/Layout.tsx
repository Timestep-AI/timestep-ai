import { ReactNode, useState, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  // Close sidebar on mobile when route changes
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth < 768) {
        setSidebarCollapsed(true);
      }
    };

    window.addEventListener('resize', handleResize);
    handleResize(); // Check on initial load

    return () => window.removeEventListener('resize', handleResize);
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex h-screen">
        <div className={cn(
          "transition-all duration-300 hidden md:block",
          sidebarCollapsed ? "w-16" : "w-64"
        )}>
          {/* Spacer for sidebar */}
        </div>
        <Sidebar 
          isCollapsed={sidebarCollapsed} 
          onClose={() => setSidebarCollapsed(true)} 
        />
        <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
          <Header 
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            sidebarCollapsed={sidebarCollapsed}
          />
          <main className="flex-1 px-3 py-3 sm:px-6 sm:py-6 pb-24 w-full overflow-y-auto min-h-0">
            <div className="w-full pb-16">
              {children}
            </div>
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};