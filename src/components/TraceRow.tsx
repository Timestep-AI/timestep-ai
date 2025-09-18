import { Trace } from '@/types/trace';
import { CollectionItemRow } from './CollectionItemRow';
import { Activity, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface TraceRowProps {
  trace: Trace;
  onSelect: (trace: Trace) => void;
}

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

export function TraceRow({ trace, onSelect }: TraceRowProps) {
  const agentsList = trace.first_5_agents?.join(', ') || 'No agents';
  const description = trace.first_5_agents 
    ? `${trace.first_5_agents.length} agent${trace.first_5_agents.length > 1 ? 's' : ''} • ${trace.handoff_count} handoff${trace.handoff_count !== 1 ? 's' : ''}`
    : `${trace.handoff_count} handoff${trace.handoff_count !== 1 ? 's' : ''} • ${trace.tool_count} tool${trace.tool_count !== 1 ? 's' : ''}`;

  return (
    <CollectionItemRow
      icon={<Activity className="w-5 h-5 text-white" />}
      title={trace.workflow_name}
      description={description}
      metadata={[
        {
          icon: <Clock className="w-3 h-3" />,
          text: formatDuration(trace.duration_ms)
        },
        ...(trace.tool_count > 0 ? [{
          icon: <Activity className="w-3 h-3" />,
          text: `${trace.tool_count} tool${trace.tool_count > 1 ? 's' : ''}`
        }] : []),
        {
          icon: null,
          text: new Date(trace.created_at).toLocaleString()
        }
      ]}
      onItemClick={() => onSelect(trace)}
      dropdownItems={[
        {
          label: 'View Details',
          onClick: () => onSelect(trace)
        }
      ]}
    />
  );
}