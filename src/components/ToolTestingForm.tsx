import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Play, CheckCircle, XCircle, AlertTriangle, Info } from 'lucide-react';
import { Tool } from '@/types/tool';
import { toolsService } from '@/services/toolsService';

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
      const response = await toolsService.callTool(tool.id, inputs);
      
      // Handle JSON-RPC response format
      if (typeof response === 'string') {
        try {
          const parsed = JSON.parse(response);
          if (parsed.result && parsed.result.content && Array.isArray(parsed.result.content)) {
            // Extract text from content array
            const textContent = parsed.result.content
              .filter((item: any) => item.type === 'text')
              .map((item: any) => item.text)
              .join('\n');
            setResult(textContent);
          } else {
            setResult(response);
          }
        } catch {
          // If parsing fails, just show the raw response
          setResult(response);
        }
      } else {
        setResult(JSON.stringify(response, null, 2));
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to call tool');
    } finally {
      setLoading(false);
    }
  };

  const parseWeatherAlerts = (text: string) => {
    console.log('Parsing text:', text); // Debug log
    
    // Split by --- but also handle the case where it might be at the end
    const alerts = text.split(/---\n?/).filter(alert => alert.trim().length > 0);
    console.log('Split alerts:', alerts.length); // Debug log
    
    return alerts.map((alert, index) => {
      const lines = alert.trim().split('\n');
      const alertData: any = { id: index };
      
      // Parse each line for alert data
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        
        if (line.startsWith('Event: ')) {
          alertData.event = line.replace('Event: ', '');
        } else if (line.startsWith('Area: ')) {
          alertData.area = line.replace('Area: ', '');
        } else if (line.startsWith('Severity: ')) {
          alertData.severity = line.replace('Severity: ', '');
        } else if (line.startsWith('Description: ')) {
          // Find the description content - everything after "Description: " until "Instructions:"
          const descriptionStart = i;
          let descriptionEnd = lines.length;
          
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].startsWith('Instructions: ')) {
              descriptionEnd = j;
              break;
            }
          }
          
          // Combine description lines
          const descLines = [lines[i].replace('Description: ', '')];
          for (let j = descriptionStart + 1; j < descriptionEnd; j++) {
            if (lines[j].trim()) {
              descLines.push(lines[j]);
            }
          }
          alertData.description = descLines.join('\n').trim();
          
        } else if (line.startsWith('Instructions: ')) {
          // Get all remaining lines as instructions
          const instructionLines = [line.replace('Instructions: ', '')];
          for (let j = i + 1; j < lines.length; j++) {
            if (lines[j].trim()) {
              instructionLines.push(lines[j]);
            }
          }
          alertData.instructions = instructionLines.join('\n').trim();
          break; // Instructions are typically at the end
        }
      }
      
      console.log('Parsed alert:', alertData); // Debug log
      return alertData;
    }).filter(alert => alert.event); // Only return alerts with an event
  };

  const getSeverityIcon = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'severe': return <AlertTriangle className="w-4 h-4 text-red-500" />;
      case 'moderate': return <AlertTriangle className="w-4 h-4 text-yellow-500" />;
      case 'minor': return <Info className="w-4 h-4 text-blue-500" />;
      default: return <Info className="w-4 h-4 text-gray-500" />;
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case 'severe': return 'destructive';
      case 'moderate': return 'secondary';
      case 'minor': return 'outline';
      default: return 'outline';
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
              <div className="space-y-4">
                <Badge variant="default">Success</Badge>
                
                <Tabs defaultValue="formatted" className="w-full">
                  <TabsList className="grid w-full grid-cols-2">
                    <TabsTrigger value="formatted">Formatted View</TabsTrigger>
                    <TabsTrigger value="raw">Raw Response</TabsTrigger>
                  </TabsList>
                  
                  <TabsContent value="formatted" className="mt-4">
                    {tool.name === 'get-alerts' ? (
                      <div className="space-y-4">
                        {(() => {
                          const alerts = parseWeatherAlerts(result);
                          console.log('Final parsed alerts:', alerts); // Debug log
                          
                          if (alerts.length === 0) {
                            return (
                              <div className="text-center py-8 text-muted-foreground">
                                <p>No weather alerts found or unable to parse the response.</p>
                                <p className="text-xs mt-2">Check the Raw Response tab to see the full data.</p>
                              </div>
                            );
                          }
                          
                          return alerts.map((alert) => (
                            <Card key={alert.id} className="border-l-4 border-l-primary">
                              <CardHeader className="pb-3">
                                <div className="flex items-center justify-between">
                                  <CardTitle className="text-lg flex items-center gap-2">
                                    {getSeverityIcon(alert.severity)}
                                    {alert.event || 'Unknown Event'}
                                  </CardTitle>
                                  {alert.severity && (
                                    <Badge variant={getSeverityColor(alert.severity) as any}>
                                      {alert.severity}
                                    </Badge>
                                  )}
                                </div>
                                {alert.area && (
                                  <p className="text-sm text-muted-foreground">{alert.area}</p>
                                )}
                              </CardHeader>
                              <CardContent className="space-y-3">
                                {alert.description && (
                                  <div>
                                    <h4 className="font-medium text-sm mb-1">Description</h4>
                                    <p className="text-sm whitespace-pre-wrap">{alert.description}</p>
                                  </div>
                                )}
                                {alert.instructions && (
                                  <div>
                                    <h4 className="font-medium text-sm mb-1">Instructions</h4>
                                    <p className="text-sm whitespace-pre-wrap">{alert.instructions}</p>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ));
                        })()}
                      </div>
                    ) : (
                      <pre className="whitespace-pre-wrap text-sm bg-background-secondary p-3 rounded border overflow-x-auto">
                        {result}
                      </pre>
                    )}
                  </TabsContent>
                  
                  <TabsContent value="raw" className="mt-4">
                    <pre className="whitespace-pre-wrap text-sm bg-background-secondary p-3 rounded border overflow-x-auto">
                      {result}
                    </pre>
                  </TabsContent>
                </Tabs>
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