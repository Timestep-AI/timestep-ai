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
    base_url: provider?.base_url || '',
    models_url: provider?.models_url || '',
    api_key: '',
  });
  const [loading, setLoading] = useState(false);

  const handleSave = async () => {
    if (!provider) return;

    setLoading(true);
    try {
      const updates: Partial<ModelProvider> = {
        provider: formData.provider,
        base_url: formData.base_url,
        models_url: formData.models_url,
      };
      
      // Only include API key if it was provided
      if (formData.api_key.trim()) {
        updates.api_key = formData.api_key;
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
        base_url: provider.base_url || '',
        models_url: provider.models_url || '',
        api_key: '',
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
            <Label htmlFor="base_url">Base URL</Label>
            <Input
              id="base_url"
              value={formData.base_url}
              onChange={(e) => setFormData({ ...formData, base_url: e.target.value })}
              placeholder="e.g., https://api.openai.com/v1"
            />
          </div>
          <div>
            <Label htmlFor="models_url">Models URL</Label>
            <Input
              id="models_url"
              value={formData.models_url}
              onChange={(e) => setFormData({ ...formData, models_url: e.target.value })}
              placeholder="e.g., https://api.openai.com/v1/models"
            />
          </div>
          <div>
            <Label htmlFor="api_key">API Key</Label>
            <Input
              id="api_key"
              type="password"
              value={formData.api_key}
              onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
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