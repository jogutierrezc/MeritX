import React, { useState, useEffect } from 'react';
import { Calendar, Users, ChevronRight, ShieldCheck } from 'lucide-react';
import type { ConvocatoriaType } from '../../db/convocatoria_table';
import { fetchConvocatoriasOnce } from '../../db/subscriptions';

interface HomePageComponentProps {
  onSelectConvocatoria: (convocatoria: ConvocatoriaType) => void;
}

export const HomePageComponent: React.FC<HomePageComponentProps> = ({ onSelectConvocatoria }) => {
  const [convocatorias, setConvocatorias] = useState<ConvocatoriaType[]>([]);
  const [loading, setLoading] = useState(true);

  // Load convocatorias once on mount to reduce DB/network usage.
  useEffect(() => {
    let mounted = true;
    const loadConvocatorias = async () => {
      try {
        setLoading(true);
        const data = await fetchConvocatoriasOnce();
        if (!mounted) return;
        const openConvocatorias = data.filter((conv) => conv.estado === 'ABIERTA');
        setConvocatorias(openConvocatorias);
      } catch (error) {
        console.error('Error loading convocatorias:', error);
        if (mounted) setConvocatorias([]);
      } finally {
        if (mounted) setLoading(false);
      }
    };

    void loadConvocatorias();
    return () => {
      mounted = false;
    };
  }, []);

  const getDaysLeft = (fechaCierre: string): number => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const cierre = new Date(fechaCierre);
    cierre.setHours(0, 0, 0, 0);
    return Math.ceil((cierre.getTime() - hoje.getTime()) / (1000 * 60 * 60 * 24));
  };

  const getDaysLeftColor = (days: number): string => {
    if (days <= 0) return 'bg-rose-100 text-rose-700';
    if (days <= 3) return 'bg-amber-100 text-amber-700';
    if (days <= 7) return 'bg-blue-100 text-blue-700';
    return 'bg-emerald-100 text-emerald-700';
  };

  const getDaysLeftText = (days: number): string => {
    if (days < 0) return 'Cerrada';
    if (days === 0) return 'Cierra hoy';
    if (days === 1) return '1 día';
    return `${days} días`;
  };

  return (
    <div className="space-y-8">
      {/* Hero Section */}
      <section className="relative overflow-hidden rounded-[2rem] bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-700 p-1 shadow-2xl shadow-blue-200">
        <div className="relative flex flex-col gap-8 rounded-[1.85rem] bg-white/8 p-8 backdrop-blur-sm md:p-12 xl:flex-row xl:items-end xl:justify-between">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 rounded-full bg-white/20 px-4 py-1.5 text-[11px] font-black uppercase tracking-[0.2em] text-white">
              <ShieldCheck size={14} /> Convocatorias Abiertas
            </div>
            <h2 className="text-4xl font-black uppercase leading-tight text-white md:text-6xl">
              Participa en el
              <br />
              <span className="text-blue-200">Escalafón UDES</span>
            </h2>
            <p className="max-w-2xl text-base font-medium text-blue-50 md:text-lg">
              Completa tu perfil académico y profesional para acceder a procesos de evaluación docente.
            </p>
          </div>

          <div className="absolute -bottom-14 -right-16 h-64 w-64 rounded-full bg-white/15 blur-3xl" />
          <div className="absolute -left-12 -top-12 h-44 w-44 rounded-full bg-blue-300/25 blur-2xl" />
        </div>
      </section>

      {/* Convocatorias Grid */}
      <section className="space-y-6">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Oportunidades disponibles</p>
          <h3 className="mt-2 text-2xl font-black uppercase tracking-tight text-slate-800">
            {convocatorias.length > 0 ? `${convocatorias.length} Convocatoria${convocatorias.length !== 1 ? 's' : ''} Abierta${convocatorias.length !== 1 ? 's' : ''}` : 'No hay convocatorias disponibles'}
          </h3>
        </div>

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-80 animate-pulse rounded-2xl bg-slate-200" />
            ))}
          </div>
        ) : convocatorias.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {convocatorias.map((conv) => {
              const postCount = conv.postulaciones_count ?? 0;
              const daysLeft = getDaysLeft(conv.fecha_cierre);
              const isClosingSoon = daysLeft <= 7;
              const isClosed = daysLeft < 0;

              return (
                <button
                  key={conv.id}
                  onClick={() => onSelectConvocatoria(conv)}
                  className="group relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-6 text-left transition-all hover:shadow-xl hover:shadow-blue-200/40"
                >
                  {/* Gradient overlay on hover */}
                  <div className="absolute inset-0 bg-gradient-to-br from-blue-600/5 to-indigo-600/5 opacity-0 transition-opacity group-hover:opacity-100" />

                  <div className="relative space-y-4">
                    {/* Days Left Badge */}
                    <div className="flex items-center justify-between pt-2">
                      <div className={`inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-xs font-black uppercase tracking-wider ${getDaysLeftColor(daysLeft)}`}>
                        <Calendar size={14} />
                        {getDaysLeftText(daysLeft)}
                      </div>
                      {isClosingSoon && !isClosed && (
                        <div className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
                      )}
                    </div>

                    {/* Header */}
                    <div className="space-y-2 border-b border-slate-100 pb-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{conv.codigo}</p>
                      <h4 className="text-lg font-black text-slate-900 line-clamp-2">{conv.nombre}</h4>
                    </div>

                    {/* Description */}
                    <p className="text-sm font-semibold text-slate-600 line-clamp-3">{conv.descripcion}</p>

                    {/* Details Grid */}
                    <div className="grid grid-cols-2 gap-2">
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Período</p>
                        <p className="mt-1 font-bold text-slate-700">{conv.periodo}</p>
                      </div>
                      <div className="rounded-lg bg-slate-50 p-3">
                        <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Año</p>
                        <p className="mt-1 font-bold text-slate-700">{conv.año}</p>
                      </div>
                    </div>

                    {/* Postulantes */}
                    {postCount > 0 && (
                      <div className="flex items-center gap-2 rounded-lg bg-blue-50 px-3 py-2">
                        <Users size={14} className="text-blue-600" />
                        <span className="text-xs font-bold text-blue-900">{postCount} postulante{postCount !== 1 ? 's' : ''}</span>
                      </div>
                    )}

                    {/* CTA visual only, the whole card is the clickable button */}
                    <div className="group/btn mt-4 flex w-full items-center justify-between rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 px-4 py-3 text-sm font-black text-white transition-all hover:shadow-lg hover:shadow-blue-300/40">
                      Iniciar Postulación
                      <ChevronRight size={16} className="transition-transform group-hover/btn:translate-x-1" />
                    </div>
                  </div>
                </button>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-12 text-center">
            <ShieldCheck size={48} className="mx-auto mb-4 text-slate-300" />
            <p className="text-lg font-bold text-slate-600">No hay convocatorias disponibles en este momento</p>
            <p className="mt-2 text-sm text-slate-500">Por favor, intenta más tarde.</p>
          </div>
        )}
      </section>
    </div>
  );
};
