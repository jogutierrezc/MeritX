import React from 'react';

type LoadingOverlayProps = {
  label?: string;
};

const LoadingOverlay: React.FC<LoadingOverlayProps> = ({ label = 'Procesando Módulo' }) => (
  <div className="fixed inset-0 bg-slate-950/98 z-50 flex flex-col items-center justify-center animate-in fade-in">
    <div className="w-32 h-32 border-8 border-white/5 border-t-blue-600 animate-spin" />
    <p className="mt-12 text-blue-400 font-black text-xs uppercase tracking-[0.8em] animate-pulse">
      {label}
    </p>
  </div>
);

export default LoadingOverlay;
