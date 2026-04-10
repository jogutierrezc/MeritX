import React from 'react';
import { ClipboardCheck, Eye, FileSearch, ShieldCheck } from 'lucide-react';

const DirectorPage = () => {
  return (
    <section className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-white">
          <ShieldCheck size={14} /> Portal Director
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tight text-slate-950 md:text-4xl">Control Directivo</h2>
        <p className="max-w-3xl text-sm font-semibold text-slate-600 md:text-base">
          Vista para seguimiento directivo de expedientes, revisiones finales y decisiones del proceso de escalafon.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 inline-flex rounded-xl bg-white p-2 text-emerald-600 shadow-sm">
            <Eye size={18} />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900">Vista consolidada</h3>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">Monitoreo de estado por campus y etapa.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 inline-flex rounded-xl bg-white p-2 text-emerald-600 shadow-sm">
            <FileSearch size={18} />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900">Revision final</h3>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">Analisis de postulaciones listas para decision.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 inline-flex rounded-xl bg-white p-2 text-emerald-600 shadow-sm">
            <ClipboardCheck size={18} />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900">Aprobacion directiva</h3>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">Trazabilidad de decisiones y observaciones.</p>
        </article>
      </div>
    </section>
  );
};

export default DirectorPage;
