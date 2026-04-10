import React from 'react';
import { ShieldCheck } from 'lucide-react';

interface LoadingProps {
  message?: string;
}

export const Loading: React.FC<LoadingProps> = ({ message = 'Sincronizando Auditoría' }) => {
  return (
    <div className="fixed inset-0 bg-slate-950/95 z-50 flex flex-col items-center justify-center animate-in fade-in duration-300">
      <div className="relative w-32 h-32 border-8 border-white/5 border-t-blue-600 animate-spin">
      </div>
      <div className="absolute flex items-center justify-center w-32 h-32">
        <ShieldCheck className="text-white w-10 h-10 animate-pulse" />
      </div>
      <div className="text-center mt-12 space-y-4">
        <p className="text-blue-400 font-black text-sm uppercase tracking-[0.8em] animate-pulse">
          {message}
        </p>
        <div className="w-64 h-1 bg-white/5 mx-auto">
          <div className="h-full bg-blue-600 animate-[loading_2s_ease-in-out_infinite]" />
        </div>
      </div>

      <style>{`
        @keyframes loading {
          0% { width: 0%; }
          50% { width: 100%; }
          100% { width: 0%; }
        }
      `}</style>
    </div>
  );
};
