import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { ModelProvider } from '@/services/modelProvidersService';
import { toast } from 'sonner';

interface EditModelProviderDialogProps {
  provider: ModelProvider | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSave: (id: string, updates: Partial<ModelProvider>) => Promise<void>;
}

export const EditModelProviderDialog = ({
  provider,
  open,
  onOpenChange,
  onSave,
}: EditModelProviderDialogProps) => {
  const [formData, setFormData] = useState({
    provider: provider?.provider || '',
    baseUrl: provider?.baseUrl || '',
    modelsUrl: provider?.modelsUrl || '',
    apiKey: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const updates: Partial<ModelProvider> = {
        provider: formData.provider,
        baseUrl: formData.baseUrl,
        modelsUrl: formData.modelsUrl,
      };
      
      // Only include API key if it was provided
      if (formData.apiKey.trim()) {
        updates.apiKey = formData.apiKey;
      }

      await onSave(provider.id, updates);
      toast.success('Model provider updated successfully');
      onOpenChange(false);
    } catch (error) {
      toast.error('Failed to update model provider');
      console.error('Error updating model provider:', error);
    } finally {
      setLoading(false);
    }
  };

  // Reset form when provider changes
  React.useEffect(() => {
    if (provider) {
      setFormData({
        provider: provider.provider || '',
        baseUrl: provider.baseUrl || '',
        modelsUrl: provider.modelsUrl || '',
        apiKey: '',
      });
    }
  }, [provider]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Edit Model Provider</DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          <div>
            <Label htmlFor="provider">Provider Name</Label>
            <Input
              id="provider"
              value={formData.provider}
              onChange={(e) => setFormData({ ...formData, provider: e.target.value })}
              placeholder="e.g., openai, anthropic"
            />
          </div>
          <div>
            <Label htmlFor="baseUrl">Base URL</Label>
            <Input
              id="baseUrl"
              value={formData.baseUrl}
              onChange={(e) => setFormData({ ...formData, baseUrl: e.target.value })}
              placeholder="e.g., https://api.openai.com/v1"
            />
          </div>
          <div>
            <Label htmlFor="modelsUrl">Models URL</Label>
            <Input
              id="modelsUrl"
              value={formData.modelsUrl}
              onChange={(e) => setFormData({ ...formData, modelsUrl: e.target.value })}
              placeholder="e.g., https://api.openai.com/v1/models"
            />
          </div>
          <div>
            <Label htmlFor="apiKey">API Key</Label>
            <Input
              id="apiKey"
              type="password"
              value={formData.apiKey}
              onChange={(e) => setFormData({ ...formData, apiKey: e.target.value })}
              placeholder="Leave empty to keep current key"
            />
            <p className="text-sm text-muted-foreground mt-1">
              Leave empty to keep the current API key. Keys are encrypted when saved.
            </p>
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