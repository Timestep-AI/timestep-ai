import { Trace } from '@/types/trace';
import { CollectionItemRow } from './CollectionItemRow';
import { Activity, Clock, AlertTriangle, CheckCircle, XCircle } from 'lucide-react';

interface TraceRowProps {
  trace: Trace;
  onSelect: (trace: Trace) => void;
}

const getStatusIcon = (status: string) => {
  switch (status) {
    case 'ok':
      return <CheckCircle className="w-4 h-4 text-emerald-500" />;
    case 'error':
      return <XCircle className="w-4 h-4 text-red-500" />;
    case 'timeout':
      return <AlertTriangle className="w-4 h-4 text-orange-500" />;
    default:
      return <Activity className="w-4 h-4 text-text-tertiary" />;
  }
};

const getStatusColor = (status: string) => {
  switch (status) {
    case 'ok':
      return 'text-emerald-600 bg-emerald-50 border-emerald-200';
    case 'error':
      return 'text-red-600 bg-red-50 border-red-200';
    case 'timeout':
      return 'text-orange-600 bg-orange-50 border-orange-200';
    default:
      return 'text-text-secondary bg-surface border-border';
  }
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

export function TraceRow({ trace, onSelect }: TraceRowProps) {
  return (
    <CollectionItemRow
      icon={<Activity className="w-5 h-5 text-white" />}
      title={trace.name}
      description={`${trace.serviceCount} services • ${trace.spanCount} spans`}
      statusBadge={
        <div className="flex items-center space-x-2">
          {getStatusIcon(trace.status)}
          <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(trace.status)}`}>
            {trace.status}
          </span>
        </div>
      }
      metadata={[
        {
          icon: <Clock className="w-3 h-3" />,
          text: formatDuration(trace.duration)
        },
        ...(trace.errorCount > 0 ? [{
          icon: <XCircle className="w-3 h-3" />,
          text: `${trace.errorCount} error${trace.errorCount > 1 ? 's' : ''}`
        }] : []),
        {
          icon: null,
          text: new Date(trace.startTime).toLocaleString()
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