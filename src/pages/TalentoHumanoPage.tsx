import React from 'react';
import { FolderCheck, ShieldCheck, UserCog, UsersRound } from 'lucide-react';

const TalentoHumanoPage = () => {
  return (
    <section className="space-y-6 rounded-[28px] border border-slate-200 bg-white p-8 shadow-[0_24px_60px_rgba(15,23,42,0.08)]">
      <header className="space-y-3">
        <div className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-4 py-2 text-[10px] font-black uppercase tracking-[0.25em] text-white">
          <ShieldCheck size={14} /> Portal Talento Humano
        </div>
        <h2 className="text-3xl font-black uppercase tracking-tight text-slate-950 md:text-4xl">Gestion Talento Humano</h2>
        <p className="max-w-3xl text-sm font-semibold text-slate-600 md:text-base">
          Portal para validaciones administrativas de personal, historial laboral y soporte documental institucional.
        </p>
      </header>

      <div className="grid gap-4 md:grid-cols-3">
        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 inline-flex rounded-xl bg-white p-2 text-indigo-600 shadow-sm">
            <UsersRound size={18} />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900">Planta docente</h3>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">Estado y trazabilidad del personal vinculado.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 inline-flex rounded-xl bg-white p-2 text-indigo-600 shadow-sm">
            <FolderCheck size={18} />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900">Soportes laborales</h3>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">Verificacion administrativa de documentos.</p>
        </article>

        <article className="rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="mb-3 inline-flex rounded-xl bg-white p-2 text-indigo-600 shadow-sm">
            <UserCog size={18} />
          </div>
          <h3 className="text-sm font-black uppercase text-slate-900">Gestion de perfiles</h3>
          <p className="mt-2 text-xs font-medium leading-relaxed text-slate-600">Administracion de usuarios y permisos operativos.</p>
        </article>
      </div>
    </section>
  );
};

export default TalentoHumanoPage;
