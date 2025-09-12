import { Span } from '@/types/trace';
import { CollectionItemRow } from './CollectionItemRow';
import { TimingBar } from './TimingBar';
import { Zap, Clock, CheckCircle, XCircle, AlertTriangle, Bot, Globe, Cpu, ArrowRight } from 'lucide-react';

interface SpanRowProps {
  span: Span;
  onSelect: (span: Span) => void;
  maxDuration?: number;
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

const getTypeIcon = (type: string) => {
  switch (type) {
    case 'agent':
      return <Bot className="w-5 h-5 text-white" />;
    case 'api_request':
      return <Globe className="w-5 h-5 text-white" />;
    case 'function_call':
      return <Cpu className="w-5 h-5 text-white" />;
    case 'handoff':
      return <ArrowRight className="w-5 h-5 text-white" />;
    default:
      return <Zap className="w-5 h-5 text-white" />;
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

export function SpanRow({ span, onSelect, maxDuration = 10000 }: SpanRowProps) {
  const getDescription = () => {
    if (span.type === 'agent' && span.model) {
      return `${span.serviceName} • ${span.model}`;
    }
    if (span.type === 'function_call' && span.tags?.['function.name']) {
      return `${span.tags['function.name']}()`;
    }
    return span.serviceName;
  };

  return (
    <CollectionItemRow
      icon={getTypeIcon(span.type)}
      title={span.operationName}
      description={getDescription()}
      statusBadge={
        <div className="flex items-center space-x-2 min-w-[200px]">
          <TimingBar
            duration={span.duration}
            maxDuration={maxDuration}
            status={span.status}
            className="flex-1"
          />
          <span className="text-xs text-text-tertiary whitespace-nowrap">
            {formatDuration(span.duration)}
          </span>
        </div>
      }
      metadata={[
        ...(span.tokens ? [{
          icon: null,
          text: `${span.tokens.total} tokens`
        }] : []),
        ...(span.functions && span.functions.length > 0 ? [{
          icon: null,
          text: `${span.functions.length} function${span.functions.length > 1 ? 's' : ''}`
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