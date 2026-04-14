import React from 'react';
import { Database } from 'lucide-react';
import type { FormData } from '../../../types';

interface RegistroIdentificacionProps {
  formData: FormData;
  onUpdateField: (field: keyof FormData, value: any) => void;
}

const fields = [
  { label: 'Nombre Completo', val: 'nombre', ph: 'Apellido, Nombre' },
  { label: 'Documento ID', val: 'documento', ph: 'C.C. XXXXXXXX' },
  { label: 'Programa', val: 'programa', ph: 'Facultad Relacionada' },
  { label: 'Facultad', val: 'facultad', ph: 'Unidad Académica' },
];

export const RegistroIdentificacion: React.FC<RegistroIdentificacionProps> = ({
  formData,
  onUpdateField,
}) => {
  return (
    <section className="bg-white p-10 border-2 border-slate-200 space-y-8">
      <div className="flex items-center gap-3 text-slate-950 border-l-8 border-slate-950 pl-6">
        <Database size={20} />
        <h3 className="font-black uppercase tracking-widest text-[11px]">Identificación Oficial</h3>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
        {fields.map((field) => (
          <div key={field.val} className="space-y-2">
            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest block">
              {field.label}
            </label>
            <input
              value={(formData as any)[field.val]}
              onChange={(e) => onUpdateField(field.val as keyof FormData, e.target.value)}
              type="text"
              className="w-full p-4 bg-slate-50 border-2 border-slate-100 focus:border-slate-950 outline-none transition-all font-bold text-[11px] uppercase tracking-wider"
              placeholder={field.ph}
            />
          </div>
        ))}
      </div>
    </section>
  );
};
