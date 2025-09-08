import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface CreateDefaultsButtonProps {
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}

export const CreateDefaultsButton = ({ 
  onClick, 
  disabled = false, 
  className = "" 
}: CreateDefaultsButtonProps) => {
  return (
    <Button 
      onClick={onClick}
      className={`bg-primary hover:bg-primary/90 text-primary-foreground text-sm h-10 ${className}`}
      disabled={disabled}
    >
      <Download className="w-4 h-4 mr-2" />
      CREATE DEFAULTS
    </Button>
  );
};