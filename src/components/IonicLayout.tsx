import { ReactNode } from 'react';
import { 
  IonContent, 
  IonHeader, 
  IonPage, 
  IonTitle, 
  IonToolbar,
  IonMenu,
  IonMenuButton,
  IonList,
  IonItem,
  IonIcon,
  IonLabel,
  IonButton,
  IonButtons,
  IonSearchbar,
  IonMenuToggle
} from '@ionic/react';
import { 
  people, 
  chatbubbles, 
  desktop, 
  construct, 
  analytics,
  add,
  search,
  logOut,
  settings
} from 'ionicons/icons';
import { useLocation, Link } from 'react-router-dom';
import { cn } from '@/lib/utils';
import { BottomNav } from './BottomNav';

interface IonicLayoutProps {
  children: ReactNode;
  title: string;
}

const abstractionItems = [
  { icon: people, label: 'Agents', path: '/agents' },
  { icon: chatbubbles, label: 'Chats', path: '/chats' },
  { icon: desktop, label: 'Models', path: '/models' },
  { icon: construct, label: 'Tools', path: '/tools' },
  { icon: analytics, label: 'Traces', path: '/traces' },
];

const accountItems = [
  { icon: logOut, label: 'Logout', path: '/logout' },
  { icon: settings, label: 'Settings', path: '/settings' },
];

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
      return 'Dashboard';
  }
};

export const IonicLayout = ({ children }: IonicLayoutProps) => {
  const location = useLocation();
  const pageTitle = getPageTitle(location.pathname);

  const isActive = (path: string) => {
    if (path === '/agents') {
      return location.pathname === '/' || location.pathname === '/agents';
    }
    return location.pathname === path;
  };

  return (
    <>
      <IonMenu contentId="main-content" type="overlay">
        <IonContent className="bg-surface" style={{ '--background': 'hsl(var(--surface))' }}>
          <div className="p-4">
            {/* ABSTRACTIONS Section */}
            <div className="mb-6">
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3 px-3">
                ABSTRACTIONS
              </h3>
              <IonList className="bg-transparent" style={{ '--background': 'transparent' }}>
                {abstractionItems.map(({ icon, label, path }) => (
                  <IonMenuToggle key={path} autoHide={false}>
                    <Link to={path} style={{ textDecoration: 'none' }}>
                      <IonItem 
                        className={cn(
                          "bg-transparent border-none rounded-lg mx-2 mb-1",
                          isActive(path) ? 'bg-primary text-primary-foreground' : ''
                        )}
                        lines="none"
                        style={{ 
                          '--background': isActive(path) ? 'hsl(var(--primary))' : 'transparent',
                          '--color': isActive(path) ? 'hsl(var(--primary-foreground))' : 'hsl(var(--text-secondary))'
                        }}
                      >
                        <IonIcon 
                          icon={icon} 
                          slot="start" 
                          size="small"
                          className={isActive(path) ? 'text-primary-foreground' : 'text-text-secondary'} 
                        />
                        <IonLabel className={isActive(path) ? 'text-primary-foreground font-medium' : 'text-text-secondary'}>
                          {label}
                        </IonLabel>
                      </IonItem>
                    </Link>
                  </IonMenuToggle>
                ))}
              </IonList>
            </div>

            {/* ACCOUNT Section */}
            <div className="mt-auto">
              <h3 className="text-xs font-medium text-text-tertiary uppercase tracking-wider mb-3 px-3">
                ACCOUNT
              </h3>
              <IonList className="bg-transparent" style={{ '--background': 'transparent' }}>
                {accountItems.map(({ icon, label, path }) => (
                  <IonMenuToggle key={path} autoHide={false}>
                    <Link to={path} style={{ textDecoration: 'none' }}>
                      <IonItem 
                        className={cn(
                          "bg-transparent border-none rounded-lg mx-2 mb-1",
                          location.pathname === path ? 'bg-primary text-primary-foreground' : ''
                        )}
                        lines="none"
                        style={{ 
                          '--background': location.pathname === path ? 'hsl(var(--primary))' : 'transparent',
                          '--color': location.pathname === path ? 'hsl(var(--primary-foreground))' : 'hsl(var(--text-secondary))'
                        }}
                      >
                        <IonIcon 
                          icon={icon} 
                          slot="start" 
                          size="small"
                          className={location.pathname === path ? 'text-primary-foreground' : 'text-text-secondary'} 
                        />
                        <IonLabel className={location.pathname === path ? 'text-primary-foreground font-medium' : 'text-text-secondary'}>
                          {label}
                        </IonLabel>
                      </IonItem>
                    </Link>
                  </IonMenuToggle>
                ))}
              </IonList>
            </div>
          </div>
        </IonContent>
      </IonMenu>

      <IonPage id="main-content">
        <IonHeader className="bg-surface border-b border-border">
          <IonToolbar className="bg-surface" style={{ '--background': 'hsl(var(--surface))' }}>
            <IonButtons slot="start">
              <IonMenuButton className="text-text-primary" />
              <div className="flex items-center space-x-2 ml-2">
                <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center">
                  <span className="text-primary-foreground font-bold text-sm">T</span>
                </div>
                <div>
                  <h1 className="text-lg font-bold text-text-primary">
                    Timestep AI
                  </h1>
                </div>
              </div>
            </IonButtons>
            <IonButtons slot="end">
              <IonSearchbar
                placeholder="Search dashboard..."
                className="w-60 max-w-sm hidden md:block"
                style={{ '--background': 'hsl(var(--background))', '--color': 'hsl(var(--foreground))' }}
                showClearButton="focus"
              />
              <IonButton className="bg-gradient-primary text-white ml-2">
                <IonIcon icon={add} slot="start" />
                <span className="hidden sm:inline">CREATE</span>
                <IonIcon icon={add} className="sm:hidden" />
              </IonButton>
              <div className="text-sm text-text-tertiary ml-2 hidden md:block">
                v0.2.3
              </div>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        
        <IonContent className="bg-background" style={{ '--background': 'hsl(var(--background))' }}>
          <div className="p-4 md:p-6 pb-20 md:pb-6">
            <div className="mb-4">
              <p className="text-text-secondary text-sm">
                Create and manage AI agents for your multi-agent workflows.
              </p>
            </div>
            {children}
          </div>
        </IonContent>
      </IonPage>
      <BottomNav />
    </>
  );
};