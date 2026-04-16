/**
 * api/r2/delete.js
 *
 * Elimina un objeto de Cloudflare R2 por su objectKey (storage path).
 * Se llama al desactivar un documento RAG desde el AdminPortal.
 */

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;

  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) {
    return res.status(500).json({ error: 'R2 environment variables not configured' });
  }

  const { objectKey } = req.body ?? {};

  if (!objectKey) {
    return res.status(400).json({ error: 'Missing required field: objectKey' });
  }

  try {
    const { S3Client, DeleteObjectCommand } = await import('@aws-sdk/client-s3');

    const client = new S3Client({
      region: 'auto',
      endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
      credentials: {
        accessKeyId: R2_ACCESS_KEY_ID,
        secretAccessKey: R2_SECRET_ACCESS_KEY,
      },
    });

    await client.send(new DeleteObjectCommand({
      Bucket: R2_BUCKET_NAME,
      Key: objectKey,
    }));

    return res.status(200).json({ ok: true, deleted: objectKey });
  } catch (error) {
    console.error('[api/r2/delete] Error:', error);
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Failed to delete object from R2',
    });
  }
}
