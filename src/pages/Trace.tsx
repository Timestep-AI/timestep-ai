import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ItemPage } from '@/components/ItemPage';
import { Badge } from '@/components/ui/badge';
import { SpanTreeRow } from '@/components/SpanTreeRow';
import { Trace, Span } from '@/types/trace';
import { tracesService } from '@/services/tracesService';
import { spansService } from '@/services/spansService';
import { Activity, Clock, CheckCircle, XCircle, AlertTriangle, Layers } from 'lucide-react';

export const TracePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
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

          {/* Spans - Two Panel Layout */}
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
                    <div className="space-y-6">
                      <div>
                        <h3 className="text-lg font-semibold text-text-primary mb-2">
                          {selectedSpan.operationName}
                        </h3>
                        <p className="text-text-secondary text-sm mb-4">
                          {selectedSpan.serviceName}
                        </p>
                        <div className="flex items-center space-x-2">
                          {selectedSpan.status === 'ok' && <CheckCircle className="w-4 h-4 text-emerald-500" />}
                          {selectedSpan.status === 'error' && <XCircle className="w-4 h-4 text-red-500" />}
                          {selectedSpan.status === 'timeout' && <AlertTriangle className="w-4 h-4 text-orange-500" />}
                          <span className="text-sm capitalize">{selectedSpan.status}</span>
                        </div>
                      </div>

                      {/* Properties */}
                      <div>
                        <h4 className="font-medium text-text-primary mb-3">Properties</h4>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-text-tertiary">Duration</span>
                            <span className="text-text-primary">{formatDuration(selectedSpan.duration)}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-tertiary">Start Time</span>
                            <span className="text-text-primary">{new Date(selectedSpan.startTime).toLocaleString()}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-text-tertiary">End Time</span>
                            <span className="text-text-primary">{new Date(selectedSpan.endTime).toLocaleString()}</span>
                          </div>
                          {selectedSpan.parentId && (
                            <div className="flex justify-between">
                              <span className="text-text-tertiary">Parent Span</span>
                              <span className="text-text-primary font-mono text-xs">{selectedSpan.parentId}</span>
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tags */}
                      {selectedSpan.tags && Object.keys(selectedSpan.tags).length > 0 && (
                        <div>
                          <h4 className="font-medium text-text-primary mb-3">Tags</h4>
                          <div className="bg-surface rounded-lg p-3 font-mono text-xs overflow-x-auto">
                            <pre className="text-text-primary">
                              {JSON.stringify(selectedSpan.tags, null, 2)}
                            </pre>
                          </div>
                        </div>
                      )}

                      {/* Logs */}
                      {selectedSpan.logs && selectedSpan.logs.length > 0 && (
                        <div>
                          <h4 className="font-medium text-text-primary mb-3">Logs</h4>
                          <div className="space-y-2">
                            {selectedSpan.logs.map((log, index) => (
                              <div key={index} className="bg-surface rounded-lg p-3">
                                <div className="flex items-center justify-between mb-1">
                                  <span className="text-xs text-text-tertiary">
                                    {new Date(log.timestamp).toLocaleString()}
                                  </span>
                                  <Badge 
                                    variant={log.level === 'error' ? 'destructive' : 'secondary'}
                                    className="text-xs"
                                  >
                                    {log.level}
                                  </Badge>
                                </div>
                                <p className="text-sm text-text-primary">{log.message}</p>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
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