import { ReactNode, useState } from 'react';
import { cn } from '@/lib/utils';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { BottomNav } from './BottomNav';

interface LayoutProps {
  children: ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const [sidebarCollapsed, setSidebarCollapsed] = useState(true);

  return (
    <div className="min-h-screen bg-background">
      <div className="flex">
        <div className={cn(
          "transition-all duration-300 hidden md:block",
          sidebarCollapsed ? "w-16" : "w-64"
        )}>
          {/* Spacer for sidebar */}
        </div>
        <Sidebar isCollapsed={sidebarCollapsed} />
        <div className="flex-1 flex flex-col">
          <Header 
            onToggleSidebar={() => setSidebarCollapsed(!sidebarCollapsed)}
            sidebarCollapsed={sidebarCollapsed}
          />
          <main className="flex-1 p-3 sm:p-6 pb-20">
            {children}
          </main>
        </div>
      </div>
      <BottomNav />
    </div>
  );
};