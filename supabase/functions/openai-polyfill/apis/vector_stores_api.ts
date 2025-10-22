// OpenAI Vector Stores API implementation

// TypeScript interfaces for Vector Stores API (from OpenAI OpenAPI spec)

export interface VectorStoreFileCounts {
  in_progress: number;
  completed: number;
  failed: number;
  cancelled: number;
  total: number;
}

export interface VectorStoreExpirationAfter {
  anchor: 'last_active_at';
  days: number;
}

export interface VectorStoreObject {
  id: string;
  object: 'vector_store';
  created_at: number;
  name: string;
  usage_bytes: number;
  file_counts: VectorStoreFileCounts;
  status: 'expired' | 'in_progress' | 'completed';
  expires_after?: VectorStoreExpirationAfter | null;
  expires_at?: number | null;
  last_active_at: number | null;
  metadata: Record<string, any> | null;
}

export interface CreateVectorStoreRequest {
  file_ids?: string[];
  name?: string;
  description?: string;
  expires_after?: VectorStoreExpirationAfter;
  chunking_strategy?: any; // ChunkingStrategyRequestParam
  metadata?: Record<string, any>;
}

export interface UpdateVectorStoreRequest {
  name?: string;
  description?: string;
  expires_after?: VectorStoreExpirationAfter;
  metadata?: Record<string, any>;
}

export interface ListVectorStoresResponse {
  object: 'list';
  data: VectorStoreObject[];
  first_id: string;
  last_id: string;
  has_more: boolean;
}

export interface DeleteVectorStoreResponse {
  id: string;
  deleted: boolean;
  object: 'vector_store.deleted';
}

export interface VectorStoreSearchRequest {
  query: string | string[];
  rewrite_query?: boolean;
  max_num_results?: number;
  filters?: any;
  ranking_options?: {
    ranker?: 'none' | 'auto' | 'default-2024-11-15';
    score_threshold?: number;
  };
}

export interface VectorStoreSearchResultItem {
  file_id: string;
  filename: string;
  score: number;
  attributes: Record<string, any>;
  content: Array<{
    type: 'text';
    text: string;
  }>;
}

export interface VectorStoreSearchResultsPage {
  object: 'vector_store.search_results.page';
  search_query: string[];
  data: VectorStoreSearchResultItem[];
  has_more: boolean;
  next_page: string | null;
}

export interface VectorStoreFileObject {
  id: string;
  object: 'vector_store.file';
  usage_bytes: number;
  created_at: number;
  vector_store_id: string;
  status: 'in_progress' | 'completed' | 'failed' | 'cancelled';
  last_error: {
    code: string;
    message: string;
  } | null;
  chunking_strategy?: {
    type: string;
    [key: string]: any;
  };
}

export interface CreateVectorStoreFileRequest {
  file_id: string;
  chunking_strategy?: {
    type: string;
    [key: string]: any;
  };
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
};

/**
 * Main router for Vector Stores API endpoints
 */
