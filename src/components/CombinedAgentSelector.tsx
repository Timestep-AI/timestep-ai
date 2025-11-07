import { useState } from 'react';
import {
  IonButton,
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/react';
import type { BackendType } from '@/services/backendConfig';
import type { AgentRecord } from '@/types/agent';
import type { ThreadMetadata } from '@/types/thread';

interface CombinedAgentSelectorProps {
  backendType: BackendType;
  selectedAgent: AgentRecord | null;
  agents: AgentRecord[];
  threads: ThreadMetadata[];
  selectedThreadId: string | null;
  loadingThreads?: boolean;
  onBackendChange: (backend: BackendType) => void;
  onAgentChange: (agentId: string) => void;
  onThreadChange: (threadId: string | null) => void;
  onCreateNewThread: () => void;
}

const CombinedAgentSelector = ({
  backendType,
  selectedAgent,
  agents,
  threads,
  selectedThreadId,
  loadingThreads = false,
  onBackendChange,
  onAgentChange,
  onThreadChange,
  onCreateNewThread,
}: CombinedAgentSelectorProps) => {
  const [backendPopoverOpen, setBackendPopoverOpen] = useState(false);
  const [agentPopoverOpen, setAgentPopoverOpen] = useState(false);
  const [threadPopoverOpen, setThreadPopoverOpen] = useState(false);

  const backendDisplay = backendType === 'typescript' ? 'TypeScript' : 'Python';
  const agentDisplay = selectedAgent?.name || 'Select Agent';
  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const threadDisplay = selectedThread
    ? selectedThread.title || `Thread ${selectedThread.id.slice(0, 8)}`
    : 'New Thread';

  const handleBackendClick = (backend: BackendType) => {
    onBackendChange(backend);
    setBackendPopoverOpen(false);
  };

  const handleAgentClick = (agentId: string) => {
    onAgentChange(agentId);
    setAgentPopoverOpen(false);
  };

  const handleThreadClick = (threadId: string | null) => {
    onThreadChange(threadId);
    setThreadPopoverOpen(false);
  };

  const handleCreateNewThread = () => {
    onCreateNewThread();
    setThreadPopoverOpen(false);
  };

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
        <IonButton
          fill="clear"
          onClick={() => setBackendPopoverOpen(true)}
          id="backend-selector-button"
          style={{ '--padding-start': '4px', '--padding-end': '4px' }}
        >
          {backendDisplay}
        </IonButton>
        <span>/</span>
        <IonButton
          fill="clear"
          onClick={() => setAgentPopoverOpen(true)}
          id="agent-selector-button"
          style={{ '--padding-start': '4px', '--padding-end': '4px' }}
        >
          {agentDisplay}
        </IonButton>
        <span>/</span>
        <IonButton
          fill="clear"
          onClick={() => setThreadPopoverOpen(true)}
          id="thread-selector-button"
          style={{ '--padding-start': '4px', '--padding-end': '4px' }}
          disabled={!selectedAgent}
        >
          {threadDisplay}
        </IonButton>
      </div>

      <IonPopover
        isOpen={backendPopoverOpen}
        onDidDismiss={() => setBackendPopoverOpen(false)}
        trigger="backend-selector-button"
        showBackdrop={false}
      >
        <IonList>
          <IonItem button onClick={() => handleBackendClick('typescript')}>
            <IonLabel>
              <span style={{ fontWeight: backendType === 'typescript' ? 'bold' : 'normal' }}>
                TypeScript
              </span>
            </IonLabel>
          </IonItem>
          <IonItem button onClick={() => handleBackendClick('python')}>
            <IonLabel>
              <span style={{ fontWeight: backendType === 'python' ? 'bold' : 'normal' }}>
                Python
              </span>
            </IonLabel>
          </IonItem>
        </IonList>
      </IonPopover>

      <IonPopover
        isOpen={agentPopoverOpen}
        onDidDismiss={() => setAgentPopoverOpen(false)}
        trigger="agent-selector-button"
        showBackdrop={false}
      >
        <IonList>
          {agents.map((agent) => (
            <IonItem
              key={agent.id}
              button
              onClick={() => handleAgentClick(agent.id)}
            >
              <IonLabel>
                <span
                  style={{
                    fontWeight: selectedAgent?.id === agent.id ? 'bold' : 'normal',
                  }}
                >
                  {agent.name}
                </span>
              </IonLabel>
            </IonItem>
          ))}
        </IonList>
      </IonPopover>

      <IonPopover
        isOpen={threadPopoverOpen}
        onDidDismiss={() => setThreadPopoverOpen(false)}
        trigger="thread-selector-button"
        showBackdrop={false}
      >
        <IonList>
          <IonItem button onClick={handleCreateNewThread}>
            <IonLabel>
              <span style={{ fontWeight: selectedThreadId === null ? 'bold' : 'normal' }}>
                + New Thread
              </span>
            </IonLabel>
          </IonItem>
          {loadingThreads ? (
            <IonItem>
              <IonLabel>Loading threads...</IonLabel>
            </IonItem>
          ) : (
            threads.map((thread) => (
              <IonItem
                key={thread.id}
                button
                onClick={() => handleThreadClick(thread.id)}
              >
                <IonLabel>
                  <span
                    style={{
                      fontWeight: selectedThreadId === thread.id ? 'bold' : 'normal',
                    }}
                  >
                    {thread.title || `Thread ${thread.id.slice(0, 8)}`}
                  </span>
                </IonLabel>
              </IonItem>
            ))
          )}
        </IonList>
      </IonPopover>
    </>
  );
};

export default CombinedAgentSelector;