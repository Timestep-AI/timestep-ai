import { useState } from 'react';
import {
  IonButton,
  IonPopover,
  IonList,
  IonItem,
  IonLabel,
} from '@ionic/react';
import type { AgentRecord } from '@/types/agent';
import type { ThreadMetadata } from '@/types/thread';

interface CombinedAgentSelectorProps {
  selectedAgent: AgentRecord | null;
  agents: AgentRecord[];
  threads: ThreadMetadata[];
  selectedThreadId: string | null;
  loadingThreads?: boolean;
  onAgentChange: (agentId: string) => void;
  onThreadChange: (threadId: string | null) => void;
  onCreateNewThread: () => void;
}

const CombinedAgentSelector = ({
  selectedAgent,
  agents,
  threads,
  selectedThreadId,
  loadingThreads = false,
  onAgentChange,
  onThreadChange,
  onCreateNewThread,
}: CombinedAgentSelectorProps) => {
  const [agentPopoverOpen, setAgentPopoverOpen] = useState(false);
  const [threadPopoverOpen, setThreadPopoverOpen] = useState(false);

  const agentDisplay = selectedAgent?.name || 'Select Agent';
  const selectedThread = threads.find((t) => t.id === selectedThreadId);
  const threadDisplay = selectedThread
    ? selectedThread.title || `Thread ${selectedThread.id.slice(0, 8)}`
    : 'New Thread';

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