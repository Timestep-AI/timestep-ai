import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, Cpu } from 'lucide-react';
import { Agent as AgentType } from '@/types/agent';
import { agentsService } from '@/services/agentsService';
import { toolsService } from '@/services/toolsService';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export const Agent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentType | null>(null);
  const [loading, setLoading] = useState(true);
  const [allAgents, setAllAgents] = useState<AgentType[]>([]);
  const [allTools, setAllTools] = useState<any[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);

  useEffect(() => {
    const loadAgent = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        // Fetch all agents and tools to resolve names
        const [agents, tools] = await Promise.all([
          agentsService.getAll(),
          toolsService.getAll().catch(() => []) // Handle potential tools service errors
        ]);
        
        const foundAgent = agents.find(a => a.id === id);
        setAgent(foundAgent || null);
        setAllAgents(agents);
        setAllTools(tools);
      } catch (error) {
        console.error('Error loading agent:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAgent();
  }, [id]);

  // Helper function to get agent name by ID
  const getAgentName = (agentId: string) => {
    const foundAgent = allAgents.find(a => a.id === agentId);
    return foundAgent?.name || agentId;
  };

  // Helper function to get tool name by ID
  const getToolName = (toolId: string) => {
    // Tool IDs are in format: mcp-server-id.tool-name
    // Extract just the tool name part after the last dot
    const lastDotIndex = toolId.lastIndexOf('.');
    if (lastDotIndex !== -1 && lastDotIndex < toolId.length - 1) {
      return toolId.substring(lastDotIndex + 1);
    }
    // Fallback to trying to find in tools list or return the full ID
    const foundTool = allTools.find(t => t.id === toolId);
    return foundTool?.name || toolId;
  };

  const handleEdit = () => {
    // TODO: Implement edit functionality
    console.log('Edit agent:', agent);
  };

  const handleDelete = async () => {
    setDeleteDialogOpen(true);
  };

  const confirmDelete = async () => {
    if (!agent) return;
    
    try {
      const { error } = await supabase
        .from('agents')
        .delete()
        .eq('id', agent.id)
        .eq('user_id', (await supabase.auth.getUser()).data.user?.id);

      if (error) {
        console.error('Error deleting agent:', error);
        toast.error('Failed to delete agent');
        return;
      }

      toast.success('Agent deleted successfully');
      navigate('/agents');
    } catch (error) {
      console.error('Error deleting agent:', error);
      toast.error('Failed to delete agent');
    } finally {
      setDeleteDialogOpen(false);
    }
  };

  const statusBadge = agent?.isHandoff ? (
    <Badge variant="secondary">Handoff</Badge>
  ) : null;

  return (
    <>
      <ItemPage
        loading={loading}
        item={agent}
        itemType="Agent"
        backPath="/agents"
        backLabel="Back to Agents"
        icon={<User className="w-8 h-8 text-primary-foreground" />}
        onEdit={handleEdit}
        onDelete={handleDelete}
        statusBadge={statusBadge}
      >
        {agent && (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                <Calendar className="w-4 h-4 flex-shrink-0" />
                <span>Created: {agent.createdAt}</span>
              </div>
              
              <div className="flex items-center space-x-2">
                {agent.model ? (
                  <Badge 
                    className="bg-info/10 text-info border-info/20 cursor-pointer hover:bg-info/20 transition-colors"
                    onClick={() => navigate(`/models/ollama-gpt-oss-20b`)}
                  >
                    <Cpu className="w-3 h-3 mr-1" />
                    {agent.model}
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-text-tertiary">
                    No Model
                  </Badge>
                )}
              </div>
            </div>

            {/* Instructions */}
            {agent.instructions && (
              <div className="border-t border-border pt-6 mb-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Instructions</h3>
                <div className="bg-surface/50 border border-border rounded-lg p-4">
                  <pre className="text-sm text-text-primary whitespace-pre-wrap font-sans leading-relaxed">
                    {agent.instructions}
                  </pre>
                </div>
              </div>
            )}

            {/* Handoff Description */}
            {agent.handoffDescription && (
              <div className="border-t border-border pt-6 mb-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">Handoff Description</h3>
                <div className="bg-surface/50 border border-border rounded-lg p-4">
                  <p className="text-sm text-text-primary leading-relaxed">
                    {agent.handoffDescription}
                  </p>
                </div>
              </div>
            )}

            {/* Handoffs */}
            {agent.handoffIds && agent.handoffIds.length > 0 && (
              <div className="border-t border-border pt-6 mb-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Handoffs ({agent.handoffIds.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {agent.handoffIds.map((handoffId) => (
                    <Badge 
                      key={handoffId}
                      variant="outline"
                      className="cursor-pointer hover:bg-primary/10 hover:border-primary/30 transition-colors"
                      onClick={() => navigate(`/agents/${handoffId}`)}
                    >
                      {getAgentName(handoffId)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}

            {/* Tools */}
            {agent.toolIds && agent.toolIds.length > 0 && (
              <div className="border-t border-border pt-6 mb-6">
                <h3 className="text-lg font-semibold text-text-primary mb-4">
                  Tools ({agent.toolIds.length})
                </h3>
                <div className="flex flex-wrap gap-2">
                  {agent.toolIds.map((toolId) => (
                    <Badge 
                      key={toolId}
                      className="bg-info/10 text-info border-info/20 cursor-pointer hover:bg-info/20 transition-colors"
                      onClick={() => navigate(`/tools/${encodeURIComponent(toolId)}`)}
                    >
                      {getToolName(toolId)}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            
            {/* Additional Details */}
            <div className="border-t border-border pt-6">
              <h3 className="text-lg font-semibold text-text-primary mb-4">Details</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="text-sm font-medium text-text-secondary">ID</label>
                  <p className="text-text-primary font-mono text-sm break-all">{agent.id}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-text-secondary">Status</label>
                  <p className="text-text-primary capitalize">{agent.status}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-text-secondary">Handoff Agent</label>
                  <p className="text-text-primary">{agent.isHandoff ? 'Yes' : 'No'}</p>
                </div>
              </div>
            </div>
          </>
        )}
      </ItemPage>

      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Agent</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete "{agent?.name}"? This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default Agent;