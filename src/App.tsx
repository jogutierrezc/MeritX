import React, { useEffect, useRef, useState } from 'react';
import './App.css';

import AppHeader from './components/AppHeader';
import AuthPage from './pages/AuthPage';
import AuxiliaresPage from './pages/AuxiliaresPage';
import InicioPage from './pages/InicioPage';
import ExpedientesPage from './pages/ExpedientesPage';
import ReportesPage from './pages/ReportesPage';
import ConfigPage from './pages/ConfigPage';
import DirectorPage from './pages/DirectorPage';
import TalentoHumanoPage from './pages/TalentoHumanoPage';
import {
  canAccessRole,
  clearPortalSession,
  getPortalSession,
  getRequiredRoleForModule,
  savePortalSession,
  type PortalSession,
} from './services/portalAuth';

// -- App ------------------------------------------------------------------------
const App = () => {
  const standalonePortal = new URLSearchParams(window.location.search).get('portal');
  const isStandaloneAutoregistro = standalonePortal === 'autoregistro';
  const [activeModule, setActiveModule] = useState('inicio');
  const [userMenuOpen, setUserMenuOpen] = useState(false);
  const [portalSession, setPortalSession] = useState<PortalSession | null>(() => getPortalSession());
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node))
        setUserMenuOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const logout = async () => {
    clearPortalSession();
    window.location.reload();
  };

  const handlePortalLogin = (session: PortalSession) => {
    const roleLandingModule: Record<PortalSession['role'], string> = {
      admin: 'expedientes',
      auxiliar: 'auxiliares',
      director: 'director',
      talento_humano: 'talento_humano',
    };

    savePortalSession(session);
    setPortalSession(session);
    setActiveModule(roleLandingModule[session.role]);
  };

  const requiredRole = getRequiredRoleForModule(activeModule);
  const hasAccess = !requiredRole || canAccessRole(portalSession, requiredRole);

  useEffect(() => {
    if (portalSession || activeModule === 'inicio' || activeModule === 'auth') return;
    if (requiredRole) setActiveModule('auth');
  }, [activeModule, portalSession, requiredRole]);

  if (isStandaloneAutoregistro) {
    return (
      <div className="min-h-screen bg-slate-50 px-4 py-6 text-slate-950 md:px-8 md:py-10">
        <div className="mx-auto max-w-7xl">
          <InicioPage standalone />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 text-slate-950 font-sans selection:bg-blue-100">
      <AppHeader
        activeModule={activeModule}
        setActiveModule={setActiveModule}
        portalSession={portalSession}
        userMenuOpen={userMenuOpen}
        setUserMenuOpen={setUserMenuOpen}
        logout={logout}
        dropdownRef={dropdownRef}
      />

      <main className="max-w-7xl mx-auto px-8 py-12">
        {activeModule === 'inicio' && <InicioPage />}
        {activeModule === 'auth' && <AuthPage onLogin={handlePortalLogin} />}
        {activeModule === 'auxiliares' && hasAccess && <AuxiliaresPage />}
        {activeModule === 'director' && hasAccess && <DirectorPage />}
        {activeModule === 'talento_humano' && hasAccess && <TalentoHumanoPage />}
        {activeModule === 'expedientes' && hasAccess && <ExpedientesPage />}
        {activeModule === 'reportes' && hasAccess && <ReportesPage />}
        {activeModule === 'config' && hasAccess && <ConfigPage />}
      </main>
    </div>
  );
};

export default App;
