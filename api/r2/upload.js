/**
 * api/r2/upload.js
 *
 * Genera una URL pre-firmada (presigned PUT) para que el cliente suba
 * archivos RAG directamente a Cloudflare R2, sin pasar por este servidor.
 *
 * Variables de entorno requeridas (Vercel Dashboard + .env local):
 *   R2_ACCOUNT_ID        → (set via env var)
 *   R2_ACCESS_KEY_ID     → (set via env var)
 *   R2_SECRET_ACCESS_KEY → (set via env var)  — DO NOT commit secrets
 *   R2_BUCKET_NAME       → (set via env var)
 *   R2_PUBLIC_URL        → (optional, set via env var)
 *
 * Nota: No incluya valores reales en el repositorio. Use variables de
 * entorno en Vercel o un gestor de secretos localmente.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME, R2_PUBLIC_URL } = process.env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    return res.status(500).json({ error: 'R2 environment variables not configured' });
  }

  const { fileName, fileType, documentKey, objectKey: objectKeyInput } = req.body ?? {};

  if (!fileName || !fileType) {
    return res.status(400).json({ error: 'Missing required fields: fileName, fileType' });
  }

  const normalizedObjectKeyInput = typeof objectKeyInput === 'string' ? objectKeyInput.trim().replace(/^\/+/, '') : '';
  if (!normalizedObjectKeyInput && !documentKey) {
    return res.status(400).json({ error: 'Missing required field: documentKey or objectKey' });
  }

  if (normalizedObjectKeyInput.includes('..')) {
    return res.status(400).json({ error: 'Invalid objectKey' });
  }

  try {
    // Importación dinámica para reducir cold start en Vercel
    const { S3Client, PutObjectCommand } = await import('@aws-sdk/client-s3');
    const { getSignedUrl } = await import('@aws-sdk/s3-request-presigner');

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    const objectKey = normalizedObjectKeyInput || `rag-documents/${documentKey}`;

    const command = new PutObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
      ContentType: fileType,
    });

    // La URL firmada expira en 5 minutos (tiempo más que suficiente para subir)
    const presignedUrl = await getSignedUrl(client, command, { expiresIn: 300 });

    // URL pública para lectura posterior desde los módulos RAG
    const publicUrl = R2_PUBLIC_URL
      ? `${R2_PUBLIC_URL.replace(/\/$/, '')}/${objectKey}`
      : null;

    return res.status(200).json({ presignedUrl, publicUrl, objectKey });
  } catch (error) {
    console.error('[api/r2/upload] Error:', error);
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to generate presigned URL',
    });
  }
}
