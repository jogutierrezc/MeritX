import React, { useState } from 'react';
import { CalendarDays, UserRoundSearch } from 'lucide-react';

import PerfilesModule from './PerfilesModule';
import ConvocatoriasModule from './ConvocatoriasModule';

const TalentoHumanoPortal = () => {
  const [tab, setTab] = useState<'perfiles' | 'convocatorias'>('perfiles');

  return (
    <div className="space-y-8">
      <section className="rounded-3xl border border-slate-200 bg-gradient-to-r from-indigo-900 via-indigo-800 to-blue-900 p-8 text-white shadow-2xl">
        <p className="text-[10px] font-black uppercase tracking-[0.24em] text-indigo-200">Portal Institucional</p>
        <h2 className="mt-2 text-4xl font-black uppercase tracking-tight">Talento Humano</h2>
        <p className="mt-3 max-w-3xl text-sm font-semibold text-indigo-100">
          Gestión de perfiles de profesor, puntuación de escalafón en tiempo real y administración de convocatorias.
        </p>
      </section>

      <section className="rounded-3xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => setTab('perfiles')}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-[0.16em] transition-all ${
              tab === 'perfiles'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <UserRoundSearch size={16} /> Perfiles
          </button>
          <button
            onClick={() => setTab('convocatorias')}
            className={`inline-flex items-center gap-2 rounded-2xl px-5 py-3 text-xs font-black uppercase tracking-[0.16em] transition-all ${
              tab === 'convocatorias'
                ? 'bg-indigo-600 text-white shadow-lg shadow-indigo-200'
                : 'bg-slate-50 text-slate-700 hover:bg-slate-100'
            }`}
          >
            <CalendarDays size={16} /> Convocatorias
          </button>
        </div>
      </section>

      {tab === 'perfiles' ? <PerfilesModule /> : <ConvocatoriasModule />}
    </div>
  );
};

export default TalentoHumanoPortal;
