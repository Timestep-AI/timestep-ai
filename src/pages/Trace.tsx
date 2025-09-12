import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { SpanRow } from '@/components/SpanRow';
import { Trace, Span } from '@/types/trace';
import { tracesService } from '@/services/tracesService';
import { spansService } from '@/services/spansService';
import { Activity, Clock, CheckCircle, XCircle, AlertTriangle, Layers } from 'lucide-react';

export const TracePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(true);
  const [spansLoading, setSpansLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTrace(id);
      loadSpans(id);
    }
  }, [id]);

  const loadTrace = async (traceId: string) => {
    try {
      setLoading(true);
      const traceData = await tracesService.getById(traceId);
      setTrace(traceData || null);
    } catch (error) {
      console.error('Failed to load trace:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSpans = async (traceId: string) => {
    try {
      setSpansLoading(true);
      const spansData = await spansService.getByTraceId(traceId);
      setSpans(spansData);
    } catch (error) {
      console.error('Failed to load spans:', error);
    } finally {
      setSpansLoading(false);
    }
  };

  const handleEdit = () => {
    // TODO: Implement edit functionality
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

  const handleSpanSelect = (span: Span) => {
    // In a real app, this might navigate to a span detail page
    console.log('Selected span:', span);
  };

  const formatDuration = (duration: number) => {
    if (duration < 1000) {
      return `${duration}ms`;
    } else if (duration < 60000) {
      return `${(duration / 1000).toFixed(1)}s`;
    } else {
      return `${(duration / 60000).toFixed(1)}m`;
    }
  };

  const getStatusBadge = () => {
    switch (trace?.status) {
      case 'ok':
        return <Badge className="bg-emerald-50 text-emerald-600 border-emerald-200"><CheckCircle className="w-3 h-3 mr-1" />Success</Badge>;
      case 'error':
        return <Badge className="bg-red-50 text-red-600 border-red-200"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
      case 'timeout':
        return <Badge className="bg-orange-50 text-orange-600 border-orange-200"><AlertTriangle className="w-3 h-3 mr-1" />Timeout</Badge>;
      default:
        return null;
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
              <span>Duration: {formatDuration(trace.duration)}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span>{trace.spanCount} spans</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Activity className="w-4 h-4 flex-shrink-0" />
              <span>{trace.serviceCount} services</span>
            </div>
            
            {trace.errorCount > 0 && (
              <div className="flex items-center space-x-2 text-sm text-red-600">
                <XCircle className="w-4 h-4 flex-shrink-0" />
                <span>{trace.errorCount} error{trace.errorCount > 1 ? 's' : ''}</span>
              </div>
            )}
          </div>

          {/* Spans */}
          <div className="border-t border-border pt-6">
            <h2 className="text-xl font-semibold text-text-primary mb-4">Spans</h2>
            
            {spansLoading ? (
              <div className="flex items-center justify-center py-12">
                <div className="text-text-secondary">Loading spans...</div>
              </div>
            ) : spans.length === 0 ? (
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
                {spans.map((span) => (
                  <SpanRow
                    key={span.id}
                    span={span}
                    onSelect={handleSpanSelect}
                  />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default TracePage;