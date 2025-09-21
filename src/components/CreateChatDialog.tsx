import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Plus } from 'lucide-react';
import { toast } from 'sonner';
import { CreateChatRequest } from '@/types/chat';
import { chatsService } from '@/services/chatsService';
import { agentsService } from '@/services/agentsService';
import { Agent } from '@/types/agent';

interface CreateChatDialogProps {
  onChatCreated: () => void;
}

export const CreateChatDialog = ({ onChatCreated }: CreateChatDialogProps) => {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [agents, setAgents] = useState<Agent[]>([]);
  const [formData, setFormData] = useState<CreateChatRequest>({
    title: '',
    agentId: '',
    status: 'active'
  });

  useEffect(() => {
    const loadAgents = async () => {
      try {
        const fetchedAgents = await agentsService.getAll();
        console.log('CreateChatDialog: Loaded agents:', fetchedAgents);
        setAgents(fetchedAgents);
        // Auto-select first agent if available
        if (fetchedAgents.length > 0) {
          console.log('CreateChatDialog: Auto-selecting first agent:', fetchedAgents[0]);
          setFormData(prev => {
            const newFormData = { ...prev, agentId: fetchedAgents[0].id };
            console.log('CreateChatDialog: Auto-selected form data:', newFormData);
            return newFormData;
          });
        }
      } catch (error) {
        console.error('Error loading agents:', error);
        toast.error('Failed to load agents');
      }
    };

    if (open) {
      loadAgents();
    }
  }, [open]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    console.log('CreateChatDialog: Submitting form with data:', formData);
    
    if (!formData.title.trim()) {
      toast.error('Please enter a chat title');
      return;
    }
    
    if (!formData.agentId) {
      toast.error('Please select an agent');
      return;
    }

    console.log('CreateChatDialog: Form validation passed, creating chat...');
    setLoading(true);
    try {
      // Create the chat through the chats service
      console.log('CreateChatDialog: Calling chatsService.create with:', formData);
      const createdChat = await chatsService.create(formData);
      console.log('CreateChatDialog: Chat created successfully:', createdChat);
      toast.success('Chat created successfully');
      setOpen(false);
      setFormData({ title: '', agentId: '', status: 'active' });
      onChatCreated();
    } catch (error) {
      console.error('CreateChatDialog: Error creating chat:', error);
      toast.error('Failed to create chat');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenChange = (newOpen: boolean) => {
    setOpen(newOpen);
    if (!newOpen) {
      setFormData({ title: '', agentId: '', status: 'active' });
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button className="flex items-center gap-2">
          <Plus className="w-4 h-4" />
          New Chat
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Create New Chat</DialogTitle>
          <DialogDescription>
            Start a new conversation with an AI agent.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={handleSubmit}>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="title">Chat Title</Label>
              <Input
                id="title"
                placeholder="Enter chat title..."
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                disabled={loading}
              />
            </div>
            
            <div className="space-y-2">
              <Label htmlFor="agent">Agent</Label>
              <Select 
                value={formData.agentId} 
                onValueChange={(value) => {
                  console.log('CreateChatDialog: Agent selected:', value);
                  setFormData(prev => {
                    const newFormData = { ...prev, agentId: value };
                    console.log('CreateChatDialog: Updated form data:', newFormData);
                    return newFormData;
                  });
                }}
                disabled={loading}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select an agent..." />
                </SelectTrigger>
                <SelectContent>
                  {agents.map((agent) => {
                    console.log('CreateChatDialog: Rendering agent option:', agent);
                    return (
                      <SelectItem key={agent.id} value={agent.id}>
                        {agent.name || 'Unnamed Agent'} ({agent.id})
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={loading}>
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? 'Creating...' : 'Create Chat'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};