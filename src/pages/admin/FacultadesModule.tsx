import React, { useState } from 'react';
import { FileText, Upload } from 'lucide-react';

// ─── Props ────────────────────────────────────────────────────────────────────

type Props = {
  saving: boolean;
  onImport: (json: string) => Promise<void>;
};

// ─── Component ────────────────────────────────────────────────────────────────

export const FacultadesModule = ({ saving, onImport }: Props) => {
  const [json, setJson] = useState('');

  const handleImport = async () => {
    await onImport(json);
    setJson('');
  };

  const EXAMPLE = `[
  {
    "facultyName": "Ingenierías",
    "programs": [
      { "name": "Ingeniería de Sistemas", "level": "PREGRADO" },
      { "name": "Ingeniería Industrial", "level": "PREGRADO" }
    ]
  },
  {
    "facultyName": "Ciencias de la Salud",
    "programs": [
      { "name": "Medicina", "level": "PREGRADO" },
      { "name": "Enfermería", "level": "PREGRADO" }
    ]
  }
]`;

  return (
    <div className="rounded-[2rem] border border-slate-100 bg-white p-8 shadow-xl shadow-slate-200/40">
      {/* Header */}
      <div className="mb-6 flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-600">
          <Upload size={22} />
        </div>
        <div>
          <h3 className="text-lg font-black uppercase tracking-tight text-slate-800">
            Importar Estructura de Facultades y Programas
          </h3>
          <p className="mt-1 text-xs font-semibold text-slate-500">
            Pega un JSON con la estructura. Cada facultad incluye un array de programas con nombre y nivel
            de formación.
          </p>
        </div>
      </div>

      {/* Format hint */}
      <div className="mb-4 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3">
        <p className="mb-1 text-[10px] font-black uppercase tracking-widest text-amber-700">
          Formato esperado
        </p>
        <p className="font-mono text-[11px] text-amber-800 leading-relaxed">
          {'[{ "facultyName": "Nombre", "programs": [{ "name": "Programa", "level": "PREGRADO" }] }]'}
        </p>
      </div>

      {/* Textarea */}
      <textarea
        value={json}
        onChange={(e) => setJson(e.target.value)}
        rows={10}
        placeholder={EXAMPLE}
        className="w-full rounded-2xl border-2 border-transparent bg-slate-50 px-5 py-3.5 font-mono text-xs outline-none transition-all focus:border-blue-500 focus:bg-white"
      />

      {/* Action row */}
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          onClick={handleImport}
          disabled={saving || !json.trim()}
          className="flex items-center gap-2 rounded-2xl bg-blue-600 px-6 py-3 text-xs font-black uppercase tracking-[0.2em] text-white shadow-lg shadow-blue-200 transition-all hover:bg-blue-700 disabled:opacity-60"
        >
          <FileText size={16} /> Importar estructura
        </button>
        <button
          type="button"
          onClick={() => setJson(EXAMPLE)}
          className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-bold text-slate-500 transition-all hover:border-blue-300 hover:text-blue-600"
        >
          Cargar ejemplo
        </button>
        {json.trim() && (
          <button
            type="button"
            onClick={() => setJson('')}
            className="ml-auto rounded-2xl text-xs font-bold text-rose-400 transition-all hover:text-rose-600"
          >
            Limpiar
          </button>
        )}
      </div>
    </div>
  );
};

export default FacultadesModule;
