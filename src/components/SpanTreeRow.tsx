import { Span } from '@/types/trace';
import { TimingBar } from './TimingBar';
import { Zap, Clock, CheckCircle, XCircle, AlertTriangle, Bot, Globe, Cpu, ArrowRight } from 'lucide-react';

interface SpanTreeRowProps {
  span: Span;
  onSelect: (span: Span) => void;
  maxDuration?: number;
  isSelected?: boolean;
  level?: number;
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
      return <Bot className="w-4 h-4" />;
    case 'api_request':
      return <Globe className="w-4 h-4" />;
    case 'function_call':
      return <Cpu className="w-4 h-4" />;
    case 'handoff':
      return <ArrowRight className="w-4 h-4" />;
    default:
      return <Zap className="w-4 h-4" />;
  }
};

const formatDuration = (duration: number) => {
  if (duration < 1000) {
    return `${duration} ms`;
  } else if (duration < 60000) {
    return `${(duration / 1000).toFixed(1)} s`;
  } else {
    return `${(duration / 60000).toFixed(1)} m`;
  }
};

export function SpanTreeRow({ span, onSelect, maxDuration = 10000, isSelected = false, level = 0 }: SpanTreeRowProps) {
  const getDescription = () => {
    if (span.type === 'agent' && span.model) {
      return span.model;
    }
    if (span.type === 'function_call' && span.tags?.['function.name']) {
      return `${span.tags['function.name']}()`;
    }
    return span.serviceName;
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'agent':
        return 'bg-blue-500';
      case 'api_request':
        return 'bg-purple-500';
      case 'function_call':
        return 'bg-green-500';
      case 'handoff':
        return 'bg-orange-500';
      default:
        return 'bg-gray-500';
    }
  };

  return (
    <div 
      className={`
        flex items-center py-2 px-3 hover:bg-surface-elevated cursor-pointer transition-colors
        ${isSelected ? 'bg-primary/10 border-l-2 border-primary' : ''}
      `}
      onClick={() => onSelect(span)}
      style={{ paddingLeft: `${12 + level * 20}px` }}
    >
      {/* Left section - Icon, title, description */}
      <div className="flex items-center space-x-2 flex-1 min-w-0">
        <div className={`w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 ${getTypeColor(span.type)}`}>
          <div className="text-white">
            {getTypeIcon(span.type)}
          </div>
        </div>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center space-x-2">
            <span className="text-sm font-medium text-text-primary truncate">
              {span.operationName}
            </span>
            {span.type === 'handoff' && (
              <ArrowRight className="w-3 h-3 text-text-tertiary flex-shrink-0" />
            )}
          </div>
          <div className="text-xs text-text-secondary truncate">
            {getDescription()}
          </div>
        </div>
      </div>

      {/* Right section - Timing bar and duration */}
      <div className="flex items-center space-x-3 min-w-[280px] justify-end">
        <div className="flex-1 max-w-[200px]">
          <TimingBar
            duration={span.duration}
            maxDuration={maxDuration}
            status={span.status}
          />
        </div>
        <span className="text-xs text-text-tertiary whitespace-nowrap w-16 text-right">
          {formatDuration(span.duration)}
        </span>
      </div>
    </div>
  );
}