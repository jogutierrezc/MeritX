import type { RequestRecord } from '../../../types/domain';
import type { AiCriterionRow, SelectedAnalysis } from './types';

export type MeritxNarrativeReport = {
  analisisMatriz: string;
  analisisMotor: string;
  analisisOficial: string;
  analisisNormativo: string;
  conclusionIntermedia: string;
  puntajeIntermedio: number;
};

export type MeritxReportPayload = {
  selectedAnalysisRequest: RequestRecord;
  selectedAnalysis: SelectedAnalysis;
  aiRows: AiCriterionRow[];
  meritxNarrative: MeritxNarrativeReport;
  generatedAt?: string | null;
  aiEngine?: { provider: string; model: string } | string;
  currentLanguages?: any[];
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

const logoSrc = () => `${window.location.origin}/UdesImprimible.png`;

const buildShell = (title: string, body: string) => `
<!doctype html>
<html lang="es">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${escapeHtml(title)}</title>
    <link href="https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=DM+Sans:wght@400;500;700;900&display=swap" rel="stylesheet" />
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
      :root {
        --ink: #0f172a;
        --ink-soft: #475569;
        --ink-muted: #94a3b8;
        --line: #e2e8f0;
        --bg: #f8fafc;
        --white: #ffffff;
        --accent: #3b82f6;
        --purple: #8b5cf6;
        --pink: #ec4899;
        --green: #15803d;
        --green-bg: #dcfce7;
        --warn: #b45309;
        --warn-bg: #fef3c7;
        --danger: #b91c1c;
        --danger-bg: #fef2f2;
        --sat-bg: #0f172a;
      }
      body {
        min-height: 100vh;
        background: #e8edf3;
        color: var(--ink);
        font-family: 'DM Sans', sans-serif;
        font-size: 13px;
      }
      .screen-wrap {
        max-width: 1080px;
        margin: 24px auto;
        background: var(--white);
        border-radius: 28px;
        overflow: hidden;
        box-shadow: 0 30px 80px rgba(15,23,42,0.14);
      }
      .udes-header {
        border: 1.5px solid #1a3a6e;
        display: flex;
        align-items: stretch;
        background: #fff;
      }
      .udes-logo-block {
        width: 210px;
        flex-shrink: 0;
        border-right: 1.5px solid #1a3a6e;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 8px;
      }
      .udes-logo-block img {
        width: 100%;
        max-width: 180px;
        height: auto;
      }
      .udes-info-block {
        flex: 1;
        border-right: 1.5px solid #1a3a6e;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        padding: 8px 20px;
        text-align: center;
        gap: 2px;
      }
      .udes-sys-title {
        font-size: 11px;
        font-weight: 700;
        color: #1a2f5a;
      }
      .udes-sys-sub {
        font-size: 10px;
        color: #1a2f5a;
        margin-bottom: 8px;
      }
      .udes-doc-title,
      .udes-doc-code {
        font-size: 10px;
        font-style: italic;
        color: #1a2f5a;
        text-transform: uppercase;
      }
      .udes-version-block {
        width: 100px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 10px;
        font-weight: 700;
        color: #1a2f5a;
        padding: 8px;
        text-align: center;
      }
      .udes-title-strip {
        background: var(--ink);
        color: #fff;
        padding: 22px 32px 20px;
        position: relative;
        overflow: hidden;
      }
      .udes-title-strip::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(59,130,246,0.22) 0%, rgba(139,92,246,0.18) 50%, rgba(236,72,153,0.14) 100%);
      }
      .uts-inner {
        position: relative;
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 24px;
      }
      .uts-label {
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 0.45em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.35);
        margin-bottom: 6px;
      }
      .uts-title {
        font-family: 'DM Serif Display', serif;
        font-size: 26px;
        font-weight: 400;
        line-height: 1.2;
      }
      .uts-title em {
        font-style: italic;
        background: linear-gradient(90deg, #93c5fd, #c4b5fd, #f9a8d4);
        -webkit-background-clip: text;
        background-clip: text;
        color: transparent;
      }
      .uts-right {
        display: flex;
        flex-wrap: wrap;
        gap: 8px;
        justify-content: flex-end;
      }
      .chip {
        padding: 5px 13px;
        border-radius: 999px;
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .chip-outline {
        border: 1px solid rgba(255,255,255,0.2);
        color: rgba(255,255,255,0.6);
        background: rgba(255,255,255,0.06);
      }
      .chip-accent {
        background: linear-gradient(90deg, var(--accent), var(--purple));
        color: #fff;
      }
      .section-pad,
      .table-section {
        padding: 36px 48px;
        border-bottom: 1px solid var(--line);
      }
      .section-label {
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.4em;
        text-transform: uppercase;
        color: var(--ink-muted);
        margin-bottom: 20px;
        display: flex;
        align-items: center;
        gap: 12px;
      }
      .section-label::after {
        content: '';
        flex: 1;
        height: 1px;
        background: var(--line);
      }
      .docente-grid {
        display: grid;
        grid-template-columns: auto 1fr auto;
        gap: 24px;
        align-items: center;
      }
      .docente-avatar {
        width: 72px;
        height: 72px;
        background: var(--ink);
        border-radius: 18px;
        display: flex;
        align-items: center;
        justify-content: center;
        color: #fff;
        font-family: 'DM Serif Display', serif;
        font-size: 28px;
        font-style: italic;
      }
      .docente-name {
        font-size: 26px;
        font-weight: 900;
        letter-spacing: -0.02em;
        text-transform: uppercase;
        margin-bottom: 6px;
      }
      .docente-sub {
        display: flex;
        flex-wrap: wrap;
        gap: 6px 20px;
        font-size: 10px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.12em;
        color: var(--ink-muted);
      }
      .docente-badge {
        display: inline-block;
        padding: 8px 16px;
        background: var(--ink);
        color: #fff;
        border-radius: 10px;
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.15em;
        text-transform: uppercase;
      }
      .docente-detail-row {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        border-top: 1px solid var(--line);
        margin-top: 24px;
      }
      .docente-detail-cell {
        padding: 18px 20px;
        border-right: 1px solid var(--line);
      }
      .docente-detail-cell:last-child { border-right: none; }
      .detail-label {
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: var(--ink-muted);
        margin-bottom: 5px;
      }
      .detail-value { font-size: 13px; font-weight: 700; }
      .stats-row {
        display: grid;
        grid-template-columns: repeat(4, 1fr);
      }
      .stat-cell {
        padding: 28px 24px;
        border-right: 1px solid var(--line);
        position: relative;
      }
      .stat-cell:last-child {
        border-right: none;
        background: var(--danger-bg);
      }
      .stat-label {
        font-size: 9px;
        font-weight: 900;
        text-transform: uppercase;
        letter-spacing: 0.2em;
        color: var(--ink-muted);
        margin-bottom: 12px;
      }
      .stat-cell:last-child .stat-label { color: var(--danger); }
      .stat-number {
        font-family: 'DM Serif Display', serif;
        font-size: 44px;
        letter-spacing: -2px;
        line-height: 1;
        margin-bottom: 6px;
      }
      .stat-cell:last-child .stat-number { color: var(--danger); }
      .stat-sub {
        font-size: 9px;
        font-weight: 700;
        text-transform: uppercase;
        letter-spacing: 0.1em;
        color: var(--ink-muted);
      }
      .stat-bar {
        position: absolute;
        bottom: 0;
        left: 0;
        right: 0;
        height: 3px;
      }
      .narrative-list { display: flex; flex-direction: column; }
      .narrative-item {
        padding: 28px 0;
        border-bottom: 1px solid var(--line);
        display: grid;
        grid-template-columns: 44px 1fr;
        gap: 20px;
      }
      .narrative-item:last-child { border-bottom: none; }
      .narrative-num {
        font-family: 'DM Serif Display', serif;
        font-size: 32px;
        font-style: italic;
        color: var(--line);
        line-height: 1;
      }
      .narrative-heading {
        font-size: 10px;
        font-weight: 900;
        letter-spacing: 0.25em;
        text-transform: uppercase;
        color: var(--ink-muted);
        margin-bottom: 10px;
      }
      .narrative-dot-bar {
        display: inline-flex;
        align-items: center;
        gap: 6px;
      }
      .n-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
      }
      .narrative-copy {
        font-size: 13px;
        color: var(--ink-soft);
        line-height: 1.8;
        text-align: justify;
        margin-bottom: 8px;
      }
      .narrative-copy:last-child { margin-bottom: 0; }
      .resolution-strip {
        background: var(--ink);
        color: #fff;
        padding: 40px 48px;
        position: relative;
        overflow: hidden;
      }
      .resolution-strip::before {
        content: '';
        position: absolute;
        inset: 0;
        background: linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(139,92,246,0.12) 100%);
      }
      .res-label,
      .res-headline,
      .res-subline,
      .res-panels {
        position: relative;
      }
      .res-label {
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.5em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.3);
        margin-bottom: 20px;
      }
      .res-headline {
        font-family: 'DM Serif Display', serif;
        font-size: 30px;
        font-weight: 400;
        line-height: 1.3;
        margin-bottom: 8px;
        max-width: 800px;
      }
      .res-headline u { text-decoration-color: rgba(255,255,255,0.3); }
      .res-subline {
        font-size: 10px;
        font-weight: 700;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.35);
        margin-bottom: 36px;
      }
      .res-panels {
        display: grid;
        grid-template-columns: repeat(3, 1fr);
        gap: 16px;
      }
      .res-panel {
        background: rgba(255,255,255,0.07);
        border: 1px solid rgba(255,255,255,0.1);
        border-radius: 16px;
        padding: 20px;
      }
      .res-panel-title {
        font-size: 9px;
        font-weight: 900;
        letter-spacing: 0.2em;
        text-transform: uppercase;
        color: rgba(255,255,255,0.45);
        margin-bottom: 10px;
      }
      .res-panel-copy {
        font-size: 12px;
        color: rgba(255,255,255,0.65);
        line-height: 1.75;
        text-align: justify;
        margin-bottom: 8px;
      }
      .res-panel-copy:last-child { margin-bottom: 0; }
      .master-table,
      .cepi-table {
        width: 100%;
        border-collapse: collapse;
        font-size: 11px;
      }
      .master-table thead tr,
      .cepi-table thead tr {
        background: var(--bg);
        border-bottom: 2px solid var(--line);
      }
      .master-table th,
      .cepi-table th {
        padding: 12px 14px;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--ink-muted);
        text-align: left;
      }
      .master-table td,
      .cepi-table td {
        padding: 12px 14px;
        border-bottom: 1px solid var(--line);
        vertical-align: middle;
      }
      .master-table tbody tr:last-child td,
      .cepi-table tbody tr:last-child td { border-bottom: none; }
      .td-section {
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 0.12em;
        text-transform: uppercase;
        color: var(--ink-muted);
      }
      .td-criterio { font-size: 12px; font-weight: 900; }
      .td-doc { font-size: 10px; color: var(--ink-soft); }
      .td-num {
        text-align: right;
        font-size: 12px;
        font-weight: 700;
      }
      .td-meritx {
        text-align: right;
        font-size: 13px;
        font-weight: 900;
        background: var(--bg);
      }
      .badge {
        display: inline-block;
        padding: 4px 10px;
        border-radius: 999px;
        font-size: 8px;
        font-weight: 900;
        letter-spacing: 0.1em;
        text-transform: uppercase;
      }
      .badge-ok { background: var(--green-bg); color: var(--green); }
      .badge-sat { background: var(--sat-bg); color: #fff; }
      .badge-warn { background: var(--warn-bg); color: var(--warn); }
      .badge-none { background: var(--danger-bg); color: var(--danger); }
      .tc { text-align: center; }
      .tr { text-align: right; }
      .tf { font-weight: 700; }
      .tmu { color: var(--ink-muted); }
      .tok { color: var(--green); font-weight: 800; }
      .twn { color: var(--warn); font-weight: 800; }
      .report-footer {
        padding: 24px 48px;
        display: flex;
        justify-content: space-between;
        align-items: center;
        border-top: 1px solid var(--line);
      }
      .footer-copy,
      .footer-date {
        font-size: 9px;
        font-weight: 800;
        letter-spacing: 0.15em;
        text-transform: uppercase;
        color: var(--ink-muted);
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
        .screen-wrap {
          margin: 32px auto;
        }
      }
      @media print {
        * {
          -webkit-print-color-adjust: exact !important;
          print-color-adjust: exact !important;
        }
        body {
          background: #fff;
        }
        .screen-wrap {
          margin: 0;
          border-radius: 0;
          box-shadow: none;
          max-width: 100%;
        }
        .narratives-section {
          page-break-before: always;
        }
        .table-section {
          page-break-before: always;
        }
        .table-section + .table-section {
          page-break-before: auto;
        }
        .master-table tbody tr,
        .cepi-table tbody tr,
        .narrative-item,
        .res-panel {
          page-break-inside: avoid;
        }
        .report-footer {
          page-break-inside: avoid;
        }
        @page {
          size: letter portrait;
          margin: 1.5cm 1.2cm;
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
  aiEngine,
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
    programa: selectedAnalysisRequest.programa || 'No disponible',
    fechaPostulacion: generatedLabel.toLocaleDateString('es-CO', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    }),
  };

  const teacherInitials = teacherData.nombre
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('') || 'MX';

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
          <td class="td-section">${escapeHtml(row.seccion)}</td>
          <td class="td-criterio">${escapeHtml(row.criterio)}</td>
          <td class="td-doc">${escapeHtml(row.doc)}</td>
          <td>
            <span class="badge ${
              row.estado === 'VALIDADO' || row.estado === 'CON SOPORTE'
                ? 'badge-ok'
                : row.estado === 'SATURADO'
                  ? 'badge-sat'
                  : row.estado === 'SIN SOPORTE'
                    ? 'badge-none'
                    : 'badge-warn'
            }">${escapeHtml(row.estado)}</span>
          </td>
          <td class="td-num tc">${escapeHtml(row.cant)}</td>
          <td class="td-num tr tmu">${escapeHtml(row.valor)}</td>
          <td class="td-num tr">${escapeHtml(row.pMatriz)}</td>
          <td class="td-num tr">${escapeHtml(row.pMotor)}</td>
          <td class="td-meritx tr">${escapeHtml(row.pIA)}</td>
        </tr>
      `,
    )
    .join('');

  const narrativeHtml = narratives
    .map(
      (item, index) => `
        <div class="narrative-item">
          <div class="narrative-num">${String(index + 1).padStart(2, '0')}</div>
          <div>
            <div class="narrative-heading">
              <span class="narrative-dot-bar">
                <span class="n-dot" style="background:${item.color}"></span>
                ${escapeHtml(item.title.replace(/^\d+\.\s*/, ''))}
              </span>
            </div>
            ${renderParagraphs(item.text, 'narrative-copy')}
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
          <td class="tf">${escapeHtml(publication.publicationTitle)}</td>
          <td class="tc tmu">${escapeHtml(source)}</td>
          <td class="tc tmu">${escapeHtml(quartile)}</td>
          <td class="tc tmu">${escapeHtml(String(publication.publicationYear || '-'))}</td>
          <td class="tr tf">${escapeHtml(unitScore)}</td>
          <td class="tr tf">${escapeHtml(appliedScore)}</td>
          <td class="${supportClass === 'cepi-warn' ? 'twn' : 'tok'}">${escapeHtml(supportText)}</td>
        </tr>
      `;
    })
    .join('');

  const cepiSectionHtml = selectedAnalysis.publications.length > 0
    ? `
      <section class="table-section">
        <div class="section-label">Auditoría CEPI por artículo</div>
        <p style="font-size:11px;color:var(--ink-soft);margin:0 0 20px;font-weight:500;">Desglose de validación por fuente, cuartil y efecto en puntaje individual de producción intelectual.</p>
        <table class="cepi-table">
          <thead>
            <tr>
              <th>Artículo</th>
              <th class="tc">Fuente</th>
              <th class="tc">Cuartil</th>
              <th class="tc">Año</th>
              <th class="tr">P. Unitario</th>
              <th class="tr">P. Aplicado</th>
              <th>Estado de soporte</th>
            </tr>
          </thead>
          <tbody>${cepiRowsHtml}</tbody>
        </table>
      </section>
    `
    : '';

  const resolutionHtml = resolutionCards
    .map(
      (item) => `
        <div class="res-panel">
          <h5 class="res-panel-title">${escapeHtml(item.title)}</h5>
          ${renderParagraphs(item.text, 'res-panel-copy')}
        </div>
      `,
    )
    .join('');

  return buildShell(
    `MeritX IA | Informe de ${teacherData.nombre}`,
    `
    <div class="screen-wrap">
      <div class="udes-header">
        <div class="udes-logo-block">
          <img class="logo-img" src="${logoSrc()}" alt="UDES" />
        </div>
        <div class="udes-info-block">
          <div class="udes-sys-title">Sistema de Gestión de la Calidad VAF</div>
          <div class="udes-sys-sub">Vicerrectoría Administrativa y Financiera</div>
          <div class="udes-doc-title">Reporte MeritX - Categorización Docente</div>
          <div class="udes-doc-code">TAH-FT-004-UDES</div>
        </div>
        <div class="udes-version-block">Versión: 05</div>
      </div>

      <div class="udes-title-strip">
        <div class="uts-inner">
          <div>
            <div class="uts-label">Auditoría Técnica</div>
            <div class="uts-title">Reporte <em>MeritX IA</em> de Categorización</div>
          </div>
          <div class="uts-right">
            ${aiEngine ? `<span class="chip chip-accent">Motor IA: ${escapeHtml(typeof aiEngine === 'string' ? aiEngine : String(aiEngine.provider).toUpperCase() + ' · ' + aiEngine.model)}</span>` : ''}
            <span class="chip chip-outline">Historial</span>
            <span class="chip chip-outline">Talento Humano UDES</span>
          </div>
        </div>
      </div>

      <div class="section-pad">
        <div class="section-label">Datos del docente</div>
        <div class="docente-grid">
          <div class="docente-avatar">${escapeHtml(teacherInitials)}</div>
          <div>
            <div class="docente-name">${escapeHtml(teacherData.nombre)}</div>
            <div class="docente-sub">
              <span>ID: ${escapeHtml(teacherData.id)}</span>
              <span>Radicado: ${escapeHtml(teacherData.radicado)}</span>
            </div>
          </div>
          <div class="docente-badge">Expediente Validado</div>
        </div>
        <div class="docente-detail-row">
          <div class="docente-detail-cell">
            <div class="detail-label">Facultad</div>
            <div class="detail-value">${escapeHtml(teacherData.facultad)}</div>
          </div>
          <div class="docente-detail-cell">
            <div class="detail-label">Programa</div>
            <div class="detail-value">${escapeHtml(teacherData.programa)}</div>
          </div>
          <div class="docente-detail-cell">
            <div class="detail-label">Fecha de postulación</div>
            <div class="detail-value">${escapeHtml(teacherData.fechaPostulacion)}</div>
          </div>
        </div>
      </div>

      <div class="stats-row">
        <div class="stat-cell">
          <div class="stat-label">Matriz Bruta</div>
          <div class="stat-number">${formatNumber(stats.matriz.pts)}</div>
          <div class="stat-sub">${escapeHtml(stats.matriz.cat)}</div>
          <div class="stat-bar" style="background:linear-gradient(90deg,#3b82f6,#6366f1)"></div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">Motor (Algoritmo)</div>
          <div class="stat-number">${formatNumber(stats.motor.pts)}</div>
          <div class="stat-sub">${escapeHtml(stats.motor.cat)}</div>
          <div class="stat-bar" style="background:linear-gradient(90deg,#8b5cf6,#a855f7)"></div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">Sugerencia MeritX</div>
          <div class="stat-number">${formatNumber(stats.ia.pts)}</div>
          <div class="stat-sub">${escapeHtml(stats.ia.cat)}</div>
          <div class="stat-bar" style="background:linear-gradient(90deg,#6366f1,#ec4899)"></div>
        </div>
        <div class="stat-cell">
          <div class="stat-label">Puntos en Discordia</div>
          <div class="stat-number">-${formatNumber(stats.discordia)}</div>
          <div class="stat-sub">Pendiente justificación</div>
        </div>
      </div>

      <div class="section-pad narratives-section">
        <div class="section-label">Análisis narrativo</div>
        <div class="narrative-list">${narrativeHtml}</div>
      </div>

      <div class="resolution-strip">
        <div class="res-label">Ratificación técnica del dictamen</div>
        <div class="res-headline">
          Se ratifica el puntaje de <u>${formatNumber(meritxNarrative.puntajeIntermedio)} puntos</u> bajo una hipótesis técnica de categoría <span style="opacity:.65">${escapeHtml(selectedAnalysis.suggested.finalCat.name)}</span>.
        </div>
        <div class="res-subline">Basado en el consenso del estudio de datos MeritX IA</div>
        <div class="res-panels">${resolutionHtml}</div>
      </div>

      <section class="table-section">
        <div class="section-label">Consolidado maestro de datos y puntajes</div>
        <table class="master-table">
          <thead>
            <tr>
              <th>Sección</th>
              <th>Criterio</th>
              <th>Documento</th>
              <th>Estado</th>
              <th class="tc">Cant.</th>
              <th class="tr">Valor</th>
              <th class="tr">P. Matriz</th>
              <th class="tr">P. Motor</th>
              <th class="tr">P. MeritX</th>
            </tr>
          </thead>
          <tbody>${rowsHtml}</tbody>
        </table>
      </section>

      ${cepiSectionHtml}

      <footer class="report-footer">
        <span class="footer-copy">Sistema de Auditoría MeritX IA - Reporte Técnico de Escalafón</span>
        <span class="footer-date">${escapeHtml(generatedLabelText)}</span>
      </footer>
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