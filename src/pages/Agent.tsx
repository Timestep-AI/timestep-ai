import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { User, Calendar, Cpu } from 'lucide-react';
import { Agent as AgentType } from '@/types/agent';
import { agentsService } from '@/services/agentsService';

export const Agent = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [agent, setAgent] = useState<AgentType | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadAgent = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const agents = await agentsService.getAll();
        const foundAgent = agents.find(a => a.id === id);
        setAgent(foundAgent || null);
      } catch (error) {
        console.error('Error loading agent:', error);
      } finally {
        setLoading(false);
      }
    };

    loadAgent();
  }, [id]);

  const handleEdit = () => {
    // TODO: Implement edit functionality
    console.log('Edit agent:', agent);
  };

  const handleDelete = async () => {
    if (!agent) return;
    
    try {
      await agentsService.delete(agent.id);
      navigate('/agents');
    } catch (error) {
      console.error('Error deleting agent:', error);
    }
  };

  const statusBadge = agent?.isHandoff ? (
    <Badge variant="secondary">Handoff</Badge>
  ) : null;

  return (
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
  );
};

export default Agent;