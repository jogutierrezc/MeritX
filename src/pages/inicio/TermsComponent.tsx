import React, { useState } from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import type { ConvocatoriaType } from '../../db/convocatoria_table';

interface TermsComponentProps {
  selectedConvocatoria: ConvocatoriaType | null;
  onBack: () => void;
  onAccept: () => void;
}

export const TermsComponent: React.FC<TermsComponentProps> = ({ selectedConvocatoria, onBack, onAccept }) => {
  const [acceptedTerms, setAcceptedTerms] = useState(false);

  const handleAccept = () => {
    if (!acceptedTerms) {
      window.alert('Debes aceptar los términos y condiciones para continuar.');
      return;
    }
    onAccept();
  };

  return (
    <div className="space-y-8">
      {/* Header */}
      <div className="space-y-4">
        <button
          onClick={onBack}
          className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 hover:shadow-sm"
        >
          <ArrowLeft size={16} /> Volver
        </button>

        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.22em] text-blue-600">Términos de participación</p>
          <h2 className="text-3xl font-black uppercase text-slate-900">
            Términos y Condiciones
          </h2>
          {selectedConvocatoria && (
            <p className="text-lg font-semibold text-slate-600">{selectedConvocatoria.nombre}</p>
          )}
        </div>
      </div>

      {/* Terms Content */}
      <div className="grid gap-8 lg:grid-cols-3">
        {/* Main Terms Section */}
        <section className="space-y-6 lg:col-span-2 rounded-2xl border border-slate-100 bg-white p-8 shadow-lg">
          <div className="space-y-4 prose prose-sm max-w-none text-slate-700">
            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900">1. Elegibilidad</h3>
              <ul className="space-y-2 list-disc list-inside text-sm font-medium">
                <li>Ser docente vinculado con la Universidad de Santander (UDES)</li>
                <li>Contar con contrato vigente al momento de la convocatoria</li>
                <li>No tener incompatibilidades según normatividad institucional</li>
                <li>Diligenciar completamente el formulario de registro</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900">2. Información Requerida</h3>
              <ul className="space-y-2 list-disc list-inside text-sm font-medium">
                <li>Datos personales e identificación válida</li>
                <li>Información de formación académica con certificados de respaldo</li>
                <li>Detalles de dominio de idiomas certificados</li>
                <li>Registro de producción académica e investigativa</li>
                <li>Experiencia profesional certificada</li>
                <li>Documentación de apoyo en formato PDF, PNG, JPG o JPEG</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900">3. Envío del Registro</h3>
              <ul className="space-y-2 list-disc list-inside text-sm font-medium">
                <li>El registro debe completarse en una sola sesión o se perderán los datos</li>
                <li>Al hacer clic en "Guardar y continuar", confirmas la exactitud de la información</li>
                <li>Recibirás un número de seguimiento (Tracking ID) para verificar el estado de tu postulación</li>
                <li>No se pueden modificar datos después de enviar el formulario</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900">4. Verificación y Auditoría</h3>
              <ul className="space-y-2 list-disc list-inside text-sm font-medium">
                <li>Tu expediente será revisado por auxiliares administrativos de la institución</li>
                <li>Se verificará la veracidad de toda la información proporcionada</li>
                <li>Reportes incompletos o con inconsistencias podrán ser rechazados</li>
                <li>Tienes derecho a conocer los resultados y criterios de evaluación</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900">5. Privacidad y Datos Personales</h3>
              <ul className="space-y-2 list-disc list-inside text-sm font-medium">
                <li>Los datos recolectados serán utilizados únicamente para propósitos de escalafón</li>
                <li>Se protegen conforme a normatividad de protección de datos personales</li>
                <li>Solo personal autorizado de UDES podrá acceder a tu información</li>
                <li>Se mantendrán confidenciales tus datos y documentos de apoyo</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900">6. Responsabilidades del Solicitante</h3>
              <ul className="space-y-2 list-disc list-inside text-sm font-medium">
                <li>Asumes total responsabilidad por la veracidad de la información reportada</li>
                <li>Falsificar documentos o información constituye causa de rechazo permanente</li>
                <li>Debes contar con los permisos legales para adjuntar documentación</li>
                <li>La falsedad comprobada podrá generar sanciones disciplinarias</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900">7. Cálculo de Puntaje</h3>
              <ul className="space-y-2 list-disc list-inside text-sm font-medium">
                <li>El sistema calcula automáticamente tu puntaje total basado en criterios predefinidos</li>
                <li>La simulación en tiempo real es estimativa y no es vinculante</li>
                <li>Auxiliares verificarán manualmente cada componente del expediente</li>
                <li>El puntaje final se determina tras auditoría completa de tu información</li>
              </ul>
            </div>

            <div className="space-y-3">
              <h3 className="text-base font-black text-slate-900">8. Limitaciones de Responsabilidad</h3>
              <ul className="space-y-2 list-disc list-inside text-sm font-medium">
                <li>UDES no se responsabiliza por pérdida de conectividad durante el registro</li>
                <li>Se recomienda usar navegadores actualizados y conexión estable</li>
                <li>Guardamos automáticamente tu progreso, pero completa el proceso en una sesión si es posible</li>
                <li>Los cambios, cancelaciones o cierres de convocatorias se comunican oficialmente</li>
              </ul>
            </div>

            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4">
              <p className="text-xs font-bold text-blue-900">
                ⚠️ <strong>Importante:</strong> Al aceptar estos términos, confirmas que has leído, entendido y aceptas todas las condiciones. 
                Si tienes dudas, contacta a recursos humanos.
              </p>
            </div>
          </div>
        </section>

        {/* Sidebar - Checklist & Acceptance */}
        <aside className="space-y-6 lg:col-span-1 h-fit sticky top-8">
          {/* Convocatoria Info */}
          {selectedConvocatoria && (
            <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
              <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">Convocatoria seleccionada</p>
              <p className="mt-3 font-bold text-slate-900">{selectedConvocatoria.nombre}</p>
              <p className="mt-2 text-xs font-semibold text-slate-600">{selectedConvocatoria.codigo}</p>
            </div>
          )}

          {/* Acceptance Checkbox */}
          <div className="rounded-2xl border border-slate-100 bg-white p-6 shadow-lg">
            <label className="flex gap-3 cursor-pointer">
              <input
                type="checkbox"
                checked={acceptedTerms}
                onChange={(e) => setAcceptedTerms(e.target.checked)}
                className="h-5 w-5 accent-blue-600 mt-1"
              />
              <div className="space-y-2">
                <p className="font-bold text-slate-900">Acepto los términos</p>
                <p className="text-xs text-slate-600">
                  Confirmo que he leído, entendido y acepto todos los términos y condiciones de esta convocatoria.
                </p>
              </div>
            </label>

            {acceptedTerms && (
              <div className="mt-4 flex items-center gap-2 rounded-lg bg-emerald-50 px-3 py-2 text-xs font-bold text-emerald-700">
                <CheckCircle2 size={14} />
                Términos aceptados
              </div>
            )}
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={handleAccept}
              disabled={!acceptedTerms}
              className="w-full rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-4 text-sm font-black text-white uppercase tracking-wide transition-all hover:shadow-lg hover:shadow-blue-300/40 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Continuar al Formulario
            </button>
            <button
              onClick={onBack}
              className="w-full rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-bold text-slate-600 transition-all hover:bg-slate-50 hover:shadow-sm"
            >
              Volver a Convocatorias
            </button>
          </div>
        </aside>
      </div>
    </div>
  );
};
