// OpenAI Uploads API implementation using Supabase Storage
// Supports multipart uploads for large files (up to 8GB)

import type { FilePurpose, OpenAIFile } from './files_api.ts';

// TypeScript interfaces for Uploads API (from OpenAI OpenAPI spec)

export type UploadStatus = 'pending' | 'completed' | 'cancelled' | 'expired';

export interface Upload {
  id: string;
  object: 'upload';
  bytes: number;
  created_at: number;
  filename: string;
  purpose: FilePurpose;
  status: UploadStatus;
  expires_at: number;
  file?: OpenAIFile | null;
}

export interface CreateUploadRequest {
  filename: string;
  purpose: FilePurpose;
  bytes: number;
  mime_type: string;
  expires_after?: {
    anchor: 'created_at';
    seconds: number;
  };
}

export interface UploadPart {
  id: string;
  object: 'upload.part';
  created_at: number;
  upload_id: string;
}

export interface CompleteUploadRequest {
  part_ids: string[];
  md5?: string;
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, content-type, x-client-info, apikey, openai-beta',
};

// Storage bucket for upload parts
const STORAGE_BUCKET = 'openai-files';
const MAX_UPLOAD_SIZE = 8 * 1024 * 1024 * 1024; // 8GB
const MAX_PART_SIZE = 64 * 1024 * 1024; // 64MB
const DEFAULT_EXPIRATION = 3600; // 1 hour

/**
 * Main router for Uploads API endpoints
 */
export async function handleUploadsRequest(
  req: Request,
  supabaseClient: any,
  userId: string,
  pathname: string
): Promise<Response> {
  // Parse the path to determine which endpoint to handle
  const pathParts = pathname.split('/').filter(Boolean);

  // POST /uploads - Create upload
  if (pathParts.length === 1 && pathParts[0] === 'uploads' && req.method === 'POST') {
    return await createUpload(req, supabaseClient, userId);
  }

  // POST /uploads/{upload_id}/parts - Add upload part
  if (
    pathParts.length === 3 &&
    pathParts[0] === 'uploads' &&
    pathParts[2] === 'parts' &&
    req.method === 'POST'
  ) {
    const uploadId = pathParts[1];
    return await addUploadPart(req, supabaseClient, userId, uploadId);
  }

  // POST /uploads/{upload_id}/complete - Complete upload
  if (
    pathParts.length === 3 &&
    pathParts[0] === 'uploads' &&
    pathParts[2] === 'complete' &&
    req.method === 'POST'
  ) {
    const uploadId = pathParts[1];
    return await completeUpload(req, supabaseClient, userId, uploadId);
  }

  // POST /uploads/{upload_id}/cancel - Cancel upload
  if (
    pathParts.length === 3 &&
    pathParts[0] === 'uploads' &&
    pathParts[2] === 'cancel' &&
    req.method === 'POST'
  ) {
    const uploadId = pathParts[1];
    return await cancelUpload(req, supabaseClient, userId, uploadId);
  }

  return new Response(
    JSON.stringify({ error: 'Uploads endpoint not found' }),
    {
      status: 404,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    }
  );
}

/**
 * POST /uploads
 * Create a new multipart upload
 */
