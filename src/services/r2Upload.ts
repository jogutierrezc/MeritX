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

const requestPresignedUpload = async (payload: PresignRequest): Promise<PresignResponse> => {
  const response = await fetch('/api/r2/upload', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const body = await response.text();
    throw new Error(`No fue posible generar URL de carga R2: ${response.status} ${body}`);
  }

  const data = await response.json();
  if (!data?.presignedUrl || !data?.objectKey) {
    throw new Error('Respuesta inválida de /api/r2/upload.');
  }

  return {
    presignedUrl: String(data.presignedUrl),
    objectKey: String(data.objectKey),
    publicUrl: typeof data.publicUrl === 'string' ? data.publicUrl : null,
  };
};

export const uploadFileToR2 = async (params: { file: File; objectKey: string }) => {
  const { file, objectKey } = params;

  const { presignedUrl, objectKey: confirmedObjectKey, publicUrl } = await requestPresignedUpload({
    fileName: file.name,
    fileType: file.type || 'application/octet-stream',
    documentKey: sanitizeFileName(file.name),
    objectKey,
  });

  const uploadResponse = await fetch(presignedUrl, {
    method: 'PUT',
    headers: {
      'Content-Type': file.type || 'application/octet-stream',
    },
    body: file,
  });

  if (!uploadResponse.ok) {
    const body = await uploadResponse.text();
    throw new Error(`No fue posible subir archivo a R2: ${uploadResponse.status} ${body || uploadResponse.statusText}`);
  }

  return {
    objectKey: confirmedObjectKey,
    publicUrl: publicUrl || null,
  };
};
