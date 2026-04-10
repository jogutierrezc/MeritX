import React from 'react';
import { Search, Database, ChevronRight, Building2 } from 'lucide-react';
import type { Request } from '../../../types';

interface ListaViewProps {
  requests: Request[];
  onSelectRequest: (request: Request) => void;
}

export const ListaView: React.FC<ListaViewProps> = ({ requests, onSelectRequest }) => {
  const [searchTerm, setSearchTerm] = React.useState('');

  const filteredRequests = requests.filter(
    (req) =>
      req.nombre.toLowerCase().includes(searchTerm.toLowerCase()) ||
      req.documento.includes(searchTerm)
  );

  return (
    <div className="space-y-12 animate-in fade-in duration-500">
      <div className="flex justify-between items-end border-b-2 border-slate-200 pb-8">
        <div>
          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter">
            Expedientes <span className="text-blue-600">Activos</span>
          </h2>
          <p className="text-slate-500 mt-2 font-bold uppercase text-[10px] tracking-widest">
            Base de datos de calificación docente UDES
          </p>
        </div>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            type="text"
            placeholder="BUSCAR EXPEDIENTE..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-12 pr-6 py-4 bg-white border-2 border-slate-200 rounded-none text-[11px] font-bold outline-none focus:border-blue-600 transition-all w-80 uppercase tracking-wider"
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-slate-200">
        {filteredRequests.map((req) => (
          <div
            key={req.id}
            className="bg-white border-r border-b border-slate-200 hover:bg-slate-50 transition-all flex flex-col group p-8"
          >
            <div className="flex justify-between items-start mb-8">
              <div className="bg-slate-950 p-4 text-white">
                <div className="w-6 h-6 bg-blue-600" />
              </div>
              <div
                className={`px-4 py-1 text-[9px] font-black uppercase tracking-widest ${req.finalCat.bgColor} text-white`}
              >
                {req.finalCat.name}
              </div>
            </div>

            <h3 className="font-black text-slate-900 text-xl uppercase tracking-tighter mb-2">
              {req.nombre}
            </h3>
            <div className="flex items-center gap-2 text-slate-400 text-[10px] font-black uppercase tracking-widest mb-10">
              <Building2 size={12} /> {req.facultad}
            </div>

            <div className="grid grid-cols-2 gap-px bg-slate-200 mb-8 border border-slate-200">
              <div className="bg-white p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Puntos</p>
                <p className="text-2xl font-black text-slate-900">{req.finalPts.toFixed(1)}</p>
              </div>
              <div className="bg-white p-4">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Obras</p>
                <p className="text-2xl font-black text-blue-600">{req.produccion.length}</p>
              </div>
            </div>

            <button
              onClick={() => onSelectRequest(req)}
              className="w-full bg-slate-950 text-white py-4 text-[10px] font-black tracking-[0.2em] hover:bg-blue-600 transition-all flex items-center justify-center gap-3"
            >
              ABRIR EXPEDIENTE <ChevronRight size={14} />
            </button>
          </div>
        ))}
        {filteredRequests.length === 0 && (
          <div className="col-span-full py-32 bg-white flex flex-col items-center justify-center text-slate-400 border-r border-b border-slate-200">
            <Database className="w-12 h-12 mb-4 opacity-10" />
            <p className="font-black text-[10px] uppercase tracking-[0.3em]">
              No hay datos registrados
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
