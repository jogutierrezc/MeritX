import React from 'react';
import { BarChart3, TrendingUp, FileText } from 'lucide-react';

interface ReportesModuleProps {
  onClose?: () => void;
}

const ReportesModule: React.FC<ReportesModuleProps> = ({ onClose }) => {
  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-slate-200 bg-white p-12 shadow-sm text-center">
        <div className="flex justify-center mb-6">
          <div className="p-4 bg-slate-100 rounded-2xl">
            <BarChart3 className="w-12 h-12 text-slate-400" />
          </div>
        </div>
        <h2 className="text-3xl font-black text-slate-900 tracking-tight mb-3">Módulo de Reportes</h2>
        <p className="text-slate-500 font-medium mb-2">En desarrollo</p>
        <p className="text-xs font-bold text-slate-400 uppercase tracking-[0.1em]">
          Próximamente disponible información estadística, análisis de postulaciones y métricas operativas.
        </p>
      </section>
    </div>
  );
};

export default ReportesModule;
