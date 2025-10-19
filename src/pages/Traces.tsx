import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { IonPage, IonHeader, IonToolbar, IonTitle, IonContent, IonCard, IonCardHeader, IonCardTitle, IonCardContent, IonList, IonItem, IonLabel, IonChip, IonSpinner, IonButton, IonIcon, IonRefresher, IonRefresherContent, IonSearchbar, IonInfiniteScroll, IonInfiniteScrollContent, IonButtons, IonSelect, IonSelectOption, IonGrid, IonRow, IonCol } from '@ionic/react';
import { timeOutline, checkmarkCircleOutline, closeCircleOutline, alertCircleOutline, chevronForwardOutline, arrowBackOutline, downloadOutline } from 'ionicons/icons';
import { TracesService, Trace, Span, TraceDetailResponse } from '@/services/tracesService';
import SidebarMenu from '@/components/SidebarMenu';

const Traces = () => {
  const navigate = useNavigate();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTrace, setSelectedTrace] = useState<TraceDetailResponse | null>(null);
  const [searchText, setSearchText] = useState('');
  const [offset, setOffset] = useState(0);
  const [hasMore, setHasMore] = useState(true);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [durationFilter, setDurationFilter] = useState<string>('');
  const [dateRangeFilter, setDateRangeFilter] = useState<string>('');

  // Menu refs
  const leftMenuRef = useRef<HTMLIonMenuElement>(null);
  const rightMenuRef = useRef<HTMLIonMenuElement>(null);

  const loadTraces = async (reset: boolean = false) => {
    try {
      if (reset) {
        setOffset(0);
        setHasMore(true);
      }

      const currentOffset = reset ? 0 : offset;
      const response = await TracesService.getTraces(20, currentOffset);
      
      if (reset) {
        setTraces(response.traces);
      } else {
        setTraces(prev => [...prev, ...response.traces]);
      }
      
      setTotal(response.total);
      setOffset(currentOffset + response.traces.length);
      setHasMore(response.traces.length === 20);
    } catch (error) {
      console.error('Error loading traces:', error);
      toast.error('Failed to load traces');
    } finally {
      setLoading(false);
    }
  };

  const loadTraceDetail = async (traceId: string) => {
    try {
      const detail = await TracesService.getTraceDetail(traceId);
      setSelectedTrace(detail);
    } catch (error) {
      console.error('Error loading trace detail:', error);
      toast.error('Failed to load trace details');
    }
  };

  const handleRefresh = async (event: CustomEvent) => {
    await loadTraces(true);
    event.detail.complete();
  };

  const handleInfiniteScroll = async (event: CustomEvent) => {
    if (hasMore) {
      await loadTraces(false);
    }
    event.detail.complete();
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'ok':
        return <IonIcon icon={checkmarkCircleOutline} color="success" />;
      case 'error':
        return <IonIcon icon={closeCircleOutline} color="danger" />;
      case 'unset':
        return <IonIcon icon={alertCircleOutline} color="warning" />;
      default:
        return <IonIcon icon={alertCircleOutline} color="medium" />;
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'ok':
        return 'success';
      case 'error':
        return 'danger';
      case 'unset':
        return 'warning';
      default:
        return 'medium';
    }
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) {
      return `${ms}ms`;
    } else if (ms < 60000) {
      return `${(ms / 1000).toFixed(2)}s`;
    } else {
      return `${(ms / 60000).toFixed(2)}m`;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString();
  };

  const exportTracesAsJSON = () => {
    const dataStr = JSON.stringify(filteredTraces, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `traces-${new Date().toISOString().split('T')[0]}.json`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Traces exported as JSON');
  };

  const exportTracesAsCSV = () => {
    const headers = ['ID', 'Name', 'Status', 'Duration (ms)', 'Created', 'Updated', 'Thread ID'];
    const csvContent = [
      headers.join(','),
      ...filteredTraces.map(trace => [
        trace.id,
        `"${trace.name}"`,
        trace.status,
        trace.duration_ms,
        trace.created_at,
        trace.updated_at || '',
        trace.thread_id || ''
      ].join(','))
    ].join('\n');
    
    const dataBlob = new Blob([csvContent], { type: 'text/csv' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `traces-${new Date().toISOString().split('T')[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast.success('Traces exported as CSV');
  };

  const filteredTraces = traces.filter(trace => {
    // Text search - search by name, id, or thread_id
    const matchesSearch = trace.name.toLowerCase().includes(searchText.toLowerCase()) ||
                         trace.id.toLowerCase().includes(searchText.toLowerCase()) ||
                         (trace.thread_id && trace.thread_id.toLowerCase().includes(searchText.toLowerCase()));
    
    // Status filter
    const matchesStatus = !statusFilter || trace.status === statusFilter;
    
    // Duration filter
    let matchesDuration = true;
    if (durationFilter) {
      switch (durationFilter) {
        case 'fast':
          matchesDuration = trace.duration_ms < 1000;
          break;
        case 'medium':
          matchesDuration = trace.duration_ms >= 1000 && trace.duration_ms < 5000;
          break;
        case 'slow':
          matchesDuration = trace.duration_ms >= 5000;
          break;
      }
    }
    
    // Date range filter
    let matchesDateRange = true;
    if (dateRangeFilter) {
      const traceDate = new Date(trace.created_at);
      const now = new Date();
      switch (dateRangeFilter) {
        case 'today':
          matchesDateRange = traceDate.toDateString() === now.toDateString();
          break;
        case 'week':
          const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
          matchesDateRange = traceDate >= weekAgo;
          break;
        case 'month':
          const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
          matchesDateRange = traceDate >= monthAgo;
          break;
      }
    }
    
    return matchesSearch && matchesStatus && matchesDuration && matchesDateRange;
  });

  useEffect(() => {
    loadTraces(true);
  }, []);

  return (
    <>
      <SidebarMenu
        ref={leftMenuRef}
        id="left-menu"
        side="start"
        title="Settings"
        color="primary"
      />

      <SidebarMenu
        ref={rightMenuRef}
        id="right-menu"
        side="end"
        title="Settings"
        color="primary"
      />

      <IonPage id="main-content">
        <IonHeader>
          <IonToolbar>
            <IonButtons slot="start">
              <IonButton fill="clear" routerLink="/">
                <IonIcon icon={arrowBackOutline} />
              </IonButton>
            </IonButtons>
            <IonTitle>Traces</IonTitle>
            <IonButtons slot="end">
              <IonButton fill="clear" onClick={exportTracesAsJSON}>
                <IonIcon icon={downloadOutline} />
                JSON
              </IonButton>
              <IonButton fill="clear" onClick={exportTracesAsCSV}>
                <IonIcon icon={downloadOutline} />
                CSV
              </IonButton>
            </IonButtons>
          </IonToolbar>
        </IonHeader>
        
        <IonContent>
          <IonRefresher slot="fixed" onIonRefresh={handleRefresh}>
            <IonRefresherContent />
          </IonRefresher>

          <div style={{ padding: '16px' }}>
            <IonSearchbar
              value={searchText}
              onIonInput={(e) => setSearchText(e.detail.value!)}
              placeholder="Search traces..."
            />
            
            {/* Filter Controls */}
            <IonGrid style={{ marginTop: '16px' }}>
              <IonRow>
                <IonCol size="4">
                  <IonSelect
                    value={statusFilter}
                    placeholder="Status"
                    onIonChange={(e) => setStatusFilter(e.detail.value)}
                    interface="popover"
                  >
                    <IonSelectOption value="">All Status</IonSelectOption>
                    <IonSelectOption value="ok">Success</IonSelectOption>
                    <IonSelectOption value="error">Error</IonSelectOption>
                    <IonSelectOption value="unset">Unset</IonSelectOption>
                  </IonSelect>
                </IonCol>
                <IonCol size="4">
                  <IonSelect
                    value={durationFilter}
                    placeholder="Duration"
                    onIonChange={(e) => setDurationFilter(e.detail.value)}
                    interface="popover"
                  >
                    <IonSelectOption value="">All Durations</IonSelectOption>
                    <IonSelectOption value="fast">Fast (&lt;1s)</IonSelectOption>
                    <IonSelectOption value="medium">Medium (1-5s)</IonSelectOption>
                    <IonSelectOption value="slow">Slow (&gt;5s)</IonSelectOption>
                  </IonSelect>
                </IonCol>
                <IonCol size="4">
                  <IonSelect
                    value={dateRangeFilter}
                    placeholder="Date Range"
                    onIonChange={(e) => setDateRangeFilter(e.detail.value)}
                    interface="popover"
                  >
                    <IonSelectOption value="">All Time</IonSelectOption>
                    <IonSelectOption value="today">Today</IonSelectOption>
                    <IonSelectOption value="week">This Week</IonSelectOption>
                    <IonSelectOption value="month">This Month</IonSelectOption>
                  </IonSelect>
                </IonCol>
              </IonRow>
            </IonGrid>

            {loading && traces.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '40px' }}>
                <IonSpinner />
                <p>Loading traces...</p>
              </div>
            ) : (
              <>
                <div style={{ marginBottom: '16px' }}>
                  <p>Showing {filteredTraces.length} of {total} traces</p>
                </div>

                {/* Table Header */}
                <div style={{ 
                  display: 'grid', 
                  gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                  gap: '16px',
                  padding: '12px 16px',
                  backgroundColor: 'var(--ion-color-light)',
                  borderRadius: '8px 8px 0 0',
                  fontWeight: 'bold',
                  fontSize: '14px',
                  color: 'var(--ion-color-dark)'
                }}>
                  <div>Workflow</div>
                  <div>Flow</div>
                  <div>Handoffs</div>
                  <div>Tools</div>
                  <div>Execution time</div>
                  <div>Created</div>
                </div>
                
                {/* Table Rows */}
                {filteredTraces.map((trace, index) => {
                  // Extract data from metadata
                  const flowName = trace.metadata?.flow || trace.metadata?.agent_name;
                  const handoffs = trace.metadata?.handoffs?.length;
                  const tools = trace.metadata?.tools?.length;
                  
                  return (
                    <div 
                      key={trace.id}
                      style={{ 
                        display: 'grid', 
                        gridTemplateColumns: '2fr 1fr 1fr 1fr 1fr 1fr',
                        gap: '16px',
                        padding: '12px 16px',
                        backgroundColor: index % 2 === 0 ? 'var(--ion-color-step-50)' : 'var(--ion-color-step-100)',
                        borderBottom: '1px solid var(--ion-color-light)',
                        cursor: 'pointer',
                        alignItems: 'center'
                      }}
                      onClick={() => navigate(`/traces/${trace.id}`)}
                    >
                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <div style={{
                          width: '8px',
                          height: '8px',
                          borderRadius: '50%',
                          backgroundColor: trace.status === 'ok' ? 'var(--ion-color-success)' : 
                                         trace.status === 'error' ? 'var(--ion-color-danger)' : 
                                         'var(--ion-color-warning)'
                        }} />
                        <span style={{ fontWeight: '500' }}>{trace.name}</span>
                      </div>
                      <div>{flowName}</div>
                      <div>{handoffs}</div>
                      <div>{tools}</div>
                      <div>{formatDuration(trace.duration_ms)}</div>
                      <div>{formatDate(trace.created_at)}</div>
                    </div>
                  );
                })}

                <IonInfiniteScroll
                  onIonInfinite={handleInfiniteScroll}
                  threshold="100px"
                  disabled={!hasMore}
                >
                  <IonInfiniteScrollContent
                    loadingSpinner="bubbles"
                    loadingText="Loading more traces..."
                  />
                </IonInfiniteScroll>
              </>
            )}
          </div>
        </IonContent>
      </IonPage>
    </>
  );
};

export default Traces;
