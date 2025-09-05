import { 
  IonCard, 
  IonCardContent, 
  IonItem, 
  IonAvatar, 
  IonLabel, 
  IonButton,
  IonIcon,
  IonChip,
  IonPopover,
  IonList
} from '@ionic/react';
import { 
  person, 
  ellipsisHorizontal, 
  calendar, 
  desktop,
  pencil,
  trash
} from 'ionicons/icons';
import { useState } from 'react';

interface Agent {
  id: string;
  name: string;
  description?: string;
  createdAt: string;
  model?: string;
  status: 'active' | 'inactive' | 'handoff';
}

interface IonicAgentCardProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
}

export const IonicAgentCard = ({ agent, onEdit, onDelete }: IonicAgentCardProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  return (
    <IonCard 
      className="bg-card border border-border rounded-xl hover:bg-surface-elevated transition-all duration-200 group mb-3"
      style={{ '--background': 'hsl(var(--card))', '--color': 'hsl(var(--card-foreground))' }}
    >
      <IonCardContent className="p-3" style={{ '--background': 'hsl(var(--card))' }}>
        <div className="flex flex-col space-y-3">
          {/* Header Row */}
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3 flex-1 min-w-0">
              <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
                <IonIcon icon={person} className="text-white text-lg" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center space-x-2 mb-1">
                  <h3 className="font-semibold text-text-primary truncate text-sm">
                    {agent.name}
                  </h3>
                  {agent.status === 'handoff' && (
                    <IonChip className="text-xs bg-secondary text-secondary-foreground flex-shrink-0">
                      Handoff
                    </IonChip>
                  )}
                </div>
              </div>
            </div>
            
            <IonButton 
              fill="clear" 
              size="small"
              id={`trigger-${agent.id}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary flex-shrink-0"
            >
              <IonIcon icon={ellipsisHorizontal} />
            </IonButton>
          </div>

          {/* Description */}
          {agent.description && (
            <p className="text-sm text-text-secondary line-clamp-2 pl-13">
              {agent.description}
            </p>
          )}
          
          {/* Footer Row */}
          <div className="flex items-center justify-between pl-13">
            <div className="flex items-center space-x-1 text-xs text-text-tertiary">
              <IonIcon icon={calendar} className="text-xs" />
              <span className="truncate">Created: {agent.createdAt}</span>
            </div>
            
            <div className="flex-shrink-0">
              {agent.model ? (
                <IonChip className="bg-info/10 text-info border-info/20 text-xs">
                  <IonLabel className="text-xs">{agent.model}</IonLabel>
                </IonChip>
              ) : (
                <IonChip color="medium" outline className="text-text-tertiary text-xs">
                  <IonLabel className="text-xs">No Model</IonLabel>
                </IonChip>
              )}
            </div>
          </div>
        </div>
        
        <IonPopover 
          trigger={`trigger-${agent.id}`} 
          isOpen={isPopoverOpen}
          onDidDismiss={() => setIsPopoverOpen(false)}
        >
          <IonList>
            <IonItem button onClick={() => onEdit?.(agent)}>
              <IonIcon icon={pencil} slot="start" />
              <IonLabel>Edit Agent</IonLabel>
            </IonItem>
            <IonItem button onClick={() => onDelete?.(agent)} className="text-destructive">
              <IonIcon icon={trash} slot="start" />
              <IonLabel>Delete Agent</IonLabel>
            </IonItem>
          </IonList>
        </IonPopover>
      </IonCardContent>
    </IonCard>
  );
};