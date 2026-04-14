import React from 'react';
import AppLogo from '../Common/AppLogo';
import { ROUTES } from '../../constants';

interface HeaderProps {
  currentView: string;
  onViewChange: (view: string) => void;
}

export const Header: React.FC<HeaderProps> = ({ currentView, onViewChange }) => {
  return (
    <header className="bg-slate-950 text-white sticky top-0 z-40 border-b-4 border-blue-600">
      <div className="max-w-7xl mx-auto px-8 h-20 flex items-center justify-between">
        <AppLogo className="flex items-center" imgClassName="h-12 w-auto" />
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