async function createUpload(
  req: Request,
  supabaseClient: any,
  userId: string
): Promise<Response> {
  try {
    const body: CreateUploadRequest = await req.json();

    // Validate required fields
    if (!body.filename || !body.purpose || !body.bytes || !body.mime_type) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Missing required fields: filename, purpose, bytes, mime_type',
            type: 'invalid_request_error',
            param: null,
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate file size
    if (body.bytes > MAX_UPLOAD_SIZE) {
      return new Response(
        JSON.stringify({
          error: {
            message: `File size exceeds maximum of ${MAX_UPLOAD_SIZE} bytes (8GB)`,
            type: 'invalid_request_error',
            param: 'bytes',
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    console.log('[Uploads] Creating upload:', body.filename, 'size:', body.bytes);

    const uploadId = `upload-${generateId()}`;
    const now = Math.floor(Date.now() / 1000);

    // Calculate expiration
    const expirationSeconds = body.expires_after?.seconds || DEFAULT_EXPIRATION;
    const expiresAt = now + expirationSeconds;

    // Store upload metadata in database
    const uploadMetadata = {
      id: uploadId,
      user_id: userId,
      filename: body.filename,
      bytes: body.bytes,
      purpose: body.purpose,
      mime_type: body.mime_type,
      status: 'pending' as UploadStatus,
      created_at: now,
      expires_at: expiresAt,
      part_ids: [],
      bytes_uploaded: 0,
    };

    const { error: dbError } = await supabaseClient
      .from('uploads')
      .insert([uploadMetadata]);

    if (dbError) {
      console.error('[Uploads] Error creating upload:', dbError);
      return createErrorResponse(dbError);
    }

    const response: Upload = {
      id: uploadId,
      object: 'upload',
      bytes: body.bytes,
      created_at: now,
      filename: body.filename,
      purpose: body.purpose,
      status: 'pending',
      expires_at: expiresAt,
    };

    console.log('[Uploads] Created upload:', uploadId);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Uploads] Error creating upload:', error);
    return createErrorResponse(error);
  }
}

/**
 * POST /uploads/{upload_id}/parts
 * Add a part to an upload
 */
async function addUploadPart(
  req: Request,
  supabaseClient: any,
  userId: string,
  uploadId: string
): Promise<Response> {
  try {
    console.log('[Uploads] Adding part to upload:', uploadId);

    // Get upload metadata
    const { data: uploadMeta, error: fetchError } = await supabaseClient
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !uploadMeta) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Upload not found',
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

    // Check if upload is still pending
    if (uploadMeta.status !== 'pending') {
      return new Response(
        JSON.stringify({
          error: {
            message: `Upload is ${uploadMeta.status}, cannot add parts`,
            type: 'invalid_request_error',
            param: null,
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Parse multipart form data
    const formData = await req.formData();
    const dataPart = formData.get('data') as File;

    if (!dataPart) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Missing required field: data',
            type: 'invalid_request_error',
            param: 'data',
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate part size
    if (dataPart.size > MAX_PART_SIZE) {
      return new Response(
        JSON.stringify({
          error: {
            message: `Part size exceeds maximum of ${MAX_PART_SIZE} bytes (64MB)`,
            type: 'invalid_request_error',
            param: 'data',
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Generate part ID
    const partId = `part-${generateId()}`;
    const now = Math.floor(Date.now() / 1000);

    // Upload part to storage
    const partBuffer = await dataPart.arrayBuffer();
    const partPath = `${userId}/uploads/${uploadId}/${partId}.part`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(partPath, partBuffer, {
        contentType: 'application/octet-stream',
        upsert: false,
      });

    if (uploadError) {
      console.error('[Uploads] Error uploading part:', uploadError);
      return createErrorResponse(uploadError);
    }

    // Update upload metadata with new part
    const updatedPartIds = [...(uploadMeta.part_ids || []), partId];
    const updatedBytesUploaded = (uploadMeta.bytes_uploaded || 0) + dataPart.size;

    const { error: updateError } = await supabaseClient
      .from('uploads')
      .update({
        part_ids: updatedPartIds,
        bytes_uploaded: updatedBytesUploaded,
      })
      .eq('id', uploadId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Uploads] Error updating upload:', updateError);
      // Clean up uploaded part
      await supabaseClient.storage.from(STORAGE_BUCKET).remove([partPath]);
      return createErrorResponse(updateError);
    }

    const response: UploadPart = {
      id: partId,
      object: 'upload.part',
      created_at: now,
      upload_id: uploadId,
    };

    console.log('[Uploads] Added part:', partId, 'size:', dataPart.size);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Uploads] Error adding part:', error);
    return createErrorResponse(error);
  }
}

/**
 * POST /uploads/{upload_id}/complete
 * Complete an upload and create the final file
 */
async function completeUpload(
  req: Request,
  supabaseClient: any,
  userId: string,
  uploadId: string
): Promise<Response> {
  try {
    const body: CompleteUploadRequest = await req.json();

    console.log('[Uploads] Completing upload:', uploadId);

    // Get upload metadata
    const { data: uploadMeta, error: fetchError } = await supabaseClient
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !uploadMeta) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Upload not found',
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

    // Check if upload is still pending
    if (uploadMeta.status !== 'pending') {
      return new Response(
        JSON.stringify({
          error: {
            message: `Upload is already ${uploadMeta.status}`,
            type: 'invalid_request_error',
            param: null,
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Validate bytes uploaded match expected bytes
    if (uploadMeta.bytes_uploaded !== uploadMeta.bytes) {
      return new Response(
        JSON.stringify({
          error: {
            message: `Bytes uploaded (${uploadMeta.bytes_uploaded}) does not match expected bytes (${uploadMeta.bytes})`,
            type: 'invalid_request_error',
            param: null,
            code: null,
          }
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      );
    }

    // Combine all parts into final file
    const partIds = body.part_ids || uploadMeta.part_ids;
    const parts: Uint8Array[] = [];

    for (const partId of partIds) {
      const partPath = `${userId}/uploads/${uploadId}/${partId}.part`;
      const { data: partData, error: downloadError } = await supabaseClient
        .storage
        .from(STORAGE_BUCKET)
        .download(partPath);

      if (downloadError || !partData) {
        console.error('[Uploads] Error downloading part:', partId, downloadError);
        return createErrorResponse(new Error(`Failed to download part: ${partId}`));
      }

      const arrayBuffer = await partData.arrayBuffer();
      parts.push(new Uint8Array(arrayBuffer));
    }

    // Combine all parts
    const totalSize = parts.reduce((sum, part) => sum + part.length, 0);
    const combinedFile = new Uint8Array(totalSize);
    let offset = 0;
    for (const part of parts) {
      combinedFile.set(part, offset);
      offset += part.length;
    }

    // Upload final file
    const fileId = `file-${generateId()}`;
    const now = Math.floor(Date.now() / 1000);
    const finalPath = `${userId}/${fileId}.dat`;

    const { error: uploadError } = await supabaseClient
      .storage
      .from(STORAGE_BUCKET)
      .upload(finalPath, combinedFile, {
        contentType: uploadMeta.mime_type,
        upsert: false,
      });

    if (uploadError) {
      console.error('[Uploads] Error uploading final file:', uploadError);
      return createErrorResponse(uploadError);
    }

    // Create file metadata
    const fileMetadata = {
      id: fileId,
      user_id: userId,
      filename: uploadMeta.filename,
      bytes: uploadMeta.bytes,
      purpose: uploadMeta.purpose,
      status: 'uploaded',
      created_at: now,
      expires_at: uploadMeta.expires_at,
      content_type: uploadMeta.mime_type,
    };

    const { error: fileError } = await supabaseClient
      .from('files')
      .insert([fileMetadata]);

    if (fileError) {
      console.error('[Uploads] Error creating file:', fileError);
      // Clean up uploaded file
      await supabaseClient.storage.from(STORAGE_BUCKET).remove([finalPath]);
      return createErrorResponse(fileError);
    }

    // Update upload status
    const { error: updateError } = await supabaseClient
      .from('uploads')
      .update({
        status: 'completed',
        file_id: fileId,
      })
      .eq('id', uploadId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Uploads] Error updating upload status:', updateError);
    }

    // Clean up parts
    const partPaths = partIds.map((id: string) => `${userId}/uploads/${uploadId}/${id}.part`);
    await supabaseClient.storage.from(STORAGE_BUCKET).remove(partPaths);

    const fileObject: OpenAIFile = {
      id: fileId,
      object: 'file',
      bytes: uploadMeta.bytes,
      created_at: now,
      expires_at: uploadMeta.expires_at,
      filename: uploadMeta.filename,
      purpose: uploadMeta.purpose,
      status: 'uploaded',
    };

    const response: Upload = {
      id: uploadId,
      object: 'upload',
      bytes: uploadMeta.bytes,
      created_at: uploadMeta.created_at,
      filename: uploadMeta.filename,
      purpose: uploadMeta.purpose,
      status: 'completed',
      expires_at: uploadMeta.expires_at,
      file: fileObject,
    };

    console.log('[Uploads] Completed upload:', uploadId, 'file:', fileId);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Uploads] Error completing upload:', error);
    return createErrorResponse(error);
  }
}

/**
 * POST /uploads/{upload_id}/cancel
 * Cancel an upload
 */
async function cancelUpload(
  _req: Request,
  supabaseClient: any,
  userId: string,
  uploadId: string
): Promise<Response> {
  try {
    console.log('[Uploads] Cancelling upload:', uploadId);

    // Get upload metadata
    const { data: uploadMeta, error: fetchError } = await supabaseClient
      .from('uploads')
      .select('*')
      .eq('id', uploadId)
      .eq('user_id', userId)
      .single();

    if (fetchError || !uploadMeta) {
      return new Response(
        JSON.stringify({
          error: {
            message: 'Upload not found',
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

    // Update upload status
    const { error: updateError } = await supabaseClient
      .from('uploads')
      .update({ status: 'cancelled' })
      .eq('id', uploadId)
      .eq('user_id', userId);

    if (updateError) {
      console.error('[Uploads] Error cancelling upload:', updateError);
      return createErrorResponse(updateError);
    }

    // Clean up parts
    const partIds = uploadMeta.part_ids || [];
    if (partIds.length > 0) {
      const partPaths = partIds.map((id: string) => `${userId}/uploads/${uploadId}/${id}.part`);
      await supabaseClient.storage.from(STORAGE_BUCKET).remove(partPaths);
    }

    const response: Upload = {
      id: uploadId,
      object: 'upload',
      bytes: uploadMeta.bytes,
      created_at: uploadMeta.created_at,
      filename: uploadMeta.filename,
      purpose: uploadMeta.purpose,
      status: 'cancelled',
      expires_at: uploadMeta.expires_at,
    };

    console.log('[Uploads] Cancelled upload:', uploadId);

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('[Uploads] Error cancelling upload:', error);
    return createErrorResponse(error);
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
