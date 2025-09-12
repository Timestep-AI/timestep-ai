import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { CollectionPage } from '@/components/CollectionPage';
import { TraceRow } from '@/components/TraceRow';
import { CreateDefaultsButton } from '@/components/CreateDefaultsButton';
import { Trace } from '@/types/trace';
import { tracesService } from '@/services/tracesService';
import { Activity } from 'lucide-react';

export const Traces = () => {
  const navigate = useNavigate();
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadTraces();
  }, []);

  const loadTraces = async () => {
    try {
      setLoading(true);
      const data = await tracesService.getAll();
      setTraces(data);
    } catch (error) {
      console.error('Failed to load traces:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleTraceSelect = (trace: Trace) => {
    navigate(`/traces/${trace.id}`);
  };

  const handleCreateDefaults = async () => {
    try {
      setLoading(true);
      const defaultTraces = await tracesService.createDefaults();
      setTraces(defaultTraces);
    } catch (error) {
      console.error('Failed to create default traces:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <CollectionPage
      title="Traces"
      items={traces}
      loading={loading}
      emptyIcon={<Activity className="w-12 h-12 text-text-tertiary" />}
      emptyTitle="No traces found"
      emptyDescription="Start monitoring your application to see execution traces here."
      searchPlaceholder="Search traces..."
      itemCountLabel={(count) => `${count} trace${count !== 1 ? 's' : ''}`}
      onCreateDefaults={handleCreateDefaults}
      renderItem={(trace) => (
        <TraceRow
          key={trace.id}
          trace={trace as Trace}
          onSelect={handleTraceSelect}
        />
      )}
    />
  );
};

export default Traces;