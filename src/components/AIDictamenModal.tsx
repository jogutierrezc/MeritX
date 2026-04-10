import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  CheckCircle2,
  ClipboardCheck,
  Cpu,
  Database,
  Download,
  FileCheck,
  FileText,
  Info,
  Lightbulb,
  Loader2,
  Printer,
  Search,
  ShieldCheck,
  User,
  X,
} from 'lucide-react';

import type { AppExperience, AppLanguage, AppPublication, AppTitle, RequestRecord } from '../types/domain';

type ScoreBreakdown = {
  ptsAcad: number;
  ptsIdioma: number;
  ptsPI: number;
  ptsExpBruta: number;
  appliedTope: number;
  finalPts: number;
  finalCat: { name: string; bgColor: string };
  outputMessage: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
  onRegenerate: () => Promise<void>;
  isLoading: boolean;
  analysis: string;
  request: RequestRecord;
  titles: AppTitle[];
  languages: AppLanguage[];
  publications: AppPublication[];
  experiences: AppExperience[];
  scoreBreakdown: ScoreBreakdown | null;
};

const loadingSteps = [
  { label: 'Iniciando motor AuditorX v2.0...', icon: <Cpu size={18} /> },
  { label: 'Extrayendo metadatos del docente...', icon: <User size={18} /> },
  { label: 'Validando títulos y soportes...', icon: <Search size={18} /> },
  { label: 'Contrastando el expediente con el RAG normativo...', icon: <ShieldCheck size={18} /> },
  { label: 'Calculando trazabilidad de puntaje y categoría...', icon: <Database size={18} /> },
  { label: 'Consolidando perspectivas institucionales...', icon: <Lightbulb size={18} /> },
  { label: 'Finalizando dictamen técnico imprimible...', icon: <FileCheck size={18} /> },
];

const reportStyles = `
  @import url('https://fonts.googleapis.com/css2?family=Crimson+Pro:ital,wght@0,400;0,600;0,700;1,400&family=Inter:wght@400;600;700;900&display=swap');
  body { background: #f8fafc; margin: 0; padding: 24px; }
  .font-serif { font-family: 'Crimson Pro', serif; }
  .font-sans { font-family: 'Inter', sans-serif; }
  @media print {
    body { background: white !important; padding: 0 !important; }
    .print-hidden { display: none !important; }
    .print-sheet { box-shadow: none !important; border: none !important; max-width: 100% !important; }
  }
`;

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatInline = (value: string) => {
  const escaped = escapeHtml(value);
  return escaped
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
};

