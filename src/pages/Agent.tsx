import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { agentsService } from '@/services/agentsService';
import type { AgentRecord } from '@/types/agent';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonSpinner,
  IonCard,
  IonCardHeader,
  IonCardTitle,
  IonCardContent,
  IonChip,
  IonLabel,
} from '@ionic/react';
import { arrowBack, chatbubbleEllipses } from 'ionicons/icons';

const Agent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentRecord | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAgent = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const data = await agentsService.getById(id);
        setAgent(data);
      } catch (error) {
        console.error('Error loading agent:', error);
        toast.error('Failed to load agent details');
      } finally {
        setLoading(false);
      }
    };

    loadAgent();
  }, [id]);

  const handleStartChat = () => {
    navigate(`/?agent=${id}`);
  };

  if (loading) {
    return (
      <IonPage>
        <IonContent>
          <div className="flex items-center justify-center h-full">
            <IonSpinner />
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (!agent) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton onClick={() => navigate('/agents')}>
                <IonIcon slot="icon-only" icon={arrowBack} />
              </IonButton>
            </IonButtons>
            <IonTitle>Agent Not Found</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent className="ion-padding">
          <p className="text-center text-muted-foreground">Agent not found</p>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => navigate('/agents')}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>{agent.name}</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleStartChat}>
              <IonIcon slot="icon-only" icon={chatbubbleEllipses} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        <div className="max-w-2xl mx-auto space-y-4">
          {agent.model && (
            <IonCard>
              <IonCardHeader>
                <IonCardTitle className="text-base">Model</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <code className="text-sm">{agent.model}</code>
              </IonCardContent>
            </IonCard>
          )}

          {agent.instructions && (
            <IonCard>
              <IonCardHeader>
                <IonCardTitle className="text-base">Instructions</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <p className="text-sm whitespace-pre-wrap">{agent.instructions}</p>
              </IonCardContent>
            </IonCard>
          )}

          {agent.tool_ids && agent.tool_ids.length > 0 && (
            <IonCard>
              <IonCardHeader>
                <IonCardTitle className="text-base">Tools ({agent.tool_ids.length})</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div className="flex flex-wrap gap-2">
                  {agent.tool_ids.map((toolId) => (
                    <IonChip key={toolId} color="primary">
                      <IonLabel>{toolId.split('.').pop()}</IonLabel>
                    </IonChip>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>
          )}

          {agent.handoff_ids && agent.handoff_ids.length > 0 && (
            <IonCard>
              <IonCardHeader>
                <IonCardTitle className="text-base">Handoffs ({agent.handoff_ids.length})</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <div className="flex flex-wrap gap-2">
                  {agent.handoff_ids.map((handoffId) => (
                    <IonChip key={handoffId} color="secondary">
                      <IonLabel>{handoffId.slice(0, 8)}</IonLabel>
                    </IonChip>
                  ))}
                </div>
              </IonCardContent>
            </IonCard>
          )}

          {agent.model_settings && Object.keys(agent.model_settings).length > 0 && (
            <IonCard>
              <IonCardHeader>
                <IonCardTitle className="text-base">Model Settings</IonCardTitle>
              </IonCardHeader>
              <IonCardContent>
                <pre className="text-xs overflow-x-auto">
                  {JSON.stringify(agent.model_settings, null, 2)}
                </pre>
              </IonCardContent>
            </IonCard>
          )}

          <IonCard>
            <IonCardHeader>
              <IonCardTitle className="text-base">Created</IonCardTitle>
            </IonCardHeader>
            <IonCardContent>
              <p className="text-sm">{new Date(agent.created_at).toLocaleString()}</p>
            </IonCardContent>
          </IonCard>

          <IonButton expand="block" onClick={handleStartChat}>
            <IonIcon slot="start" icon={chatbubbleEllipses} />
            Start Chat with {agent.name}
          </IonButton>
        </div>
      </IonContent>
    </IonPage>
  );
};

export default Agent;
