import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import {
  IonPage,
  IonHeader,
  IonToolbar,
  IonTitle,
  IonContent,
  IonButtons,
  IonButton,
  IonIcon,
  IonSpinner,
} from '@ionic/react';
import { arrowBack, add } from 'ionicons/icons';
import { ThreadCard } from '@/components/ThreadCard';

const Chats = () => {
  const navigate = useNavigate();
  const [threads, setThreads] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const getServerBaseUrl = () => {
    const supabaseUrl = import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:54321';
    return `${supabaseUrl}/functions/v1/agent-chat`;
  };

  const getAuthHeaders = async () => {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) {
      throw new Error('No valid session found');
    }
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    };
  };

  const loadThreads = async () => {
    try {
      setLoading(true);
      const authHeaders = await getAuthHeaders();
      const response = await fetch(
        `${getServerBaseUrl()}/agents/00000000-0000-0000-0000-000000000000/chatkit`,
        {
          method: 'POST',
          headers: authHeaders,
          body: JSON.stringify({
            type: 'threads.list',
            params: { limit: 50, order: 'desc' }
          }),
        }
      );

      if (response.ok) {
        const data = await response.json();
        setThreads(data.data || []);
      }
    } catch (error) {
      console.error('Error loading threads:', error);
      toast.error('Failed to load chats');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const initAuth = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        await supabase.auth.signInAnonymously();
      }
      await loadThreads();
    };
    initAuth();
  }, []);

  const handleThreadClick = (threadId: string) => {
    navigate(`/?thread=${threadId}`);
  };

  const handleNewChat = () => {
    navigate('/');
  };

  return (
    <IonPage>
      <IonHeader>
        <IonToolbar>
          <IonButtons slot="start">
            <IonButton onClick={() => navigate('/')}>
              <IonIcon slot="icon-only" icon={arrowBack} />
            </IonButton>
          </IonButtons>
          <IonTitle>Chats</IonTitle>
          <IonButtons slot="end">
            <IonButton onClick={handleNewChat}>
              <IonIcon slot="icon-only" icon={add} />
            </IonButton>
          </IonButtons>
        </IonToolbar>
      </IonHeader>

      <IonContent className="ion-padding">
        {loading ? (
          <div className="flex items-center justify-center h-full">
            <IonSpinner />
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-3">
            {threads.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                <p>No chats yet. Start a new conversation!</p>
                <IonButton onClick={handleNewChat} className="mt-4">
                  New Chat
                </IonButton>
              </div>
            ) : (
              threads.map((thread) => (
                <ThreadCard
                  key={thread.id}
                  thread={thread}
                  isActive={false}
                  onClick={() => handleThreadClick(thread.id)}
                />
              ))
            )}
          </div>
        )}
      </IonContent>
    </IonPage>
  );
};

export default Chats;
