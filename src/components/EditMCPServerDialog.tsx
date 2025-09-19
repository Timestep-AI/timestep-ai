import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { MCPServer } from '@/types/mcpServer';
import { toast } from 'sonner';

interface EditMCPServerDialogProps {
  server: MCPServer | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<MCPServer>) => Promise<void>;
}

export const EditMCPServerDialog = ({
  server,
  open,
  onOpenChange,
  onSave,
}: EditMCPServerDialogProps) => {
  const [formData, setFormData] = useState({
    name: server?.name || '',
    description: server?.description || '',
    serverUrl: server?.serverUrl || '',
    enabled: server?.enabled ?? true,
    authToken: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!server) return;

    setLoading(true);
    try {
      const updates: Partial<MCPServer> = {
        name: formData.name,
        description: formData.description,
        serverUrl: formData.serverUrl,
        enabled: formData.enabled,
      };
      
      // Only include auth token if it was provided
      if (formData.authToken.trim()) {
        updates.authToken = formData.authToken;
      }

      await onSave(server.id, updates);
      toast.success('MCP server updated successfully');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update MCP server');
      console.error('Error updating MCP server:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset form when server changes
  React.useEffect(() => {
    if (server) {
      setFormData({
        name: server.name || '',
        description: server.description || '',
        serverUrl: server.serverUrl || '',
        enabled: server.enabled ?? true,
        authToken: '',
      });
    }
  }, [server]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit MCP Server</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input
              id="name"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              placeholder="Server name"
            />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="Server description"
              rows={3}
            />
          </div>
          <div>
            <Label htmlFor="serverUrl">Server URL</Label>
            <Input
              id="serverUrl"
              value={formData.serverUrl}
              onChange={(e) => setFormData({ ...formData, serverUrl: e.target.value })}
              placeholder="e.g., https://api.example.com"
            />
          </div>
          <div>
            <Label htmlFor="authToken">Auth Token</Label>
            <Input
              id="authToken"
              type="password"
              value={formData.authToken}
              onChange={(e) => setFormData({ ...formData, authToken: e.target.value })}
              placeholder="Leave empty to keep current token"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Leave empty to keep the current auth token. Tokens are encrypted when saved.
            </p>
          </div>
          <div className="flex items-center space-x-2">
            <Switch
              id="enabled"
              checked={formData.enabled}
              onCheckedChange={(enabled) => setFormData({ ...formData, enabled })}
            />
            <Label htmlFor="enabled">Enabled</Label>
          </div>
          <div className="flex justify-end space-x-2">
            <Button variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button onClick={handleSave} disabled={loading}>
              {loading ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};