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
  search
} from 'ionicons/icons';
import { useLocation } from 'react-router-dom';

interface IonicLayoutProps {
  children: ReactNode;
  title: string;
}

const menuItems = [
  { icon: people, label: 'Agents', path: '/agents' },
  { icon: chatbubbles, label: 'Chats', path: '/chats' },
  { icon: desktop, label: 'Models', path: '/models' },
  { icon: construct, label: 'Tools', path: '/tools' },
  { icon: analytics, label: 'Traces', path: '/traces' },
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

  return (
    <>
      <IonMenu contentId="main-content" type="overlay">
        <IonContent className="bg-surface">
          <div className="p-4 border-b border-border">
            <div className="flex items-center space-x-3">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center">
                <IonIcon icon={desktop} className="text-white text-xl" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-text-primary">
                  Timestep AI
                </h1>
                <p className="text-xs text-text-tertiary">v0.2.3</p>
              </div>
            </div>
          </div>
          
          <IonList>
            {menuItems.map(({ icon, label, path }) => (
              <IonMenuToggle key={path} autoHide={false}>
                <IonItem 
                  routerLink={path} 
                  className={location.pathname === path ? 'bg-primary/20' : ''}
                >
                  <IonIcon 
                    icon={icon} 
                    slot="start" 
                    className={location.pathname === path ? 'text-primary' : 'text-text-secondary'} 
                  />
                  <IonLabel className={location.pathname === path ? 'text-primary font-medium' : 'text-text-secondary'}>
                    {label}
                  </IonLabel>
                </IonItem>
              </IonMenuToggle>
            ))}
          </IonList>
          
          <div className="p-4 mt-auto">
            <p className="text-xs text-text-tertiary">
              Create and manage AI agents for your multi-agent workflows.
            </p>
          </div>
        </IonContent>
      </IonMenu>

      <IonPage id="main-content">
        <IonHeader className="bg-surface border-b border-border">
          <IonToolbar className="bg-surface">
            <IonButtons slot="start">
              <IonMenuButton className="text-text-primary" />
            </IonButtons>
            <IonTitle className="text-text-primary font-bold">
              {pageTitle}
            </IonTitle>
            <IonButtons slot="end">
              <IonSearchbar
                placeholder={`Search ${pageTitle.toLowerCase()}...`}
                className="w-80 max-w-sm"
                showClearButton="focus"
              />
              <IonButton className="bg-gradient-primary text-white ml-2">
                <IonIcon icon={add} slot="start" />
                Create
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        
        <IonContent className="bg-background">
          <div className="p-6">
            <div className="mb-4">
              <p className="text-text-secondary">
                Create and manage AI agents for your multi-agent workflows.
              </p>
            </div>
            {children}
          </div>
        </IonContent>
      </IonPage>
    </>
  );
};