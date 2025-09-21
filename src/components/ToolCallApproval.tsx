import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { CheckCircle, XCircle, Settings, Eye } from 'lucide-react';
import { PendingToolCall } from '@/types/a2a';

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
    <Card className="w-full max-w-2xl mx-auto mb-4 border-orange-200 bg-orange-50">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-800">
          <Settings className="w-5 h-5" />
          Tool Call Approval Required
        </CardTitle>
        <CardDescription className="text-orange-700">
          The agent wants to execute a tool call that requires your approval.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Tool Call Details */}
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-mono">
              {toolCall.name}
            </Badge>
            <span className="text-sm text-gray-600">ID: {toolCall.id}</span>
          </div>
          
          {toolCall.description && (
            <p className="text-sm text-gray-700">{toolCall.description}</p>
          )}
        </div>

        {/* Parameters */}
        {Object.keys(toolCall.parameters).length > 0 && (
          <div className="space-y-2">
            <Label className="text-sm font-medium">Parameters:</Label>
            <div className="bg-gray-50 p-3 rounded-md space-y-1">
              {Object.entries(toolCall.parameters).map(([key, value]) => (
                <div key={key} className="flex justify-between text-sm">
                  <span className="font-mono text-gray-600">{key}:</span>
                  <span className="font-mono text-gray-800">
                    {typeof value === 'string' ? `"${value}"` : JSON.stringify(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Reason Input */}
        <div className="space-y-2">
          <Label htmlFor="reason" className="text-sm font-medium">
            Reason (optional):
          </Label>
          <Textarea
            id="reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Enter a reason for your decision..."
            className="min-h-[60px]"
          />
        </div>

        {/* Modify Parameters */}
        {showModifyForm ? (
          <div className="space-y-3 p-3 bg-blue-50 rounded-md">
            <Label className="text-sm font-medium text-blue-800">Modify Parameters:</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label htmlFor="paramName" className="text-xs">Parameter Name</Label>
                <input
                  id="paramName"
                  type="text"
                  value={modifyParam}
                  onChange={(e) => setModifyParam(e.target.value)}
                  placeholder="e.g., city"
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
              <div>
                <Label htmlFor="paramValue" className="text-xs">New Value</Label>
                <input
                  id="paramValue"
                  type="text"
                  value={modifyValue}
                  onChange={(e) => setModifyValue(e.target.value)}
                  placeholder="e.g., San Francisco"
                  className="w-full px-2 py-1 text-sm border rounded"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                onClick={handleModify}
                disabled={!modifyParam.trim() || !modifyValue.trim()}
              >
                Apply Change
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => setShowModifyForm(false)}
              >
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <Button
            size="sm"
            variant="outline"
            onClick={() => setShowModifyForm(true)}
            className="w-full"
          >
            <Settings className="w-4 h-4 mr-2" />
            Modify Parameters
          </Button>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2">
          <Button
            onClick={handleApprove}
            className="flex-1 bg-green-600 hover:bg-green-700"
          >
            <CheckCircle className="w-4 h-4 mr-2" />
            Approve
          </Button>
          <Button
            onClick={handleReject}
            variant="destructive"
            className="flex-1"
          >
            <XCircle className="w-4 h-4 mr-2" />
            Reject
          </Button>
        </div>

        {/* Additional Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            variant="outline"
            onClick={onShowParams}
            className="flex-1"
          >
            <Eye className="w-4 h-4 mr-2" />
            Show Parameters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};
