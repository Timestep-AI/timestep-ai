import { ReactNode } from 'react';
import { ModernSidebar } from './ModernSidebar';
import { ModernHeader } from './ModernHeader';

interface ModernLayoutProps {
  children: ReactNode;
}

export const ModernLayout = ({ children }: ModernLayoutProps) => {
  return (
    <div className="min-h-screen bg-gray-50">
      <div className="flex">
        <ModernSidebar />
        <div className="flex-1 flex flex-col">
          <ModernHeader />
          <main className="flex-1 p-6">
            {children}
          </main>
        </div>
      </div>
    </div>
  );
};