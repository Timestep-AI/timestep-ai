import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { agentsService } from '@/services/agentsService';
import { Agent } from '@/types/agent';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonSelect, IonSelectOption, IonIcon, IonSpinner, IonButtons } from '@ionic/react';
import { personCircleOutline } from 'ionicons/icons';

const Chat = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Get server base URL
  const getServerBaseUrl = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ohzbghitbjryfpmucgju.supabase.co";
    return `${supabaseUrl}/functions/v1/agent-chat`;
  };

  // Load agents
  const loadAgents = async () => {
    try {
      setLoadingAgents(true);
      const agentsData = await agentsService.getAll();
      setAgents(agentsData);
      
      // Auto-select the first agent if available
      if (agentsData.length > 0 && !selectedAgent) {
        setSelectedAgent(agentsData[0]);
      }
    } catch (error) {
      console.error('Error loading agents:', error);
      toast.error('Failed to load agents');
    } finally {
      setLoadingAgents(false);
    }
  };

  // Anonymous sign-in and load agents on component mount
  useEffect(() => {
    const signInAnonymously = async () => {
      try {
        const { data, error } = await supabase.auth.signInAnonymously();
        if (error) {
          console.error('Anonymous sign-in error:', error);
          toast.error('Failed to initialize chat');
        } else {
          console.log('Anonymous sign-in successful:', data);
          setIsAuthenticated(true);
          // Load agents after successful authentication
          await loadAgents();
        }
      } catch (error) {
        console.error('Anonymous sign-in error:', error);
        toast.error('Failed to initialize chat');
      }
    };

    signInAnonymously();
  }, []);

  // Helper function to get auth headers
  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    
    if (!session?.access_token) {
      throw new Error('No valid session found. Please sign in.');
    }
    
    return {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${session.access_token}`
    };
  };

  // Handle agent switching
  const handleAgentChange = (e: CustomEvent) => {
    const agentId = e.detail.value;
    const agent = agents.find(a => a.id === agentId);
    if (agent) {
      console.log('Switching to agent:', agent.name, 'ID:', agent.id);
      setSelectedAgent(agent);
      // Show a toast notification when switching agents
      toast.success(`Switched to ${agent.name}`);
    }
  };

  // ChatKit configuration
  const chatKitUrl = selectedAgent ? `${getServerBaseUrl()}/agents/${selectedAgent.id}/chatkit` : `${getServerBaseUrl()}/api/chatkit`;
  console.log('ChatKit URL:', chatKitUrl, 'Selected Agent:', selectedAgent?.name);
  
  const { control } = useChatKit({
    api: {
      url: chatKitUrl,

      // Custom fetch with auth injection
      async fetch(url: string, options: RequestInit) {
        const auth = await getAuthHeaders();
        
        return fetch(url, {
          ...options,
          headers: {
            ...options.headers,
            ...auth,
          },
        });
      },

      // Upload strategy for attachments
      uploadStrategy: {
        type: "direct",
        uploadUrl: selectedAgent ? `${getServerBaseUrl()}/agents/${selectedAgent.id}/chatkit/upload` : `${getServerBaseUrl()}/api/chatkit/upload`,
      },

      // Domain key for security
      domainKey: "localhost-dev",
    },
    composer: {
      placeholder: "Type your question…",
      tools: [{ id: "rate", label: "Rate", icon: "star", pinned: true }],
    },
    header: {
      leftAction: {
        icon: "settings-cog",
        onClick: () => alert("Profile settings"),
      },
      rightAction: {
        icon: "home",
        onClick: () => alert("Home"),
      },
    },
    startScreen: {
      greeting: selectedAgent ? `Welcome to Timestep AI! You're chatting with ${selectedAgent.name}` : "Welcome to Timestep AI!",
      prompts: [
        {
          prompt: "How many R's are there in the word 'strawberry'?", label: "How many R's are there in the word 'strawberry'?"
        },
        {
          prompt: "What's the weather in Oakland and San Francisco?", label: "What's the weather in Oakland and San Francisco?"
        }
      ]
    },
    theme: {
      colorScheme: "dark",
      color: { accent: { primary: "#D7263D", level: 2 } },
      radius: "round",
      density: "normal",
      typography: { fontFamily: "Open Sans, sans-serif" },
    },
  });

  console.log('ChatKit: Control object:', control);

  if (!isAuthenticated || loadingAgents) {
    return (
      <IonPage>
        <IonContent className="ion-padding">
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '100%' }}>
            <IonSpinner name="crescent" />
            <p style={{ marginTop: '1rem' }}>
              {!isAuthenticated ? 'Initializing chat...' : 'Loading agents...'}
            </p>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonTitle>Timestep AI</IonTitle>
          <IonButtons slot="end">
            <IonIcon icon={personCircleOutline} style={{ fontSize: '24px', marginRight: '8px' }} />
            <IonSelect
              value={selectedAgent?.id || ""}
              placeholder="Select Agent"
              onIonChange={handleAgentChange}
              interface="popover"
            >
              {agents.map((agent) => (
                <IonSelectOption key={agent.id} value={agent.id}>
                  {agent.name}
                </IonSelectOption>
              ))}
            </IonSelect>
          </IonButtons>
        </IonToolbar>
      </IonHeader>
      <IonContent fullscreen>
        <ChatKit
          key={selectedAgent?.id || 'default'}
          control={control}
          className="h-full w-full"
        />
      </IonContent>
    </IonPage>
  );
};

export default Chat;
