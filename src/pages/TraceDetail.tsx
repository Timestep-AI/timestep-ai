import { useEffect, useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { 
  IonPage, 
  IonHeader, 
  IonToolbar, 
  IonTitle, 
  IonContent, 
  IonCard, 
  IonCardHeader, 
  IonCardTitle, 
  IonCardContent, 
  IonList, 
  IonItem, 
  IonLabel, 
  IonChip, 
  IonSpinner, 
  IonButton, 
  IonIcon, 
  IonButtons,
  IonBackButton,
  IonRefresher,
  IonRefresherContent,
  IonAccordion,
  IonAccordionGroup
} from '@ionic/react';
import { 
  timeOutline, 
  checkmarkCircleOutline, 
  closeCircleOutline, 
  alertCircleOutline, 
  arrowBackOutline,
  refreshOutline,
  eyeOutline,
  chevronDownOutline,
  chevronForwardOutline,
  copyOutline,
  thumbsUpOutline,
  thumbsDownOutline,
  personOutline,
  chatbubbleOutline,
  globeOutline,
  ellipseOutline,
  downloadOutline
} from 'ionicons/icons';
import { TracesService, Trace, Span } from '@/services/tracesService';
import SidebarMenu from '@/components/SidebarMenu';

const TraceDetail = () => {
  const { traceId } = useParams<{ traceId: string }>();
  const navigate = useNavigate();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
      const [selectedSpan, setSelectedSpan] = useState<Span | null>(null);
      const [expandedAgents, setExpandedAgents] = useState<Set<string>>(new Set());
      const [propertiesExpanded, setPropertiesExpanded] = useState<boolean>(true);
      const [configurationExpanded, setConfigurationExpanded] = useState<boolean>(true);
      const [instructionsExpanded, setInstructionsExpanded] = useState<boolean>(true);
      const [inputExpanded, setInputExpanded] = useState<boolean>(true);
      const [outputExpanded, setOutputExpanded] = useState<boolean>(true);

  const fetchTraceDetails = async () => {
    if (!traceId) return;
    
    setLoading(true);
    setError(null);
    try {
      const data = await TracesService.getTraceDetail(traceId);
      setTrace(data.trace);
      setSpans(data.spans);
      
      // Initialize ALL spans as expanded
      if (data.spans.length > 0) {
        // Expand all spans by default
        setExpandedAgents(new Set(data.spans.map(span => span.id)));
        // Don't select any span - let user click to select
      }
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to fetch trace details';
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTraceDetails();
  }, [traceId]);

  const handleRefresh = async (event: CustomEvent) => {
    await fetchTraceDetails();
    event.detail.complete();
  };

  const formatDuration = (ms: number) => {
    return `${ms.toLocaleString()}ms`;
  };

  const exportTraceAsJSON = () => {
    if (!trace || !spans) return;
    
    const data = {
      trace,
      spans,
      exported_at: new Date().toISOString()
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `trace-${trace.id}-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Trace exported as JSON');
  };

  const getAgentSpan = () => {
    return spans.find(span => span.name.includes('Agent:'));
  };

  const getChildSpans = () => {
    const agentSpan = getAgentSpan();
    if (!agentSpan) return [];
    
    // Get all spans except the agent span itself
    return spans.filter(span => span.id !== agentSpan.id);
  };

  const buildSpanHierarchy = () => {
    const spanMap = new Map(spans.map(span => [span.id, span]));
    const rootSpans: Span[] = [];
    const childMap = new Map<string, Span[]>();

    // Build parent-child relationships
    spans.forEach(span => {
      if (span.parent_span_id && spanMap.has(span.parent_span_id)) {
        if (!childMap.has(span.parent_span_id)) {
          childMap.set(span.parent_span_id, []);
        }
        childMap.get(span.parent_span_id)!.push(span);
      } else {
        rootSpans.push(span);
      }
    });

    return { rootSpans, childMap };
  };

  const renderSpanHierarchy = (parentSpan: Span, level: number = 0) => {
    const { childMap } = buildSpanHierarchy();
    const children = childMap.get(parentSpan.id) || [];
    const hasChildren = children.length > 0;
    const isExpanded = expandedAgents.has(parentSpan.id) || (level > 0 && hasChildren);
    const maxDuration = Math.max(...spans.map(s => s.duration_ms), 1);
    const progressWidth = Math.min(100, (parentSpan.duration_ms / maxDuration) * 100);
    
    // Generate proper span name
    const getSpanDisplayName = (span: Span) => {
      if (span.name.includes('Agent:')) {
        return span.name.replace('Agent:', '').trim();
      }
      if (span.name.includes('POST')) {
        return 'POST /v1/responses';
      }
      if (span.name.includes('Handoff')) {
        return span.name;
      }
      // For placeholder spans
      if (span.attributes?.is_placeholder) {
        return 'Processing...';
      }
      // For generic span IDs, try to determine the type from attributes
      if (span.attributes?.span_type === 'agent') {
        return span.attributes?.agent_name || 'Agent';
      }
      if (span.attributes?.span_type === 'response') {
        return 'POST /v1/responses';
      }
      if (span.attributes?.span_type === 'handoff') {
        return `Handoff > ${span.attributes?.to_agent || 'Unknown'}`;
      }
      // For spans that are in progress and have generic IDs, show a more descriptive name
      if (span.status === 'unset' && span.duration_ms === 0 && span.name.startsWith('span_')) {
        return 'Processing...';
      }
      // Default fallback
      return span.name;
    };
    
    const displayName = getSpanDisplayName(parentSpan);
    // A span is in progress if it has status 'unset' AND duration is 0, or if it's a placeholder
    const isInProgress = (parentSpan.status === 'unset' && parentSpan.duration_ms === 0) || parentSpan.attributes?.is_placeholder;

    return (
      <div key={parentSpan.id}>
        <div 
          style={{ 
            display: 'flex', 
            alignItems: 'center', 
            padding: '12px 16px',
            paddingLeft: `${16 + (level * 24)}px`,
            backgroundColor: selectedSpan?.id === parentSpan.id ? 'var(--ion-color-primary-tint)' : 'transparent',
            borderBottom: '1px solid var(--ion-color-light)'
          }}
        >
          {/* Expand/Collapse Arrow - show for any span with children */}
          {hasChildren && (
            <div 
              style={{ 
                marginRight: '8px', 
                cursor: 'pointer',
                padding: '4px',
                borderRadius: '4px'
              }}
              onClick={(e) => {
                e.stopPropagation();
                const newExpanded = new Set(expandedAgents);
                if (newExpanded.has(parentSpan.id)) {
                  newExpanded.delete(parentSpan.id);
                } else {
                  newExpanded.add(parentSpan.id);
                }
                setExpandedAgents(newExpanded);
              }}
            >
              <IonIcon 
                icon={isExpanded ? chevronDownOutline : chevronForwardOutline}
                style={{ fontSize: '16px', color: 'var(--ion-color-medium)' }}
              />
            </div>
          )}
          
          {/* Row Content - Clickable for Selection */}
          <div 
            style={{ 
              display: 'flex', 
              alignItems: 'center', 
              flex: 1,
              cursor: 'pointer'
            }}
            onClick={() => {
              // Toggle selection - if already selected, deselect
              if (selectedSpan?.id === parentSpan.id) {
                setSelectedSpan(null);
              } else {
                setSelectedSpan(parentSpan);
              }
            }}
          >
            {/* Icon */}
            <div style={{ marginRight: '12px' }}>
              <div style={{
                width: '16px',
                height: '16px',
                borderRadius: '50%',
                backgroundColor: level === 0 ? 'var(--ion-color-primary)' : 'var(--ion-color-medium)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '8px',
                color: 'white'
              }}>
                {level === 0 ? '⚙' : '●'}
              </div>
            </div>
            
                {/* Content */}
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: '500', marginBottom: '4px' }}>
                    {displayName}
                  </div>
                  {isInProgress && (
                    <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', fontStyle: 'italic' }}>
                      In progress...
                    </div>
                  )}
                </div>
            
            {/* Timing and Progress Bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', minWidth: '60px' }}>
                {formatDuration(parentSpan.duration_ms)}
              </div>
              <div style={{ 
                width: '120px', 
                height: '8px', 
                backgroundColor: 'var(--ion-color-light)', 
                borderRadius: '4px',
                overflow: 'hidden'
              }}>
              <div 
                style={{ 
                  width: `${progressWidth}%`, 
                  height: '100%', 
                  backgroundColor: level === 0 ? 'var(--ion-color-primary)' : 'var(--ion-color-medium)',
                  borderRadius: '4px',
                  transition: 'width 0.3s ease',
                  ...(isInProgress && {
                    background: 'repeating-linear-gradient(45deg, var(--ion-color-medium), var(--ion-color-medium) 10px, var(--ion-color-light) 10px, var(--ion-color-light) 20px)',
                    animation: 'progress-stripes 1s linear infinite'
                  })
                }} 
              />
              </div>
            </div>
          </div>
        </div>
        
        {/* Render children if expanded */}
        {isExpanded && children.map(child => renderSpanHierarchy(child, level + 1))}
      </div>
    );
  };

  const toggleAgentExpansion = (agentName: string) => {
    const newExpanded = new Set(expandedAgents);
    if (newExpanded.has(agentName)) {
      newExpanded.delete(agentName);
    } else {
      newExpanded.add(agentName);
    }
    setExpandedAgents(newExpanded);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok': return checkmarkCircleOutline;
      case 'error': return closeCircleOutline;
      case 'unset': return alertCircleOutline;
      default: return alertCircleOutline;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok': return 'success';
      case 'error': return 'danger';
      case 'unset': return 'warning';
      default: return 'medium';
    }
  };

  const getSpanIcon = (span: Span) => {
    if (span.name.includes('Agent:')) return 'settings'; // gear icon for agent
    if (span.name.includes('POST')) return 'radio-button-on'; // filled circle for POST
    if (span.name.includes('Handoff')) return 'swap-horizontal'; // handoff icon
    return ellipseOutline;
  };

  const getSpanColor = (span: Span) => {
    if (span.name.includes('Agent:')) return 'primary';
    if (span.name.includes('Response:')) return 'secondary';
    if (span.name.includes('POST')) return 'tertiary';
    return 'medium';
  };

  if (loading) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/traces" />
            </IonButtons>
            <IonTitle>Trace Details</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="ion-padding">
            <IonSpinner name="crescent" /> Loading trace details...
          </div>
        </IonContent>
      </IonPage>
    );
  }

  if (error || !trace) {
    return (
      <IonPage>
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/traces" />
            </IonButtons>
            <IonTitle>Trace Details</IonTitle>
          </IonToolbar>
        </IonHeader>
        <IonContent>
          <div className="ion-padding">
            <p className="ion-text-danger">Error: {error || 'Trace not found'}</p>
            <IonButton onClick={() => navigate('/traces')}>Back to Traces</IonButton>
          </div>
        </IonContent>
      </IonPage>
    );
  }

  return (
    <>
      <style>{`
        @keyframes progress-stripes {
          0% { background-position: 0 0; }
          100% { background-position: 20px 0; }
        }
      `}</style>
      <SidebarMenu
        id="left-menu"
        side="start"
        title="Settings"
        color="primary"
      />

      <SidebarMenu
        id="right-menu"
        side="end"
        title="Settings"
        color="primary"
      />

      <IonPage id="main-content">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonBackButton defaultHref="/traces" />
            </IonButtons>
            <IonTitle>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span>Traces / {trace.name}</span>
                <span style={{ fontSize: '12px', color: 'var(--ion-color-medium)', fontFamily: 'monospace' }}>
                  {trace.id.length > 20 ? `${trace.id.substring(0, 20)}...` : trace.id}
                </span>
              </div>
            </IonTitle>
            <IonButtons slot="end">
              <IonButton fill="clear" onClick={fetchTraceDetails}>
                Refresh
              </IonButton>
              <IonButton fill="clear">
                Evaluate
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>

        <IonContent>
          <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
            <IonRefresherContent />
          </IonRefresher>

          <div style={{ display: 'flex', height: '100%' }}>
            {/* Left Panel - Spans List */}
            <div style={{ flex: '2', borderRight: '1px solid var(--ion-color-medium)' }}>
              <div style={{ padding: '16px', borderBottom: '1px solid var(--ion-color-light)' }}>
                <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Workflow Steps</h3>
              </div>
              <div style={{ overflowY: 'auto', height: 'calc(100vh - 200px)' }}>
                {(() => {
                  const { rootSpans } = buildSpanHierarchy();
                  
                  return (
                    <div>
                      {rootSpans.map(span => renderSpanHierarchy(span, 0))}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* Right Panel - Span Details */}
            <div style={{ flex: '1', padding: '16px' }}>
              {selectedSpan ? (
                <div>
                  {/* Header */}
                  <div style={{ marginBottom: '24px' }}>
                    <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: '600', color: 'white' }}>
                      {selectedSpan.name.replace('Agent:', '').trim() || selectedSpan.name}
                    </h2>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
                          <IonChip color={selectedSpan.attributes?.span_type === 'response' ? 'secondary' : 'primary'} style={{ fontSize: '12px' }}>
                            <IonIcon icon={selectedSpan.attributes?.span_type === 'response' ? chatbubbleOutline : personOutline} style={{ fontSize: '14px' }} />
                            <IonLabel>{selectedSpan.attributes?.span_type === 'response' ? 'Response' : 'Agent'}</IonLabel>
                          </IonChip>
                          {selectedSpan.attributes?.tokens && (
                            <span style={{ fontSize: '14px', color: 'var(--ion-color-medium)' }}>
                              {selectedSpan.attributes.tokens}t
                            </span>
                          )}
                          <span style={{ fontSize: '14px', color: 'var(--ion-color-medium)' }}>
                            {formatDuration(selectedSpan.duration_ms)}
                          </span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px', fontSize: '12px', color: 'var(--ion-color-medium)' }}>
                        <IonIcon icon={copyOutline} style={{ fontSize: '14px' }} />
                        <span style={{ fontFamily: 'monospace' }}>
                          {selectedSpan.id.length > 20 ? `${selectedSpan.id.substring(0, 20)}...` : selectedSpan.id}
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  {/* Properties */}
                  <div style={{ marginBottom: '24px' }}>
                    <div 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        marginBottom: '16px',
                        cursor: 'pointer'
                      }}
                      onClick={() => setPropertiesExpanded(!propertiesExpanded)}
                    >
                      <IonIcon 
                        icon={propertiesExpanded ? chevronDownOutline : chevronForwardOutline} 
                        style={{ marginRight: '8px', fontSize: '16px' }} 
                      />
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>Properties</h3>
                    </div>
                    {propertiesExpanded && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                        <div>
                          <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Created</div>
                          <div style={{ fontSize: '14px', color: 'white' }}>
                            {new Date(selectedSpan.start_time).toLocaleString('en-US', {
                              month: 'short',
                              day: 'numeric',
                              year: 'numeric',
                              hour: 'numeric',
                              minute: 'numeric',
                              hour12: true,
                            })}
                          </div>
                        </div>
                        {selectedSpan.attributes?.span_type === 'response' && (
                          <>
                            <div>
                              <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>ID</div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                                {selectedSpan.attributes?.response_id ? (
                                  <Link
                                    to={`/responses/${selectedSpan.attributes.response_id}`}
                                    style={{
                                      fontSize: '12px',
                                      fontFamily: 'monospace',
                                      color: 'var(--ion-color-primary)',
                                      textDecoration: 'none',
                                      cursor: 'pointer'
                                    }}
                                    onMouseEnter={(e) => e.currentTarget.style.textDecoration = 'underline'}
                                    onMouseLeave={(e) => e.currentTarget.style.textDecoration = 'none'}
                                  >
                                    {selectedSpan.attributes.response_id.length > 20
                                      ? `${selectedSpan.attributes.response_id.substring(0, 20)}...`
                                      : selectedSpan.attributes.response_id
                                    }
                                  </Link>
                                ) : ''}
                                {selectedSpan.attributes?.response_id && (
                                  <IonIcon icon={copyOutline} style={{ fontSize: '14px', color: 'var(--ion-color-medium)', cursor: 'pointer' }} />
                                )}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Model</div>
                              <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'white' }}>
                                {selectedSpan.attributes?.model || ''}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Tokens</div>
                              <div style={{ fontSize: '14px', color: 'white' }}>
                                {selectedSpan.attributes?.tokens ? `${selectedSpan.attributes.tokens} total` : ''}
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Functions</div>
                              <div style={{ display: 'flex', gap: '6px', marginTop: '6px', flexWrap: 'wrap' }}>
                                {selectedSpan.attributes?.functions ? (() => {
                                  const functions = Array.isArray(selectedSpan.attributes.functions) 
                                    ? selectedSpan.attributes.functions 
                                    : [selectedSpan.attributes.functions];
                                  return functions.map((func: string, index: number) => (
                                    <IonChip key={index} color="tertiary" style={{ fontSize: '11px' }}>
                                      <IonLabel style={{ fontSize: '11px' }}>{func}</IonLabel>
                                    </IonChip>
                                  ));
                                })() : ''}
                              </div>
                            </div>
                            <div style={{ marginTop: '16px' }}>
                              <h4 style={{ margin: '0 0 12px 0', fontSize: '14px', fontWeight: '600', color: 'white' }}>Configuration</h4>
                              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                                <div>
                                  <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Response</div>
                                  <div style={{ fontSize: '14px', color: 'white' }}>{selectedSpan.attributes?.output_type || 'text'}</div>
                                </div>
                                <div>
                                  <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Verbosity</div>
                                  <div style={{ fontSize: '14px', color: 'white' }}>medium</div>
                                </div>
                              </div>
                            </div>
                          </>
                        )}
                        {selectedSpan.attributes?.span_type !== 'response' && (
                          <>
                            <div>
                              <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Output type</div>
                              <div style={{ fontSize: '14px', color: 'white' }}>{selectedSpan.attributes?.output_type || 'text'}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Handoffs</div>
                              <div style={{ fontSize: '14px', color: 'white' }}>
                                {selectedSpan.attributes?.handoffs && selectedSpan.attributes.handoffs.length > 0 
                                  ? selectedSpan.attributes.handoffs.join(', ')
                                  : 'None'
                                }
                              </div>
                            </div>
                            <div>
                              <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Tools</div>
                              <div style={{ fontSize: '14px', color: 'white' }}>
                                {selectedSpan.attributes?.tools && selectedSpan.attributes.tools.length > 0 
                                  ? selectedSpan.attributes.tools.join(', ')
                                  : 'None'
                                }
                              </div>
                            </div>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                  
                  {/* Only show detailed sections for response spans */}
                  {selectedSpan.attributes?.span_type === 'response' && (
                    <>
                      
                      {/* Instructions */}
                      <div style={{ marginBottom: '24px' }}>
                        <div 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            marginBottom: '16px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setInstructionsExpanded(!instructionsExpanded)}
                        >
                          <IonIcon 
                            icon={instructionsExpanded ? chevronDownOutline : chevronForwardOutline} 
                            style={{ marginRight: '8px', fontSize: '16px' }} 
                          />
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>Instructions</h3>
                        </div>
                        {instructionsExpanded && (
                          <div>
                            <p style={{ fontSize: '12px', lineHeight: '1.5', margin: '0', whiteSpace: 'pre-wrap', color: 'white' }}>
                              {selectedSpan.attributes?.instructions || 'No instructions available'}
                            </p>
                          </div>
                        )}
                      </div>
                      
                      {/* Input */}
                      <div style={{ marginBottom: '24px' }}>
                        <div 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            marginBottom: '16px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setInputExpanded(!inputExpanded)}
                        >
                          <IonIcon 
                            icon={inputExpanded ? chevronDownOutline : chevronForwardOutline} 
                            style={{ marginRight: '8px', fontSize: '16px' }} 
                          />
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>Input</h3>
                        </div>
                        {inputExpanded && (
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>User</div>
                            <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'white' }}>
                              {selectedSpan.attributes?.input || 'No input available'}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Output */}
                      <div style={{ marginBottom: '24px' }}>
                        <div 
                          style={{ 
                            display: 'flex', 
                            alignItems: 'center', 
                            marginBottom: '16px',
                            cursor: 'pointer'
                          }}
                          onClick={() => setOutputExpanded(!outputExpanded)}
                        >
                          <IonIcon 
                            icon={outputExpanded ? chevronDownOutline : chevronForwardOutline} 
                            style={{ marginRight: '8px', fontSize: '16px' }} 
                          />
                          <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600', color: 'white' }}>Output</h3>
                        </div>
                        {outputExpanded && (
                          <div>
                            <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Assistant</div>
                            <div style={{ fontSize: '12px', fontFamily: 'monospace', color: 'white' }}>
                              {selectedSpan.attributes?.output || 'No output available'}
                            </div>
                          </div>
                        )}
                      </div>
                      
                      {/* Feedback buttons */}
                      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px', marginTop: '20px' }}>
                        <IonButton fill="clear" size="small" style={{ color: 'white' }}>
                          <IonIcon icon={thumbsUpOutline} />
                        </IonButton>
                        <IonButton fill="clear" size="small" style={{ color: 'white' }}>
                          <IonIcon icon={thumbsDownOutline} />
                        </IonButton>
                      </div>
                    </>
                  )}
                </div>
              ) : (
                <div>
                  {/* Properties Section */}
                  <div style={{ marginBottom: '24px' }}>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: '16px',
                      cursor: 'pointer'
                    }}>
                      <IonIcon 
                        icon={chevronDownOutline} 
                        style={{ marginRight: '8px', fontSize: '16px' }} 
                      />
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Properties</h3>
                    </div>
                    <div style={{ paddingLeft: '24px' }}>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>ID</div>
                        <div style={{ fontSize: '14px', fontFamily: 'monospace', wordBreak: 'break-all' }}>
                          {trace?.id}
                        </div>
                      </div>
                      <div style={{ marginBottom: '12px' }}>
                        <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)', marginBottom: '4px' }}>Workflow name</div>
                        <div style={{ fontSize: '14px' }}>
                          {trace?.name}
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  {/* Metadata Section */}
                  <div>
                    <div style={{ 
                      display: 'flex', 
                      alignItems: 'center', 
                      marginBottom: '16px',
                      cursor: 'pointer'
                    }}>
                      <IonIcon 
                        icon={chevronDownOutline} 
                        style={{ marginRight: '8px', fontSize: '16px' }} 
                      />
                      <h3 style={{ margin: 0, fontSize: '16px', fontWeight: '600' }}>Metadata</h3>
                    </div>
                    <div style={{ paddingLeft: '24px' }}>
                      {trace?.metadata && Object.keys(trace.metadata).length > 0 ? (
                        <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)' }}>
                          <pre style={{ margin: 0, whiteSpace: 'pre-wrap', fontSize: '12px' }}>
                            {JSON.stringify(trace.metadata, null, 2)}
                          </pre>
                        </div>
                      ) : (
                        <div style={{ fontSize: '12px', color: 'var(--ion-color-medium)' }}>
                          No metadata entries
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </IonContent>
      </IonPage>
    </>
  );
};

export default TraceDetail;

