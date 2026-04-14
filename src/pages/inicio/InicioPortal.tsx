import React, { useState } from 'react';
import AppLogo from '../../components/Common/AppLogo';
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
            <AppLogo className="flex items-center" imgClassName="h-11 w-auto sm:h-12" />
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
