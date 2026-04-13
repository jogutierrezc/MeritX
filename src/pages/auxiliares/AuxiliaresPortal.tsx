import React, { useState } from 'react';
import { Inbox, FileText, BarChart3, History } from 'lucide-react';
import BandejaAuditarModule from './BandejaAuditarModule';
import ConvocatoriasModule from './ConvocatoriasModule';
import ReportesModule from './ReportesModule';

const AuxiliaresPortal = () => {
  const [activeModule, setActiveModule] = useState<'bandeja' | 'convocatorias' | 'reportes'>('bandeja');

  return (
    <div className="font-sans text-slate-900">
      <main>
        {/* --- SUBNAV (TABS) --- */}
        <div className="sticky top-20 z-40 bg-white rounded-2xl border border-slate-200 p-1.5 flex items-center justify-between shadow-sm mb-8">
          <div className="flex gap-1.5">
            <button
              onClick={() => setActiveModule('bandeja')}
              className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                activeModule === 'bandeja'
                  ? 'text-blue-700 bg-blue-50 border border-blue-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <Inbox className="w-4 h-4" /> Bandeja CAP
            </button>
            <button
              onClick={() => setActiveModule('convocatorias')}
              className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                activeModule === 'convocatorias'
                  ? 'text-blue-700 bg-blue-50 border border-blue-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <FileText className="w-4 h-4" /> Convocatorias
            </button>
            <button
              onClick={() => setActiveModule('reportes')}
              className={`flex items-center gap-2 px-6 py-2.5 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all ${
                activeModule === 'reportes'
                  ? 'text-blue-700 bg-blue-50 border border-blue-100'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-50'
              }`}
            >
              <BarChart3 className="w-4 h-4" /> Reportes
            </button>
          </div>
          <button className="flex items-center gap-2 px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-slate-800 transition-all border-l border-slate-100 ml-auto">
            <History className="w-4 h-4" /> Histórico
          </button>
        </div>

        {/* --- CONTENIDO DINÁMICO --- */}
        {activeModule === 'bandeja' && <BandejaAuditarModule />}
        {activeModule === 'convocatorias' && <ConvocatoriasModule />}
        {activeModule === 'reportes' && <ReportesModule />}
      </main>
    </div>
  );
};

export default AuxiliaresPortal;
