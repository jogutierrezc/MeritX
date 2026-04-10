import React from 'react';
import { ArrowLeft, FileCheck } from 'lucide-react';
import type { FormData, Titulo } from '../../../types';
import { RegistroIdentificacion } from './RegistroIdentificacion';
import { RegistroOrcid } from './RegistroOrcid';
import { RegistroExperiencia } from './RegistroExperiencia';
import { RegistroSidebar } from './RegistroSidebar';

interface RegistroViewProps {
  formData: FormData;
  onUpdateField: (field: keyof FormData, value: any) => void;
  onAddTitulo: () => void;
  onAddIdioma: () => void;
  onAddExperiencia: () => void;
  onAddProduccion: (data: any[]) => void;
  onRemoveTitulo: (index: number) => void;
  onRemoveIdioma: (index: number) => void;
  onRemoveExperiencia: (index: number) => void;
  onUpdateIdioma: (index: number, value: any) => void;
  onUpdateExperiencia: (index: number, value: any) => void;
  onUpdateTitulo: (index: number, value: Titulo) => void;
  onSave: () => void;
  onBack: () => void;
  loading: boolean;
}

export const RegistroView: React.FC<RegistroViewProps> = ({
  formData,
  onUpdateField,
  onAddTitulo,
  onAddIdioma,
  onAddExperiencia,
  onAddProduccion,
  onRemoveTitulo,
  onRemoveIdioma,
  onRemoveExperiencia,
  onUpdateIdioma,
  onUpdateExperiencia,
  onUpdateTitulo,
  onSave,
  onBack,
  loading,
}) => {
  return (
    <div className="max-w-5xl mx-auto space-y-12 animate-in slide-in-from-bottom-10 duration-500">
      <div className="bg-white p-10 border-4 border-slate-950 flex items-center justify-between">
        <div className="flex items-center gap-8">
          <button
            onClick={onBack}
            className="p-4 bg-slate-100 hover:bg-slate-950 hover:text-white transition-all text-slate-950"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h2 className="text-3xl font-black text-slate-900 uppercase tracking-tighter">
              Registro de <span className="text-blue-600">Aspirante</span>
            </h2>
            <p className="text-slate-400 font-bold uppercase text-[9px] tracking-[0.3em]">
              Carga de méritos académicos para auditoría formal
            </p>
          </div>
        </div>
        <FileCheck size={48} className="text-slate-100 hidden md:block" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        <div className="lg:col-span-8 space-y-8">
          <RegistroIdentificacion formData={formData} onUpdateField={onUpdateField} />
          <RegistroOrcid
            formData={formData}
            onUpdateField={onUpdateField}
            onAddProduccion={onAddProduccion}
          />
          <RegistroExperiencia
            experiencia={formData.experiencia}
            onAdd={onAddExperiencia}
            onUpdate={onUpdateExperiencia}
            onRemove={onRemoveExperiencia}
          />
        </div>

        <RegistroSidebar
          formData={formData}
          onAddTitulo={onAddTitulo}
          onRemoveTitulo={onRemoveTitulo}
          onAddIdioma={onAddIdioma}
          onRemoveIdioma={onRemoveIdioma}
          onUpdateIdioma={onUpdateIdioma}
          onUpdateTitulo={onUpdateTitulo}
          onSave={onSave}
          loading={loading}
        />
      </div>
    </div>
  );
};
