import React, { useState } from 'react';
import {
  ChevronRight,
  ClipboardCheck,
  FileCheck2,
  Grid3X3,
  List,
  Plus,
  Search,
  ShieldCheck,
  Star,
  Trash2,
  User as UserIcon,
} from 'lucide-react';
import type { RequestRecord } from '../types/domain';

type Props = {
  requests: RequestRecord[];
  setView: (v: string) => void;
  setSelectedRequest: (r: RequestRecord) => void;
  deleteRecord: (id: string) => void;
  onWorkflowAction: (req: RequestRecord, action: 'valorar' | 'calificar' | 'seguimiento' | 'validar') => void;
};

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
  RECIBIDO: { label: 'Recibido', color: 'bg-slate-200 text-slate-700' },
  EN_VALORACION: { label: 'En Valoración', color: 'bg-blue-100 text-blue-800' },
  EN_CALIFICACION: { label: 'En Calificación', color: 'bg-purple-100 text-purple-800' },
  EN_SEGUIMIENTO: { label: 'En Seguimiento', color: 'bg-amber-100 text-amber-800' },
  EN_VALIDACION: { label: 'En Validación', color: 'bg-teal-100 text-teal-800' },
  APROBADO: { label: 'Aprobado', color: 'bg-green-100 text-green-800' },
  RECHAZADO: { label: 'Rechazado', color: 'bg-rose-100 text-rose-800' },
};

const getStatusInfo = (status: string) => STATUS_LABELS[status] || STATUS_LABELS.RECIBIDO;

