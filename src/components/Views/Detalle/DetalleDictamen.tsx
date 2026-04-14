import React from 'react';
import { BrainCircuit } from 'lucide-react';

interface DetalleDictamenProps {
  analysis: string;
}

export const DetalleDictamen: React.FC<DetalleDictamenProps> = ({ analysis }) => {
  return (
    <section className="bg-slate-950 text-white p-16 border-l-8 border-blue-600 relative overflow-hidden animate-in slide-in-from-top-10 duration-700">
      <div className="flex items-center gap-8 mb-12 pb-10 border-b border-white/10">
        <div className="bg-blue-600 p-5 shadow-2xl">
          <BrainCircuit className="text-white w-10 h-10" />
        </div>
        <div>
          <h3 className="text-3xl font-black uppercase tracking-tighter">Dictamen Técnico CAP</h3>
          <p className="text-blue-400 text-[11px] font-black tracking-[0.5em] uppercase">
            AUDITORÍA BASADA EN REGLAMENTO 013
          </p>
        </div>
      </div>
      <div className="space-y-10 relative z-10">
        {analysis.split('\n').map((line, i) => (
          <p
            key={i}
            className="text-slate-300 text-lg leading-relaxed font-bold uppercase tracking-tight opacity-90 border-l border-white/10 pl-6"
          >
            {line}
          </p>
        ))}
      </div>
    </section>
  );
};
