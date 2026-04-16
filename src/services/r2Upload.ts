type PresignRequest = {
  fileName: string;
  fileType: string;
  documentKey?: string;
  objectKey?: string;
};

type PresignResponse = {
  presignedUrl: string;
  objectKey: string;
  publicUrl?: string | null;
};

type UploadResult = {
  objectKey: string;
  publicUrl: string | null;
  fileName: string;
  success: true;
};

type UploadError = {
  fileName: string;
  objectKey: string;
  error: string;
  success: false;
  retryable: boolean;
};

const sanitizeFileName = (value: string) =>
  String(value || 'archivo')
    .trim()
    .replace(/[^a-zA-Z0-9._-]/g, '_')
    .replace(/_+/g, '_')
    .slice(0, 180) || 'archivo';

export const buildSupportObjectKey = (params: {
  trackingId: string;
  scope: 'titles' | 'experience';
  rowRef: string | number;
  fileName: string;
}) => {
  const safeTracking = String(params.trackingId || 'unknown').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeRowRef = String(params.rowRef || '0').replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeName = sanitizeFileName(params.fileName);
  return `professor-supports/${params.scope}/${safeTracking}/${safeRowRef}-${Date.now()}-${safeName}`;
};

const isRetryableError = (status: number, error: unknown) => {
  // Retry on network errors, timeouts, and server errors (5xx)
  if (status >= 500 && status < 600) return true;
  if (status === 408 || status === 429) return true; // Timeout and rate limit
  if (error instanceof TypeError) return true; // Network error
  return false;
};

const waitMs = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

const requestPresignedUpload = async (
  payload: PresignRequest,
  attempt: number = 1,
  maxAttempts: number = 3,
): Promise<PresignResponse> => {
  try {
    const response = await fetch('/api/r2/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout?.(30000), // 30s timeout
    });

    if (!response.ok) {
      const body = await response.text();
      if (isRetryableError(response.status, null) && attempt < maxAttempts) {
        await waitMs(Math.pow(2, attempt - 1) * 500); // Exponential backoff: 500ms, 1s, 2s
        return requestPresignedUpload(payload, attempt + 1, maxAttempts);
      }
      throw new Error(`Presign failed [${response.status}]: ${body}`);
    }

    const data = await response.json();
    if (!data?.presignedUrl || !data?.objectKey) {
      throw new Error('Invalid presign response');
    }

    return {
      presignedUrl: String(data.presignedUrl),
      objectKey: String(data.objectKey),
      publicUrl: typeof data.publicUrl === 'string' ? data.publicUrl : null,
    };
  } catch (error) {
    if (attempt < maxAttempts && isRetryableError(0, error)) {
      await waitMs(Math.pow(2, attempt - 1) * 500);
      return requestPresignedUpload(payload, attempt + 1, maxAttempts);
    }
    throw error;
  }
};

const putFileWithRetry = async (
  presignedUrl: string,
  file: File,
  attempt: number = 1,
  maxAttempts: number = 3,
): Promise<void> => {
  try {
    const uploadResponse = await fetch(presignedUrl, {
      method: 'PUT',
      headers: {
        'Content-Type': file.type || 'application/octet-stream',
      },
      body: file,
      signal: AbortSignal.timeout?.(60000), // 60s timeout for large files
    });

    if (!uploadResponse.ok) {
      const body = await uploadResponse.text();
      if (isRetryableError(uploadResponse.status, null) && attempt < maxAttempts) {
        await waitMs(Math.pow(2, attempt - 1) * 500);
        return putFileWithRetry(presignedUrl, file, attempt + 1, maxAttempts);
      }
      throw new Error(`PUT failed [${uploadResponse.status}]: ${body || uploadResponse.statusText}`);
    }
  } catch (error) {
    if (attempt < maxAttempts && isRetryableError(0, error)) {
      await waitMs(Math.pow(2, attempt - 1) * 500);
      return putFileWithRetry(presignedUrl, file, attempt + 1, maxAttempts);
    }
    throw error;
  }
};

export const uploadFileToR2 = async (params: { file: File; objectKey: string }) => {
  const { file, objectKey } = params;

  try {
    const { presignedUrl, objectKey: confirmedObjectKey, publicUrl } = await requestPresignedUpload({
      fileName: file.name,
      fileType: file.type || 'application/octet-stream',
      documentKey: sanitizeFileName(file.name),
      objectKey,
    });

    await putFileWithRetry(presignedUrl, file);

    console.debug(`[R2] Uploaded ${file.name} → ${confirmedObjectKey}`);
    return {
      objectKey: confirmedObjectKey,
      publicUrl: publicUrl || null,
    };
  } catch (error) {
    const msg = error instanceof Error ? error.message : 'Unknown error';
    console.error(`[R2] Failed to upload ${file.name}: ${msg}`);
    throw error;
  }
};

/**
 * Upload multiple files in parallel with detailed result tracking.
 * @returns Promise with array of results (mix of successes and failures)
 */
export const uploadMultipleFilesToR2 = async (
  uploads: Array<{ file: File; objectKey: string }>,
  onProgress?: (completed: number, total: number) => void,
  maxConcurrency: number = 4,
): Promise<{
  successful: UploadResult[];
  failed: UploadError[];
  total: number;
}> => {
  const results = {
    successful: [] as UploadResult[],
    failed: [] as UploadError[],
    total: uploads.length,
  };

  if (uploads.length === 0) return results;

  // Track progress
  let completed = 0;
  const concurrency = Math.max(1, Math.min(maxConcurrency, uploads.length));
  let nextIndex = 0;

  const worker = async () => {
    while (true) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      if (currentIndex >= uploads.length) return;

      const upload = uploads[currentIndex];
      try {
        const result = await uploadFileToR2(upload);
        const uploadResult: UploadResult = {
          objectKey: result.objectKey,
          publicUrl: result.publicUrl,
          fileName: upload.file.name,
          success: true,
        };
        results.successful.push(uploadResult);
        console.info(`[R2] ✓ Complete: ${upload.file.name}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : 'Unknown error';
        const uploadError: UploadError = {
          fileName: upload.file.name,
          objectKey: upload.objectKey,
          error: msg,
          success: false,
          retryable: isRetryableError(0, error),
        };
        results.failed.push(uploadError);
        console.error(`[R2] ✗ Failed: ${upload.file.name} - ${msg}`);
      } finally {
        completed += 1;
        onProgress?.(completed, uploads.length);
      }
    }
  };

  await Promise.all(Array.from({ length: concurrency }, () => worker()));

  return results;
};
