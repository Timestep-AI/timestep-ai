import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Loader2, Play, CheckCircle, XCircle } from 'lucide-react';
import { Tool } from '@/types/tool';
import { mcpClient } from '@/services/mcpClient';

interface ToolTestingFormProps {
  tool: Tool;
}

export const ToolTestingForm = ({ tool }: ToolTestingFormProps) => {
  const [inputs, setInputs] = useState<Record<string, any>>({});
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleInputChange = (key: string, value: any) => {
    setInputs(prev => ({
      ...prev,
      [key]: value
    }));
  };

  const handleTest = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await mcpClient.callTool(tool.name, inputs);
      setResult(response);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to call tool');
    } finally {
      setLoading(false);
    }
  };

  const renderInputField = (propertyName: string, schema: any) => {
    const inputType = schema.type;
    const description = schema.description;
    const required = tool.inputSchema?.required?.includes(propertyName) || false;

    switch (inputType) {
      case 'string':
        if (schema.enum) {
          return (
            <div key={propertyName} className="space-y-2">
              <Label htmlFor={propertyName}>
                {propertyName} {required && <span className="text-destructive">*</span>}
              </Label>
              <select
                id={propertyName}
                className="w-full px-3 py-2 border border-input bg-background rounded-md"
                value={inputs[propertyName] || ''}
                onChange={(e) => handleInputChange(propertyName, e.target.value)}
              >
                <option value="">Select an option</option>
                {schema.enum.map((option: string) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
              {description && (
                <p className="text-sm text-text-tertiary">{description}</p>
              )}
            </div>
          );
        }
        
        if (description?.includes('multiline') || description?.includes('long')) {
          return (
            <div key={propertyName} className="space-y-2">
              <Label htmlFor={propertyName}>
                {propertyName} {required && <span className="text-destructive">*</span>}
              </Label>
              <Textarea
                id={propertyName}
                placeholder={description || `Enter ${propertyName}`}
                value={inputs[propertyName] || ''}
                onChange={(e) => handleInputChange(propertyName, e.target.value)}
                rows={3}
              />
              {description && (
                <p className="text-sm text-text-tertiary">{description}</p>
              )}
            </div>
          );
        }
        
        return (
          <div key={propertyName} className="space-y-2">
            <Label htmlFor={propertyName}>
              {propertyName} {required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={propertyName}
              type="text"
              placeholder={description || `Enter ${propertyName}`}
              value={inputs[propertyName] || ''}
              onChange={(e) => handleInputChange(propertyName, e.target.value)}
            />
            {description && (
              <p className="text-sm text-text-tertiary">{description}</p>
            )}
          </div>
        );

      case 'number':
      case 'integer':
        return (
          <div key={propertyName} className="space-y-2">
            <Label htmlFor={propertyName}>
              {propertyName} {required && <span className="text-destructive">*</span>}
            </Label>
            <Input
              id={propertyName}
              type="number"
              placeholder={description || `Enter ${propertyName}`}
              value={inputs[propertyName] || ''}
              onChange={(e) => handleInputChange(propertyName, parseFloat(e.target.value) || e.target.value)}
            />
            {description && (
              <p className="text-sm text-text-tertiary">{description}</p>
            )}
          </div>
        );

      case 'boolean':
        return (
          <div key={propertyName} className="space-y-2">
            <Label htmlFor={propertyName}>
              {propertyName} {required && <span className="text-destructive">*</span>}
            </Label>
            <select
              id={propertyName}
              className="w-full px-3 py-2 border border-input bg-background rounded-md"
              value={inputs[propertyName] !== undefined ? inputs[propertyName].toString() : ''}
              onChange={(e) => handleInputChange(propertyName, e.target.value === 'true')}
            >
              <option value="">Select true/false</option>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
            {description && (
              <p className="text-sm text-text-tertiary">{description}</p>
            )}
          </div>
        );

      default:
        return (
          <div key={propertyName} className="space-y-2">
            <Label htmlFor={propertyName}>
              {propertyName} {required && <span className="text-destructive">*</span>}
            </Label>
            <Textarea
              id={propertyName}
              placeholder={`Enter ${propertyName} (JSON format)`}
              value={inputs[propertyName] ? JSON.stringify(inputs[propertyName], null, 2) : ''}
              onChange={(e) => {
                try {
                  const parsed = JSON.parse(e.target.value);
                  handleInputChange(propertyName, parsed);
                } catch {
                  handleInputChange(propertyName, e.target.value);
                }
              }}
              rows={3}
            />
            {description && (
              <p className="text-sm text-text-tertiary">{description}</p>
            )}
          </div>
        );
    }
  };

  const hasInputSchema = tool.inputSchema?.properties && Object.keys(tool.inputSchema.properties).length > 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="w-5 h-5" />
          Test Tool
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {hasInputSchema ? (
          <div className="space-y-4">
            <div className="text-sm text-text-secondary">
              Configure the input parameters for this tool:
            </div>
            
            {Object.entries(tool.inputSchema.properties).map(([key, schema]) =>
              renderInputField(key, schema)
            )}
          </div>
        ) : (
          <div className="text-sm text-text-secondary">
            This tool doesn't require any input parameters.
          </div>
        )}

        <Button 
          onClick={handleTest} 
          disabled={loading || tool.status !== 'available'}
          className="w-full"
        >
          {loading ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Calling Tool...
            </>
          ) : (
            <>
              <Play className="w-4 h-4 mr-2" />
              Test Tool
            </>
          )}
        </Button>

        {result && (
          <Alert>
            <CheckCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <Badge variant="default">Success</Badge>
                <pre className="whitespace-pre-wrap text-sm bg-background-secondary p-3 rounded border overflow-x-auto">
                  {result}
                </pre>
              </div>
            </AlertDescription>
          </Alert>
        )}

        {error && (
          <Alert variant="destructive">
            <XCircle className="h-4 w-4" />
            <AlertDescription>
              <div className="space-y-2">
                <Badge variant="destructive">Error</Badge>
                <p className="text-sm">{error}</p>
              </div>
            </AlertDescription>
          </Alert>
        )}
      </CardContent>
    </Card>
  );
};