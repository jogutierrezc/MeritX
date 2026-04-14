import type { RequestRecord } from '../../../types/domain';
import type { AiCriterionRow, SelectedAnalysis } from './types';

type MeritxNarrativeReport = {
  analisisMatriz: string;
  analisisMotor: string;
  analisisOficial: string;
  analisisNormativo: string;
  conclusionIntermedia: string;
  puntajeIntermedio: number;
};

type MeritxReportPayload = {
  selectedAnalysisRequest: RequestRecord;
  selectedAnalysis: SelectedAnalysis;
  aiRows: AiCriterionRow[];
  meritxNarrative: MeritxNarrativeReport;
  generatedAt?: string;
};

const escapeHtml = (value: string) =>
  String(value || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const formatNumber = (value: number) =>
  new Intl.NumberFormat('es-CO', {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);

const normalizeText = (value: string) =>
  String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();

const splitParagraphs = (value: string) =>
  String(value || '')
    .replace(/\*\*/g, '')
    .replace(/^\s*\d+\.\s+/gm, '')
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

const renderParagraphs = (value: string, className: string) => {
  const items = splitParagraphs(value);
  if (items.length === 0) return `<p class="${className}">Sin contenido generado.</p>`;
  return items.map((item) => `<p class="${className}">${escapeHtml(item)}</p>`).join('');
};

const logoSrc = () => `${window.location.origin}/MeritX%20Logo.png`;

const buildShell = (title: string, body: string) => `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <style>
      * { box-sizing: border-box; }
      html, body { margin: 0; padding: 0; }
      body {
        min-height: 100vh;
        background: #f1f5f9;
        color: #1e293b;
        font-family: "Segoe UI", sans-serif;
      }
      .logo-img {
        display: block;
        width: auto;
        max-width: 100%;
        height: auto;
        margin: 0;
      }
      .report-header-logo {
        height: 34px;
        width: auto;
      }
      .loader-page {
        min-height: 100vh;
        background: white;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 24px;
        overflow: hidden;
        position: relative;
      }
      .loader-aura {
        position: absolute;
        inset: 0;
        overflow: hidden;
        pointer-events: none;
      }
      .loader-aura-1 {
        position: absolute;
        top: 50%;
        left: 50%;
        transform: translate(-50%, -50%);
        width: 900px;
        height: 900px;
        background: linear-gradient(to top right, rgba(219,234,254,0.7), rgba(233,213,255,0.6), rgba(252,231,243,0.65));
        border-radius: 999px;
        filter: blur(120px);
        animation: pulse 3s ease-in-out infinite;
      }
      .loader-aura-2,
      .loader-aura-3 {
        position: absolute;
        width: 400px;
        height: 400px;
        border-radius: 999px;
        filter: blur(100px);
        animation: blob 8s infinite;
      }
      .loader-aura-2 {
        top: 25%;
        left: 25%;
        background: rgba(224,231,255,0.7);
      }
      .loader-aura-3 {
        right: 25%;
        bottom: 25%;
        background: rgba(255,228,230,0.7);
        animation-delay: 2s;
      }
      .loader-content {
        position: relative;
        z-index: 1;
        display: flex;
        flex-direction: column;
        align-items: center;
        text-align: center;
      }
      .loader-logo-wrap {
        margin-bottom: 56px;
        position: relative;
      }
      .loader-logo-glow {
        position: absolute;
        inset: -16px;
        background: linear-gradient(to top right, rgba(59,130,246,0.28), rgba(168,85,247,0.24), rgba(236,72,153,0.24));
        border-radius: 999px;
        filter: blur(48px);
        animation: spin 10s linear infinite;
      }
      .loader-logo-card {
        position: relative;
        width: 320px;
        min-height: 180px;
        background: white;
        border-radius: 38px;
        display: flex;
        align-items: center;
        justify-content: center;
        box-shadow: 0 25px 60px rgba(15,23,42,0.12);
        border: 1px solid #f8fafc;
        padding: 24px 28px;
      }
      .loader-logo-card img {
        width: 100%;
        max-width: 240px;
        height: auto;
      }
      .loader-title {
        font-size: 2.25rem;
        font-weight: 900;
        letter-spacing: 0.3em;
        text-transform: uppercase;
        margin: 0 0 16px;
        background: linear-gradient(to right, #0f172a, #475569, #0f172a);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .loader-subtitle-row {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 40px;
      }
      .loader-sparkle {
        width: 14px;
        height: 14px;
        background: linear-gradient(135deg, #3b82f6, #a855f7);
        clip-path: polygon(50% 0%, 62% 38%, 100% 50%, 62% 62%, 50% 100%, 38% 62%, 0% 50%, 38% 38%);
        animation: bounce 1.3s ease-in-out infinite;
      }
      .loader-subtitle {
        margin: 0;
        color: #94a3b8;
        font-weight: 700;
        font-size: 0.75rem;
        text-transform: uppercase;
        letter-spacing: 0.2em;
      }
      .loader-progress {
        width: 320px;
        height: 4px;
        background: #f1f5f9;
        border-radius: 999px;
        overflow: hidden;
        position: relative;
      }
      .loader-progress-bar {
        height: 100%;
        background: linear-gradient(to right, #3b82f6, #8b5cf6, #ec4899);
        transition: width 0.3s ease-out;
        width: 0%;
      }
      .loader-progress-label {
        margin-top: 16px;
        font-size: 11px;
        color: #cbd5e1;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.18em;
      }
      .report-page {
        min-height: 100vh;
        background: #f1f5f9;
        padding: 8px 32px;
        color: #1e293b;
      }
      .report-shell {
        position: relative;
        max-width: 1400px;
        margin: 0 auto;
      }
      .report-glow {
        position: absolute;
        inset: -6px;
        background: linear-gradient(to right, #3b82f6, #6366f1, #8b5cf6, #ec4899, #3b82f6);
        border-radius: 2.8rem;
        filter: blur(10px);
        opacity: 0.25;
        transition: opacity 1s;
        animation: gradient-x 12s ease infinite;
        background-size: 200% 200%;
      }
      .report-card {
        position: relative;
        background: #f8fafc;
        border-radius: 2.5rem;
        overflow: hidden;
        box-shadow: 0 25px 60px rgba(15,23,42,0.12);
      }
      .report-inner {
        padding: 16px 40px 0;
        max-width: 1400px;
        margin: 0 auto;
      }
      .report-topbar {
        display: flex;
        justify-content: space-between;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
      }
      .report-brand {
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .report-brand img {
        height: 40px;
        width: auto;
      }
      .report-actions-note {
        display: flex;
        align-items: center;
        gap: 8px;
        color: #94a3b8;
        font-weight: 700;
        font-size: 10px;
        text-transform: uppercase;
        letter-spacing: 0.2em;
      }
      .report-print-button {
        display: inline-flex;
        align-items: center;
        gap: 8px;
        padding: 10px 24px;
        background: #1e293b;
        color: white;
        border-radius: 12px;
        font-size: 14px;
        font-weight: 700;
        box-shadow: 0 10px 24px rgba(15,23,42,0.16);
        border: 0;
        cursor: pointer;
      }
      .teacher-card {
        background: white;
        border-radius: 24px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        margin-bottom: 32px;
        overflow: hidden;
      }
      .teacher-head {
        padding: 32px;
        display: flex;
        flex-direction: column;
        gap: 32px;
        align-items: center;
        background: rgba(248,250,252,0.5);
        border-bottom: 1px solid #f1f5f9;
      }
      .teacher-avatar {
        width: 80px;
        height: 80px;
        background: white;
        border-radius: 16px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #94a3b8;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        overflow: hidden;
      }
      .teacher-avatar img {
        width: 78%;
        height: auto;
      }
      .teacher-main {
        flex-grow: 1;
        text-align: center;
      }
      .teacher-title-row {
        display: flex;
        flex-direction: column;
        gap: 12px;
        margin-bottom: 8px;
        justify-content: center;
        align-items: center;
      }
      .teacher-name {
        margin: 0;
        font-size: 30px;
        font-weight: 900;
        color: #0f172a;
        letter-spacing: -0.02em;
        text-transform: uppercase;
      }
      .teacher-badge {
        padding: 6px 12px;
        background: #0f172a;
        color: white;
        font-size: 10px;
        font-weight: 900;
        border-radius: 8px;
        text-transform: uppercase;
        letter-spacing: 0.15em;
      }
      .teacher-meta-row {
        display: flex;
        flex-wrap: wrap;
        justify-content: center;
        gap: 10px 32px;
        font-size: 12px;
        color: #64748b;
        font-weight: 700;
        text-transform: uppercase;
      }
      .teacher-meta-row span {
        display: inline-flex;
        align-items: center;
        gap: 8px;
      }
      .teacher-grid {
        display: grid;
        grid-template-columns: 1fr;
      }
      .teacher-grid-item {
        padding: 20px;
        display: flex;
        align-items: center;
        gap: 16px;
        border-top: 1px solid #f1f5f9;
      }
      .teacher-grid-icon {
        padding: 12px;
        background: #f8fafc;
        color: #64748b;
        border-radius: 12px;
        width: 44px;
        text-align: center;
        font-size: 18px;
        font-weight: 900;
      }
      .teacher-grid-label {
        margin: 0 0 4px;
        font-size: 10px;
        font-weight: 900;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }
      .teacher-grid-value {
        margin: 0;
        font-size: 14px;
        font-weight: 700;
        color: #1e293b;
      }
      .stats-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 16px;
        margin-bottom: 32px;
      }
      .stats-box {
        padding: 24px;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        background: white;
        box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        display: flex;
        flex-direction: column;
        justify-content: space-between;
      }
      .stats-box.alert {
        background: #fef2f2;
        color: #b91c1c;
        border-color: #fecaca;
      }
      .stats-head {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        opacity: 0.65;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }
      .stats-main {
        font-size: 42px;
        font-weight: 900;
        letter-spacing: -0.05em;
      }
      .stats-sub {
        margin-top: 4px;
        font-size: 10px;
        font-weight: 700;
        opacity: 0.7;
        text-transform: uppercase;
      }
      .narratives {
        display: flex;
        flex-direction: column;
        gap: 24px;
        margin-bottom: 32px;
      }
      .narrative-box {
        background: white;
        padding: 32px;
        border-radius: 24px;
        border: 1px solid #e2e8f0;
        box-shadow: 0 1px 2px rgba(15,23,42,0.04);
        position: relative;
        overflow: hidden;
      }
      .narrative-row {
        display: flex;
        flex-direction: column;
        gap: 24px;
      }
      .narrative-track {
        display: flex;
        align-items: center;
        gap: 8px;
      }
      .narrative-dot {
        width: 12px;
        height: 12px;
        border-radius: 999px;
      }
      .narrative-line {
        display: none;
        width: 1px;
        height: 100%;
        background: #f1f5f9;
      }
      .narrative-title {
        margin: 0 0 12px;
        font-size: 11px;
        font-weight: 900;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.2em;
      }
      .narrative-copy {
        margin: 0 0 10px;
        font-size: 14px;
        color: #475569;
        line-height: 1.75;
        text-align: justify;
        font-style: italic;
        font-weight: 600;
      }
      .resolution-box {
        background: #f1f5f9;
        border-radius: 2.5rem;
        padding: 40px;
        border: 1px solid #e2e8f0;
        margin-bottom: 48px;
        position: relative;
        overflow: hidden;
      }
      .resolution-gavel {
        position: absolute;
        top: 0;
        right: 0;
        padding: 48px;
        opacity: 0.03;
        color: #0f172a;
        font-size: 300px;
        font-weight: 900;
        line-height: 1;
      }
      .resolution-title {
        margin: 0 0 40px;
        text-align: center;
        font-size: 10px;
        font-weight: 900;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.4em;
      }
      .resolution-main {
        max-width: 960px;
        margin: 0 auto 48px;
        text-align: center;
      }
      .resolution-main-copy {
        margin: 0;
        font-size: 34px;
        font-weight: 900;
        color: #0f172a;
        line-height: 1.25;
      }
      .resolution-subcopy {
        margin-top: 16px;
        color: #64748b;
        font-size: 14px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.15em;
        opacity: 0.85;
      }
      .resolution-grid {
        display: grid;
        grid-template-columns: 1fr;
        gap: 24px;
        padding-top: 40px;
        border-top: 1px solid #e2e8f0;
      }
      .resolution-panel {
        background: rgba(255,255,255,0.5);
        padding: 24px;
        border-radius: 16px;
        border: 1px solid rgba(255,255,255,0.6);
      }
      .resolution-panel-title {
        margin: 0 0 12px;
        font-size: 10px;
        font-weight: 900;
        color: #0f172a;
        text-transform: uppercase;
        letter-spacing: 0.14em;
      }
      .resolution-panel-copy {
        margin: 0 0 8px;
        font-size: 12px;
        color: #475569;
        line-height: 1.7;
        text-align: justify;
        font-style: italic;
      }
      .master-section {
        margin: 64px 0;
      }
      .cepi-section {
        margin: 48px 0;
      }
      .cepi-head {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 18px;
      }
      .cepi-title {
        margin: 0;
        font-size: 18px;
        font-weight: 900;
        color: #0f172a;
        letter-spacing: -0.01em;
        text-transform: uppercase;
      }
      .cepi-line {
        height: 1px;
        flex: 1;
        background: #e2e8f0;
      }
      .cepi-subtitle {
        margin: 0 0 14px;
        font-size: 11px;
        color: #64748b;
        font-weight: 700;
      }
      .cepi-table-wrap {
        background: #ffffff;
        border: 1px solid #e2e8f0;
        border-radius: 16px;
        overflow: auto;
      }
      .cepi-table {
        width: 100%;
        min-width: 900px;
        border-collapse: collapse;
      }
      .cepi-table thead tr {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        font-size: 9px;
        font-weight: 900;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .cepi-table th,
      .cepi-table td {
        padding: 14px;
        border-bottom: 1px solid #f1f5f9;
      }
      .cepi-article {
        font-size: 12px;
        font-weight: 800;
        color: #1e293b;
      }
      .cepi-meta {
        font-size: 11px;
        font-weight: 700;
        color: #64748b;
      }
      .cepi-ok {
        color: #166534;
        font-weight: 800;
      }
      .cepi-warn {
        color: #b45309;
        font-weight: 800;
      }
      .master-head {
        display: flex;
        align-items: center;
        gap: 16px;
        margin-bottom: 24px;
      }
      .master-title {
        margin: 0;
        font-size: 24px;
        font-weight: 900;
        color: #0f172a;
        letter-spacing: -0.02em;
        text-transform: uppercase;
      }
      .master-line {
        height: 1px;
        flex: 1;
        background: #e2e8f0;
      }
      .master-table-wrap {
        background: white;
        border-radius: 16px;
        border: 1px solid #e2e8f0;
        overflow: auto;
        box-shadow: 0 1px 2px rgba(15,23,42,0.04);
      }
      .master-table {
        width: 100%;
        min-width: 1000px;
        border-collapse: collapse;
      }
      .master-table thead tr {
        background: #f8fafc;
        border-bottom: 1px solid #e2e8f0;
        font-size: 9px;
        font-weight: 900;
        color: #94a3b8;
        text-transform: uppercase;
        letter-spacing: 0.04em;
      }
      .master-table th,
      .master-table td {
        padding: 16px;
        text-align: left;
        border-bottom: 1px solid #f1f5f9;
      }
      .master-table td {
        font-size: 14px;
      }
      .master-section-cell {
        font-size: 10px;
        font-weight: 700;
        color: #94a3b8;
        text-transform: uppercase;
      }
      .master-criteria {
        font-size: 14px;
        font-weight: 900;
        color: #1e293b;
      }
      .master-doc {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 10px;
        font-weight: 700;
        color: #64748b;
      }
      .master-state {
        display: inline-block;
        font-size: 9px;
        font-weight: 900;
        padding: 6px 12px;
        border-radius: 999px;
      }
      .state-ok {
        background: #dcfce7;
        color: #15803d;
      }
      .state-sat {
        background: #0f172a;
        color: white;
      }
      .state-warn {
        background: #eff6ff;
        color: #2563eb;
      }
      .text-center { text-align: center; }
      .text-right { text-align: right; }
      .text-soft { color: #94a3b8; }
      .text-bold { font-weight: 700; }
      .text-black { font-weight: 900; color: #0f172a; }
      .meritx-col { background: rgba(248,250,252,0.6); }
      .report-footer {
        margin-top: 48px;
        padding-top: 32px;
        border-top: 1px solid #e2e8f0;
        padding-bottom: 64px;
        text-align: center;
      }
      .report-footer-copy {
        margin: 0;
        color: #cbd5e1;
        font-size: 10px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.6em;
      }
      .error-page {
        min-height: 100vh;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 24px;
      }
      .error-card {
        width: 100%;
        max-width: 760px;
        border-radius: 32px;
        background: white;
        border: 1px solid #e2e8f0;
        box-shadow: 0 30px 80px rgba(15,23,42,0.1);
        padding: 40px;
        text-align: center;
      }
      .error-card img {
        margin: 0 auto 24px;
        height: 60px;
        width: auto;
      }
      .error-card h1 {
        margin: 0 0 12px;
        font-size: 30px;
        font-weight: 900;
        color: #0f172a;
      }
      .error-card p {
        margin: 0;
        font-size: 14px;
        line-height: 1.75;
        color: #475569;
      }
      @keyframes blob {
        0% { transform: translate(0px, 0px) scale(1); }
        33% { transform: translate(40px, -60px) scale(1.1); }
        66% { transform: translate(-30px, 30px) scale(0.9); }
        100% { transform: translate(0px, 0px) scale(1); }
      }
      @keyframes spin {
        from { transform: rotate(0deg); }
        to { transform: rotate(360deg); }
      }
      @keyframes pulse {
        0%, 100% { opacity: 0.7; transform: scale(1); }
        50% { opacity: 1; transform: scale(1.02); }
      }
      @keyframes bounce {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-4px); }
      }
      @keyframes gradient-x {
        0%, 100% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
      }
      @media (min-width: 768px) {
        .teacher-head {
          flex-direction: row;
          align-items: center;
        }
        .teacher-main {
          text-align: left;
        }
        .teacher-title-row {
          flex-direction: row;
          justify-content: flex-start;
        }
        .teacher-meta-row {
          justify-content: flex-start;
        }
        .teacher-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
        .teacher-grid-item {
          border-top: 0;
          border-right: 1px solid #f1f5f9;
        }
        .teacher-grid-item:last-child {
          border-right: 0;
        }
        .stats-grid {
          grid-template-columns: repeat(4, minmax(0, 1fr));
        }
        .narrative-row {
          flex-direction: row;
          align-items: flex-start;
        }
        .narrative-track {
          flex-direction: column;
          width: 14px;
          flex-shrink: 0;
        }
        .narrative-line {
          display: block;
        }
        .resolution-grid {
          grid-template-columns: repeat(3, minmax(0, 1fr));
        }
      }
      @media print {
        body {
          -webkit-print-color-adjust: exact;
          background-color: white !important;
        }
        .report-page {
          padding: 0;
          background: white;
        }
        .report-glow {
          display: none !important;
        }
        .report-card {
          box-shadow: none;
          border-radius: 0;
        }
        .print-hidden {
          display: none !important;
        }
        .report-topbar {
          margin-bottom: 12px;
        }
        .teacher-card,
        .narrative-box,
        .master-table-wrap {
          box-shadow: none;
        }
        @page {
          margin: 1cm;
          size: landscape;
        }
      }
    </style>
  </head>
  <body>${body}</body>
</html>`;

const buildLoadingHtml = (teacherName: string) =>
  buildShell(
    `MeritX IA | Generando informe de ${teacherName}`,
    `
    <div class="loader-page">
      <div class="loader-aura">
        <div class="loader-aura-1"></div>
        <div class="loader-aura-2"></div>
        <div class="loader-aura-3"></div>
      </div>
      <div class="loader-content">
        <div class="loader-logo-wrap">
          <div class="loader-logo-glow"></div>
                      <img class="logo-img" src="${logoSrc()}" alt="MeritX" />
          </div>
        </div>
        
        <div class="loader-subtitle-row">
          <div class="loader-sparkle"></div>
          <p class="loader-subtitle">Generando informe jurídico-técnico de ${escapeHtml(teacherName)}</p>
        </div>
        <div class="loader-progress">
          <div id="loader-progress-bar" class="loader-progress-bar"></div>
        </div>
        <p id="loader-progress-label" class="loader-progress-label">0% Procesado</p>
      </div>
      <script>
        (function () {
          var progress = 0;
          var bar = document.getElementById('loader-progress-bar');
          var label = document.getElementById('loader-progress-label');
          var timer = window.setInterval(function () {
            progress = Math.min(94, progress + 1.2);
            if (bar) bar.style.width = progress + '%';
            if (label) label.textContent = Math.round(progress) + '% Procesado';
            if (progress >= 94) window.clearInterval(timer);
          }, 25);
        })();
      </script>
    </div>
  `,
  );

const buildErrorHtml = (message: string) =>
  buildShell(
    'MeritX IA | Error de generación',
    `
    <div class="error-page">
      <div class="error-card">
        <img class="logo-img" src="${logoSrc()}" alt="MeritX" />
        <h1>No fue posible consolidar el informe</h1>
        <p>${escapeHtml(message)}</p>
      </div>
    </div>
  `,
  );

const buildReportHtml = ({
  selectedAnalysisRequest,
  selectedAnalysis,
  aiRows,
  meritxNarrative,
  generatedAt,
}: MeritxReportPayload) => {
  const supportCount = selectedAnalysis.rows.filter((row) => row.hasSupport).length;
  const reserveGap = Math.abs(selectedAnalysis.matrixTotal - selectedAnalysis.suggested.finalPts);
  const generatedLabel = generatedAt ? new Date(generatedAt) : new Date();
  const generatedLabelText = generatedLabel.toLocaleDateString('es-CO');
  const teacherData = {
    nombre: selectedAnalysisRequest.nombre,
    id: selectedAnalysisRequest.documento,
    radicado: selectedAnalysisRequest.id,
    facultad: selectedAnalysisRequest.facultad || 'No disponible',
    programa: 'No disponible',
    fechaPostulacion: generatedLabel.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };

  const stats = {
    matriz: {
      pts: selectedAnalysis.matrixTotal,
      cat: 'Potencial documental consolidado',
    },
    motor: {
      pts: selectedAnalysis.suggested.finalPts,
      cat: selectedAnalysis.suggested.finalCat.name,
    },
    ia: {
      pts: meritxNarrative.puntajeIntermedio,
      cat: 'Dictamen MeritX',
    },
    discordia: reserveGap,
  };

  const aiByCriterion = new Map(aiRows.map((row) => [row.criterio.trim().toLowerCase(), row]));

  const masterData = selectedAnalysis.rows.map((row) => {
    const aiRow = aiByCriterion.get(row.criterio.trim().toLowerCase());
    const pIa = aiRow ? aiRow.puntajeSugerido : row.hasSupport ? row.puntaje : 0;
    let estado = 'OBSERVADO';
    if (row.hasSupport) estado = 'CON SOPORTE';
    if (!row.hasSupport) estado = 'SIN SOPORTE';
    if (row.hasSupport && pIa < row.puntaje) estado = 'SATURADO';
    if (row.hasSupport && pIa === row.puntaje) estado = 'VALIDADO';

    return {
      seccion: row.section.toUpperCase(),
      criterio: row.criterio,
      doc: row.detalle || row.supportNote || 'Soporte no especificado',
      estado,
      cant: formatNumber(row.cantidad),
      valor: formatNumber(row.valor),
      pMatriz: formatNumber(row.puntaje),
      pMotor: formatNumber(row.hasSupport ? row.puntaje : 0),
      pIA: formatNumber(pIa),
    };
  });

  const narratives = [
    {
      title: '01. Consideraciones de la Matriz Bruta',
      color: '#3b82f6',
      text: meritxNarrative.analisisMatriz,
    },
    {
      title: '02. Consideraciones del Motor (Algoritmo)',
      color: '#8b5cf6',
      text: meritxNarrative.analisisMotor,
    },
    {
      title: '03. Sugerencia de la IA (MeritX)',
      color: '#6366f1',
      text: meritxNarrative.analisisOficial,
    },
    {
      title: '04. Perspectiva Jurídica y Normativa',
      color: '#0f172a',
      text: meritxNarrative.analisisNormativo,
    },
  ];

  const resolutionCards = [
    {
      title: 'Puntos en Convergencia',
      text: `Se identifican ${supportCount} criterios con soporte verificable y una base técnica suficiente para sostener la línea principal del dictamen.`,
    },
    {
      title: 'Discordia Identificada',
      text: `La diferencia de ${formatNumber(stats.discordia)} puntos entre matriz y motor exige una justificación normativa expresa sobre topes, saturaciones o restricciones aplicables al caso.`,
    },
    {
      title: 'Justificación de Reserva',
      text: meritxNarrative.conclusionIntermedia,
    },
  ];

  const rowsHtml = masterData
    .map(
      (row) => `
        <tr>
          <td class="master-section-cell">${escapeHtml(row.seccion)}</td>
          <td class="master-criteria">${escapeHtml(row.criterio)}</td>
          <td>
            <div class="master-doc">
              <span>F</span>
              <span>${escapeHtml(row.doc)}</span>
            </div>
          </td>
          <td>
            <span class="master-state ${
              row.estado === 'VALIDADO' || row.estado === 'CON SOPORTE'
                ? 'state-ok'
                : row.estado === 'SATURADO'
                  ? 'state-sat'
                  : 'state-warn'
            }">${escapeHtml(row.estado)}</span>
          </td>
          <td class="text-center text-bold">${escapeHtml(row.cant)}</td>
          <td class="text-right text-bold text-soft">${escapeHtml(row.valor)}</td>
          <td class="text-right text-bold">${escapeHtml(row.pMatriz)}</td>
          <td class="text-right text-bold">${escapeHtml(row.pMotor)}</td>
          <td class="text-right text-black meritx-col">${escapeHtml(row.pIA)}</td>
        </tr>
      `,
    )
    .join('');

  const narrativeHtml = narratives
    .map(
      (item) => `
        <div class="narrative-box">
          <div class="narrative-row">
            <div class="narrative-track">
              <div class="narrative-dot" style="background:${item.color}"></div>
              <div class="narrative-line"></div>
            </div>
            <div>
              <h3 class="narrative-title">${escapeHtml(item.title)}</h3>
              ${renderParagraphs(item.text, 'narrative-copy')}
            </div>
          </div>
        </div>
      `,
    )
    .join('');

  const productionRows = selectedAnalysis.rows.filter((row) => row.section === 'Otros' && normalizeText(row.criterio).includes('produccion intelectual'));

  const cepiRowsHtml = selectedAnalysis.publications
    .map((publication, index) => {
      const source = String(publication.sourceKind || 'MANUAL').toUpperCase();
      const quartile = String(publication.quartile || 'Q4').toUpperCase();
      const productionRow = productionRows[index];
      const unitScore = productionRow ? formatNumber(productionRow.valor) : '0.0';
      const appliedScore = productionRow ? formatNumber(productionRow.puntaje) : '0.0';
      const supportText = productionRow?.supportNote || (source === 'MANUAL' ? 'Registro manual sin soporte indexado (no puntúa)' : `Validado por fuente indexada (${source})`);
      const supportClass = source === 'MANUAL' ? 'cepi-warn' : 'cepi-ok';

      return `
        <tr>
          <td class="cepi-article">${escapeHtml(publication.publicationTitle)}</td>
          <td class="cepi-meta text-center">${escapeHtml(source)}</td>
          <td class="cepi-meta text-center">${escapeHtml(quartile)}</td>
          <td class="cepi-meta text-center">${escapeHtml(String(publication.publicationYear || '-'))}</td>
          <td class="cepi-meta text-right">${escapeHtml(unitScore)}</td>
          <td class="cepi-meta text-right text-black">${escapeHtml(appliedScore)}</td>
          <td class="cepi-meta ${supportClass}">${escapeHtml(supportText)}</td>
        </tr>
      `;
    })
    .join('');

  const cepiSectionHtml = selectedAnalysis.publications.length > 0
    ? `
      <section class="cepi-section">
        <div class="cepi-head">
          <h2 class="cepi-title">Auditoría CEPI por Artículo</h2>
          <div class="cepi-line"></div>
        </div>
        <p class="cepi-subtitle">Desglose de validación por fuente, cuartil y efecto en puntaje individual de producción intelectual.</p>
        <div class="cepi-table-wrap">
          <table class="cepi-table">
            <thead>
              <tr>
                <th>Artículo</th>
                <th class="text-center">Fuente</th>
                <th class="text-center">Cuartil</th>
                <th class="text-center">Año</th>
                <th class="text-right">Puntaje unitario</th>
                <th class="text-right">Puntaje aplicado</th>
                <th>Estado de soporte</th>
              </tr>
            </thead>
            <tbody>${cepiRowsHtml}</tbody>
          </table>
        </div>
      </section>
    `
    : '';

  const resolutionHtml = resolutionCards
    .map(
      (item) => `
        <div class="resolution-panel">
          <h5 class="resolution-panel-title">${escapeHtml(item.title)}</h5>
          ${renderParagraphs(item.text, 'resolution-panel-copy')}
        </div>
      `,
    )
    .join('');

  return buildShell(
    `MeritX IA | Informe de ${teacherData.nombre}`,
    `
    <div class="report-page">
      <div class="report-shell">
        <div class="report-glow print-hidden"></div>
        <div class="report-card">
          <div class="report-inner">
            <div class="report-topbar">
              <div class="report-brand">
                <img class="logo-img report-header-logo" src="${logoSrc()}" alt="MeritX" />
              </div>
              <div style="display:flex;align-items:center;gap:16px;flex-wrap:wrap;justify-content:flex-end;">
                <div class="report-actions-note">
                  <span>Historial</span>
                  <span>Auditoría Técnica Talento Humano • MeritX IA</span>
                </div>
              </div>
            </div>

            <div class="teacher-card">
              <div class="teacher-head">
                <div class="teacher-avatar">
                  <img class="logo-img" src="${logoSrc()}" alt="MeritX" />
                </div>
                <div class="teacher-main">
                  <div class="teacher-title-row">
                    <h1 class="teacher-name">${escapeHtml(teacherData.nombre)}</h1>
                    <span class="teacher-badge">Expediente Validado</span>
                  </div>
                  <div class="teacher-meta-row">
                    <span>ID: ${escapeHtml(teacherData.id)}</span>
                    <span>Radicado: ${escapeHtml(teacherData.radicado)}</span>
                  </div>
                </div>
              </div>

              <div class="teacher-grid">
                <div class="teacher-grid-item">
                  <div class="teacher-grid-icon">F</div>
                  <div>
                    <p class="teacher-grid-label">Facultad</p>
                    <p class="teacher-grid-value">${escapeHtml(teacherData.facultad)}</p>
                  </div>
                </div>
                <div class="teacher-grid-item">
                  <div class="teacher-grid-icon">P</div>
                  <div>
                    <p class="teacher-grid-label">Programa</p>
                    <p class="teacher-grid-value">${escapeHtml(teacherData.programa)}</p>
                  </div>
                </div>
                <div class="teacher-grid-item">
                  <div class="teacher-grid-icon">C</div>
                  <div>
                    <p class="teacher-grid-label">Postulación</p>
                    <p class="teacher-grid-value">${escapeHtml(teacherData.fechaPostulacion)}</p>
                  </div>
                </div>
              </div>
            </div>

            <section class="stats-grid">
              <div class="stats-box">
                <div class="stats-head">Matriz Bruta</div>
                <div>
                  <div class="stats-main">${formatNumber(stats.matriz.pts)}</div>
                  <div class="stats-sub">${escapeHtml(stats.matriz.cat)}</div>
                </div>
              </div>
              <div class="stats-box">
                <div class="stats-head">Motor (Algoritmo)</div>
                <div>
                  <div class="stats-main">${formatNumber(stats.motor.pts)}</div>
                  <div class="stats-sub">${escapeHtml(stats.motor.cat)}</div>
                </div>
              </div>
              <div class="stats-box">
                <div class="stats-head">Sugerencia MeritX</div>
                <div>
                  <div class="stats-main">${formatNumber(stats.ia.pts)}</div>
                  <div class="stats-sub">${escapeHtml(stats.ia.cat)}</div>
                </div>
              </div>
              <div class="stats-box alert">
                <div class="stats-head">Puntos en Discordia</div>
                <div>
                  <div class="stats-main">-${formatNumber(stats.discordia)}</div>
                  <div class="stats-sub">Pendiente Justificación</div>
                </div>
              </div>
            </section>

            <div class="narratives">${narrativeHtml}</div>

            <div class="resolution-box">
              <div class="resolution-gavel print-hidden">G</div>
              <div style="position:relative;z-index:1;">
                <h4 class="resolution-title">Ratificación Técnica del Dictamen</h4>
                <div class="resolution-main">
                  <p class="resolution-main-copy">
                    Se ratifica el puntaje de <span style="text-decoration:underline;text-decoration-color:#cbd5e1;">${formatNumber(meritxNarrative.puntajeIntermedio)} puntos</span> bajo una hipótesis técnica de categoría <span style="color:#475569;">${escapeHtml(selectedAnalysis.suggested.finalCat.name)}</span>.
                  </p>
                  <p class="resolution-subcopy">Basado en el consenso del estudio de datos MeritX IA</p>
                </div>
                <div class="resolution-grid">${resolutionHtml}</div>
              </div>
            </div>

            <section class="master-section">
              <div class="master-head">
                <h2 class="master-title">Consolidado Maestro de Datos y Puntajes</h2>
                <div class="master-line"></div>
              </div>

              <div class="master-table-wrap">
                <table class="master-table">
                  <thead>
                    <tr>
                      <th>Sección</th>
                      <th>Criterio</th>
                      <th>Documento</th>
                      <th>Estado</th>
                      <th class="text-center">Cant.</th>
                      <th class="text-right">Valor</th>
                      <th class="text-right">P. Matriz</th>
                      <th class="text-right">P. Motor</th>
                      <th class="text-right meritx-col">P. MeritX</th>
                    </tr>
                  </thead>
                  <tbody>${rowsHtml}</tbody>
                </table>
              </div>
            </section>

            ${cepiSectionHtml}

            <footer class="report-footer">
              <p class="report-footer-copy">Sistema de Auditoría MeritX IA • Reporte Técnico de Escalafón • ${escapeHtml(generatedLabelText)}</p>
            </footer>
          </div>
        </div>
      </div>
    </div>
  `,
  );
};

export const openMeritxReportWindow = (teacherName: string) => {
  const popup = window.open('', '_blank', 'width=1480,height=960');
  if (!popup) return null;

  popup.document.open();
  popup.document.write(buildLoadingHtml(teacherName));
  popup.document.close();
  return popup;
};

export const renderMeritxReportWindow = (popup: Window | null, payload: MeritxReportPayload) => {
  if (!popup || popup.closed) return;
  popup.document.open();
  popup.document.write(buildReportHtml(payload));
  popup.document.close();
};

export const renderMeritxReportError = (popup: Window | null, message: string) => {
  if (!popup || popup.closed) return;
  popup.document.open();
  popup.document.write(buildErrorHtml(message));
  popup.document.close();
};