const renderAnalysisBlocks = (analysis: string) => {
  const lines = analysis.split('\n');
  const blocks: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length === 0) return;
    blocks.push(
      <ol key={key} className="space-y-3 pl-6 text-sm text-slate-700">
        {listItems.map((item, index) => (
          <li key={`${key}-${index}`} className="pl-2 leading-relaxed" dangerouslySetInnerHTML={{ __html: formatInline(item) }} />
        ))}
      </ol>,
    );
    listItems = [];
  };

  lines.forEach((rawLine, index) => {
    const line = rawLine.trim();
    if (!line) {
      flushList(`list-${index}`);
      return;
    }

    const bullet = line.match(/^[-*]\s+(.+)/);
    const ordered = line.match(/^\d+[.)]\s+(.+)/);
    if (bullet || ordered) {
      listItems.push((bullet || ordered)?.[1] || line);
      return;
    }

    flushList(`list-${index}`);

    if (line.startsWith('### ')) {
      blocks.push(<h5 key={index} className="text-sm font-black uppercase tracking-[0.18em] text-blue-900">{line.replace(/^###\s+/, '')}</h5>);
      return;
    }

    if (line.startsWith('## ')) {
      blocks.push(
        <div key={index} className="pt-6">
          <h4 className="border-l-4 border-blue-600 pl-4 text-lg font-black text-slate-900">{line.replace(/^##\s+/, '')}</h4>
        </div>,
      );
      return;
    }

    if (line.startsWith('# ')) {
      blocks.push(<h3 key={index} className="text-2xl font-black text-slate-950">{line.replace(/^#\s+/, '')}</h3>);
      return;
    }

    blocks.push(
      <p key={index} className="text-sm leading-7 text-justify text-slate-700" dangerouslySetInnerHTML={{ __html: formatInline(line) }} />,
    );
  });

  flushList('list-final');
  return blocks;
};

const buildHash = (value: string) => {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return Math.abs(hash).toString(16).padStart(12, '0');
};

const AIDictamenModal: React.FC<Props> = ({
  open,
  onClose,
  onRegenerate,
  isLoading,
  analysis,
  request,
  titles,
  languages,
  publications,
  experiences,
  scoreBreakdown,
}) => {
  const reportRef = useRef<HTMLDivElement | null>(null);
  const [loadingStep, setLoadingStep] = useState(0);

  useEffect(() => {
    if (!open) return;
    const originalOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!isLoading) {
      setLoadingStep(loadingSteps.length - 1);
      return;
    }

    setLoadingStep(0);
    const interval = window.setInterval(() => {
      setLoadingStep((previous) => {
        if (previous >= loadingSteps.length - 1) return previous;
        return previous + 1;
      });
    }, 850);

    return () => {
      window.clearInterval(interval);
    };
  }, [isLoading]);

  const reportId = useMemo(() => `AUD-${request.id}`, [request.id]);
  const issueDate = useMemo(
    () => new Date().toLocaleDateString('es-CO', { day: '2-digit', month: 'long', year: 'numeric' }),
    [],
  );
  const reportHash = useMemo(() => buildHash(`${request.id}-${request.documento}-${analysis}`), [analysis, request.documento, request.id]);

  const summaryParagraphs = useMemo(() => {
    const paragraphs = analysis
      .split('\n\n')
      .map((item) => item.replace(/^#+\s+/gm, '').trim())
      .filter((item) => item.length > 40);
    return paragraphs.slice(0, 2);
  }, [analysis]);

  const methodology = useMemo(() => {
    const base = [
      'El informe fue generado mediante contraste automatizado entre los soportes del expediente, las reglas del motor de puntaje y el contexto normativo recuperado desde el repositorio RAG institucional.',
      `Se evaluaron ${titles.length} título(s), ${languages.length} registro(s) de idioma, ${publications.length} publicación(es) y ${experiences.length} experiencia(s) con trazabilidad hacia el puntaje final de ${request.finalPts.toFixed(1)} puntos.`,
      'La lectura por componentes se basa en el tipo de evidencia cargada y se interpreta dentro del workflow de validación auxiliar.',
    ];
    base.push('La puntuación final mostrada en este informe corresponde al valor oficial persistido en el expediente; la posible calificación por componente es preliminar hasta validación auxiliar.');
    return base.join(' ');
  }, [experiences.length, languages.length, publications.length, request.finalPts, scoreBreakdown, titles.length]);

  const workflowBreakdown = useMemo(() => {
    if (!scoreBreakdown) return [] as Array<{ label: string; value: number; state: string; hint: string }>;
    return [
      {
        label: 'Académico',
        value: scoreBreakdown.ptsAcad,
        state: request.audit?.titleValidated ? 'Conforme por auxiliar' : 'Pendiente validación del auxiliar',
        hint: titles.length > 0 ? `${titles.length} soporte(s) académicos cargados` : 'Sin soportes académicos cargados',
      },
      {
        label: 'Idiomas',
        value: scoreBreakdown.ptsIdioma,
        state: request.audit?.languageValidated ? 'Conforme por auxiliar' : 'Pendiente validación del auxiliar',
        hint: languages.length > 0 ? `${languages.length} soporte(s) de idioma cargados` : 'Sin soportes de idioma cargados',
      },
      {
        label: 'Producción',
        value: scoreBreakdown.ptsPI,
        state: request.audit?.publicationVerified ? 'Verificada por auxiliar' : 'Pendiente verificación del auxiliar',
        hint: publications.length > 0 ? `${publications.length} evidencia(s) de producción cargadas` : 'Sin evidencia de producción cargada',
      },
      {
        label: 'Experiencia',
        value: Math.min(scoreBreakdown.ptsExpBruta, scoreBreakdown.appliedTope),
        state: request.audit?.experienceCertified ? 'Certificada por auxiliar' : 'Pendiente certificación del auxiliar',
        hint: experiences.length > 0 ? `${experiences.length} soporte(s) de experiencia cargados` : 'Sin soportes de experiencia cargados',
      },
    ];
  }, [experiences.length, languages.length, publications.length, request.audit, scoreBreakdown, titles.length]);

  const recommendationItems = useMemo(() => {
    const lines = analysis.split('\n').map((item) => item.trim()).filter(Boolean);
    const extracted = lines
      .filter((item) => /^[-*]/.test(item) || /^\d+[.)]/.test(item) || /recomiend|sugier|condicion|subsan/i.test(item))
      .map((item) => item.replace(/^[-*]\s+/, '').replace(/^\d+[.)]\s+/, ''));
    return extracted.slice(0, 4);
  }, [analysis]);

  const titleCards = useMemo(
    () =>
      titles.slice(0, 4).map((title) => ({
        nombre: title.titleName,
        cumple: title.titleLevel,
        observacion: `Soporte académico incorporado al expediente para valoración de categoría y trazabilidad del puntaje institucional.`,
      })),
    [titles],
  );

  const handlePrint = () => {
    const reportNode = reportRef.current;
    if (!reportNode) return;

    const popup = window.open('', '_blank', 'width=1200,height=900');
    if (!popup) return;

    popup.document.write(`
      <html>
        <head>
          <title>${reportId}</title>
          <style>${reportStyles}</style>
        </head>
        <body>${reportNode.outerHTML}</body>
      </html>
    `);
    popup.document.close();
    popup.focus();
    popup.print();
  };

  const handleExport = () => {
    const reportNode = reportRef.current;
    if (!reportNode) return;

    const html = `
      <html>
        <head>
          <meta charset="utf-8" />
          <title>${reportId}</title>
          <style>${reportStyles}</style>
        </head>
        <body>${reportNode.outerHTML}</body>
      </html>
    `;

    const blob = new Blob([html], { type: 'text/html;charset=utf-8' });
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = `${reportId.toLowerCase()}.html`;
    anchor.click();
    window.URL.revokeObjectURL(url);
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] bg-slate-950/70 backdrop-blur-sm print:bg-white">
      <div className="absolute inset-0" onClick={onClose} />
      <div className="relative z-10 mx-auto flex h-full max-w-7xl flex-col px-4 py-4 md:px-8 md:py-6 print:p-0">
        <div className="mb-4 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-4 shadow-lg print:hidden">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ShieldCheck size={18} />
            </div>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.26em] text-slate-500">Sistema AuditorX</p>
              <p className="text-sm font-semibold text-slate-900">Ventana de dictamen IA lista para impresión</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
          >
            <X size={16} /> Cerrar
          </button>
        </div>

        <div className="relative flex-1 overflow-auto rounded-[2rem] bg-white shadow-2xl">
          {isLoading ? (
            <div className="flex min-h-full items-center justify-center bg-white p-6 text-slate-950">
              <div className="w-full max-w-2xl space-y-8">
                <div className="flex flex-col items-center space-y-4 text-center">
                  <div className="relative">
                    <div className="absolute inset-0 rounded-full bg-blue-400/30 blur-xl animate-pulse" />
                    <Loader2 className="relative z-10 h-16 w-16 animate-spin text-blue-600" />
                  </div>
                  <div>
                    <h2 className="text-2xl font-black tracking-tight text-slate-950">Procesando Dictamen IA</h2>
                    <p className="text-sm text-slate-600">Motor AuditorX analizando expediente, trazabilidad y normas RAG.</p>
                  </div>
                </div>

                <div className="rounded-[1.75rem] border border-blue-100 bg-white p-6 shadow-lg shadow-blue-100/50">
                  <div className="space-y-4">
                    {loadingSteps.map((step, idx) => (
                      <div
                        key={step.label}
                        className={`flex items-center gap-3 transition-all duration-500 ${
                          idx === loadingStep
                            ? 'translate-x-2 text-blue-600'
                            : idx < loadingStep
                              ? 'text-slate-800 opacity-70'
                              : 'text-slate-300 opacity-70'
                        }`}
                      >
                        {idx < loadingStep ? <CheckCircle2 size={18} className="text-blue-600" /> : step.icon}
                        <span className={`text-sm font-semibold ${idx === loadingStep ? 'animate-pulse' : ''}`}>{step.label}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                  <div
                    className="h-full bg-blue-600 transition-all duration-500 ease-out"
                    style={{ width: `${((loadingStep + 1) / loadingSteps.length) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="min-h-full bg-slate-50 p-4 md:p-10 font-serif text-slate-900 print:bg-white print:p-0">
              <div className="mx-auto mb-6 flex max-w-5xl items-center justify-between gap-4 print-hidden font-sans">
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded bg-slate-800 text-white">
                    <ShieldCheck size={18} />
                  </div>
                  <h1 className="text-sm font-bold uppercase tracking-tight text-slate-700">Sistema AuditorX</h1>
                </div>
                <div className="flex flex-wrap gap-2">
                  <button onClick={onRegenerate} className="rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                    Re-analizar
                  </button>
                  <button onClick={handlePrint} className="flex items-center gap-2 rounded border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50">
                    <Printer size={16} /> Imprimir
                  </button>
                  <button onClick={handleExport} className="flex items-center gap-2 rounded bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-slate-950">
                    <Download size={16} /> Exportar
                  </button>
                </div>
              </div>

              <div ref={reportRef} className="print-sheet mx-auto max-w-5xl overflow-hidden border border-slate-200 bg-white shadow-xl">
                <style>{reportStyles}</style>

                <div className="flex items-start justify-between gap-10 border-b-2 border-slate-800 p-10">
                  <div className="max-w-2xl space-y-4">
                    <div className="inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.2em] text-slate-500 font-sans">
                      <FileCheck size={14} className="text-slate-800" /> Documento Oficial de Auditoría
                    </div>
                    <h2 className="text-3xl font-bold leading-tight text-slate-900">INFORME DE AUDITORÍA Y <br />DICTAMEN DE PUNTAJE</h2>
                    <div className="space-y-1 text-xs text-slate-500 font-sans">
                      <p><span className="font-bold text-slate-700">REFERENCIA:</span> {reportId}</p>
                      <p><span className="font-bold text-slate-700">FECHA DE EMISIÓN:</span> {issueDate}</p>
                    </div>
                  </div>
                  <div className="text-right font-sans">
                    <div className="rounded border border-slate-200 bg-slate-50 p-4 text-center">
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">Puntaje Final</p>
                      <p className="text-4xl font-black leading-none text-slate-800">{request.finalPts.toFixed(1)}</p>
                      <p className="mt-1 text-[10px] font-bold uppercase text-slate-500">Unidades AC</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-10 p-10 leading-relaxed text-slate-800">
                  <section>
                    <h3 className="mb-4 border-b border-slate-100 pb-1 text-xs font-bold uppercase tracking-widest text-slate-400 font-sans">I. Información del Sujeto Evaluado</h3>
                    <div className="grid grid-cols-1 gap-y-4 text-sm md:grid-cols-2">
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 font-sans">Nombre del Docente</p>
                        <p className="font-bold">{request.nombre}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 font-sans">Identificación</p>
                        <p className="font-mono">{request.documento}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 font-sans">Unidad Académica / Facultad</p>
                        <p className="font-semibold">{request.facultad}</p>
                      </div>
                      <div>
                        <p className="text-[10px] font-bold uppercase text-slate-500 font-sans">Categoría Resultante</p>
                        <p className="font-semibold text-blue-800">{request.finalCat.name}</p>
                      </div>
                    </div>
                  </section>

                  <section className="space-y-6">
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-800 font-sans">
                        <Info size={14} /> Resumen Ejecutivo de la Evaluación
                      </h3>
                      {(summaryParagraphs.length > 0 ? summaryParagraphs : [analysis || 'No se generó contenido para el resumen ejecutivo.']).map((paragraph, index) => (
                        <p key={index} className="text-sm text-justify">{paragraph}</p>
                      ))}
                    </div>
                    <div className="space-y-3">
                      <h3 className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-800 font-sans">
                        <BookOpen size={14} /> Metodología Aplicada
                      </h3>
                      <p className="text-sm text-justify">{methodology}</p>
                    </div>
                  </section>

                  <section className="space-y-4">
                    <h3 className="border-b-2 border-slate-800 pb-1 text-xs font-bold uppercase tracking-widest text-slate-800 font-sans">II. Análisis de Requisitos Normativos</h3>
                    <p className="text-xs italic text-slate-500">Evaluación realizada bajo el marco reglamentario institucional y el expediente normativo recuperado desde RAG.</p>
                    <div className="space-y-2">
                      {(titleCards.length > 0 ? titleCards : [{ nombre: 'Sin títulos registrados', cumple: 'Revisión manual', observacion: 'El expediente no contiene títulos académicos visibles para esta sección.' }]).map((title, index) => (
                        <div key={`${title.nombre}-${index}`} className="flex flex-col justify-between gap-3 rounded border border-slate-200 p-3 text-sm md:flex-row md:items-center">
                          <div className="flex items-start gap-3">
                            <CheckCircle2 size={16} className="mt-0.5 text-slate-800" />
                            <div>
                              <p className="font-bold">{title.nombre}</p>
                              <p className="text-[11px] italic text-slate-500">{title.observacion}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="rounded border border-slate-200 bg-slate-100 px-2 py-1 text-[10px] font-bold uppercase">Base {title.cumple.toUpperCase()}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </section>

                  <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-6">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <Database size={20} className="text-blue-700" />
                      <h3 className="text-lg font-bold tracking-tight text-slate-900 font-sans">Trazabilidad del Puntaje</h3>
                    </div>
                    <p className="text-sm text-slate-600">
                      Los siguientes valores muestran la posible calificación por tipo de evidencia cargada. Cada frente queda en firme cuando el auxiliar valida su conformidad documental.
                    </p>
                    {workflowBreakdown.length > 0 && (
                      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
                        {workflowBreakdown.map((item) => (
                          <div key={item.label} className="rounded border border-slate-200 bg-white px-4 py-4 text-center">
                            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{item.label}</p>
                            <p className="mt-2 text-3xl font-black text-slate-900">{item.value.toFixed(1)}</p>
                            <p className="mt-2 text-[10px] font-black uppercase tracking-widest text-slate-700">{item.state}</p>
                            <p className="mt-2 text-[10px] font-semibold leading-relaxed text-slate-500">{item.hint}</p>
                          </div>
                        ))}
                      </div>
                    )}
                    <div className="rounded border border-blue-100 bg-blue-50 px-4 py-4">
                      <p className="text-[10px] font-bold uppercase tracking-[0.25em] text-blue-700">Puntaje oficial del expediente</p>
                      <p className="mt-2 text-4xl font-black text-slate-900">{request.finalPts.toFixed(1)}</p>
                      <p className="mt-3 text-sm text-slate-600">{request.outputMessage}</p>
                    </div>
                    {scoreBreakdown && (
                      <p className="text-[11px] font-semibold text-slate-500">
                        Posible resultado por soportes: {scoreBreakdown.finalPts.toFixed(1)} pts y categoría posible {scoreBreakdown.finalCat.name}.
                      </p>
                    )}
                  </section>

                  <section className="space-y-4">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <FileText size={20} className="text-slate-800" />
                      <h3 className="text-lg font-bold tracking-tight text-slate-900 font-sans">III. Dictamen técnico narrativo</h3>
                    </div>
                    <div className="space-y-4">{renderAnalysisBlocks(analysis || 'No se generó contenido de dictamen.')}</div>
                  </section>

                  <section className="space-y-4 rounded-lg border border-slate-200 bg-slate-50 p-6">
                    <div className="flex items-center gap-2 border-b border-slate-200 pb-2">
                      <Lightbulb size={20} className="text-amber-500" />
                      <h3 className="text-lg font-bold tracking-tight text-slate-900 font-sans">Recomendaciones del AuditorX</h3>
                    </div>
                    <div className="space-y-4">
                      {(recommendationItems.length > 0 ? recommendationItems : ['El informe no devolvió recomendaciones explícitas; revisar el texto completo del dictamen técnico.']).map((item, index) => (
                        <div key={`${item}-${index}`} className="flex gap-3 text-sm">
                          <span className="font-bold text-slate-400 font-sans">{index + 1}.</span>
                          <p className="leading-relaxed italic text-slate-700">&quot;{item}&quot;</p>
                        </div>
                      ))}
                    </div>
                  </section>

                  <div className="flex flex-col items-center justify-between gap-10 pt-10 md:flex-row">
                    <div className="space-y-1 font-mono text-[10px] text-slate-400">
                      <p>VERIFICACIÓN ELECTRÓNICA:</p>
                      <p>HASH-SHA256: {reportHash}</p>
                      <p>CERTIFICADO POR: SISTEMA AUDITORX V2.0</p>
                    </div>
                    <div className="space-y-2 text-center font-sans">
                      <div className="mb-2 flex h-24 w-64 flex-col items-center justify-end border-b border-slate-800">
                        <ClipboardCheck size={32} className="mb-2 text-slate-200" />
                        <span className="mb-1 text-[10px] font-mono text-slate-300">Firma Digitalizada AuditorX</span>
                      </div>
                      <p className="text-xs font-bold uppercase text-slate-900">Coordinación Técnica de Escalafón</p>
                      <p className="text-[10px] uppercase text-slate-500">Comité de Asignación de Puntaje (CAP)</p>
                    </div>
                  </div>
                </div>

                <div className="border-t border-slate-100 bg-slate-50 p-6 text-center">
                  <p className="text-[10px] font-bold uppercase tracking-[0.4em] text-slate-400 font-sans">Propiedad Institucional • Validez Legal Permanente</p>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AIDictamenModal;