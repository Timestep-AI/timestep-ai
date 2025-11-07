export interface ThreadMetadata {
  id: string;
  title: string | null;
  created_at: number;
  status: {
    type: string;
  };
  metadata: Record<string, any>;
}

export interface ThreadListResponse {
  data: ThreadMetadata[];
  has_more: boolean;
  after: string | null;
}

