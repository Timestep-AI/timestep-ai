import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { SpanRow } from '@/components/SpanRow';
import { Trace, Span } from '@/types/trace';
import { tracesService } from '@/services/tracesService';
import { spansService } from '@/services/spansService';
import { Activity, Clock, Hash, Layers, Bot } from 'lucide-react';

export const TracePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadTraceAndSpans = async () => {
      if (!id) return;
      
      try {
        setLoading(true);
        const [traceData, spansData] = await Promise.all([
          tracesService.getById(id),
          spansService.getByTraceId(id)
        ]);
        
        setTrace(traceData || null);
        setSpans(spansData);
      } catch (error) {
        console.error('Error loading trace and spans:', error);
      } finally {
        setLoading(false);
      }
    };

    loadTraceAndSpans();
  }, [id]);

  const handleEdit = () => {
    console.log('Edit trace:', trace);
  };

  const handleDelete = async () => {
    if (!trace) return;
    
    try {
      await tracesService.delete(trace.id);
      navigate('/traces');
    } catch (error) {
      console.error('Error deleting trace:', error);
    }
  };

  const handleEditSpan = (span: Span) => {
    console.log('Edit span:', span);
  };

  const handleDeleteSpan = async (span: Span) => {
    try {
      await spansService.delete(span.id);
      const updatedSpans = await spansService.getByTraceId(id!);
      setSpans(updatedSpans);
    } catch (error) {
      console.error('Error deleting span:', error);
    }
  };

  const handleSpanSelect = (span: Span) => {
    // Navigate to span details if needed
    console.log('Selected span:', span);
  };

  const getStatusBadge = () => {
    if (!trace) return null;
    
    const hasErrors = spans.some(span => span.status === 'error');
    if (hasErrors) {
      return <Badge variant="destructive">Error</Badge>;
    }
    
    const isRunning = spans.some(span => span.status === 'running');
    if (isRunning) {
      return <Badge className="bg-warning/10 text-warning border-warning/20">Running</Badge>;
    }
    
    return <Badge className="bg-success/10 text-success border-success/20">Completed</Badge>;
  };

  const formatDuration = (duration: number | null) => {
    if (duration === null) return 'N/A';
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`;
    } else {
      return `${(duration / 60000).toFixed(1)}m`;
    }
  };

  return (
    <ItemPage
      loading={loading}
      item={trace}
      itemType="Trace"
      backPath="/traces"
      backLabel="Back to Traces"
      icon={<Activity className="w-8 h-8 text-primary-foreground" />}
      onEdit={handleEdit}
      onDelete={handleDelete}
      statusBadge={getStatusBadge()}
    >
      {trace && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>Duration: {formatDuration(trace.duration_ms)}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Hash className="w-4 h-4 flex-shrink-0" />
              <span>{spans.length} spans</span>
            </div>

            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Activity className="w-4 h-4 flex-shrink-0" />
              <span>{trace.handoff_count} handoff{trace.handoff_count !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span>{trace.tool_count} tool{trace.tool_count !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {/* Spans */}
          <div className="border-t border-border pt-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Spans</h2>
            
            {spans.length === 0 ? (
              <div className="text-center py-12">
                <div className="w-16 h-16 bg-surface-elevated rounded-full flex items-center justify-center mx-auto mb-4">
                  <Layers className="text-4xl text-text-tertiary" />
                </div>
                <h3 className="text-lg font-semibold text-text-primary mb-2">
                  No spans found
                </h3>
                <p className="text-text-secondary">
                  This trace doesn't contain any spans yet.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {spans.map((span) => {
                  const maxDuration = Math.max(...spans.map(s => s.duration));
                  return (
                    <SpanRow
                      key={span.id}
                      span={span}
                      onSelect={handleSpanSelect}
                      maxDuration={maxDuration}
                    />
                  );
                })}
              </div>
            )}
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default TracePage;