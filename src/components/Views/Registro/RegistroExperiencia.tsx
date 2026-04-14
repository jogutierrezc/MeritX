import React from 'react';
import { Briefcase } from 'lucide-react';
import type { Experiencia } from '../../../types';

interface RegistroExperienciaProps {
  experiencia: Experiencia[];
  onAdd: () => void;
  onUpdate: (index: number, value: Experiencia) => void;
  onRemove: (index: number) => void;
}

export const RegistroExperiencia: React.FC<RegistroExperienciaProps> = ({
  experiencia,
  onAdd,
  onUpdate,
  onRemove,
}) => {
  return (
    <section className="bg-white p-10 border-2 border-slate-200 space-y-8">
      <div className="flex justify-between items-center border-b-2 border-slate-100 pb-6">
        <div className="flex items-center gap-3 text-slate-950 border-l-8 border-slate-950 pl-6">
          <Briefcase size={20} />
          <h3 className="font-black uppercase tracking-widest text-[11px]">Historia Profesional</h3>
        </div>
        <button
          onClick={onAdd}
          className="bg-slate-100 text-slate-950 px-4 py-2 text-[9px] font-black hover:bg-slate-950 hover:text-white transition-all"
        >
          + CARGO
        </button>
      </div>
      <div className="space-y-4">
        {experiencia.map((exp, i) => (
          <div key={i} className="grid grid-cols-1 md:grid-cols-5 gap-0 border-2 border-slate-100">
            <select
              value={exp.tipo}
              onChange={(e) =>
                onUpdate(i, { ...exp, tipo: e.target.value as any })
              }
              className="p-4 bg-white text-[10px] font-bold outline-none border-r border-slate-100 col-span-1"
            >
              <option>Profesional</option>
              <option>Docencia Universitaria</option>
              <option>Investigación</option>
            </select>
            <input
              type="date"
              value={exp.inicio}
              onChange={(e) =>
                onUpdate(i, { ...exp, inicio: e.target.value })
              }
              className="p-4 bg-slate-50 text-[10px] font-bold outline-none border-r border-slate-100 col-span-1"
            />
            <input
              type="date"
              value={exp.fin}
              onChange={(e) =>
                onUpdate(i, { ...exp, fin: e.target.value })
              }
              className="p-4 bg-slate-50 text-[10px] font-bold outline-none border-r border-slate-100 col-span-1"
            />
            <button
              onClick={() =>
                onUpdate(i, {
                  ...exp,
                  certificacion: exp.certificacion === 'SI' ? 'NO' : 'SI',
                })
              }
              className={`p-4 text-[9px] font-black transition-all col-span-1 ${
                exp.certificacion === 'SI'
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-300'
              }`}
            >
              SOPORTE: {exp.certificacion}
            </button>
            <button
              onClick={() => onRemove(i)}
              className="p-4 bg-red-50 text-red-600 text-[9px] font-black hover:bg-red-600 hover:text-white transition-all"
            >
              ELIMINAR
            </button>
          </div>
        ))}
      </div>
    </section>
  );
};
