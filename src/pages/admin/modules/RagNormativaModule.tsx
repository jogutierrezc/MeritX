import React, { useState } from 'react';
import { BookOpen, FileJson, Plus, Save, X } from 'lucide-react';

import type { RagNormative } from '../../../types/config';
import {
  normativeArticleCount,
  normativeDisplayTitle,
  parseNormativeJson,
} from '../../../utils/ragNormativeParser';

type Props = {
  ragNormatives: RagNormative[];
  onUpload: (title: string, json: string, documentId: string, file?: File) => Promise<void>;
  onDeactivate: (normativeKey: string) => Promise<void>;
  onStatus: (msg: string) => void;
};

const isValidJson = (text: string) => {
  try {
    JSON.parse(text);
    return true;
  } catch {
    return false;
  }
};

export const RagNormativaModule: React.FC<Props> = ({
  ragNormatives,
  onUpload,
  onDeactivate,
  onStatus,
}) => {
  const [title, setTitle] = useState('');
  const [jsonPaste, setJsonPaste] = useState('');
  const [uploading, setUploading] = useState(false);

  const activeNormatives = ragNormatives.filter((n) => n.active);

  const preview = jsonPaste.trim() ? parseNormativeJson(jsonPaste) : null;
  const jsonIsValid = jsonPaste.trim() === '' || isValidJson(jsonPaste);

  const resolveTitle = () =>
    title.trim() ||
    (preview ? normativeDisplayTitle(preview, '') : '') ||
    'Normativa';

  const resolveDocumentId = () =>
    (preview ? String(preview.documento || preview.titulo_oficial || '').trim() : '') ||
    resolveTitle();

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    try {
      setUploading(true);
      const text = await f.text();
      if (!isValidJson(text)) {
        onStatus('El archivo no contiene JSON válido.');
        return;
      }
      const parsed = parseNormativeJson(text);
      const autoTitle =
        title.trim() ||
        (parsed ? normativeDisplayTitle(parsed, f.name.replace(/\.[^.]+$/, '')) : f.name);
      const docId = parsed
        ? String(parsed.documento || parsed.titulo_oficial || autoTitle).trim()
        : autoTitle;
      await onUpload(autoTitle, text, docId, f);
      onStatus(`Normativa "${autoTitle}" guardada en la base de datos RAG.`);
      setTitle('');
      setJsonPaste('');
    } finally {
      setUploading(false);
      if (e.target) e.target.value = '';
    }
  };

  const handleSavePaste = async () => {
    if (!jsonPaste.trim()) return;
    if (!isValidJson(jsonPaste)) {
      onStatus('El texto pegado no es JSON válido.');
      return;
    }
    try {
      setUploading(true);
      await onUpload(resolveTitle(), jsonPaste, resolveDocumentId());
      onStatus(`Normativa "${resolveTitle()}" guardada en la base de datos RAG.`);
      setTitle('');
      setJsonPaste('');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-6 rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl">
      {/* Header */}
      <div className="flex items-center gap-3">
        <BookOpen className="text-violet-600" size={20} />
        <div>
          <h3 className="text-lg font-black tracking-tight text-slate-800">
            Normatividad estructurada (JSON)
          </h3>
          <p className="text-xs font-semibold text-slate-500">
            Carga acuerdos, resoluciones y reglamentos en formato JSON para que el motor RAG los consulte
            artículo por artículo.
          </p>
        </div>
      </div>

      {/* Expected structure hint */}
      <details className="rounded-xl border border-violet-100 bg-violet-50">
        <summary className="cursor-pointer px-4 py-2 text-xs font-black text-violet-800">
          Ver estructura esperada del JSON
        </summary>
        <pre className="overflow-x-auto px-4 pb-4 text-[11px] font-mono text-violet-900">
{`{
  "documento": "Acuerdo No. 008 de 2019",
  "titulo_oficial": "Por medio del cual se regula el Escalafón...",
  "emisor": "Consejo Superior - Universidad de Santander",
  "fecha_expedicion": "04 de marzo de 2019",
  "articulos": [
    {
      "numero": "Artículo 1",
      "titulo": "Definición de escalafón",
      "contenido": "El escalafón profesoral es..."
    }
  ]
}`}
        </pre>
      </details>

      {/* Input row */}
      <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
        <input
          placeholder="Título (opcional, se toma del JSON si está vacío)"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="col-span-2 w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-semibold outline-none transition-all focus:border-violet-500 focus:bg-white"
        />
        <label className="inline-flex cursor-pointer items-center justify-center gap-2 rounded-2xl bg-violet-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700">
          <FileJson size={16} />
          {uploading ? 'Subiendo…' : 'Cargar archivo .json'}
          <input type="file" accept="application/json,.json" className="hidden" onChange={handleFileUpload} />
        </label>
      </div>

      {/* Paste area */}
      <div className="space-y-2">
        <label className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
          O pega el JSON aquí
        </label>
        <textarea
          rows={7}
          placeholder='{ "documento": "...", "articulos": [...] }'
          value={jsonPaste}
          onChange={(e) => setJsonPaste(e.target.value)}
          className={`w-full rounded-2xl border-2 bg-slate-50 px-5 py-3.5 font-mono text-sm outline-none transition-all focus:bg-white ${
            jsonPaste && !jsonIsValid ? 'border-rose-400' : 'border-transparent focus:border-violet-500'
          }`}
        />
        {jsonPaste && !jsonIsValid && (
          <p className="text-xs font-bold text-rose-600">JSON inválido — revisa la sintaxis.</p>
        )}
        {preview && (
          <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-4 py-2 text-xs font-semibold text-emerald-800">
            <BookOpen size={12} />
            <span>
              {normativeDisplayTitle(preview)} · {normativeArticleCount(preview)} artículo(s)
              {preview.emisor ? ` · ${preview.emisor}` : ''}
              {preview.fecha_expedicion ? ` · ${preview.fecha_expedicion}` : ''}
            </span>
          </div>
        )}
      </div>

      <button
        onClick={handleSavePaste}
        disabled={uploading || !jsonPaste.trim() || !jsonIsValid}
        className="inline-flex items-center gap-2 rounded-2xl bg-violet-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-violet-200 transition-all hover:bg-violet-700 disabled:opacity-50"
      >
        <Save size={16} />
        {uploading ? 'Guardando…' : 'Guardar normativa pegada'}
      </button>

      {/* List */}
      <div className="space-y-2">
        <p className="ml-1 text-xs font-black uppercase tracking-widest text-slate-400">
          Normativas activas ({activeNormatives.length})
        </p>
        {activeNormatives.length === 0 ? (
          <p className="rounded-xl border border-dashed border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-500">
            No hay normativas activas. Sube un JSON para que el motor RAG lo consulte.
          </p>
        ) : (
          activeNormatives.map((n) => {
            const parsed = parseNormativeJson(n.content);
            const artCount = normativeArticleCount(parsed);
            const docId = n.documentId || normativeDisplayTitle(parsed, n.title);
            return (
              <div
                key={n.normativeKey}
                className="flex items-center justify-between rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3"
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-black text-slate-800">{n.title}</p>
                  <p className="truncate text-[10px] font-bold uppercase tracking-[0.15em] text-slate-400">
                    {docId !== n.title ? docId + ' · ' : ''}{artCount > 0 ? `${artCount} artículos` : 'JSON'} ·{' '}
                    {n.uploadedAt ? new Date(n.uploadedAt).toLocaleDateString('es-CO') : ''}
                  </p>
                </div>
                <button
                  onClick={() => {
                    onDeactivate(n.normativeKey);
                    onStatus('Normativa desactivada correctamente.');
                  }}
                  className="ml-4 flex-shrink-0 rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-black text-rose-700 hover:bg-rose-100"
                >
                  <X size={12} className="inline" /> Desactivar
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
