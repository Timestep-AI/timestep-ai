import { forwardRef } from 'react';
import {
  IonMenu,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonList,
  IonItem,
  IonLabel,
  IonIcon,
  IonToggle,
  IonSpinner,
  IonCard,
  IonCardContent,
  IonChip,
  IonSelect,
  IonSelectOption,
} from '@ionic/react';
import { colorPaletteOutline, informationCircleOutline, cogOutline, serverOutline } from 'ionicons/icons';
import type { AgentRecord } from '@/types/agent';
import type { BackendType } from '@/services/backendConfig';

interface SidebarMenuProps {
  id: string;
  side: 'start' | 'end';
  title: string;
  color: 'primary' | 'secondary';
  darkMode?: boolean;
  onDarkModeChange?: (checked: boolean) => void;
  backendType?: BackendType;
  onBackendChange?: (backendType: BackendType) => void;
  agentDetails?: AgentRecord | null;
  loadingAgentDetails?: boolean;
}

const SidebarMenu = forwardRef<HTMLIonMenuElement, SidebarMenuProps>(
  (
    { id, side, title, color, darkMode, onDarkModeChange, backendType, onBackendChange, agentDetails, loadingAgentDetails },
    ref
  ) => {
    return (
      <IonMenu ref={ref} id={id} contentId="main-content" type="reveal" side={side}>
        <IonHeader>
          <IonToolbar color={color}>
            <IonTitle>{title}</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          {/* Agent Config Section */}
          <IonList>
            <IonItem>
              <IonLabel>
                <h2>Agent Config</h2>
              </IonLabel>
            </IonItem>
          </IonList>

          {loadingAgentDetails ? (
            <IonList>
              <IonItem>
                <IonSpinner name="crescent" slot="start" />
                <IonLabel>Loading agent details...</IonLabel>
              </IonItem>
            </IonList>
          ) : agentDetails ? (
            <IonList>
              <IonItem>
                <IonIcon icon={informationCircleOutline} slot="start" />
                <IonLabel>
                  <h3>Name</h3>
                  <p>{agentDetails.name}</p>
                </IonLabel>
              </IonItem>

              {agentDetails.model && (
                <IonItem>
                  <IonIcon icon={cogOutline} slot="start" />
                  <IonLabel>
                    <h3>Model</h3>
                    <p>{agentDetails.model}</p>
                  </IonLabel>
                </IonItem>
              )}

              {agentDetails.instructions && (
                <IonItem>
                  <IonLabel>
                    <h3>Instructions</h3>
                    <p>{agentDetails.instructions}</p>
                  </IonLabel>
                </IonItem>
              )}

              {agentDetails.handoff_ids && agentDetails.handoff_ids.length > 0 && (
                <IonItem>
                  <IonLabel>
                    <h3>Handoff IDs</h3>
                    <p>{agentDetails.handoff_ids.join(', ')}</p>
                  </IonLabel>
                </IonItem>
              )}

              {agentDetails.tool_ids && agentDetails.tool_ids.length > 0 && (
                <IonItem>
                  <IonLabel>
                    <h3>Tool IDs</h3>
                    <p>{agentDetails.tool_ids.join(', ')}</p>
                  </IonLabel>
                </IonItem>
              )}

              {agentDetails.model_settings &&
                Object.keys(agentDetails.model_settings).length > 0 && (
                  <IonItem>
                    <IonLabel>
                      <h3>Model Settings</h3>
                      <p>{JSON.stringify(agentDetails.model_settings, null, 2)}</p>
                    </IonLabel>
                  </IonItem>
                )}

              <IonItem>
                <IonLabel>
                  <h3>Created At</h3>
                  <p>{new Date(agentDetails.created_at).toLocaleString()}</p>
                </IonLabel>
              </IonItem>
            </IonList>
          ) : null}

          {/* App Config Section */}
          <IonList>
            <IonItem>
              <IonLabel>
                <h2>App Config</h2>
              </IonLabel>
            </IonItem>
            <IonItem>
              <IonIcon icon={serverOutline} slot="start" />
              <IonLabel>Backend</IonLabel>
              <IonSelect
                value={backendType}
                placeholder="Select backend"
                onIonChange={(e) => onBackendChange?.(e.detail.value as BackendType)}
                interface="popover"
              >
                <IonSelectOption value="typescript">TypeScript</IonSelectOption>
                <IonSelectOption value="python">Python</IonSelectOption>
              </IonSelect>
            </IonItem>
            <IonItem>
              <IonIcon icon={colorPaletteOutline} slot="start" />
              <IonLabel>Dark Mode</IonLabel>
              <IonToggle
                slot="end"
                checked={darkMode}
                onIonChange={(e) => onDarkModeChange?.(e.detail.checked)}
              />
            </IonItem>
          </IonList>
        </IonContent>
      </IonMenu>
    );
  }
);

SidebarMenu.displayName = 'SidebarMenu';

export default SidebarMenu;
