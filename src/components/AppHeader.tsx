import React from 'react';
import { BarChart3, ChevronDown, Home, LogOut, Settings, ShieldCheck, User as UserIcon, Users, Zap } from 'lucide-react';
import AppLogo from './Common/AppLogo';
import Files from './icons/Files';
import type { PortalSession } from '../services/portalAuth';

type Props = {
  activeModule: string;
  setActiveModule: (m: string) => void;
  portalSession: PortalSession | null;
  userMenuOpen: boolean;
  setUserMenuOpen: (o: boolean) => void;
  logout: () => void;
  dropdownRef: React.RefObject<HTMLDivElement | null>;
};

const NAV_ITEMS = [
  { id: 'inicio', label: 'INICIO', icon: Home },
  { id: 'decano', label: 'CONSEJO DE FACULTAD', icon: Users },
  { id: 'cap', label: 'PORTAL CAP', icon: ShieldCheck },
  { id: 'cepi', label: 'PORTAL CEPI', icon: ShieldCheck },
  { id: 'talento_humano', label: 'TALENTO HUMANO', icon: UserIcon },
  { id: 'expedientes', label: 'EXPEDIENTES', icon: Files },
  { id: 'reportes', label: 'REPORTES', icon: BarChart3 },
  { id: 'config', label: 'CONFIGURACIÓN', icon: Settings },
];

const getVisibleNavItems = (portalSession: PortalSession | null) => {
  if (!portalSession) {
    return NAV_ITEMS.filter((item) => item.id === 'inicio');
  }

  if (portalSession.role === 'decano') {
    return NAV_ITEMS.filter((item) => ['inicio', 'decano'].includes(item.id));
  }

  if (portalSession.role === 'cap') {
    return NAV_ITEMS.filter((item) => ['inicio', 'cap'].includes(item.id));
  }

  if (portalSession.role === 'cepi') {
    return NAV_ITEMS.filter((item) => ['inicio', 'cepi'].includes(item.id));
  }

  if (portalSession.role === 'talento_humano') {
    return NAV_ITEMS.filter((item) => ['inicio', 'talento_humano'].includes(item.id));
  }

  if (portalSession.role === 'admin') {
    return NAV_ITEMS.filter((item) => ['inicio', 'expedientes', 'reportes', 'config'].includes(item.id));
  }

  return NAV_ITEMS.filter((item) => item.id === 'inicio');
};

const AppHeader: React.FC<Props> = ({
  activeModule,
  setActiveModule,
  portalSession,
  userMenuOpen,
  setUserMenuOpen,
  logout,
  dropdownRef,
}) => {
  const visibleItems = getVisibleNavItems(portalSession);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/85 backdrop-blur-xl">
      <div className="max-w-7xl mx-auto flex h-20 items-center justify-between px-6 md:px-8">
        <div className="flex items-center gap-4 md:gap-6">
          <AppLogo className="flex items-center" imgClassName="h-12 w-auto md:h-14" />
        </div>

        <nav className="hidden items-center gap-2 md:flex">
          {visibleItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveModule(item.id)}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-[10px] font-black tracking-[0.25em] transition-all ${
                activeModule === item.id
                  ? 'bg-slate-950 text-white shadow-[0_10px_24px_rgba(15,23,42,0.18)]'
                  : 'text-slate-500 hover:bg-slate-100 hover:text-slate-950'
              }`}
            >
              <item.icon size={14} /> {item.label}
            </button>
          ))}
          {!portalSession && (
            <button
              onClick={() => setActiveModule('auth')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-3 text-[10px] font-black tracking-[0.25em] transition-all ${
                activeModule === 'auth'
                  ? 'bg-blue-600 text-white shadow-[0_10px_24px_rgba(37,99,235,0.22)]'
                  : 'bg-slate-950 text-white hover:bg-blue-600'
              }`}
            >
              ACCESO
            </button>
          )}
        </nav>

        <div className="relative" ref={dropdownRef}>
          {!portalSession ? (
            <button
              onClick={() => setActiveModule('auth')}
              className="inline-flex items-center gap-2 rounded-full bg-slate-950 px-4 py-3 text-[10px] font-black tracking-[0.25em] text-white transition-all hover:bg-blue-600 md:hidden"
            >
              ACCESO
            </button>
          ) : (
          <button
            onClick={() => setUserMenuOpen(!userMenuOpen)}
            className="flex items-center gap-3 rounded-full border border-slate-200 bg-white pl-4 pr-3 py-2 shadow-sm transition-all hover:border-blue-500 hover:shadow-md"
          >
            <div className="text-right hidden sm:block">
              <p className="text-[10px] font-black uppercase tracking-tighter leading-none">
                {portalSession ? portalSession.username : 'Acceso Restringido'}
              </p>
              <p className="text-[8px] text-blue-600 font-bold uppercase tracking-widest mt-1">
                {portalSession ? `ROL ${portalSession.role}` : 'PORTALES PROTEGIDOS'}
              </p>
            </div>
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-950 text-white font-black">
              {(portalSession?.username || 'U').slice(0, 1).toUpperCase()}
            </div>
            <ChevronDown
              size={14}
              className={`text-slate-500 transition-transform duration-300 ${userMenuOpen ? 'rotate-180' : ''}`}
            />
          </button>
          )}

          {portalSession && userMenuOpen && (
            <div className="absolute right-0 z-50 mt-3 w-60 overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-[0_24px_60px_rgba(15,23,42,0.16)] animate-in fade-in slide-in-from-top-2">
              <div className="border-b border-slate-100 bg-slate-50 p-4">
                <p className="text-[10px] font-black text-slate-400 uppercase mb-1">Sesión Activa</p>
                <p className="text-xs font-bold text-slate-800 truncate">{portalSession?.username || 'INVITADO'}</p>
              </div>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-all">
                <UserIcon size={14} /> MI PERFIL
              </button>
              <button className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black text-slate-600 hover:bg-blue-50 hover:text-blue-700 transition-all border-b border-slate-100">
                <Zap size={14} /> ACTIVIDAD
              </button>
              <button
                onClick={logout}
                className="w-full flex items-center gap-3 px-4 py-3 text-[10px] font-black text-rose-600 hover:bg-rose-50 transition-all"
              >
                <LogOut size={14} /> CERRAR SESIÓN
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};

export default AppHeader;
