import { Span } from '@/types/trace';
import { CollectionItemRow } from './CollectionItemRow';
import { Zap, Clock, CheckCircle, XCircle, AlertTriangle, Database, Globe, Cpu } from 'lucide-react';

interface SpanRowProps {
  span: Span;
  onSelect: (span: Span) => void;
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
      return <Zap className="w-4 h-4 text-text-tertiary" />;
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

const getServiceIcon = (serviceName: string) => {
  if (serviceName.includes('database') || serviceName.includes('db')) {
    return <Database className="w-5 h-5 text-white" />;
  } else if (serviceName.includes('api') || serviceName.includes('gateway')) {
    return <Globe className="w-5 h-5 text-white" />;
  } else {
    return <Cpu className="w-5 h-5 text-white" />;
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

export function SpanRow({ span, onSelect }: SpanRowProps) {
  const hasLogs = span.logs && span.logs.length > 0;
  const hasTags = span.tags && Object.keys(span.tags).length > 0;

  return (
    <CollectionItemRow
      icon={getServiceIcon(span.serviceName)}
      title={span.operationName}
      description={`${span.serviceName}${span.parentId ? ' • Child Span' : ' • Root Span'}`}
      statusBadge={
        <div className="flex items-center space-x-2">
          {getStatusIcon(span.status)}
          <span className={`px-2 py-1 text-xs rounded-full border ${getStatusColor(span.status)}`}>
            {span.status}
          </span>
        </div>
      }
      metadata={[
        {
          icon: <Clock className="w-3 h-3" />,
          text: formatDuration(span.duration)
        },
        ...(hasLogs ? [{
          icon: null,
          text: `${span.logs!.length} log${span.logs!.length > 1 ? 's' : ''}`
        }] : []),
        ...(hasTags ? [{
          icon: null,
          text: `${Object.keys(span.tags!).length} tag${Object.keys(span.tags!).length > 1 ? 's' : ''}`
        }] : []),
        {
          icon: null,
          text: new Date(span.startTime).toLocaleString()
        }
      ]}
      onItemClick={() => onSelect(span)}
      dropdownItems={[
        {
          label: 'View Details',
          onClick: () => onSelect(span)
        }
      ]}
    />
  );
}