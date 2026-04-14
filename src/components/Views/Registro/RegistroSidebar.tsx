import React from 'react';
import { Award, Languages, Plus, FileCheck } from 'lucide-react';
import type { FormData, Titulo } from '../../../types';

interface RegistroSidebarProps {
  formData: FormData;
  onAddTitulo: () => void;
  onRemoveTitulo: (index: number) => void;
  onAddIdioma: () => void;
  onRemoveIdioma: (index: number) => void;
  onUpdateIdioma: (index: number, value: any) => void;
  onUpdateTitulo: (index: number, value: Titulo) => void;
  onSave: () => void;
  loading: boolean;
}

export const RegistroSidebar: React.FC<RegistroSidebarProps> = ({
  formData,
  onAddTitulo,
  onRemoveTitulo,
  onAddIdioma,
  onRemoveIdioma,
  onUpdateIdioma,
  onUpdateTitulo,
  onSave,
  loading,
}) => {
  const handleTituloChange = (index: number, field: 'titulo' | 'nivel', value: string) => {
    const current = formData.titulos[index];
    if (!current) return;
    onUpdateTitulo(index, {
      ...current,
      [field]: value,
    } as Titulo);
  };

  return (
    <div className="lg:col-span-4 space-y-8">
      {/* Titulación */}
      <section className="bg-white p-8 border-2 border-slate-200 space-y-6">
        <div className="flex justify-between items-center border-b-2 border-slate-950 pb-4">
          <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-2">
            <Award size={16} className="text-blue-600" /> Titulación
          </h3>
          <button
            onClick={onAddTitulo}
            className="text-slate-950 hover:bg-slate-100 p-1"
          >
            <Plus size={20} />
          </button>
        </div>
        <div className="space-y-4">
          {formData.titulos.map((t, i) => (
            <div key={i} className="p-5 bg-slate-50 border border-slate-100 space-y-3">
              <input
                value={t.titulo}
                onChange={(e) => handleTituloChange(i, 'titulo', e.target.value)}
                className="w-full p-2 bg-white border border-slate-200 text-[10px] font-bold uppercase outline-none focus:border-slate-950"
                placeholder="PROGRAMA"
              />
              <select
                value={t.nivel}
                onChange={(e) => handleTituloChange(i, 'nivel', e.target.value)}
                className="w-full p-2 bg-slate-950 text-white text-[9px] font-black uppercase tracking-widest"
              >
                <option>Pregrado</option>
                <option>Especialización</option>
                <option>Maestría</option>
                <option>Doctorado</option>
              </select>
              <button
                onClick={() => onRemoveTitulo(i)}
                className="w-full p-2 bg-red-50 text-red-600 text-[9px] font-black hover:bg-red-600 hover:text-white transition-all"
              >
                ELIMINAR
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Bilingüismo */}
      <section className="bg-slate-950 p-8 border-b-8 border-blue-600 text-white space-y-6">
        <div className="flex justify-between items-center border-b border-white/20 pb-4">
          <h3 className="font-black text-[11px] uppercase tracking-widest flex items-center gap-2">
            <Languages size={16} className="text-blue-400" /> Bilingüismo
          </h3>
          <button
            onClick={onAddIdioma}
            className="bg-white/10 hover:bg-white/20 p-1"
          >
            <Plus size={18} />
          </button>
        </div>
        <div className="space-y-4">
          {formData.idiomas.map((idm, i) => (
            <div key={i} className="p-4 bg-white/5 border border-white/10 space-y-4">
              <div className="flex gap-2">
                <input
                  value={idm.idioma}
                  onChange={(e) =>
                    onUpdateIdioma(i, { ...idm, idioma: e.target.value })
                  }
                  className="flex-1 p-2 bg-slate-800 border-none text-[10px] font-bold outline-none uppercase"
                  placeholder="IDIOMA"
                />
                <select
                  value={idm.nivel}
                  onChange={(e) =>
                    onUpdateIdioma(i, { ...idm, nivel: e.target.value as any })
                  }
                  className="p-2 bg-blue-600 border-none text-[10px] font-black"
                >
                  <option>A2</option>
                  <option>B1</option>
                  <option>B2</option>
                  <option>C1</option>
                </select>
              </div>
              <button
                onClick={() =>
                  onUpdateIdioma(i, {
                    ...idm,
                    convalidacion: idm.convalidacion === 'SI' ? 'NO' : 'SI',
                  })
                }
                className={`w-full py-2 text-[9px] font-black transition-all border ${
                  idm.convalidacion === 'SI'
                    ? 'bg-blue-600 border-blue-600'
                    : 'bg-transparent border-white/20'
                }`}
              >
                CONVALIDACIÓN: {idm.convalidacion}
              </button>
              <button
                onClick={() => onRemoveIdioma(i)}
                className="w-full py-2 text-[9px] font-black bg-red-600/20 border border-red-600/50 hover:bg-red-600 hover:border-red-600 text-red-400 hover:text-white transition-all"
              >
                ELIMINAR
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Save Button */}
      <button
        onClick={onSave}
        disabled={loading}
        className="w-full bg-blue-600 text-white py-8 font-black text-[12px] tracking-[0.4em] shadow-2xl hover:bg-blue-700 active:scale-[0.98] transition-all flex items-center justify-center gap-4 disabled:opacity-50"
      >
        FINALIZAR REGISTRO <FileCheck size={24} />
      </button>
    </div>
  );
};
