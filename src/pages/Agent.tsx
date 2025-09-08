import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Layout } from '@/components/Layout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ArrowLeft, User, Calendar, Cpu, Edit, Trash2 } from 'lucide-react';
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

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-text-secondary">Loading agent...</div>
        </div>
      </Layout>
    );
  }

  if (!agent) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-text-secondary mb-4">Agent not found</div>
          <Button onClick={() => navigate('/agents')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agents
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <Layout>
      <div className="space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            onClick={() => navigate('/agents')}
            className="p-2"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Agents
          </Button>
          
          <div className="flex items-center space-x-2">
            <Button onClick={handleEdit} variant="outline" size="sm">
              <Edit className="w-4 h-4 mr-2" />
              Edit
            </Button>
            <Button onClick={handleDelete} variant="destructive" size="sm">
              <Trash2 className="w-4 h-4 mr-2" />
              Delete
            </Button>
          </div>
        </div>

        {/* Agent Details */}
        <div className="bg-card border border-border rounded-xl p-6">
          <div className="flex items-start space-x-4 mb-6">
            <div className="w-16 h-16 bg-gradient-primary rounded-xl flex items-center justify-center flex-shrink-0">
              <User className="w-8 h-8 text-primary-foreground" />
            </div>
            
            <div className="flex-1">
              <div className="flex items-start justify-between mb-2">
                <h1 className="text-2xl font-bold text-text-primary">
                  {agent.name}
                </h1>
                {agent.status === 'handoff' && (
                  <Badge variant="secondary">
                    Handoff
                  </Badge>
                )}
              </div>
              
              {agent.description && (
                <p className="text-text-secondary mb-4">
                  {agent.description}
                </p>
              )}
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                  <Calendar className="w-4 h-4 flex-shrink-0" />
                  <span>Created: {agent.createdAt}</span>
                </div>
                
                <div className="flex items-center space-x-2">
                  {agent.model ? (
                    <Badge className="bg-info/10 text-info border-info/20">
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
            </div>
          </div>
        </div>
      </div>
    </Layout>
  );
};

export default Agent;