import { Span } from '@/types/trace';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, AlertTriangle, ArrowLeft, Clock, Bot, Globe, Cpu, ArrowRight } from 'lucide-react';

interface SpanDetailsProps {
  span: Span;
  onBack?: () => void;
  isMobile?: boolean;
}

const getSpanTypeBadge = (span: Span) => {
  switch (span.type) {
    case 'agent':
      return <Badge className="bg-blue-100 text-blue-800 border-blue-200"><Bot className="w-3 h-3 mr-1" />Agent</Badge>;
    case 'api_request':
      return <Badge className="bg-purple-100 text-purple-800 border-purple-200"><Globe className="w-3 h-3 mr-1" />Generation</Badge>;
    case 'function_call':
      return <Badge className="bg-green-100 text-green-800 border-green-200"><Cpu className="w-3 h-3 mr-1" />Function</Badge>;
    case 'handoff':
      return <Badge className="bg-orange-100 text-orange-800 border-orange-200"><ArrowRight className="w-3 h-3 mr-1" />Handoff</Badge>;
    default:
      return null;
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

export function SpanDetails({ span, onBack, isMobile = false }: SpanDetailsProps) {
  const renderAgentDetails = () => (
    <>
      {/* Properties */}
      <div className="space-y-3">
        <h4 className="font-medium text-text-primary">Properties</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-tertiary">Created</span>
            <span className="text-text-primary">{new Date(span.startTime).toLocaleDateString()}, {new Date(span.startTime).toLocaleTimeString()}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-text-tertiary">Output type</span>
            <span className="text-text-primary">text</span>
          </div>
          {span.tags?.['handoff.to'] && (
            <div className="flex justify-between">
              <span className="text-text-tertiary">Handoffs</span>
              <span className="text-text-primary">{span.tags['handoff.to']}</span>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const renderGenerationDetails = () => (
    <>
      {/* Properties */}
      <div className="space-y-3">
        <h4 className="font-medium text-text-primary">Properties</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-tertiary">Created</span>
            <span className="text-text-primary">{new Date(span.startTime).toLocaleDateString()}, {new Date(span.startTime).toLocaleTimeString()}</span>
          </div>
          {span.model && (
            <div className="flex justify-between">
              <span className="text-text-tertiary">Model</span>
              <span className="text-text-primary">{span.model}</span>
            </div>
          )}
        </div>
      </div>

      {/* Input */}
      <div className="space-y-3">
        <h4 className="font-medium text-text-primary">Input</h4>
        <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs overflow-x-auto">
          <pre className="text-green-400">
{`{
  "content": "You are a basic agent",
  "role": "system"
}

{
  "content": [
    {
      "text": "What's the weather in San Francisco?",
      "type": "input_text"
    }
  ]
}`}
          </pre>
        </div>
      </div>
    </>
  );

  const renderHandoffDetails = () => (
    <>
      {/* Properties */}
      <div className="space-y-3">
        <h4 className="font-medium text-text-primary">Properties</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-tertiary">Created</span>
            <span className="text-text-primary">{new Date(span.startTime).toLocaleDateString()}, {new Date(span.startTime).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Agents */}
      <div className="space-y-3">
        <h4 className="font-medium text-text-primary">Agents</h4>
        <div className="space-y-2">
          {span.tags?.['handoff.from'] && (
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-4 h-4 text-green-500" />
              <span className="text-sm text-text-primary">{span.tags['handoff.from']} agent</span>
            </div>
          )}
          {span.tags?.['handoff.to'] && (
            <div className="flex items-center space-x-2">
              <div className="w-4 h-4 border-2 border-gray-300 rounded-full" />
              <span className="text-sm text-text-primary">{span.tags['handoff.to']} agent</span>
            </div>
          )}
        </div>
      </div>
    </>
  );

  const renderFunctionDetails = () => (
    <>
      {/* Properties */}
      <div className="space-y-3">
        <h4 className="font-medium text-text-primary">Properties</h4>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-text-tertiary">Created</span>
            <span className="text-text-primary">{new Date(span.startTime).toLocaleDateString()}, {new Date(span.startTime).toLocaleTimeString()}</span>
          </div>
        </div>
      </div>

      {/* Function call */}
      <div className="space-y-3">
        <h4 className="font-medium text-text-primary">Function call</h4>
        <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs">
          <span className="text-blue-400">{span.tags?.['function.name'] || span.operationName}()</span>
        </div>
      </div>

      {/* Output */}
      <div className="space-y-3">
        <h4 className="font-medium text-text-primary">Output</h4>
        <div className="bg-gray-900 rounded-lg p-3 font-mono text-xs">
          <span className="text-gray-300">The user info is John Doe.</span>
        </div>
      </div>
    </>
  );

  const renderContent = () => {
    switch (span.type) {
      case 'agent':
        return renderAgentDetails();
      case 'api_request':
        return renderGenerationDetails();
      case 'handoff':
        return renderHandoffDetails();
      case 'function_call':
        return renderFunctionDetails();
      default:
        return null;
    }
  };

  return (
    <div className="h-full bg-background">
      {isMobile && (
        <div className="flex items-center justify-between p-4 border-b border-border">
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="p-0"
          >
            <ArrowLeft className="w-4 h-4 mr-2" />
            Traces
          </Button>
          <h1 className="font-semibold text-text-primary">Span details</h1>
          <div className="w-8" /> {/* Spacer */}
        </div>
      )}
      
      <div className="p-4 space-y-6">
        <div>
          <h3 className="text-lg font-semibold text-text-primary mb-2">
            {span.operationName}
          </h3>
          <div className="flex items-center space-x-2 mb-2">
            {getSpanTypeBadge(span)}
            <div className="flex items-center space-x-1 text-xs text-text-tertiary">
              <Clock className="w-3 h-3" />
              <span>{formatDuration(span.duration)}</span>
            </div>
            <span className="text-xs text-text-tertiary font-mono">{span.id}</span>
          </div>
        </div>

        {renderContent()}
      </div>
    </div>
  );
}