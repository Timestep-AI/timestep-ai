import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButton,
  IonButtons,
  IonBackButton,
  IonCard,
  IonCardContent,
  IonCardHeader,
  IonCardTitle,
  IonSpinner,
  IonGrid,
  IonRow,
  IonCol,
  IonChip,
  IonLabel,
} from '@ionic/react';
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
const supabase = createClient(supabaseUrl, supabaseAnonKey);

interface ResponseData {
  id: string;
  model: string;
  instructions: string;
  usage: {
    input_tokens: number;
    output_tokens: number;
    total_tokens: number;
  };
  tools: any[];
  messages: any[];
  output: any[];
  output_type: string;
  metadata: any;
  created_at: string;
}

const ResponseDetail = () => {
  const { responseId } = useParams<{ responseId: string }>();
  const navigate = useNavigate();
  const [response, setResponse] = useState<ResponseData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchResponse = async () => {
      try {
        setLoading(true);
        setError(null);

        const { data: { session } } = await supabase.auth.getSession();
        if (!session) {
          setError('Not authenticated');
          setLoading(false);
          return;
        }

        const { data, error: fetchError } = await supabase
          .from('responses')
          .select('*')
          .eq('id', responseId)
          .single();

        if (fetchError) {
          console.error('Error fetching response:', fetchError);
          setError('Failed to load response');
        } else {
          setResponse(data);
        }
      } catch (err) {
        console.error('Error:', err);
        setError('An error occurred');
      } finally {
        setLoading(false);
      }
    };

    if (responseId) {
      fetchResponse();
    }
  }, [responseId]);

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
  };

  const renderMessages = (messages: any[]) => {
    if (!messages || messages.length === 0) return null;

    return messages.map((msg, idx) => {
      let text = '';
      if (typeof msg.content === 'string') {
        text = msg.content;
      } else if (Array.isArray(msg.content)) {
        text = msg.content.map((c: any) => c.text || '').join('\n');
      }

      return (
        <div key={idx} style={{ marginBottom: '12px' }}>
          <div style={{
            fontWeight: 'bold',
            color: 'var(--ion-color-medium)',
            fontSize: '12px',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            {msg.role}
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
        </div>
      );
    });
  };

  const renderOutput = (output: any[]) => {
    if (!output || output.length === 0) return null;

    return output.map((item, idx) => {
      let text = '';
      if (typeof item === 'string') {
        text = item;
      } else if (item.content && Array.isArray(item.content)) {
        text = item.content.map((c: any) => c.text || '').join('\n');
      } else if (item.text) {
        text = item.text;
      }

      return (
        <div key={idx} style={{ marginBottom: '12px' }}>
          <div style={{
            fontWeight: 'bold',
            color: 'var(--ion-color-medium)',
            fontSize: '12px',
            textTransform: 'uppercase',
            marginBottom: '4px'
          }}>
            Assistant
          </div>
          <div style={{ whiteSpace: 'pre-wrap' }}>{text}</div>
        </div>
      );
    });
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonBackButton defaultHref="/traces" />
          </IonButtons>
          <IonTitle>Response Detail</IonTitle>
        </IonToolbar>
      </IonHeader>
      <IonContent>
        {loading && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px' }}>
            <IonSpinner />
          </div>
        )}

        {error && (
          <IonCard color="danger">
            <IonCardContent>{error}</IonCardContent>
          </IonCard>
        )}

        {!loading && !error && response && (
          <div style={{ padding: '16px' }}>
            <IonGrid>
              <IonRow>
                <IonCol size="12" sizeMd="8">
                  {/* Instructions Section */}
                  {response.instructions && (
                    <IonCard>
                      <IonCardHeader>
                        <IonCardTitle>Instructions</IonCardTitle>
                      </IonCardHeader>
                      <IonCardContent>
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{
                            fontWeight: 'bold',
                            color: 'var(--ion-color-medium)',
                            fontSize: '12px',
                            textTransform: 'uppercase',
                            marginBottom: '8px'
                          }}>
                            System Instructions
                          </div>
                          <div style={{ whiteSpace: 'pre-wrap' }}>
                            {response.instructions}
                          </div>
                        </div>
                      </IonCardContent>
                    </IonCard>
                  )}

                  {/* Input Section */}
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>
                        Input
                        {response.messages && (
                          <span style={{
                            marginLeft: '12px',
                            fontSize: '14px',
                            color: 'var(--ion-color-medium)'
                          }}>
                            {response.usage?.input_tokens || 0}t
                          </span>
                        )}
                      </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      {renderMessages(response.messages)}
                    </IonCardContent>
                  </IonCard>

                  {/* Output Section */}
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>
                        Output
                        {response.output && (
                          <span style={{
                            marginLeft: '12px',
                            fontSize: '14px',
                            color: 'var(--ion-color-medium)'
                          }}>
                            {response.usage?.output_tokens || 0}t
                          </span>
                        )}
                      </IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      {renderOutput(response.output)}
                    </IonCardContent>
                  </IonCard>
                </IonCol>

                <IonCol size="12" sizeMd="4">
                  {/* Properties Section */}
                  <IonCard>
                    <IonCardHeader>
                      <IonCardTitle>Properties</IonCardTitle>
                    </IonCardHeader>
                    <IonCardContent>
                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          fontWeight: 'bold',
                          color: 'var(--ion-color-medium)',
                          fontSize: '12px',
                          marginBottom: '4px'
                        }}>
                          Created
                        </div>
                        <div>{formatDate(response.created_at)}</div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          fontWeight: 'bold',
                          color: 'var(--ion-color-medium)',
                          fontSize: '12px',
                          marginBottom: '4px'
                        }}>
                          ID
                        </div>
                        <div style={{
                          fontFamily: 'monospace',
                          fontSize: '12px',
                          wordBreak: 'break-all'
                        }}>
                          {response.id}
                        </div>
                      </div>

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          fontWeight: 'bold',
                          color: 'var(--ion-color-medium)',
                          fontSize: '12px',
                          marginBottom: '4px'
                        }}>
                          Model
                        </div>
                        <div>{response.model}</div>
                      </div>

                      {response.usage && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{
                            fontWeight: 'bold',
                            color: 'var(--ion-color-medium)',
                            fontSize: '12px',
                            marginBottom: '4px'
                          }}>
                            Tokens
                          </div>
                          <div>{response.usage.total_tokens} total</div>
                        </div>
                      )}

                      {response.tools && response.tools.length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{
                            fontWeight: 'bold',
                            color: 'var(--ion-color-medium)',
                            fontSize: '12px',
                            marginBottom: '8px'
                          }}>
                            Functions
                          </div>
                          <div>
                            {response.tools.map((tool: any, idx: number) => (
                              <IonChip key={idx}>
                                <IonLabel>{tool.name || tool}()</IonLabel>
                              </IonChip>
                            ))}
                          </div>
                        </div>
                      )}

                      <div style={{ marginBottom: '16px' }}>
                        <div style={{
                          fontWeight: 'bold',
                          color: 'var(--ion-color-medium)',
                          fontSize: '12px',
                          marginBottom: '4px'
                        }}>
                          Configuration
                        </div>
                        <div>
                          <div><strong>Response</strong> {response.output_type}</div>
                          <div><strong>Verbosity</strong> medium</div>
                        </div>
                      </div>

                      {response.metadata && Object.keys(response.metadata).length > 0 && (
                        <div style={{ marginBottom: '16px' }}>
                          <div style={{
                            fontWeight: 'bold',
                            color: 'var(--ion-color-medium)',
                            fontSize: '12px',
                            marginBottom: '4px'
                          }}>
                            Metadata
                          </div>
                          <pre style={{ fontSize: '12px', overflow: 'auto' }}>
                            {JSON.stringify(response.metadata, null, 2)}
                          </pre>
                        </div>
                      )}
                    </IonCardContent>
                  </IonCard>
                </IonCol>
              </IonRow>
            </IonGrid>
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default ResponseDetail;
