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

import { Agent } from '@/types/agent';

interface IonicAgentCardProps {
  agent: Agent;
  onEdit?: (agent: Agent) => void;
  onDelete?: (agent: Agent) => void;
}

export const IonicAgentCard = ({ agent, onEdit, onDelete }: IonicAgentCardProps) => {
  const [isPopoverOpen, setIsPopoverOpen] = useState(false);

  return (
    <IonCard 
      className="bg-card border border-border rounded-lg hover:bg-surface-elevated transition-all duration-200 group mb-2"
      style={{ '--background': 'hsl(var(--card))', '--color': 'hsl(var(--card-foreground))' }}
    >
      <IonCardContent className="p-4" style={{ '--background': 'hsl(var(--card))' }}>
        <div className="flex items-center justify-between">
          {/* Left side - Avatar and info */}
          <div className="flex items-center space-x-3 flex-1 min-w-0">
            <div className="w-8 h-8 bg-gradient-primary rounded-lg flex items-center justify-center flex-shrink-0">
              <IonIcon icon={person} className="text-white text-sm" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center space-x-2 mb-1">
                <h3 className="font-semibold text-text-primary truncate text-sm">
                  {agent.name}
                </h3>
                {agent.status === 'handoff' && (
                  <IonChip className="text-xs bg-secondary text-secondary-foreground flex-shrink-0 h-5">
                    Handoff
                  </IonChip>
                )}
              </div>
              {agent.description && (
                <p className="text-xs text-text-secondary line-clamp-1 mb-1">
                  {agent.description}
                </p>
              )}
              <div className="flex items-center space-x-1 text-xs text-text-tertiary">
                <IonIcon icon={calendar} className="text-xs" />
                <span className="truncate">Created: {agent.createdAt}</span>
              </div>
            </div>
          </div>
          
          {/* Right side - Model and actions */}
          <div className="flex items-center space-x-2 flex-shrink-0">
            <div className="flex-shrink-0">
              {agent.model ? (
                <IonChip className="bg-info/10 text-info border-info/20 text-xs h-5">
                  <IonLabel className="text-xs">{agent.model}</IonLabel>
                </IonChip>
              ) : (
                <IonChip color="medium" outline className="text-text-tertiary text-xs h-5">
                  <IonLabel className="text-xs">No Model</IonLabel>
                </IonChip>
              )}
            </div>
            
            <IonButton 
              fill="clear" 
              size="small"
              id={`trigger-${agent.id}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary flex-shrink-0 w-8 h-8"
            >
              <IonIcon icon={ellipsisHorizontal} className="text-sm" />
            </IonButton>
          </div>
        </div>
        
        <IonPopover 
          trigger={`trigger-${agent.id}`} 
          isOpen={isPopoverOpen}
          onDidDismiss={() => setIsPopoverOpen(false)}
          className="dark-popover"
        >
          <IonList style={{ '--background': 'hsl(var(--surface))', '--color': 'hsl(var(--foreground))' }}>
            <IonItem 
              button 
              onClick={() => onEdit?.(agent)}
              style={{ '--background': 'hsl(var(--surface))', '--color': 'hsl(var(--foreground))' }}
              className="hover:bg-surface-elevated"
            >
              <IonIcon icon={pencil} slot="start" className="text-text-secondary" />
              <IonLabel className="text-text-primary">Edit Agent</IonLabel>
            </IonItem>
            <IonItem 
              button 
              onClick={() => onDelete?.(agent)} 
              style={{ '--background': 'hsl(var(--surface))', '--color': 'hsl(var(--destructive))' }}
              className="hover:bg-destructive/10"
            >
              <IonIcon icon={trash} slot="start" className="text-destructive" />
              <IonLabel className="text-destructive">Delete Agent</IonLabel>
            </IonItem>
          </IonList>
        </IonPopover>
      </IonCardContent>
    </IonCard>
  );
};