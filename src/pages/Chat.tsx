import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { ChatKit, useChatKit } from '@openai/chatkit-react';
import { agentsService } from '@/services/agentsService';
import { Agent } from '@/types/agent';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Bot } from 'lucide-react';

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
  const handleAgentChange = (agentId: string) => {
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
      <div className="h-screen w-screen flex items-center justify-center bg-background">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">
            {!isAuthenticated ? 'Initializing chat...' : 'Loading agents...'}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen relative">
      {/* Agent Selection Dropdown */}
      <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50">
        <div className="flex items-center gap-2 bg-background/95 backdrop-blur-sm border rounded-lg px-3 py-2 shadow-lg">
          <Bot className="w-4 h-4 text-muted-foreground" />
          <Select value={selectedAgent?.id || ""} onValueChange={handleAgentChange}>
            <SelectTrigger className="w-48 h-8 text-sm border-0 bg-transparent shadow-none">
              <SelectValue placeholder="Select Agent" />
            </SelectTrigger>
            <SelectContent>
              {agents.map((agent) => (
                <SelectItem key={agent.id} value={agent.id}>
                  {agent.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>
      
      <ChatKit 
        key={selectedAgent?.id || 'default'} 
        control={control} 
        className="h-full w-full" 
      />
    </div>
  );
};

export default Chat;
