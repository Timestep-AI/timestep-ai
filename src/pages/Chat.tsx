import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { agentsService } from '@/services/agentsService';
import { Agent } from '@/types/agent';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Bot, MessageCircle } from 'lucide-react';

const Chat = () => {
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [selectedAgent, setSelectedAgent] = useState<Agent | null>(null);
  const [loadingAgents, setLoadingAgents] = useState(false);

  // Get server base URL
  const getServerBaseUrl = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || "https://ohzbghitbjryfpmucgju.supabase.co";
    return `${supabaseUrl}/functions/v1/server`;
  };

  // Load agents
  const loadAgents = async () => {
    try {
      setLoadingAgents(true);
      const agentsData = await agentsService.getAll();
      setAgents(agentsData);
      
      // Set default agent (Personal Assistant) if available
      // TEMPORARILY DISABLED: Let user manually select agent for testing
      // const defaultAgent = agentsData.find(agent => agent.id === '00000000-0000-0000-0000-000000000000');
      // if (defaultAgent) {
      //   setSelectedAgent(defaultAgent);
      // } else if (agentsData.length > 0) {
      //   setSelectedAgent(agentsData[0]);
      // }
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

  // ChatKit configuration
  const { control } = useChatKit({
    api: {
      url: selectedAgent ? `${getServerBaseUrl()}/agents/${selectedAgent.id}/chatkit` : `${getServerBaseUrl()}/api/chatkit`,

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

  if (!isAuthenticated) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Initializing chat...</p>
        </div>
      </div>
    );
  }

  // Show agent selection if no agent is selected or still loading
  if (loadingAgents || !selectedAgent) {
    return (
      <div className="h-screen w-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-2xl">
          <div className="text-center mb-8">
            <h1 className="text-3xl font-bold mb-2">Welcome to Timestep AI</h1>
            <p className="text-muted-foreground">Choose an agent to start chatting</p>
          </div>
          
          {loadingAgents ? (
            <div className="text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
              <p className="text-muted-foreground">Loading agents...</p>
            </div>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              {agents.map((agent) => (
                <Card 
                  key={agent.id} 
                  className={`cursor-pointer transition-all hover:shadow-md ${
                    selectedAgent?.id === agent.id ? 'ring-2 ring-primary' : ''
                  }`}
                  onClick={() => setSelectedAgent(agent)}
                >
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bot className="w-5 h-5" />
                      {agent.name}
                    </CardTitle>
                    <CardDescription>
                      {agent.description || 'AI Agent'}
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <Button 
                      className="w-full" 
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedAgent(agent);
                      }}
                    >
                      <MessageCircle className="w-4 h-4 mr-2" />
                      Start Chatting
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen">
      <ChatKit 
        control={control} 
        className="h-full w-full" 
      />
    </div>
  );
};

export default Chat;
