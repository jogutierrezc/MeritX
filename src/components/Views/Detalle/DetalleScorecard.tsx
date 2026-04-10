import React from 'react';
import { Fingerprint, Info } from 'lucide-react';
import type { Request } from '../../../types';

interface DetalleScorecardProps {
  request: Request;
}

export const DetalleScorecard: React.FC<DetalleScorecardProps> = ({ request }) => {
  return (
    <div className="space-y-8">
      {/* Points Card */}
      <div className="bg-white p-12 border-4 border-slate-950 sticky top-32 shadow-2xl">
        <p className="text-[12px] font-black text-blue-600 uppercase tracking-[0.4em] mb-12 text-center">
          Valoración Unidades
        </p>

        <div className="text-center mb-16 relative">
          <div className="inline-block border-8 border-slate-950 p-8">
            <h3 className="text-9xl font-black text-slate-950 tracking-tighter leading-none">
              {request.finalPts.toFixed(1)}
            </h3>
            <p className="text-[10px] font-black uppercase tracking-[0.5em] mt-4 text-blue-600">
              Puntaje Auditoría
            </p>
          </div>
          <div
            className={`mt-10 w-full py-5 text-center font-black text-[12px] uppercase tracking-[0.3em] ${request.finalCat.bgColor} text-white`}
          >
            NIVEL {request.finalCat.name}
          </div>
        </div>

        <div className="space-y-px bg-slate-200">
          {[
            { l: 'Formación', v: request.ptsTitulos },
            { l: 'Idiomas', v: request.ptsIdioma },
            { l: 'Producción', v: request.ptsProduccion.toFixed(1) },
          ].map((item) => (
            <div key={item.l} className="flex justify-between items-center px-6 py-5 bg-white">
              <span className="text-slate-400 font-black text-[11px] uppercase tracking-widest">
                {item.l}
              </span>
              <span className="font-black text-slate-950 text-2xl">{item.v}</span>
            </div>
          ))}
          <div className="flex justify-between items-center px-6 py-6 bg-blue-50 border-t-4 border-blue-600">
            <span className="text-blue-900 font-black text-[11px] uppercase tracking-widest">
              Exp. Topada
            </span>
            <span className="font-black text-blue-600 text-2xl">
              {request.cappedExp.toFixed(1)}
            </span>
          </div>
        </div>

        <div className="mt-10 p-8 bg-slate-950 text-white flex items-start gap-6 border-b-8 border-blue-600">
          <Info className="text-blue-400 w-8 h-8 flex-shrink-0" />
          <p className="text-[10px] text-slate-400 font-bold leading-relaxed uppercase tracking-tighter">
            Rango certificado para <b>{request.finalCat.name}</b>:{' '}
            {request.finalCat.min} a{' '}
            {request.finalCat.max === Infinity ? '+' : request.finalCat.max} unidades.
          </p>
        </div>
      </div>

      {/* Works Card */}
      <div className="bg-slate-900 p-12 text-white border-l-8 border-blue-600 shadow-2xl">
        <div className="flex items-center justify-between mb-12 border-b border-white/10 pb-8">
          <div className="flex items-center gap-4">
            <Fingerprint size={24} className="text-blue-400" />
            <h4 className="text-[12px] font-black uppercase tracking-[0.3em] text-blue-100">
              Obras Registradas
            </h4>
          </div>
          <span className="text-[12px] font-black bg-blue-600 px-4 py-2 border border-white/10">
            {request.produccion.length}
          </span>
        </div>
        <div className="space-y-px bg-white/10 border border-white/10">
          {request.produccion.map((art, idx) => (
            <div key={idx} className="bg-slate-900 p-8 hover:bg-slate-800 transition-all group">
              <div className="flex justify-between items-start gap-8 mb-4">
                <p className="text-[14px] font-black text-slate-100 leading-snug uppercase tracking-tight group-hover:text-blue-400 transition-colors">
                  {art.titulo}
                </p>
                <span className="text-[10px] font-black text-blue-400 border border-blue-400/30 px-3 py-1">
                  {art.cuartil}
                </span>
              </div>
              <div className="flex items-center justify-between opacity-50 text-[10px] font-black tracking-widest uppercase">
                <span>{art.source}</span>
                <span>{art.fecha}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
