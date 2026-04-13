import React, { useState } from 'react';
import type { ConvocatoriaType } from '../../db/convocatoria_table';
import { HomePageComponent } from './HomePageComponent';
import { TermsComponent } from './TermsComponent';
import { FormComponent } from './FormComponent';

type ViewType = 'home' | 'terms' | 'form';

interface InicioPortalProps {
  standalone?: boolean;
}

const InicioPortal: React.FC<InicioPortalProps> = ({ standalone = false }) => {
  const [view, setView] = useState<ViewType>('home');
  const [selectedConvocatoria, setSelectedConvocatoria] = useState<ConvocatoriaType | null>(null);
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleSelectConvocatoria = (convocatoria: ConvocatoriaType) => {
    setSelectedConvocatoria(convocatoria);
    setAcceptedTerms(false);
    setView('terms');
  };

  const handleAcceptTerms = () => {
    setAcceptedTerms(true);
    setView('form');
  };

  const handleBackFromTerms = () => {
    setView('home');
    setSelectedConvocatoria(null);
  };

  const handleBackFromForm = () => {
    setView('home');
    setSelectedConvocatoria(null);
    setAcceptedTerms(false);
  };

  const handleFormSubmit = () => {
    // Reset and go back to home
    setView('home');
    setSelectedConvocatoria(null);
    setAcceptedTerms(false);
  };

  return (
    <>
      {standalone && (
        <nav className="sticky top-3 z-50 rounded-3xl border border-slate-200 bg-white/90 px-4 py-3 backdrop-blur-md sm:px-6 mb-8">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-blue-600 p-2 text-white shadow-lg shadow-blue-200">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
              </div>
              <div>
                <p className="text-sm font-black tracking-tight text-blue-900">SISTEMA ESCALAFON</p>
                <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-slate-400">Gestion Rectoria UDES</p>
              </div>
            </div>
            <div className="hidden items-center gap-2 sm:flex">
              <span className="rounded-full bg-slate-100 px-4 py-2 text-xs font-semibold text-slate-600">Inicio</span>
              <span className="rounded-full bg-slate-900 px-4 py-2 text-xs font-bold text-white">Acceso</span>
            </div>
          </div>
        </nav>
      )}

      <div className="space-y-8">
        {view === 'home' && <HomePageComponent onSelectConvocatoria={handleSelectConvocatoria} />}

        {view === 'terms' && (
          <TermsComponent
            selectedConvocatoria={selectedConvocatoria}
            onBack={handleBackFromTerms}
            onAccept={handleAcceptTerms}
          />
        )}

        {view === 'form' && (
          <FormComponent
            selectedConvocatoria={selectedConvocatoria}
            onBack={handleBackFromForm}
            onSubmit={handleFormSubmit}
          />
        )}
      </div>
    </>
  );
};

export default InicioPortal;
