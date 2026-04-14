import React, { useState } from 'react';
import { ArrowRight, LockKeyhole, ShieldCheck, Users } from 'lucide-react';

import AppLogo from '../components/Common/AppLogo';
import PortalLoginPage from './PortalLoginPage';
import type { PortalRole, PortalSession } from '../services/portalAuth';

interface Props {
  onLogin: (session: PortalSession) => void;
}

const ROLE_OPTIONS: Array<{
  role: PortalRole;
  title: string;
  description: string;
  icon: typeof Users;
}> = [
  {
    role: 'decano',
    title: 'Consejo de Facultad',
    description: 'Primera verificación, carga de entrevistas y decisión de continuidad o rechazo.',
    icon: ShieldCheck,
  },
  {
    role: 'cap',
    title: 'Portal CAP',
    description: 'Comité de Asuntos Profesorales para valoración y continuidad del expediente.',
    icon: Users,
  },
  {
    role: 'admin',
    title: 'Portal Administración',
    description: 'Acceso a expedientes, reportes y configuración del backoffice CAP.',
    icon: ShieldCheck,
  },
  {
    role: 'cepi',
    title: 'Portal CEPI',
    description: 'Comité de Evaluación de Producción Intelectual para decisión final y puntaje.',
    icon: ShieldCheck,
  },
  {
    role: 'talento_humano',
    title: 'Portal Talento Humano',
    description: 'Gestión administrativa de personal, documentación laboral y perfiles.',
    icon: Users,
  },
];

const AuthPage = ({ onLogin }: Props) => {
  const [selectedRole, setSelectedRole] = useState<PortalRole>('decano');

  return (
    <div className="grid gap-8 xl:grid-cols-[0.95fr_1.05fr]">
      <section className="relative overflow-hidden rounded-[32px] border border-slate-200 bg-white p-8 shadow-[0_30px_80px_rgba(15,23,42,0.08)] md:p-12">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(37,99,235,0.14),_transparent_32%),linear-gradient(180deg,_rgba(15,23,42,0.02),_transparent_55%)]" />
        <div className="relative space-y-8">
          <div className="space-y-4">
            <AppLogo className="flex items-center" imgClassName="h-14 w-auto md:h-16" />
            <div className="inline-flex items-center gap-3 rounded-full bg-slate-950 px-4 py-2 text-[10px] font-black uppercase tracking-[0.35em] text-white">
              <LockKeyhole size={14} /> Acceso por roles
            </div>
          </div>

          <div className="space-y-4">
            <h2 className="text-4xl font-black uppercase tracking-tighter text-slate-950 md:text-6xl">
              Acceso a
              <br />
              <span className="text-blue-600">Portales</span>
            </h2>
            <p className="max-w-xl text-sm font-bold uppercase leading-relaxed text-slate-500 md:text-base">
              Inicia sesión según tu rol. Si no hay sesión activa, la topbar pública solo mostrará Inicio y Acceso.
            </p>
          </div>

          <div className="grid gap-4">
            {ROLE_OPTIONS.map((option) => {
              const Icon = option.icon;
              const active = selectedRole === option.role;
              return (
                <button
                  key={option.role}
                  onClick={() => setSelectedRole(option.role)}
                  className={`rounded-[24px] border px-6 py-6 text-left transition-all ${
                    active
                      ? 'border-blue-600 bg-blue-50 shadow-[0_16px_40px_rgba(37,99,235,0.12)]'
                      : 'border-slate-200 bg-white hover:border-slate-300 hover:bg-slate-50'
                  }`}
                >
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-lg font-black uppercase tracking-tight text-slate-950">{option.title}</p>
                      <p className="mt-2 text-xs font-bold uppercase leading-relaxed text-slate-500">
                        {option.description}
                      </p>
                    </div>
                    <div className={`rounded-2xl p-3 ${active ? 'bg-blue-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Icon size={20} />
                    </div>
                  </div>
                  {active && (
                    <div className="mt-5 inline-flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.3em] text-blue-700">
                      Seleccionado <ArrowRight size={14} />
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="rounded-[32px] border border-slate-200 bg-white p-3 shadow-[0_30px_80px_rgba(15,23,42,0.08)] md:p-4">
        <PortalLoginPage role={selectedRole} onLogin={onLogin} compact />
      </section>
    </div>
  );
};

export default AuthPage;