const ValidationDots = ({ audit }: { audit?: RequestRecord['audit'] }) => {
  if (!audit) return null;
  const items = [
    { key: 'T', ok: audit.titleValidated, label: 'Títulos' },
    { key: 'E', ok: audit.experienceCertified, label: 'Experiencia' },
    { key: 'P', ok: audit.publicationVerified, label: 'Producción' },
    { key: 'I', ok: audit.languageValidated, label: 'Idioma' },
  ];
  return (
    <div className="flex gap-1.5">
      {items.map((i) => (
        <span
          key={i.key}
          title={`${i.label}: ${i.ok ? 'Validado' : 'Pendiente'}`}
          className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[8px] font-black ${
            i.ok ? 'bg-green-500 text-white' : 'bg-slate-200 text-slate-400'
          }`}
        >
          {i.key}
        </span>
      ))}
    </div>
  );
};

const ListaView: React.FC<Props> = ({ requests, setView, setSelectedRequest, deleteRecord, onWorkflowAction }) => {
  const [layout, setLayout] = useState<'grid' | 'list'>('grid');
  const [search, setSearch] = useState('');

  const filtered = requests.filter(
    (r) =>
      r.nombre.toLowerCase().includes(search.toLowerCase()) ||
      r.documento.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div className="space-y-10 animate-in fade-in duration-500">
      {/* Header */}
      <div className="flex flex-col md:flex-row justify-between items-end gap-8 border-b-2 border-slate-200 pb-8">
        <div>
          <h2 className="text-4xl font-black text-slate-900 uppercase tracking-tighter leading-none italic">
            Módulo de <span className="text-blue-600">Expedientes</span>
          </h2>
          <p className="text-slate-500 mt-2 font-bold uppercase text-[9px] tracking-[0.4em]">
            Auditoría y Gestión de Méritos Docentes
          </p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <div className="relative flex-1 md:w-72">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="BUSCAR DOCENTE..."
              className="w-full pl-12 pr-6 py-3.5 bg-white border-2 border-slate-200 text-[10px] font-black uppercase tracking-widest outline-none focus:border-blue-600 transition-all shadow-sm"
            />
          </div>

          {/* Layout toggle */}
          <div className="flex border-2 border-slate-200 bg-white">
            <button
              onClick={() => setLayout('grid')}
              className={`p-3 transition-all ${layout === 'grid' ? 'bg-slate-950 text-white' : 'text-slate-400 hover:text-slate-700'}`}
              title="Vista cuadrícula"
            >
              <Grid3X3 size={16} />
            </button>
            <button
              onClick={() => setLayout('list')}
              className={`p-3 transition-all ${layout === 'list' ? 'bg-slate-950 text-white' : 'text-slate-400 hover:text-slate-700'}`}
              title="Vista lista"
            >
              <List size={16} />
            </button>
          </div>

          <button
            onClick={() => setView('nuevo')}
            className="bg-blue-600 text-white px-6 py-3.5 text-[10px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all flex items-center gap-2 shadow-xl active:scale-95 whitespace-nowrap"
          >
            <Plus size={16} /> NUEVO
          </button>
        </div>
      </div>

      {/* Grid layout */}
      {layout === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-0 border-t border-l border-slate-200 shadow-2xl">
          {filtered.map((req) => {
            const statusInfo = getStatusInfo(req.status);
            return (
              <div
                key={req.id}
                className="bg-white border-r border-b border-slate-200 hover:bg-blue-50/20 transition-all flex flex-col group p-8"
              >
                <div className="flex justify-between items-start mb-6">
                  <div className="flex items-center gap-3">
                    <div className="bg-slate-950 p-3 text-white"><UserIcon size={20} /></div>
                    <ValidationDots audit={req.audit} />
                  </div>
                  <div className="flex flex-col items-end gap-2">
                    <div className={`px-3 py-1 text-[8px] font-black uppercase tracking-widest ${req.finalCat?.bgColor || 'bg-slate-500'} text-white`}>
                      {req.finalCat?.name || 'Sin categoría'}
                    </div>
                    <span className={`px-2.5 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-sm ${statusInfo.color}`}>
                      {statusInfo.label}
                    </span>
                  </div>
                </div>

                <h3 className="font-black text-slate-900 text-lg uppercase tracking-tighter mb-1 leading-tight">{req.nombre}</h3>
                <p className="text-slate-400 text-[9px] font-black uppercase tracking-widest mb-6 border-l-4 border-blue-600 pl-3">
                  {req.facultad}
                </p>

                <div className="grid grid-cols-2 gap-px bg-slate-200 mb-6 border border-slate-200">
                  <div className="bg-white p-4">
                    <p className="text-[8px] font-black text-slate-400 uppercase mb-1">Puntaje</p>
                    <p className="text-2xl font-black text-slate-950">{(req.finalPts || 0).toFixed(1)}</p>
                  </div>
                  <div className="bg-white p-4 flex flex-col justify-center">
                    <span className="text-[9px] font-black text-blue-600 uppercase mb-0.5">
                      {req.esIngresoNuevo ? 'Ingreso' : 'Ascenso'}
                    </span>
                    <span className="text-[8px] font-bold text-slate-300 uppercase italic">Vía Formal</span>
                  </div>
                </div>

                {/* Workflow actions */}
                <div className="grid grid-cols-2 gap-1.5 mb-4">
                  <button
                    onClick={() => onWorkflowAction(req, 'valorar')}
                    className="flex items-center justify-center gap-1.5 py-2 bg-blue-50 text-blue-700 text-[8px] font-black uppercase tracking-wider hover:bg-blue-100 transition-all border border-blue-100"
                    title="Valorar perfil docente"
                  >
                    <Star size={11} /> Valorar
                  </button>
                  <button
                    onClick={() => onWorkflowAction(req, 'calificar')}
                    className="flex items-center justify-center gap-1.5 py-2 bg-purple-50 text-purple-700 text-[8px] font-black uppercase tracking-wider hover:bg-purple-100 transition-all border border-purple-100"
                    title="Calificar condiciones"
                  >
                    <ClipboardCheck size={11} /> Calificar
                  </button>
                  <button
                    onClick={() => onWorkflowAction(req, 'seguimiento')}
                    className="flex items-center justify-center gap-1.5 py-2 bg-amber-50 text-amber-700 text-[8px] font-black uppercase tracking-wider hover:bg-amber-100 transition-all border border-amber-100"
                    title="Seguimiento del expediente"
                  >
                    <ShieldCheck size={11} /> Seguimiento
                  </button>
                  <button
                    onClick={() => onWorkflowAction(req, 'validar')}
                    className="flex items-center justify-center gap-1.5 py-2 bg-teal-50 text-teal-700 text-[8px] font-black uppercase tracking-wider hover:bg-teal-100 transition-all border border-teal-100"
                    title="Validar documentos soportes"
                  >
                    <FileCheck2 size={11} /> Validar
                  </button>
                </div>

                <div className="flex gap-2 mt-auto">
                  <button
                    onClick={() => { setSelectedRequest(req); setView('detalle'); }}
                    className="flex-1 bg-slate-950 text-white py-3.5 text-[10px] font-black tracking-[0.2em] hover:bg-blue-600 transition-all flex items-center justify-center gap-2"
                  >
                    ABRIR <ChevronRight size={14} />
                  </button>
                  <button
                    onClick={() => deleteRecord(req.id)}
                    className="p-3.5 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="col-span-full p-20 bg-white border-r border-b border-slate-200 text-center">
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                {search ? 'Sin resultados para la búsqueda' : 'No hay expedientes registrados'}
              </p>
            </div>
          )}
        </div>
      )}

      {/* List layout */}
      {layout === 'list' && (
        <div className="border-2 border-slate-200 shadow-2xl bg-white">
          {/* Table header */}
          <div className="grid grid-cols-12 gap-4 px-6 py-4 bg-slate-50 border-b-2 border-slate-200 text-[9px] font-black uppercase tracking-[0.2em] text-slate-500">
            <div className="col-span-3">Docente</div>
            <div className="col-span-2">Facultad</div>
            <div className="col-span-1 text-center">Pts</div>
            <div className="col-span-1 text-center">Categoría</div>
            <div className="col-span-1 text-center">Estado</div>
            <div className="col-span-1 text-center">Validación</div>
            <div className="col-span-3 text-center">Acciones</div>
          </div>
          {filtered.map((req) => {
            const statusInfo = getStatusInfo(req.status);
            return (
              <div
                key={req.id}
                className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-slate-100 items-center hover:bg-blue-50/30 transition-all"
              >
                <div className="col-span-3">
                  <p className="font-black text-slate-900 text-sm uppercase tracking-tight leading-tight">{req.nombre}</p>
                  <p className="text-[9px] text-slate-400 font-bold">{req.documento}</p>
                </div>
                <div className="col-span-2">
                  <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">{req.facultad}</p>
                </div>
                <div className="col-span-1 text-center">
                  <p className="text-lg font-black text-slate-950">{(req.finalPts || 0).toFixed(1)}</p>
                </div>
                <div className="col-span-1 text-center">
                  <span className={`inline-block px-2.5 py-1 text-[8px] font-black uppercase tracking-wider ${req.finalCat?.bgColor || 'bg-slate-500'} text-white`}>
                    {req.finalCat?.name || 'N/A'}
                  </span>
                </div>
                <div className="col-span-1 text-center">
                  <span className={`inline-block px-2 py-0.5 text-[8px] font-black uppercase tracking-wider rounded-sm ${statusInfo.color}`}>
                    {statusInfo.label}
                  </span>
                </div>
                <div className="col-span-1 text-center">
                  <ValidationDots audit={req.audit} />
                </div>
                <div className="col-span-3 flex items-center justify-center gap-1.5">
                  <button onClick={() => onWorkflowAction(req, 'valorar')} className="p-2 bg-blue-50 text-blue-700 hover:bg-blue-100 transition-all border border-blue-100" title="Valorar perfil">
                    <Star size={12} />
                  </button>
                  <button onClick={() => onWorkflowAction(req, 'calificar')} className="p-2 bg-purple-50 text-purple-700 hover:bg-purple-100 transition-all border border-purple-100" title="Calificar condiciones">
                    <ClipboardCheck size={12} />
                  </button>
                  <button onClick={() => onWorkflowAction(req, 'seguimiento')} className="p-2 bg-amber-50 text-amber-700 hover:bg-amber-100 transition-all border border-amber-100" title="Seguimiento">
                    <ShieldCheck size={12} />
                  </button>
                  <button onClick={() => onWorkflowAction(req, 'validar')} className="p-2 bg-teal-50 text-teal-700 hover:bg-teal-100 transition-all border border-teal-100" title="Validar documentos">
                    <FileCheck2 size={12} />
                  </button>
                  <button
                    onClick={() => { setSelectedRequest(req); setView('detalle'); }}
                    className="p-2 bg-slate-950 text-white hover:bg-blue-600 transition-all"
                    title="Ver detalle"
                  >
                    <ChevronRight size={12} />
                  </button>
                  <button
                    onClick={() => deleteRecord(req.id)}
                    className="p-2 bg-slate-100 text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-all"
                    title="Eliminar"
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              </div>
            );
          })}
          {filtered.length === 0 && (
            <div className="p-16 text-center">
              <p className="text-slate-400 text-[11px] font-black uppercase tracking-[0.2em]">
                {search ? 'Sin resultados para la búsqueda' : 'No hay expedientes registrados'}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ListaView;
