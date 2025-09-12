import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { CollectionPage } from '@/components/CollectionPage';
import { SpanRow } from '@/components/SpanRow';
import { Trace, Span } from '@/types/trace';
import { tracesService } from '@/services/tracesService';
import { spansService } from '@/services/spansService';
import { Activity, Zap, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Layout } from '@/components/Layout';

export const TracePage = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [trace, setTrace] = useState<Trace | null>(null);
  const [spans, setSpans] = useState<Span[]>([]);
  const [loading, setLoading] = useState(true);
  const [spansLoading, setSpansLoading] = useState(true);

  useEffect(() => {
    if (id) {
      loadTrace(id);
      loadSpans(id);
    }
  }, [id]);

  const loadTrace = async (traceId: string) => {
    try {
      setLoading(true);
      const traceData = await tracesService.getById(traceId);
      setTrace(traceData || null);
    } catch (error) {
      console.error('Failed to load trace:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadSpans = async (traceId: string) => {
    try {
      setSpansLoading(true);
      const spansData = await spansService.getByTraceId(traceId);
      setSpans(spansData);
    } catch (error) {
      console.error('Failed to load spans:', error);
    } finally {
      setSpansLoading(false);
    }
  };

  const handleSpanSelect = (span: Span) => {
    // In a real app, this might navigate to a span detail page
    console.log('Selected span:', span);
  };

  if (loading) {
    return (
      <Layout>
        <div className="flex items-center justify-center py-12">
          <div className="text-text-secondary">Loading trace...</div>
        </div>
      </Layout>
    );
  }

  if (!trace) {
    return (
      <Layout>
        <div className="flex flex-col items-center justify-center py-12">
          <div className="text-text-secondary mb-4">Trace not found</div>
          <Button onClick={() => navigate('/traces')} variant="outline">
            <ArrowLeft className="w-4 h-4 mr-2" />
            Back to Traces
          </Button>
        </div>
      </Layout>
    );
  }

  return (
    <CollectionPage
      title={`${trace.name} - Spans`}
      items={spans}
      loading={spansLoading}
      emptyIcon={<Zap className="w-12 h-12 text-text-tertiary" />}
      emptyTitle="No spans found"
      emptyDescription="This trace doesn't contain any spans yet."
      searchPlaceholder="Search spans..."
      itemCountLabel={(count) => `${count} span${count !== 1 ? 's' : ''}`}
      onCreateDefaults={async () => {}} // No defaults for spans
      showSearch={false} // Don't show search for individual trace spans
      renderItem={(span) => (
        <SpanRow
          key={span.id}
          span={span as Span}
          onSelect={handleSpanSelect}
        />
      )}
    />
  );
};

export default TracePage;