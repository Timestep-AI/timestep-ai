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
  IonSelect,
  IonSelectOption,
  IonInput,
  IonRange,
} from '@ionic/react';
import { colorPaletteOutline, informationCircleOutline, cogOutline } from 'ionicons/icons';
import type { AgentRecord } from '@/types/agent';

export interface ThemeSettings {
  colorScheme: 'dark' | 'light';
  accentColor: string;
  accentLevel: 0 | 1 | 2 | 3;
  radius: 'pill' | 'round' | 'sharp' | 'soft';
  density: 'compact' | 'normal' | 'spacious';
  fontFamily: string;
}

interface SidebarMenuProps {
  id: string;
  side: 'start' | 'end';
  title: string;
  color: 'primary' | 'secondary';
  darkMode?: boolean;
  onDarkModeChange?: (checked: boolean) => void;
  agentDetails?: AgentRecord | null;
  loadingAgentDetails?: boolean;
  themeSettings?: ThemeSettings;
  onThemeChange?: (settings: Partial<ThemeSettings>) => void;
}

const SidebarMenu = forwardRef<HTMLIonMenuElement, SidebarMenuProps>(
  (
    { id, side, title, color, darkMode, onDarkModeChange, agentDetails, loadingAgentDetails, themeSettings, onThemeChange },
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
              <IonIcon icon={colorPaletteOutline} slot="start" />
              <IonLabel>Dark Mode</IonLabel>
              <IonToggle
                slot="end"
                checked={darkMode}
                onIonChange={(e) => onDarkModeChange?.(e.detail.checked)}
              />
            </IonItem>
          </IonList>

          {/* ChatKit Theme Settings */}
          {themeSettings && onThemeChange && (
            <IonList>
              <IonItem>
                <IonLabel>
                  <h2>ChatKit Theme</h2>
                </IonLabel>
              </IonItem>

              <IonItem>
                <IonLabel>Color Scheme</IonLabel>
                <IonSelect
                  value={themeSettings.colorScheme}
                  onIonChange={(e) => onThemeChange({ colorScheme: e.detail.value })}
                >
                  <IonSelectOption value="dark">Dark</IonSelectOption>
                  <IonSelectOption value="light">Light</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel>Accent Color</IonLabel>
                <IonInput
                  type="text"
                  value={themeSettings.accentColor}
                  placeholder="#D7263D"
                  onIonChange={(e) => onThemeChange({ accentColor: e.detail.value as string })}
                />
              </IonItem>

              <IonItem>
                <IonLabel>Accent Level</IonLabel>
                <IonSelect
                  value={themeSettings.accentLevel}
                  onIonChange={(e) => onThemeChange({ accentLevel: e.detail.value })}
                >
                  <IonSelectOption value={0}>0</IonSelectOption>
                  <IonSelectOption value={1}>1</IonSelectOption>
                  <IonSelectOption value={2}>2</IonSelectOption>
                  <IonSelectOption value={3}>3</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel>Radius</IonLabel>
                <IonSelect
                  value={themeSettings.radius}
                  onIonChange={(e) => onThemeChange({ radius: e.detail.value })}
                >
                  <IonSelectOption value="sharp">Sharp</IonSelectOption>
                  <IonSelectOption value="soft">Soft</IonSelectOption>
                  <IonSelectOption value="round">Round</IonSelectOption>
                  <IonSelectOption value="pill">Pill</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel>Density</IonLabel>
                <IonSelect
                  value={themeSettings.density}
                  onIonChange={(e) => onThemeChange({ density: e.detail.value })}
                >
                  <IonSelectOption value="compact">Compact</IonSelectOption>
                  <IonSelectOption value="normal">Normal</IonSelectOption>
                  <IonSelectOption value="spacious">Spacious</IonSelectOption>
                </IonSelect>
              </IonItem>

              <IonItem>
                <IonLabel position="stacked">Font Family</IonLabel>
                <IonInput
                  value={themeSettings.fontFamily}
                  placeholder="'Inter', sans-serif"
                  onIonChange={(e) => onThemeChange({ fontFamily: e.detail.value as string })}
                />
              </IonItem>
            </IonList>
          )}
        </IonContent>
      </IonMenu>
    );
  }
);

SidebarMenu.displayName = 'SidebarMenu';

export default SidebarMenu;
