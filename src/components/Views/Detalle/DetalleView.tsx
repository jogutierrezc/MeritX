import React from 'react';
import { ArrowLeft, Download, BrainCircuit } from 'lucide-react';
import type { Request } from '../../../types';
import { DetalleExpediente } from './DetalleExpediente';
import { DetalleScorecard } from './DetalleScorecard';
import { DetalleDictamen } from './DetalleDictamen';

interface DetalleViewProps {
  request: Request;
  aiAnalysis: string;
  onGenerateAI: () => void;
  onBack: () => void;
  loading: boolean;
}

export const DetalleView: React.FC<DetalleViewProps> = ({
  request,
  aiAnalysis,
  onGenerateAI,
  onBack,
  loading,
}) => {
  return (
    <div className="max-w-7xl mx-auto space-y-0 animate-in fade-in duration-500 pb-20">
      <div className="bg-white border-2 border-slate-950 p-8 flex flex-col md:flex-row justify-between items-center gap-6 mb-8">
        <button
          onClick={onBack}
          className="flex items-center gap-4 text-slate-950 hover:bg-slate-100 px-6 py-4 font-black text-[11px] tracking-widest transition-all border-2 border-slate-950"
        >
          <ArrowLeft size={20} /> VOLVER A LISTADO
        </button>
        <div className="flex gap-0 shadow-xl">
          <button className="p-5 bg-slate-100 border-y-2 border-l-2 border-slate-950 text-slate-500 hover:text-slate-950 transition-all">
            <Download size={24} />
          </button>
          <button
            onClick={onGenerateAI}
            disabled={loading}
            className="flex items-center gap-4 bg-slate-950 text-white px-10 py-5 font-black text-[12px] tracking-[0.2em] hover:bg-blue-600 transition-all disabled:opacity-50"
          >
            <BrainCircuit size={28} className="text-blue-400" /> GENERAR DICTAMEN CAP
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <DetalleExpediente request={request} />
          {aiAnalysis && <DetalleDictamen analysis={aiAnalysis} />}
        </div>

        <div className="lg:col-span-4">
          <DetalleScorecard request={request} />
        </div>
      </div>
    </div>
  );
};
