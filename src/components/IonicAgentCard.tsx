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
  IonList,
  IonButtons
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
      className="bg-card border border-border rounded-xl hover:bg-surface-elevated transition-all duration-200 group"
      style={{ '--background': 'hsl(var(--card))', '--color': 'hsl(var(--card-foreground))' }}
    >
      <IonCardContent className="p-4" style={{ '--background': 'hsl(var(--card))' }}>
        <IonItem 
          lines="none" 
          className="--padding-start: 0 --inner-padding-end: 0 bg-transparent"
          style={{ '--background': 'transparent', '--color': 'hsl(var(--card-foreground))' }}
        >
          <IonAvatar slot="start" className="w-10 h-10">
            <div className="w-full h-full bg-gradient-primary rounded-full flex items-center justify-center">
              <IonIcon icon={person} className="text-white text-lg" />
            </div>
          </IonAvatar>
          
          <IonLabel>
            <div className="flex items-center space-x-2 mb-1">
              <h3 className="font-semibold text-text-primary">
                {agent.name}
              </h3>
              {agent.status === 'handoff' && (
                <IonChip color="medium" className="text-xs bg-secondary text-secondary-foreground">
                  Handoff
                </IonChip>
              )}
            </div>
            
            {agent.description && (
              <p className="text-sm text-text-secondary mb-2 line-clamp-2">
                {agent.description}
              </p>
            )}
            
            <div className="flex items-center space-x-4 text-xs text-text-tertiary">
              <div className="flex items-center space-x-1">
                <IonIcon icon={calendar} className="text-xs" />
                <span>Created: {agent.createdAt}</span>
              </div>
            </div>
          </IonLabel>
          
          <div slot="end" className="flex items-center space-x-2">
            {agent.model ? (
              <IonChip className="bg-info/10 text-info border-info/20">
                <IonIcon icon={desktop} className="mr-1" />
                <IonLabel>{agent.model}</IonLabel>
              </IonChip>
            ) : (
              <IonChip color="medium" outline className="text-text-tertiary">
                <IonLabel>No Model</IonLabel>
              </IonChip>
            )}
            
            <IonButton 
              fill="clear" 
              size="small"
              id={`trigger-${agent.id}`}
              className="opacity-0 group-hover:opacity-100 transition-opacity text-text-secondary"
            >
              <IonIcon icon={ellipsisHorizontal} />
            </IonButton>
            
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
          </div>
        </IonItem>
      </IonCardContent>
    </IonCard>
  );
};