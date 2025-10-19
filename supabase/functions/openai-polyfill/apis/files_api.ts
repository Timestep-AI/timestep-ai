// OpenAI Files API implementation using Supabase Storage

// TypeScript interfaces for Files API (from OpenAI OpenAPI spec)

export type FilePurpose =
  | 'assistants'
  | 'assistants_output'
  | 'batch'
  | 'batch_output'
  | 'fine-tune'
  | 'fine-tune-results'
  | 'vision'
  | 'user_data';

export type FileStatus = 'uploaded' | 'processed' | 'error';

export interface FileExpirationAfter {
  anchor: 'created_at';
  seconds: number;
}

export interface OpenAIFile {
  id: string;
  object: 'file';
  bytes: number;
  created_at: number;
  expires_at?: number;
  filename: string;
  purpose: FilePurpose;
  status: FileStatus;
  status_details?: string;
}

export interface ListFilesResponse {
  object: 'list';
  data: OpenAIFile[];
  first_id?: string;
  last_id?: string;
  has_more: boolean;
}

export interface DeleteFileResponse {
  id: string;
  object: 'file';
  deleted: boolean;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
};

// Supabase storage bucket name for files
const STORAGE_BUCKET = 'openai-files';

/**
 * Main router for Files API endpoints
 */
export async function handleFilesRequest(
  req: Request,
  supabaseClient: any,
  userId: string,
  pathname: string,
  userJwt: string
): Promise<Response> {
  // Parse the path to determine which endpoint to handle
  const pathParts = pathname.split('/').filter(Boolean);

  // Find where 'files' starts in the path
  const filesIndex = pathParts.indexOf('files');
  if (filesIndex === -1) {
    return new Response(
      JSON.stringify({ error: 'Files endpoint not found in path' }),
      {
        status: 404,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    );
  }

  // Get the parts after 'files'
  const relativeParts = pathParts.slice(filesIndex);

  // /files
  if (relativeParts.length === 1 && relativeParts[0] === 'files') {
    if (req.method === 'GET') {
      return await listFiles(req, supabaseClient, userId);
    } else if (req.method === 'POST') {
      return await uploadFile(req, supabaseClient, userId, userJwt);
    }
  }

  // /files/{file_id}
  if (relativeParts.length === 2 && relativeParts[0] === 'files') {
    const fileId = relativeParts[1];

    if (req.method === 'GET') {
      return await retrieveFile(req, supabaseClient, userId, fileId);
    } else if (req.method === 'DELETE') {
      return await deleteFile(req, supabaseClient, userId, fileId);
    }
  }

  // /files/{file_id}/content
  if (relativeParts.length === 3 && relativeParts[0] === 'files' && relativeParts[2] === 'content') {
    const fileId = relativeParts[1];

    if (req.method === 'GET') {
      return await retrieveFileContent(req, supabaseClient, userId, fileId);
    }
  }

  return new Response(
    JSON.stringify({ error: 'Files endpoint not found' }),
    {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * GET /files
 * List files
 */
async function listFiles(
  req: Request,
  supabaseClient: any,
  userId: string
): Promise<Response> {
  try {
    const url = new URL(req.url);
    const purpose = url.searchParams.get('purpose');
    const limit = parseInt(url.searchParams.get('limit') || '10000');
    const order = url.searchParams.get('order') || 'desc';
    const after = url.searchParams.get('after');

    console.log('[Files] Listing files', { purpose, limit, order, after, userId });

    // List files from Supabase Storage
    const { data: storageFiles, error: listError } = await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .list(userId, {
        limit,
        sortBy: { column: 'created_at', order },
      });

    if (listError) {
      console.error('[Files] Error listing files from storage:', listError);
      return createErrorResponse(listError);
    }

    // Fetch metadata from database
    const fileIds = storageFiles?.map((f: any) => f.name.replace('.dat', '')) || [];

    let query = supabaseClient
      .from('files')
      .select('*')
      .eq('user_id', userId)
      .in('id', fileIds);

    if (purpose) {
      query = query.eq('purpose', purpose);
    }

    if (after) {
      query = query.gt('id', after);
    }

    query = query.order('created_at', { ascending: order === 'asc' });
    query = query.limit(limit);

    const { data: filesMetadata, error: dbError } = await query;

    if (dbError) {
      console.error('[Files] Error fetching file metadata:', dbError);
      return createErrorResponse(dbError);
    }

    const files: OpenAIFile[] = (filesMetadata || []).map((meta: any) => ({
      id: meta.id,
      object: 'file' as const,
      bytes: meta.bytes,
      created_at: meta.created_at,
      expires_at: meta.expires_at,
      filename: meta.filename,
      purpose: meta.purpose,
      status: meta.status,
      status_details: meta.status_details,
    }));

    const response: ListFilesResponse = {
      object: 'list',
      data: files,
      first_id: files[0]?.id,
      last_id: files[files.length - 1]?.id,
      has_more: files.length === limit,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Files] Error listing files:', error);
    return createErrorResponse(error);
  }
}

/**
 * POST /files
 * Upload a file
 */
async function uploadFile(
  req: Request,
  supabaseClient: any,
  userId: string,
  userJwt: string
): Promise<Response> {
  try {
    const formData = await req.formData();
    const file = formData.get('file') as File;
    const purpose = formData.get('purpose') as FilePurpose;
    const expiresAfterAnchor = formData.get('expires_after[anchor]');
    const expiresAfterSeconds = formData.get('expires_after[seconds]');

    if (!file) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Missing required field: file',
            type: 'invalid_request_error',
            param: 'file',
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    if (!purpose) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Missing required field: purpose',
            type: 'invalid_request_error',
            param: 'purpose',
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Files] Uploading file:', file.name, 'purpose:', purpose, 'size:', file.size);

    // Generate file ID
    const fileId = `file-${generateId()}`;
    const now = Math.floor(Date.now() / 1000);

    // Calculate expiration
    let expiresAt: number | undefined;
    if (expiresAfterAnchor && expiresAfterSeconds) {
      const seconds = parseInt(expiresAfterSeconds as string);
      expiresAt = now + seconds;
    }

    // Upload to Supabase Storage
    const fileBuffer = await file.arrayBuffer();
    const { error: uploadError } = await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(`${userId}/${fileId}.dat`, fileBuffer, {
        contentType: file.type || 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Files] Error uploading to storage:', uploadError);
      return createErrorResponse(uploadError);
    }

    // Generate embedding for the file content
    let embedding: number[] | null = null;
    try {
      const fileText = await file.text();
      console.log('[Files] Generating embedding for file content...');

      embedding = await generateEmbedding(fileText, userJwt);

      console.log('[Files] Generated embedding with', embedding?.length, 'dimensions');
    } catch (error) {
      console.error('[Files] Error generating embedding:', error);
      // Continue without embedding - it's not critical for file upload
    }

    // Store metadata in database with embedding
    const fileMetadata: any = {
      id: fileId,
      user_id: userId,
      filename: file.name,
      bytes: file.size,
      purpose,
      status: 'uploaded' as FileStatus,
      created_at: now,
      expires_at: expiresAt,
      content_type: file.type || 'application/octet-stream',
    };

    // Add embedding if generated (store as pgvector array format)
    if (embedding) {
      fileMetadata.embedding = embedding;
    }

    const { error: dbError } = await supabaseClient
      .from('files')
      .insert([fileMetadata]);

    if (dbError) {
      console.error('[Files] Error saving file metadata:', dbError);
      // Clean up uploaded file
      await supabaseClient.storage.from(STORAGE_BUCKET).remove([`${userId}/${fileId}.dat`]);
      return createErrorResponse(dbError);
    }

    const response: OpenAIFile = {
      id: fileId,
      object: 'file',
      bytes: file.size,
      created_at: now,
      expires_at: expiresAt,
      filename: file.name,
      purpose,
      status: 'uploaded',
    };

    console.log('[Files] Successfully uploaded file:', fileId);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Files] Error uploading file:', error);
    return createErrorResponse(error);
  }
}

/**
 * GET /files/{file_id}
 * Retrieve file metadata
 */
async function retrieveFile(
  _req: Request,
  supabaseClient: any,
  userId: string,
  fileId: string
): Promise<Response> {
  try {
    console.log('[Files] Retrieving file:', fileId);

    const { data: fileMetadata, error: dbError } = await supabaseClient
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (dbError || !fileMetadata) {
      console.error('[Files] File not found:', fileId);
      return new Response(
        JSON.stringify({
          error: {
            message: 'File not found',
            type: 'invalid_request_error',
            param: null,
            code: null,
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    const response: OpenAIFile = {
      id: fileMetadata.id,
      object: 'file',
      bytes: fileMetadata.bytes,
      created_at: fileMetadata.created_at,
      expires_at: fileMetadata.expires_at,
      filename: fileMetadata.filename,
      purpose: fileMetadata.purpose,
      status: fileMetadata.status,
      status_details: fileMetadata.status_details,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Files] Error retrieving file:', error);
    return createErrorResponse(error);
  }
}

/**
 * DELETE /files/{file_id}
 * Delete a file
 */
async function deleteFile(
  _req: Request,
  supabaseClient: any,
  userId: string,
  fileId: string
): Promise<Response> {
  try {
    console.log('[Files] Deleting file:', fileId);

    // Check if file exists and belongs to user
    const { data: fileMetadata, error: checkError } = await supabaseClient
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (checkError || !fileMetadata) {
      console.error('[Files] File not found:', fileId);
      return new Response(
        JSON.stringify({
          error: {
            message: 'File not found',
            type: 'invalid_request_error',
            param: null,
            code: null,
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Delete from storage
    const { error: storageError } = await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .remove([`${userId}/${fileId}.dat`]);

    if (storageError) {
      console.error('[Files] Error deleting from storage:', storageError);
    }

    // Delete from database
    const { error: dbError } = await supabaseClient
      .from('files')
      .delete()
      .eq('id', fileId)
      .eq('user_id', userId);

    if (dbError) {
      console.error('[Files] Error deleting from database:', dbError);
      return createErrorResponse(dbError);
    }

    const response: DeleteFileResponse = {
      id: fileId,
      object: 'file',
      deleted: true,
    };

    console.log('[Files] Successfully deleted file:', fileId);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Files] Error deleting file:', error);
    return createErrorResponse(error);
  }
}

/**
 * GET /files/{file_id}/content
 * Retrieve file content
 */
async function retrieveFileContent(
  _req: Request,
  supabaseClient: any,
  userId: string,
  fileId: string
): Promise<Response> {
  try {
    console.log('[Files] Retrieving file content:', fileId);

    // Check if file exists and belongs to user
    const { data: fileMetadata, error: checkError } = await supabaseClient
      .from('files')
      .select('*')
      .eq('id', fileId)
      .eq('user_id', userId)
      .single();

    if (checkError || !fileMetadata) {
      console.error('[Files] File not found:', fileId);
      return new Response(
        JSON.stringify({
          error: {
            message: 'File not found',
            type: 'invalid_request_error',
            param: null,
            code: null,
          }
        }),
        {
          status: 404,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Download from storage
    const { data: fileData, error: downloadError } = await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .download(`${userId}/${fileId}.dat`);

    if (downloadError || !fileData) {
      console.error('[Files] Error downloading file:', downloadError);
      return createErrorResponse(downloadError);
    }

    console.log('[Files] Successfully retrieved file content:', fileId);

    // Return the file content with appropriate headers
    return new Response(fileData, {
      status: 200,
      headers: {
        ...corsHeaders,
        'Content-Type': fileMetadata.content_type || 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${fileMetadata.filename}"`,
        'Content-Length': fileMetadata.bytes.toString(),
      },
    });
  } catch (error) {
    console.error('[Files] Error retrieving file content:', error);
    return createErrorResponse(error);
  }
}

/**
 * Helper function to generate embedding for text using our embeddings API
 */
async function generateEmbedding(text: string, userJwt: string): Promise<number[] | null> {
  try {
    // Call our own embeddings endpoint
    const embeddingsUrl = `${Deno.env.get('SUPABASE_URL')}/functions/v1/openai-polyfill/embeddings`;

    const response = await fetch(embeddingsUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${userJwt}`,
      },
      body: JSON.stringify({
        input: text.substring(0, 8000), // Limit to ~8k chars to avoid token limits
        model: 'text-embedding-3-small',
      }),
    });

    if (!response.ok) {
      console.error('[Files] Embeddings API error:', await response.text());
      return null;
    }

    const data = await response.json();
    return data.data[0]?.embedding || null;
  } catch (error) {
    console.error('[Files] Error calling embeddings API:', error);
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
