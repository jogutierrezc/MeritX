import React, { useState } from 'react';
import { FileSearch, Plus, X } from 'lucide-react';

import type { RagConfig, RagDocument } from '../../../types/config';

type Props = {
  ragDocuments: RagDocument[];
  ragConfig: RagConfig;
  onUpload: (file: File) => Promise<void>;
  onDeactivate: (documentKey: string) => Promise<void>;
  onStatus: (msg: string) => void;
};

const prettyBytes = (bytes: number) => {
  if (!bytes) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  let val = bytes;
  let idx = 0;
  while (val >= 1024 && idx < units.length - 1) {
    val /= 1024;
    idx++;
  }
  return `${val.toFixed(idx === 0 ? 0 : 1)} ${units[idx]}`;
};

export const RagDocumentosModule: React.FC<Props> = ({
  ragDocuments,
  ragConfig,
  onUpload,
  onDeactivate,
  onStatus,
}) => {
  const [uploading, setUploading] = useState(false);

  const activeDocuments = ragDocuments.filter((d) => d.active);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setUploading(true);
      await onUpload(f);
      onStatus(`Documento "${f.name}" cargado al bucket RAG.`);
    } catch (err) {
      onStatus('No fue posible cargar el documento RAG.');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  return (
    <div className="space-y-5 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <FileSearch className="text-indigo-600" size={20} />
          <div>
            <h3 className="text-lg font-black tracking-tight text-slate-800">Documentos de conocimiento</h3>
            <p className="text-xs font-semibold text-slate-500">
              Bucket: <strong>{ragConfig.bucketName}</strong> — Los documentos se almacenan con su contenido en Spacetime.
            </p>
          </div>
        </div>
        <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-xs font-black uppercase tracking-[0.18em] text-white hover:bg-indigo-700">
          <Plus size={14} />
          {uploading ? 'Subiendo…' : 'Cargar documento'}
          <input type="file" className="hidden" onChange={handleUpload} />
        </label>
      </div>

      <div className="space-y-3">
        {activeDocuments.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
            No hay documentos activos en RAG.
          </p>
        ) : (
          activeDocuments.map((doc) => (
            <div
              key={doc.documentKey}
              className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
            >
              <div className="min-w-0">
                <p className="truncate text-sm font-black text-slate-800">{doc.fileName}</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                  {doc.fileType} · {prettyBytes(doc.fileSizeBytes)}
                  {doc.uploadedAt
                    ? ' · ' + new Date(doc.uploadedAt).toLocaleDateString('es-CO')
                    : ''}
                </p>
              </div>
              <button
                onClick={() => {
                  onDeactivate(doc.documentKey);
                  onStatus('Documento RAG desactivado.');
                }}
                className="ml-4 flex-shrink-0 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
              >
                <X size={12} className="inline" /> Desactivar
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
};
