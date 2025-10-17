import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Settings, Eye } from 'lucide-react';
import { PendingToolCall } from '@/types/toolCall';

interface ToolCallApprovalProps {
  toolCall: PendingToolCall;
  onApprove: (reason?: string) => void;
  onReject: (reason?: string) => void;
  onModify: (paramName: string, value: any) => void;
  onShowParams: () => void;
  isVisible: boolean;
}

export const ToolCallApproval = ({
  toolCall,
  onApprove,
  onReject,
  onModify,
  onShowParams,
  isVisible
}: ToolCallApprovalProps) => {
  const [reason, setReason] = useState('');
  const [modifyParam, setModifyParam] = useState('');
  const [modifyValue, setModifyValue] = useState('');
  const [showModifyForm, setShowModifyForm] = useState(false);

  console.log('ToolCallApproval received toolCall:', toolCall);
  console.log('toolCall.parameters:', toolCall.parameters);
  console.log('toolCall.parameters type:', typeof toolCall.parameters);
  console.log('Object.keys(toolCall.parameters):', Object.keys(toolCall.parameters));
  console.log('Object.entries(toolCall.parameters):', Object.entries(toolCall.parameters));

  if (!isVisible) return null;

  const handleApprove = () => {
    onApprove(reason.trim() || undefined);
    setReason('');
  };

  const handleReject = () => {
    onReject(reason.trim() || undefined);
    setReason('');
  };

  const handleModify = () => {
    if (modifyParam.trim() && modifyValue.trim()) {
      onModify(modifyParam.trim(), modifyValue.trim());
      setModifyParam('');
      setModifyValue('');
      setShowModifyForm(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl mx-auto mb-4 border-border bg-card">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-text-primary">
          <Settings className="w-5 h-5" />
          Tool Call Approval Required
        </CardTitle>
        <CardDescription className="text-text-secondary">
          The agent wants to execute a tool call that requires your approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tool Call Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono bg-primary/20 border-primary/40 text-primary">
              {toolCall.name}
            </Badge>
            <span className="text-sm text-text-tertiary">ID: {toolCall.id}</span>
          </div>

          {toolCall.description && (
            <p className="text-sm text-text-secondary">{toolCall.description}</p>
          )}
        </div>

        {/* Parameters */}
        {Object.keys(toolCall.parameters).length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium text-text-primary">Parameters:</Label>
            <div className="bg-surface-elevated p-3 rounded-md border border-border space-y-1">
              {Object.entries(toolCall.parameters).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="font-mono text-primary">{key}:</span>
                  <span className="font-mono text-text-secondary">
                    {typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reason Input */}
        <div className="space-y-2">
          <Label htmlFor="reason" className="text-sm font-medium text-text-primary">
            Reason (optional):
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter a reason for your decision..."
            className="min-h-[60px] bg-surface border-border text-text-primary placeholder:text-text-tertiary"
          />
        </div>

        {/* Modify Parameters */}
        <Button
          size="sm"
          variant="outline"
          onClick={() => setShowModifyForm(!showModifyForm)}
          className="w-full"
        >
          <Settings className="w-4 h-4 mr-2" />
          Modify Parameters
        </Button>

        {/* Action Buttons */}
        {toolCall.approved ? (
          <div className="flex items-center justify-center gap-2 p-3 bg-green-900/20 border border-green-600/30 rounded-lg">
            <CheckCircle className="w-5 h-5 text-green-400" />
            <span className="text-green-400 font-medium">Tool Call Approved</span>
          </div>
        ) : (
          <div className="flex gap-2">
            <Button
              onClick={handleApprove}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white"
            >
              <CheckCircle className="w-4 h-4 mr-2" />
              Approve
            </Button>
            <Button
              onClick={handleReject}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white"
            >
              <XCircle className="w-4 h-4 mr-2" />
              Reject
            </Button>
          </div>
        )}

        {/* Additional Actions */}
        <Button
          size="sm"
          variant="outline"
          onClick={onShowParams}
          className="w-full"
        >
          <Eye className="w-4 h-4 mr-2" />
          Show Parameters
        </Button>
      </CardContent>
    </Card>
  );
};
