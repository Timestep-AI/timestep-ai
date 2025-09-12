import { cn } from '@/lib/utils';

interface TimingBarProps {
  duration: number;
  maxDuration: number;
  status: 'ok' | 'error' | 'timeout' | 'running';
  className?: string;
}

export function TimingBar({ duration, maxDuration, status, className }: TimingBarProps) {
  const percentage = Math.min((duration / maxDuration) * 100, 100);
  
  const getBarColor = () => {
    switch (status) {
      case 'ok':
        return 'bg-blue-500';
      case 'error':
        return 'bg-red-500';
      case 'timeout':
        return 'bg-orange-500';
      case 'running':
        return 'bg-yellow-500';
      default:
        return 'bg-gray-400';
    }
  };

  return (
    <div className={cn("w-full", className)}>
      <div className="w-full bg-surface-elevated/50 rounded-full h-2">
        <div
          className={cn("h-2 rounded-full transition-all duration-300", getBarColor())}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}