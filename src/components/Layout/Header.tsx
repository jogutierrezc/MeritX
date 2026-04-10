import React from 'react';
import { ShieldCheck } from 'lucide-react';
import { ROUTES } from '../../constants';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onViewChange }) => {
  return (
    <header className="bg-slate-950 text-white sticky top-0 z-40 border-b-4 border-blue-600">
      <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div className="w-10 h-10 bg-blue-600 flex items-center justify-center">
            <ShieldCheck className="w-6 h-6 text-white" />
          </div>
          <div className="border-l border-white/20 pl-6">
            <h1 className="text-lg font-black tracking-tight leading-none uppercase">
              Auditoría <span className="text-blue-400">Escalafón</span>
            </h1>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.5em] block mt-1">
              SISTEMA RECTANGULAR DE MÉRITOS
            </span>
          </div>
        </div>
        <div className="flex h-full">
          <button
            onClick={() => onViewChange(ROUTES.LISTA)}
            className={`px-8 h-full text-[10px] font-black transition-all flex items-center gap-2 border-r border-white/5 ${
              currentView === ROUTES.LISTA
                ? 'bg-blue-600 text-white'
                : 'text-slate-400 hover:bg-slate-900'
            }`}
          >
            SOLICITUDES
          </button>
          <button
            onClick={() => onViewChange(ROUTES.NUEVO)}
            className={`px-8 h-full text-[10px] font-black transition-all flex items-center gap-2 ${
              currentView === ROUTES.NUEVO
                ? 'bg-blue-600 text-white'
                : 'bg-slate-900 text-white hover:bg-slate-800'
            }`}
          >
            REGISTRO
          </button>
        </div>
      </div>
    </header>
  );
};
