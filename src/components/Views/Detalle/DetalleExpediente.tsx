import React from 'react';
import { ShieldCheck, User, FileCheck, Calendar, ChevronRight } from 'lucide-react';
import type { Request } from '../../../types';

interface DetalleExpedienteProps {
  request: Request;
}

export const DetalleExpediente: React.FC<DetalleExpedienteProps> = ({ request }) => {
  return (
    <section className="bg-white p-16 border-2 border-slate-200 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-32 h-32 bg-slate-950 text-white flex items-center justify-center">
        <ShieldCheck size={48} />
      </div>

      <div className="flex flex-col md:flex-row items-center gap-12 mb-16 relative z-10">
        <div className="bg-slate-950 p-10 text-white border-b-8 border-blue-600">
          <User className="w-16 h-16" />
        </div>
        <div className="text-center md:text-left">
          <h2 className="text-6xl font-black text-slate-950 tracking-tighter mb-4 leading-none uppercase">
            {request.nombre}
          </h2>
          <div className="flex flex-wrap justify-center md:justify-start gap-4 items-center">
            <span className="bg-blue-600 text-white px-6 py-2 text-[10px] font-black uppercase tracking-[0.2em]">
              {request.facultad}
            </span>
            <span className="bg-slate-100 text-slate-500 font-black text-[10px] px-6 py-2 uppercase tracking-tighter border border-slate-200">
              ID: {request.documento}
            </span>
            {request.orcid && (
              <span className="text-blue-600 text-[10px] font-black uppercase border-b-4 border-blue-100 tracking-widest">
                ORCID: {request.orcid}
              </span>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-px bg-slate-100 border border-slate-100 relative z-10">
        {/* Titulos */}
        <div className="bg-white p-12">
          <h3 className="text-[12px] font-black text-slate-950 uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
            <span className="w-3 h-3 fill-blue-600 bg-blue-600" /> Formación Postgrado
          </h3>
          <div className="space-y-6">
            {request.titulos.map((t, idx) => (
              <div
                key={idx}
                className="flex items-center gap-6 p-6 bg-slate-50 border border-slate-100 hover:border-slate-950 transition-colors"
              >
                <FileCheck size={24} className="text-slate-400" />
                <div>
                  <p className="text-sm font-black text-slate-950 uppercase tracking-tight">
                    {t.titulo}
                  </p>
                  <p className="text-[9px] text-slate-400 font-black uppercase tracking-widest">
                    {t.nivel}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Experiencia */}
        <div className="bg-white p-12">
          <h3 className="text-[12px] font-black text-slate-950 uppercase tracking-[0.4em] mb-10 flex items-center gap-3">
            <span className="w-3 h-3 fill-blue-600 bg-blue-600" /> Vinculación Docente
          </h3>
          <div className="space-y-6">
            {request.experiencia.map((e, idx) => (
              <div
                key={idx}
                className="p-6 bg-slate-50 border border-slate-100 hover:border-slate-950 transition-colors"
              >
                <div className="flex justify-between items-center mb-4">
                  <p className="text-xs font-black text-slate-950 uppercase">{e.tipo}</p>
                  {e.certificacion === 'SI' && (
                    <span className="text-[8px] bg-slate-950 text-white px-2 py-1 font-black tracking-tighter">
                      CERTIFICADO
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-4 text-slate-400 text-[10px] font-black">
                  <Calendar size={14} className="text-blue-600" /> {e.inicio}{' '}
                  <ChevronRight size={10} /> {e.fin || 'VIGENTE'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
};