export async function handleVectorStoresRequest(
  req: Request,
  supabaseClient: any,
  userId: string,
  pathname: string,
  userJwt: string
): Promise<Response> {
  // Parse the path to determine which endpoint to handle
  const pathParts = pathname.split('/').filter(Boolean);

  // Find where 'vector_stores' starts in the path
  const vectorStoresIndex = pathParts.indexOf('vector_stores');
  if (vectorStoresIndex === -1) {
    return new Response(JSON.stringify({ error: 'Vector stores endpoint not found in path' }), {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }

  // Get the parts after 'vector_stores'
  const relativeParts = pathParts.slice(vectorStoresIndex);

  // /vector_stores
  if (relativeParts.length === 1 && relativeParts[0] === 'vector_stores') {
    if (req.method === 'GET') {
      return await listVectorStores(req, supabaseClient, userId);
    } else if (req.method === 'POST') {
      return await createVectorStore(req, supabaseClient, userId);
    }
  }

  // /vector_stores/{vector_store_id}
  if (relativeParts.length === 2 && relativeParts[0] === 'vector_stores') {
    const vectorStoreId = relativeParts[1];

    if (req.method === 'GET') {
      return await getVectorStore(req, supabaseClient, userId, vectorStoreId);
    } else if (req.method === 'POST') {
      return await modifyVectorStore(req, supabaseClient, userId, vectorStoreId);
    } else if (req.method === 'DELETE') {
      return await deleteVectorStore(req, supabaseClient, userId, vectorStoreId);
    }
  }

  // /vector_stores/{vector_store_id}/files
  if (
    relativeParts.length === 3 &&
    relativeParts[0] === 'vector_stores' &&
    relativeParts[2] === 'files'
  ) {
    const vectorStoreId = relativeParts[1];

    if (req.method === 'GET') {
      return await listVectorStoreFiles(req, supabaseClient, userId, vectorStoreId);
    } else if (req.method === 'POST') {
      return await createVectorStoreFile(req, supabaseClient, userId, vectorStoreId);
    }
  }

  // /vector_stores/{vector_store_id}/files/{file_id}
  if (
    relativeParts.length === 4 &&
    relativeParts[0] === 'vector_stores' &&
    relativeParts[2] === 'files'
  ) {
    const vectorStoreId = relativeParts[1];
    const fileId = relativeParts[3];

    if (req.method === 'GET') {
      return await getVectorStoreFile(req, supabaseClient, userId, vectorStoreId, fileId);
    } else if (req.method === 'DELETE') {
      return await deleteVectorStoreFile(req, supabaseClient, userId, vectorStoreId, fileId);
    }
  }

  // /vector_stores/{vector_store_id}/search
  if (
    relativeParts.length === 3 &&
    relativeParts[0] === 'vector_stores' &&
    relativeParts[2] === 'search'
  ) {
    const vectorStoreId = relativeParts[1];

    if (req.method === 'POST') {
      return await searchVectorStore(req, supabaseClient, userId, vectorStoreId, userJwt);
    }
  }

  return new Response(JSON.stringify({ error: 'Vector stores endpoint not found' }), {
    status: 404,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

/**
 * GET /vector_stores
 * List vector stores
 */
async function listVectorStores(
  req: Request,
  _supabaseClient: any,
  _userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const limit = parseInt(url.searchParams.get('limit') || '20');
    const order = url.searchParams.get('order') || 'desc';
    const after = url.searchParams.get('after');
    const before = url.searchParams.get('before');

    // TODO: Implement actual vector store listing from database
    const response: ListVectorStoresResponse = {
      object: 'list',
      data: [],
      first_id: '',
      last_id: '',
      has_more: false,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error listing vector stores:', error);
    return createErrorResponse(error);
  }
}

/**
 * POST /vector_stores
 * Create a vector store
 */
async function createVectorStore(
  req: Request,
  supabaseClient: any,
  userId: string
): Promise<Response> {
  try {
    const body: CreateVectorStoreRequest = await req.json();

    const now = Math.floor(Date.now() / 1000);
    const vectorStoreId = `vs_${generateId()}`;

    // Insert into database
    const { error: dbError } = await supabaseClient.from('vector_stores').insert({
      id: vectorStoreId,
      user_id: userId,
      name: body.name || '',
      usage_bytes: 0,
      files_in_progress: 0,
      files_completed: 0,
      files_failed: 0,
      files_total: 0,
      status: 'completed',
      created_at: now,
      metadata: body.metadata || {},
    });

    if (dbError) {
      console.error('[VectorStores] Error saving to database:', dbError);
      throw dbError;
    }

    const vectorStore: VectorStoreObject = {
      id: vectorStoreId,
      object: 'vector_store',
      created_at: now,
      name: body.name || '',
      usage_bytes: 0,
      file_counts: {
        in_progress: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
      },
      status: 'completed',
      last_active_at: now,
      metadata: body.metadata || null,
    };

    return new Response(JSON.stringify(vectorStore), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error creating vector store:', error);
    return createErrorResponse(error);
  }
}

/**
 * GET /vector_stores/{vector_store_id}
 * Retrieve a vector store
 */
async function getVectorStore(
  _req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string
): Promise<Response> {
  try {
    // TODO: Implement actual vector store retrieval from database
    const now = Math.floor(Date.now() / 1000);
    const vectorStore: VectorStoreObject = {
      id: vectorStoreId,
      object: 'vector_store',
      created_at: now,
      name: 'Sample Vector Store',
      usage_bytes: 0,
      file_counts: {
        in_progress: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
      },
      status: 'completed',
      last_active_at: now,
      metadata: null,
    };

    return new Response(JSON.stringify(vectorStore), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error getting vector store:', error);
    return createErrorResponse(error);
  }
}

/**
 * POST /vector_stores/{vector_store_id}
 * Modify a vector store
 */
async function modifyVectorStore(
  req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string
): Promise<Response> {
  try {
    const body: UpdateVectorStoreRequest = await req.json();

    // TODO: Implement actual vector store modification in database
    const now = Math.floor(Date.now() / 1000);
    const vectorStore: VectorStoreObject = {
      id: vectorStoreId,
      object: 'vector_store',
      created_at: now,
      name: body.name || 'Modified Vector Store',
      usage_bytes: 0,
      file_counts: {
        in_progress: 0,
        completed: 0,
        failed: 0,
        cancelled: 0,
        total: 0,
      },
      status: 'completed',
      last_active_at: now,
      metadata: body.metadata || null,
    };

    return new Response(JSON.stringify(vectorStore), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error modifying vector store:', error);
    return createErrorResponse(error);
  }
}

/**
 * DELETE /vector_stores/{vector_store_id}
 * Delete a vector store
 */
async function deleteVectorStore(
  _req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string
): Promise<Response> {
  try {
    // TODO: Implement actual vector store deletion from database
    const response: DeleteVectorStoreResponse = {
      id: vectorStoreId,
      deleted: true,
      object: 'vector_store.deleted',
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error deleting vector store:', error);
    return createErrorResponse(error);
  }
}

/**
 * GET /vector_stores/{vector_store_id}/files
 * List vector store files (stub)
 */
async function listVectorStoreFiles(
  _req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string
): Promise<Response> {
  // TODO: Implement file listing
  return new Response(
    JSON.stringify({
      object: 'list',
      data: [],
      first_id: '',
      last_id: '',
      has_more: false,
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * POST /vector_stores/{vector_store_id}/files
 * Create a vector store file
 */
async function createVectorStoreFile(
  req: Request,
  supabaseClient: any,
  userId: string,
  vectorStoreId: string
): Promise<Response> {
  try {
    const body: CreateVectorStoreFileRequest = await req.json();

    // Verify the vector store exists and user has access
    const { data: vectorStore, error: vsError } = await supabaseClient
      .from('vector_stores')
      .select('*')
      .eq('id', vectorStoreId)
      .eq('user_id', userId)
      .single();

    if (vsError || !vectorStore) {
      console.error('[VectorStores] Vector store not found:', vsError);
      return new Response(
        JSON.stringify({
          error: {
            message: 'Vector store not found',
            type: 'invalid_request_error',
            param: null,
            code: null,
          },
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Verify the file exists and user has access
    const { data: file, error: fileError } = await supabaseClient
      .from('files')
      .select('*')
      .eq('id', body.file_id)
      .eq('user_id', userId)
      .single();

    if (fileError || !file) {
      console.error('[VectorStores] File not found:', fileError);
      return new Response(
        JSON.stringify({
          error: {
            message: 'File not found',
            type: 'invalid_request_error',
            param: 'file_id',
            code: null,
          },
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const now = Math.floor(Date.now() / 1000);
    const vectorStoreFileId = `file-${generateId()}`;

    // Check if the file already exists in this vector store
    const { data: existingVsFile } = await supabaseClient
      .from('vector_store_files')
      .select('id')
      .eq('vector_store_id', vectorStoreId)
      .eq('file_id', body.file_id)
      .single();

    if (existingVsFile) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'File already exists in this vector store',
            type: 'invalid_request_error',
            param: 'file_id',
            code: null,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Insert into vector_store_files table
    // Copy the embedding from the files table to vector_store_files for faster lookups
    const { error: insertError } = await supabaseClient.from('vector_store_files').insert({
      id: vectorStoreFileId,
      vector_store_id: vectorStoreId,
      file_id: body.file_id,
      user_id: userId,
      status: file.embedding ? 'completed' : 'failed',
      usage_bytes: file.bytes || 0,
      chunking_strategy_type: body.chunking_strategy?.type || null,
      chunking_strategy: body.chunking_strategy || {},
      created_at: now,
      last_error: file.embedding ? null : 'No embedding available for file',
      embedding: file.embedding, // Copy embedding from files table
    });

    if (insertError) {
      console.error('[VectorStores] Error inserting vector store file:', insertError);
      throw insertError;
    }

    const vectorStoreFile: VectorStoreFileObject = {
      id: vectorStoreFileId,
      object: 'vector_store.file',
      usage_bytes: file.bytes || 0,
      created_at: now,
      vector_store_id: vectorStoreId,
      status: file.embedding ? 'completed' : 'failed',
      last_error: file.embedding
        ? null
        : {
            code: 'embedding_missing',
            message: 'No embedding available for file',
          },
      chunking_strategy: body.chunking_strategy,
    };

    return new Response(JSON.stringify(vectorStoreFile), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error creating vector store file:', error);
    return createErrorResponse(error);
  }
}

/**
 * GET /vector_stores/{vector_store_id}/files/{file_id}
 * Get a vector store file
 */
async function getVectorStoreFile(
  _req: Request,
  supabaseClient: any,
  userId: string,
  vectorStoreId: string,
  fileId: string
): Promise<Response> {
  try {
    // Get the vector store file from the junction table
    const { data: vectorStoreFile, error: vsFileError } = await supabaseClient
      .from('vector_store_files')
      .select('*')
      .eq('vector_store_id', vectorStoreId)
      .eq('file_id', fileId)
      .eq('user_id', userId)
      .single();

    if (vsFileError || !vectorStoreFile) {
      console.error('[VectorStores] Vector store file not found:', vsFileError);
      return new Response(
        JSON.stringify({
          error: {
            message: 'Vector store file not found',
            type: 'invalid_request_error',
            param: null,
            code: null,
          },
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const response: VectorStoreFileObject = {
      id: vectorStoreFile.id,
      object: 'vector_store.file',
      usage_bytes: vectorStoreFile.usage_bytes || 0,
      created_at: vectorStoreFile.created_at,
      vector_store_id: vectorStoreFile.vector_store_id,
      status: vectorStoreFile.status,
      last_error: vectorStoreFile.last_error
        ? {
            code: 'server_error',
            message: vectorStoreFile.last_error,
          }
        : null,
      chunking_strategy: vectorStoreFile.chunking_strategy_type
        ? {
            type: vectorStoreFile.chunking_strategy_type,
            ...vectorStoreFile.chunking_strategy,
          }
        : undefined,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error getting vector store file:', error);
    return createErrorResponse(error);
  }
}

/**
 * DELETE /vector_stores/{vector_store_id}/files/{file_id}
 * Delete a vector store file (stub)
 */
async function deleteVectorStoreFile(
  _req: Request,
  _supabaseClient: any,
  _userId: string,
  vectorStoreId: string,
  fileId: string
): Promise<Response> {
  // TODO: Implement file deletion
  return new Response(
    JSON.stringify({
      id: fileId,
      deleted: true,
      object: 'vector_store.file.deleted',
    }),
    {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * POST /vector_stores/{vector_store_id}/search
 * Search a vector store using embeddings
 */
async function searchVectorStore(
  req: Request,
  supabaseClient: any,
  userId: string,
  vectorStoreId: string,
  userJwt: string
): Promise<Response> {
  try {
    const body: VectorStoreSearchRequest = await req.json();

    // Validate query
    if (!body.query) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Missing required field: query',
            type: 'invalid_request_error',
            param: 'query',
            code: null,
          },
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Get vector store to verify it exists and user has access
    const { data: vectorStore, error: vsError } = await supabaseClient
      .from('vector_stores')
      .select('*')
      .eq('id', vectorStoreId)
      .eq('user_id', userId)
      .single();

    if (vsError || !vectorStore) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Vector store not found',
            type: 'invalid_request_error',
            param: null,
            code: null,
          },
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Normalize query to array
    const queries = Array.isArray(body.query) ? body.query : [body.query];
    const maxResults = body.max_num_results || 10;

    // Get all files in this vector store
    const { data: vectorStoreFiles } = await supabaseClient
      .from('vector_store_files')
      .select('file_id')
      .eq('vector_store_id', vectorStoreId)
      .eq('status', 'completed');

    if (!vectorStoreFiles || vectorStoreFiles.length === 0) {
      // No files in vector store, return empty results
      const response: VectorStoreSearchResultsPage = {
        object: 'vector_store.search_results.page',
        search_query: queries,
        data: [],
        has_more: false,
        next_page: null,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Generate embedding for the search query
    const queryText = queries.join(' ');

    let queryEmbedding: number[] | null = null;
    try {
      queryEmbedding = await generateEmbedding(queryText, userJwt);
    } catch (error) {
      console.error('[VectorStores] Error generating query embedding:', error);
      return createErrorResponse(new Error('Failed to generate query embedding'));
    }

    if (!queryEmbedding) {
      return createErrorResponse(new Error('Failed to generate query embedding'));
    }

    // Perform semantic search using pgvector
    // Use cosine similarity: 1 - (embedding <=> queryEmbedding)
    const fileIds = vectorStoreFiles.map((vsf: any) => vsf.file_id);

    const { data: files, error: searchError } = await supabaseClient.rpc(
      'search_files_by_embedding',
      {
        query_embedding: queryEmbedding,
        file_ids: fileIds,
        match_count: maxResults,
        score_threshold: body.ranking_options?.score_threshold || 0.0,
      }
    );

    if (searchError) {
      console.error('[VectorStores] Error performing semantic search:', searchError);
      // Fall back to simple file retrieval if RPC function doesn't exist
      const { data: fallbackFiles } = await supabaseClient
        .from('files')
        .select('*')
        .in('id', fileIds)
        .limit(maxResults);

      // Download file content for results
      const results: VectorStoreSearchResultItem[] = [];
      for (const file of fallbackFiles || []) {
        try {
          const content = await downloadFileContent(supabaseClient, userId, file.id);
          results.push({
            file_id: file.id,
            filename: file.filename,
            score: 0.5, // No real score without embedding search
            attributes: {},
            content: [
              {
                type: 'text' as const,
                text: content || `Content from ${file.filename}`,
              },
            ],
          });
        } catch (error) {
          console.error('[VectorStores] Error downloading file content:', error);
        }
      }

      const response: VectorStoreSearchResultsPage = {
        object: 'vector_store.search_results.page',
        search_query: queries,
        data: results,
        has_more: false,
        next_page: null,
      };

      return new Response(JSON.stringify(response), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      });
    }

    // Download file content for results
    const results: VectorStoreSearchResultItem[] = [];
    for (const file of files || []) {
      try {
        const content = await downloadFileContent(supabaseClient, userId, file.id);
        results.push({
          file_id: file.id,
          filename: file.filename,
          score: file.similarity_score || 0.0,
          attributes: {},
          content: [
            {
              type: 'text' as const,
              text: content || `Content from ${file.filename}`,
            },
          ],
        });
      } catch (error) {
        console.error('[VectorStores] Error downloading file content:', error);
      }
    }

    const response: VectorStoreSearchResultsPage = {
      object: 'vector_store.search_results.page',
      search_query: queries,
      data: results,
      has_more: false,
      next_page: null,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[VectorStores] Error searching vector store:', error);
    return createErrorResponse(error);
  }
}

/**
 * Helper function to generate embedding for text
 */
async function generateEmbedding(text: string, userJwt: string): Promise<number[] | null> {
  try {
    // Call our own embeddings endpoint
    const embeddingsUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/openai-polyfill/embeddings`;

    const response = await fetch(embeddingsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${userJwt}`,
      },
      body: JSON.stringify({
        input: text.substring(0, 8000), // Limit to ~8k chars to avoid token limits
        model: 'text-embedding-3-small',
      }),
    });

    if (!response.ok) {
      console.error('[VectorStores] Embeddings API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.data[0]?.embedding || null;
  } catch (error) {
    console.error('[VectorStores] Error calling embeddings API:', error);
    return null;
  }
}

/**
 * Helper function to download file content from storage
 */
async function downloadFileContent(
  supabaseClient: any,
  userId: string,
  fileId: string
): Promise<string | null> {
  try {
    const { data, error } = await supabaseClient.storage
      .from('openai-polyfill-files')
      .download(`${userId}/${fileId}.dat`);

    if (error) {
      console.error('[VectorStores] Error downloading file:', error);
      return null;
    }

    const text = await data.text();
    return text;
  } catch (error) {
    console.error('[VectorStores] Error reading file content:', error);
    return null;
  }
}

/**
 * Helper function to generate a random ID
 */
function generateId(): string {
  return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
}

/**
 * Helper function to create error responses
 */
function createErrorResponse(error: unknown): Response {
  return new Response(
    JSON.stringify({
      error: {
        message: error instanceof Error ? error.message : 'Unknown error',
        type: 'api_error',
        param: null,
        code: null,
      },
    }),
    {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}
