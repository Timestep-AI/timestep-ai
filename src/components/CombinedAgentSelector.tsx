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

interface CombinedAgentSelectorProps {
  backendType: BackendType;
  selectedAgent: AgentRecord | null;
  agents: AgentRecord[];
  onBackendChange: (backend: BackendType) => void;
  onAgentChange: (agentId: string) => void;
}

const CombinedAgentSelector = ({
  backendType,
  selectedAgent,
  agents,
  onBackendChange,
  onAgentChange,
}: CombinedAgentSelectorProps) => {
  const [backendPopoverOpen, setBackendPopoverOpen] = useState(false);
  const [agentPopoverOpen, setAgentPopoverOpen] = useState(false);

  const backendDisplay = backendType === 'typescript' ? 'TypeScript' : 'Python';
  const agentDisplay = selectedAgent?.name || 'Select Agent';

  const handleBackendClick = (backend: BackendType) => {
    onBackendChange(backend);
    setBackendPopoverOpen(false);
  };

  const handleAgentClick = (agentId: string) => {
    onAgentChange(agentId);
    setAgentPopoverOpen(false);
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
    </>
  );
};

export default CombinedAgentSelector;