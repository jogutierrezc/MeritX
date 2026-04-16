import React, { useEffect, useRef, useState } from 'react';
import './App.css';

import AppHeader from './components/AppHeader';
import AuthPage from './pages/AuthPage';
import AuxiliaresPortal from './pages/auxiliares/AuxiliaresPortal';
import DecanoPage from './pages/decano/ConsejoFacultadPortal';
import InicioPortal from './pages/inicio/InicioPortal';
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
  PORTAL_SESSION_CHANGED_EVENT,
  savePortalSession,
  type PortalSession,
} from './services/portalAuth';

const moduleToPath: Record<string, string> = {
  inicio: '/',
  auth: '/auth',
  decano: '/decano',
  cap: '/cap',
  cepi: '/cepi',
  talento_humano: '/talento_humano',
  expedientes: '/expedientes',
  reportes: '/reportes',
  config: '/config',
};

const getModuleFromPath = (pathname: string): string => {
  const normalized = pathname.replace(/\/+$/, '') || '/';
  const aliasMap: Record<string, string> = {
    '/': 'inicio',
    '/inicio': 'inicio',
    '/auth': 'auth',
    '/decano': 'decano',
    '/cap': 'cap',
    '/cepi': 'cepi',
    '/talento_humano': 'talento_humano',
    '/talento-humano': 'talento_humano',
    '/expedientes': 'expedientes',
    '/reportes': 'reportes',
    '/config': 'config',
  };

  return aliasMap[normalized] || 'inicio';
};

// -- App ------------------------------------------------------------------------
const App = () => {
  const standalonePortal = new URLSearchParams(window.location.search).get('portal');
  const isStandaloneAutoregistro = standalonePortal === 'autoregistro';
  const [activeModule, setActiveModule] = useState(() => getModuleFromPath(window.location.pathname));
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

  useEffect(() => {
    const onPopState = () => setActiveModule(getModuleFromPath(window.location.pathname));
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, []);

  useEffect(() => {
    const syncPortalSession = () => setPortalSession(getPortalSession());
    window.addEventListener(PORTAL_SESSION_CHANGED_EVENT, syncPortalSession);
    return () => window.removeEventListener(PORTAL_SESSION_CHANGED_EVENT, syncPortalSession);
  }, []);

  useEffect(() => {
    const targetPath = moduleToPath[activeModule] || '/';
    if (window.location.pathname === targetPath) return;
    const nextUrl = `${targetPath}${window.location.search}${window.location.hash}`;
    window.history.pushState({}, '', nextUrl);
  }, [activeModule]);

  const logout = async () => {
    clearPortalSession();
    window.location.reload();
  };

  const handlePortalLogin = (session: PortalSession) => {
    const roleLandingModule: Record<PortalSession['role'], string> = {
      admin: 'expedientes',
      decano: 'decano',
      cap: 'cap',
      cepi: 'cepi',
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
        <div className="mx-auto max-w-screen-2xl">
          <InicioPortal standalone />
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

      <main className="max-w-screen-2xl mx-auto px-4 py-8 md:px-8 md:py-12">
        {activeModule === 'inicio' && <InicioPortal />}
        {activeModule === 'auth' && <AuthPage onLogin={handlePortalLogin} />}
        {activeModule === 'decano' && hasAccess && <DecanoPage />}
        {activeModule === 'cap' && hasAccess && <AuxiliaresPortal />}
        {activeModule === 'cepi' && hasAccess && <DirectorPage />}
        {activeModule === 'talento_humano' && hasAccess && <TalentoHumanoPage />}
        {activeModule === 'expedientes' && hasAccess && <ExpedientesPage />}
        {activeModule === 'reportes' && hasAccess && <ReportesPage />}
        {activeModule === 'config' && hasAccess && <ConfigPage />}
      </main>
    </div>
  );
};

export default App;
