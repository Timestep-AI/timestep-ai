import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { SpanTreeRow } from '@/components/SpanTreeRow';
import { SpanDetails } from '@/components/SpanDetails';
import { Trace, Span } from '@/types/trace';
import { tracesService } from '@/services/tracesService';
import { spansService } from '@/services/spansService';
import { Activity, Clock, CheckCircle, XCircle, AlertTriangle, Layers } from 'lucide-react';
import { useIsMobile } from '@/hooks/use-mobile';

export const TracePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const isMobile = useIsMobile();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);
  const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
  const [loading, setLoading] = useState(true);
  const [spansLoading, setSpansLoading] = useState(true);
  const [expandedSpans, setExpandedSpans] = useState<Set<string>>(new Set());

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
    setSelectedSpan(span);
  };

  const handleBackToSpans = () => {
    setSelectedSpan(null);
  };

  const handleToggleExpanded = (spanId: string) => {
    setExpandedSpans(prev => {
      const newSet = new Set(prev);
      if (newSet.has(spanId)) {
        newSet.delete(spanId);
      } else {
        newSet.add(spanId);
      }
      return newSet;
    });
  };

  // Build span tree and filter visible spans
  const getVisibleSpans = (spans: Span[]) => {
    // Build parent-child map
    const childrenMap = new Map<string, Span[]>();
    const parentMap = new Map<string, string>();
    
    spans.forEach(span => {
      if (span.parentId) {
        parentMap.set(span.id, span.parentId);
        if (!childrenMap.has(span.parentId)) {
          childrenMap.set(span.parentId, []);
        }
        childrenMap.get(span.parentId)!.push(span);
      }
    });

    // Determine which spans are visible
    const visibleSpans: Array<{span: Span, level: number, hasChildren: boolean}> = [];
    
    const addSpanAndChildren = (span: Span, level: number) => {
      const hasChildren = childrenMap.has(span.id);
      const isExpanded = expandedSpans.has(span.id);
      
      visibleSpans.push({ span, level, hasChildren });
      
      // Add children if expanded
      if (hasChildren && isExpanded) {
        const children = childrenMap.get(span.id) || [];
        children.forEach(child => addSpanAndChildren(child, level + 1));
      }
    };
    
    // Add root spans (those without parents)
    const rootSpans = spans.filter(span => !span.parentId);
    rootSpans.forEach(span => addSpanAndChildren(span, 0));
    
    return visibleSpans;
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
    >
      {trace && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Clock className="w-4 h-4 flex-shrink-0" />
              <span>Duration: {formatDuration(trace.duration_ms)}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Activity className="w-4 h-4 flex-shrink-0" />
              <span>{trace.handoff_count} handoff{trace.handoff_count !== 1 ? 's' : ''}</span>
            </div>
            
            <div className="flex items-center space-x-2 text-sm text-text-tertiary">
              <Layers className="w-4 h-4 flex-shrink-0" />
              <span>{trace.tool_count} tool{trace.tool_count !== 1 ? 's' : ''}</span>
            </div>
            
            {trace.first_5_agents && trace.first_5_agents.length > 0 && (
              <div className="flex items-center space-x-2 text-sm text-text-tertiary">
                <Activity className="w-4 h-4 flex-shrink-0" />
                <span>{trace.first_5_agents.length} agent{trace.first_5_agents.length > 1 ? 's' : ''}</span>
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
            ) : isMobile ? (
              // Mobile: Single column layout with modal-like span details
              selectedSpan ? (
                <SpanDetails 
                  span={selectedSpan} 
                  onBack={handleBackToSpans}
                  isMobile={true}
                />
              ) : (
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-y-auto max-h-[600px]">
                    {(() => {
                      const visibleSpans = getVisibleSpans(spans);
                      const maxDuration = Math.max(...spans.map(s => s.duration));
                      
                      return visibleSpans.map(({ span, level, hasChildren }) => (
                        <SpanTreeRow
                          key={span.id}
                          span={span}
                          onSelect={handleSpanSelect}
                          maxDuration={maxDuration}
                          isSelected={false}
                          level={level}
                          hasChildren={hasChildren}
                          isExpanded={expandedSpans.has(span.id)}
                          onToggleExpanded={handleToggleExpanded}
                        />
                      ));
                    })()}
                  </div>
                </div>
              )
            ) : (
              // Desktop: Two panel layout
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 h-[600px]">
                {/* Left Panel - Spans List */}
                <div className="bg-card border border-border rounded-xl overflow-hidden">
                  <div className="overflow-y-auto h-full">
                    {(() => {
                      const visibleSpans = getVisibleSpans(spans);
                      const maxDuration = Math.max(...spans.map(s => s.duration));
                      
                      return visibleSpans.map(({ span, level, hasChildren }) => (
                        <SpanTreeRow
                          key={span.id}
                          span={span}
                          onSelect={handleSpanSelect}
                          maxDuration={maxDuration}
                          isSelected={selectedSpan?.id === span.id}
                          level={level}
                          hasChildren={hasChildren}
                          isExpanded={expandedSpans.has(span.id)}
                          onToggleExpanded={handleToggleExpanded}
                        />
                      ));
                    })()}
                  </div>
                </div>

                {/* Right Panel - Span Details */}
                <div className="bg-card border border-border rounded-xl p-6 overflow-y-auto">
                  {selectedSpan ? (
                    <SpanDetails span={selectedSpan} />
                  ) : (
                    <div className="text-center py-12">
                      <Layers className="w-12 h-12 text-text-tertiary mx-auto mb-4" />
                      <h3 className="text-lg font-semibold text-text-primary mb-2">
                        Select a span
                      </h3>
                      <p className="text-text-secondary">
                        Click on a span from the left to view its details.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}
    </ItemPage>
  );
};

export default TracePage;