import React from 'react';
import { BarChart3 } from 'lucide-react';

const ReportesPage = () => (
  <div className="flex flex-col items-center justify-center py-32 bg-white border-2 border-slate-200">
    <BarChart3 size={64} className="text-blue-600 mb-8 opacity-20" />
    <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">
      Módulo de <span className="text-blue-600">Reportes</span>
    </h2>
    <p className="text-slate-400 font-bold uppercase text-[10px] tracking-[0.4em] mt-4">
      Analítica avanzada de escalafón en desarrollo
    </p>
  </div>
);

export default ReportesPage;
