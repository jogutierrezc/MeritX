import { MeritxReportPayload } from './meritxReportWindow';
import { normalizeText } from './helpers';

const formatNumber = (val: number) =>
    val.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 });

const escapeHtml = (unsafe: string) => {
    return unsafe
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#039;');
};

export const buildPrintFormatHtml = ({
    selectedAnalysisRequest,
    selectedAnalysis,
    currentLanguages
}: MeritxReportPayload) => {
    const generatedLabel = new Date().toLocaleDateString('es-CO', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
    });

    const barrier = selectedAnalysis.suggested.barrierDiagnosis;
    const isMissingTitle = barrier?.missingTitle ? 'X' : '';
    const isMissingPts = barrier?.missingPts ? 'X' : '';
    const isMissingExp = (barrier?.missingPts && selectedAnalysis.suggested.ptsExpBruta === 0) ? 'X' : '';
    const isMissingProd = (barrier?.missingPts && selectedAnalysis.suggested.ptsPI === 0) ? 'X' : '';

    // Calcular puntaje total PRIMERO (antes de usarlo en narrativa)
    let totalPoints = 0;
    selectedAnalysis.rows.forEach(row => {
            totalPoints += row.puntaje || 0;
    });
    const computedTotal = formatNumber(totalPoints);

    // Narrativa de justificación basada en barreras
    let justificacionNarrativa = '';
    if (barrier) {
        const barrierTexts: string[] = [];
        if (barrier.missingTitle) {
            barrierTexts.push(`No cumple con la formación académica mínima requerida (requiere ${barrier.requiredTitle})`);
        }
        if (barrier.missingIdioma) {
            barrierTexts.push(`No acredita el nivel de idioma mínimo requerido (requiere nivel ${barrier.requiredIdioma})`);
        }
        if (barrier.missingPts) {
            barrierTexts.push(`Puntaje insuficiente (actualmente tiene ${computedTotal} puntos, requiere ${barrier.requiredPts} puntos)`);
        }
        
        if (barrierTexts.length > 0) {
            justificacionNarrativa = `Se asigna la categoría ${escapeHtml(selectedAnalysis.suggested.finalCat.name.toUpperCase())} debido a que el docente no cumple con los requisitos mínimos para la categoría inmediatamente superior: ${barrierTexts.join('; ')}. `;
            if (selectedAnalysis.suggested.appliedTope > 0 && selectedAnalysis.suggested.appliedTope < selectedAnalysis.suggested.ptsExpBruta) {
                justificacionNarrativa += `Adicionalmente, la experiencia laboral se aplicó con tope normativo de ${formatNumber(selectedAnalysis.suggested.appliedTope)} años conforme a la normativa institucional.`;
            }
        } else {
            justificacionNarrativa = `El docente cumple con los parámetros establecidos para la categoría ${escapeHtml(selectedAnalysis.suggested.finalCat.name.toUpperCase())} según la matriz de escalafón. Puntaje total: ${computedTotal} puntos.`;
        }
    } else {
        justificacionNarrativa = `El docente cumple con los parámetros establecidos para la categoría ${escapeHtml(selectedAnalysis.suggested.finalCat.name.toUpperCase())} según la matriz de escalafón. Puntaje total: ${computedTotal} puntos.`;
    }

    // Also idioma is not explicitly in the checkboxes, maybe we add it or add to "Observaciones"
    const observaciones = '';

    const titleValueByLevel = (level: string) => {
        const normalized = normalizeText(level);
        if (normalized.includes('doctor')) return 400;
        if (normalized.includes('maestr') || normalized.includes('magister')) return 200;
        if (normalized.includes('especial')) return 90;
        return 300;
    };

    const sumYears = (type: string) => {
        return selectedAnalysis.experiences
            .filter((e) => normalizeText(e.experienceType).includes(normalizeText(type)))
            .reduce((acc, e) => {
                const from = new Date(e.startedAt);
                const to = e.endedAt ? new Date(e.endedAt) : new Date();
                if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || to < from) return acc;
                return acc + ((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24 * 365.25));
            }, 0);
    };

    // 1. Estudios Cursados
    const titlesRows = selectedAnalysis.titles.map((t) => {
        const valorNum = titleValueByLevel(t.titleLevel || '');
        const cant = 1;
        const valor = formatNumber(valorNum);
        const puntaje = formatNumber(valorNum);
        return `
      <tr>
        <td>${escapeHtml(t.titleLevel || '')}</td>
        <td>${escapeHtml(t.titleName || '')}</td>
        <td class="text-center">${cant}</td>
        <td class="text-center">${valor}</td>
        <td class="text-center">${puntaje}</td>
      </tr>
    `;
    });

    const languagesRows = (currentLanguages || []).map((l: any) => {
                const row = selectedAnalysis.rows.find((r) => r.section === 'Estudios Cursados' && normalizeText(r.criterio) === 'idioma extranjero');
                const cant = 1;
                const valor = row ? formatNumber(row.valor) : formatNumber(30);
                const puntaje = row ? formatNumber(row.valor) : '0.0';
        return `
      <tr>
        <td>IDIOMA EXTRANJERO (${escapeHtml(l.languageLevel)})</td>
        <td>${escapeHtml(l.languageName)}</td>
        <td class="text-center">${cant}</td>
        <td class="text-center">${valor}</td>
        <td class="text-center">${puntaje}</td>
      </tr>
    `;
    });

    const estudiosHtml = [...titlesRows, ...languagesRows].join('');

    // 2. Experiencia Laboral y Docente
        const expCriteria = [
                { label: 'EXPERIENCIA LABORAL PROFESIONAL', key: 'profesional', defaultValor: 20 },
                { label: 'EXPERIENCIA LABORAL DOCENCIA', key: 'docencia', defaultValor: 30 },
                { label: 'EXPERIENCIA INVESTIGACIÓN', key: 'investig', defaultValor: 40 },
        ];

        const expRowsHtml = expCriteria.map((criterion) => {
                const row = selectedAnalysis.rows.find(
                        (r) => r.section === 'Experiencia' && normalizeText(r.criterio).includes(criterion.key),
                );
                // Solo mostrar si hay puntaje > 0
                if (!row || row.puntaje === 0) return '';
                
                const years = row.cantidad || 0;
                const valor = row.valor || 0;
                const puntaje = row.puntaje || 0;
                const detalle = row.detalle ? `${escapeHtml(row.detalle)}` : '';

                return `
                <tr class="row-data">
                    <td class="label-cell">${escapeHtml(criterion.label)}</td>
                    <td class="input-cell">${detalle}</td>
                    <td class="num-cell">${formatNumber(years)}</td>
                    <td class="num-cell">${formatNumber(valor)}</td>
                    <td class="zero-cell">${formatNumber(puntaje)}</td>
                </tr>
            `;
        }).join('');

        const productionRows = selectedAnalysis.rows.filter((r) => r.section === 'Otros');
        const productionRowsHtml = productionRows
                .map((r) => {
                        const supportInfo = r.hasSupport ? `${escapeHtml(r.supportNote || 'Soporte adjunto')}` : '';
                        return `
            <tr class="row-data">
                <td class="label-cell">${escapeHtml(r.criterio)}</td>
                <td class="input-cell">${supportInfo}</td>
                <td class="num-cell">${formatNumber(r.cantidad)}</td>
                <td class="num-cell">${formatNumber(r.valor)}</td>
                <td class="zero-cell">${formatNumber(r.puntaje)}</td>
            </tr>
        `;
                })
                .join('');

        const matrixSubtotal = selectedAnalysis.matrixTotal;
        const normativeFinal = selectedAnalysis.suggested.finalPts;
        const experienceApplied = Math.min(selectedAnalysis.suggested.ptsExpBruta, selectedAnalysis.suggested.appliedTope);

    // Soportes Presentados
    const soportesPresentados = selectedAnalysis.rows
        .filter(r => r.hasSupport)
        .map(r => `<li style="margin-bottom: 3px;">${escapeHtml(r.criterio)}: ${escapeHtml(r.supportNote || 'Soporte adjunto')}</li>`)
        .join('');

    return `
<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Categorización TAH-FT-004-UDES</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=Arial+Narrow&display=swap');

  * {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
  }

  body {
    font-family: Arial, Helvetica, sans-serif;
    font-size: 10px;
    background: #ffffff;
    display: flex;
    justify-content: center;
    align-items: flex-start;
    padding: 10px;
  }

  .page {
    width: 820px;
    background: #fff;
    padding: 18px 22px 22px 22px;
    box-shadow: none;
    font-family: Arial, Helvetica, sans-serif;
  }

  /* ── HEADER ── */
  .header {
    display: flex;
    align-items: stretch;
    border: 1.5px solid #222;
    margin-bottom: 10px;
    font-family: Arial, Helvetica, sans-serif;
  }

  .header-logo {
    width: 180px;
    min-height: 62px;
    border-right: 1.5px solid #222;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 6px 8px;
    gap: 4px;
    font-family: Arial, Helvetica, sans-serif;
  }

  .logo-icons {
    display: flex;
    gap: 6px;
    align-items: center;
    margin-bottom: 2px;
  }

  .logo-box {
    border: 1.5px solid #1a3a6e;
    border-radius: 3px;
    padding: 2px 4px;
    font-size: 7px;
    font-weight: bold;
    color: #1a3a6e;
    line-height: 1.1;
    text-align: center;
  }

  .logo-iqnet {
    background: #1a3a6e;
    color: #fff;
    font-size: 7px;
    font-weight: bold;
    padding: 2px 5px;
    border-radius: 3px;
    line-height: 1.1;
    text-align: center;
  }

  .logo-title {
    text-align: center;
  }

  .logo-title span.univ {
    font-size: 13px;
    font-weight: 900;
    color: #1a3a6e;
    display: block;
    line-height: 1;
  }

  .logo-title span.sub {
    font-size: 8px;
    color: #1a3a6e;
    font-weight: bold;
    display: block;
    letter-spacing: 0.5px;
  }

  .logo-title span.udes {
    font-size: 9px;
    color: #e8311b;
    font-weight: 900;
    display: block;
  }

  .logo-vigilada {
    font-size: 6.5px;
    color: #555;
    text-align: center;
  }

  .logo-sc {
    font-size: 6px;
    color: #1a3a6e;
    font-weight: bold;
  }

  .header-info {
    flex: 1;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    padding: 5px 12px;
    border-right: 1.5px solid #222;
    text-align: center;
  }

  .header-info .sys-title {
    font-size: 9.5px;
    font-weight: bold;
    color: #222;
    margin-bottom: 1px;
  }

  .header-info .sys-sub {
    font-size: 8.5px;
    color: #222;
    margin-bottom: 5px;
  }

  .header-info .doc-title {
    font-style: italic;
    font-weight: bold;
    font-size: 9px;
    color: #222;
    text-transform: uppercase;
    margin-bottom: 1px;
  }

  .header-info .doc-code {
    font-style: italic;
    font-size: 9px;
    color: #222;
    text-transform: uppercase;
  }

  .header-version {
    width: 90px;
    display: flex;
    align-items: center;
    justify-content: center;
    font-size: 9px;
    font-weight: bold;
    color: #222;
    padding: 5px;
    text-align: center;
  }

  /* ── FIELDS ROW ── */
  .fields-row {
    display: flex;
    border: 1px solid #222;
    margin-bottom: 6px;
  }

  .field-cell {
    flex: 1;
    padding: 4px 7px;
    border-right: 1px solid #222;
    font-size: 9.5px;
    min-height: 20px;
    display: flex;
    align-items: center;
    gap: 5px;
    font-family: Arial, Helvetica, sans-serif;
  }

  .field-cell:last-child {
    border-right: none;
  }

  .field-cell label {
    font-weight: bold;
    color: #222;
    white-space: nowrap;
    font-family: Arial, Helvetica, sans-serif;
  }

  .field-cell .underline {
    flex: 1;
    border-bottom: 1px solid #aaa;
    min-width: 40px;
    height: 14px;
  }

  /* ── MAIN TABLE ── */
  .main-table {
    width: 100%;
    border-collapse: collapse;
    border: 1.5px solid #222;
  }

  .main-table td,
  .main-table th {
    border: 1px solid #333;
    padding: 0;
    vertical-align: middle;
  }

  /* Blue header rows */
  .row-blue {
    background: #2155a0;
      font-family: Arial, Helvetica, sans-serif;
    color: #fff;
    font-weight: bold;
    font-size: 9px;
  }

  .row-blue td {
    padding: 5px 8px;
    border-color: #1a4080;
  }

  /* Section header rows (medium blue) */
  .row-section {
    background: #2e6bb5;
      font-family: Arial, Helvetica, sans-serif;
    color: #fff;
    font-weight: bold;
    font-size: 9px;
  }

  .row-section td {
    padding: 4px 8px;
    border-color: #1a4080;
    text-align: center;
  }

  /* Column header row */
  .row-colheader {
    background: #3a7dc9;
      font-family: Arial, Helvetica, sans-serif;
    color: #fff;
    font-weight: bold;
    font-size: 8.5px;
    text-align: center;
  }

  .row-colheader td {
    padding: 4px 6px;
    border-color: #1a4080;
    text-align: center;
  }

  /* Data rows */
  .row-data td {
    padding: 3px 7px;
    font-size: 8.5px;
    color: #111;
    height: 20px;
    font-family: Arial, Helvetica, sans-serif;
  }

  .row-data td.label-cell {
    font-size: 8.5px;
    text-transform: uppercase;
    color: #111;
    width: 210px;
  }

  .row-data td.input-cell {
    background: #fff;
    border-bottom: 1px solid #aaa;
  }

  .row-data td.num-cell {
    text-align: center;
    font-size: 9px;
    width: 55px;
  }

  .row-data td.zero-cell {
    text-align: center;
    font-size: 9px;
    width: 55px;
    color: #111;
  }

  /* Categoria footer row */
  .row-categoria {
    background: #2155a0;
    color: #fff;
    font-weight: bold;
    font-size: 10px;
  }

  .row-categoria td {
    padding: 6px 8px;
    border-color: #1a4080;
  }

  .row-categoria td.total-label {
    text-align: right;
    font-size: 9px;
    font-weight: bold;
    letter-spacing: 0.5px;
  }

  .row-categoria td.total-val {
    text-align: center;
    font-size: 11px;
    font-weight: 900;
    background: #2155a0;
    color: #fff;
    width: 55px;
  }

  /* ── FOOTER ── */
  .footer-row {
    display: flex;
    justify-content: space-between;
    margin-top: 10px;
      font-family: Arial, Helvetica, sans-serif;
    font-size: 9px;
    color: #222;
  }

  .footer-row span {
    font-weight: bold;
  }

  /* ── PRINT ── */
  @media print {
    body {
      background: #fff;
      padding: 0;
    }
    .page {
      box-shadow: none;
      padding: 10px 14px;
      width: 100%;
    }
    @page {
      size: A4 landscape;
      margin: 10mm;
    }
  }
</style>
</head>
<body>
<div class="page">

  <!-- ══ HEADER ══ -->
  <div class="header">
    <div class="header-logo">
      <img src="/UdesImprimible.png" alt="UDES Logo" style="max-height: 60px; max-width: 100%; object-fit: contain;">
    </div>

    <div class="header-info">
      <div class="sys-title">Sistema de Gestión de la Calidad VAF</div>
      <div class="sys-sub">Vicerrectoría Administrativa y Financiera</div>
      <div class="doc-title">Categorización</div>
      <div class="doc-code">TAH-FT-004-UDES</div>
    </div>

    <div class="header-version">Versión: 05</div>
  </div>

  <!-- ══ CAMPUS / PERIODO / FECHA ══ -->
  <div class="fields-row">
    <div class="field-cell" style="flex:1.2;">
      <label>Campus:</label>
      <div class="underline">BUCARAMANGA</div>
    </div>
    <div class="field-cell" style="flex:0.9;">
      <label>Período:</label>
      <div class="underline">2026-01</div>
    </div>
    <div class="field-cell" style="flex:0.9; border-right:none;">
      <label>Fecha:</label>
      <div class="underline">${generatedLabel}</div>
    </div>
  </div>

  <!-- ══ CÉDULA / NOMBRES ══ -->
  <table class="main-table">
    <tbody>

      <!-- Cédula + Nombres -->
      <tr class="row-blue">
        <td style="width:110px; padding:5px 8px; font-size:9px; font-weight:bold; border-right:1px solid #1a4080;">CÉDULA:</td>
        <td style="padding:5px 8px;" colspan="4">
          <span style="font-size:9px; font-weight:bold;">NOMBRES Y APELLIDOS:</span>
        </td>
      </tr>

      <tr class="row-data">
        <td class="input-cell" style="width:110px; font-size:8.5px;">${escapeHtml(selectedAnalysisRequest.documento)}</td>
        <td class="input-cell" colspan="4" style="font-size:8.5px;">${escapeHtml(selectedAnalysisRequest.nombre)}</td>
      </tr>

      <!-- ADSCRITO AL AREA + columns -->
      <tr class="row-blue">
        <td colspan="2" style="padding:5px 8px; font-size:9px; font-weight:bold; border-right:1px solid #1a4080;">ADSCRITO AL AREA</td>
        <td class="row-colheader" style="width:50px;">Cantidad</td>
        <td class="row-colheader" style="width:50px;">Valor</td>
        <td class="row-colheader" style="width:50px;">Puntaje</td>
      </tr>

      <!-- ESTUDIOS CURSADOS header -->
      <tr class="row-section">
        <td style="width:210px; text-align:center; border-right:1px solid #1a4080;">Estudios Cursados</td>
        <td style="text-align:center; border-right:1px solid #1a4080;">Título Obtenido</td>
        <td colspan="3"></td>
      </tr>

      <!-- Data rows — Estudios -->
      ${estudiosHtml || '<tr class="row-data"><td colspan="5" class="label-cell">No se reportan estudios</td></tr>'}

      <!-- EXPERIENCIA header -->
      <tr class="row-section">
        <td style="width:210px; text-align:center; border-right:1px solid #1a4080;">Experiencia</td>
        <td style="text-align:center; border-right:1px solid #1a4080;">Entidad/Institución</td>
        <td class="row-colheader" style="width:50px;">Años</td>
        <td class="row-colheader" style="width:50px;">Valor</td>
        <td class="row-colheader" style="width:50px;">Puntaje</td>
      </tr>

      <!-- Data rows — Experiencia -->
      ${expRowsHtml || '<tr class="row-data"><td colspan="5" class="label-cell">No se reporta experiencia</td></tr>'}

      <!-- OTROS header -->
      <tr class="row-section">
        <td style="width:210px; text-align:center; border-right:1px solid #1a4080;">Conceptos/Soportes</td>
        <td style="text-align:center; border-right:1px solid #1a4080;">Descripción del Soporte</td>
        <td class="row-colheader" style="width:50px;">Cant.</td>
        <td class="row-colheader" style="width:50px;">Valor</td>
        <td class="row-colheader" style="width:50px;">Puntaje</td>
      </tr>

      <!-- Data rows — Producción intelectual y Otros -->
      ${productionRowsHtml || '<tr class="row-data"><td colspan="5" class="label-cell">No se reporta producción intelectual</td></tr>'}

      <!-- CATEGORÍA footer -->
      <tr class="row-categoria">
        <td style="padding:6px 8px; font-size:10px; font-weight:900; letter-spacing:1px;" colspan="2">CATEGORÍA: ${escapeHtml(selectedAnalysis.suggested.finalCat.name.toUpperCase())}</td>
        <td class="total-label" colspan="2" style="padding:6px 8px; font-size:9px; background:#2155a0; color:#fff; text-align:right; font-weight:bold;">PUNTAJE TOTAL</td>
        <td class="total-val">${computedTotal}</td>
      </tr>

      <!-- Observaciones de Categorización -->
      <tr class="row-data" style="height: auto;">
        <td colspan="5" style="padding: 10px; border: 1px solid #333; vertical-align: top;">
          <div style="font-weight: bold; margin-bottom: 8px; color: #222; font-size: 9.5px;">OBSERVACIONES DE CATEGORIZACIÓN:</div>
          <div style="font-size: 8.5px; line-height: 1.6; color: #111; text-align: justify;">
            ${escapeHtml(justificacionNarrativa)}
          </div>
        </td>
      </tr>

         </tbody>
  </table>

  <!-- ══ FOOTER ══ -->
  <div class="footer-row">
    <div style="display: flex; flex-direction: column; align-items: center; gap: 20px; width: 100%;">
      <div style="display: flex; justify-content: space-between; width: 100%; gap: 40px;">
        <div style="flex: 1; text-align: center;">
          <div style="border-bottom: 1px solid #222; height: 30px; margin-bottom: 5px;"></div>
          <span style="font-weight: bold; font-size: 9px;">Elaborado por</span>
          
        </div>
        <div style="flex: 1; text-align: center;">
          <div style="border-bottom: 1px solid #222; height: 30px; margin-bottom: 5px;"></div>
          <span style="font-weight: bold; font-size: 9px;">Aprobado por</span>
          
        </div>
      </div>
    </div>
  </div>

</div>

</body>
</html>
  `;
};

export const openPrintFormatWindow = (payload: MeritxReportPayload) => {
    const popup = window.open('', '_blank', 'width=1000,height=960');
    if (!popup) return null;

    popup.document.open();
    popup.document.write(buildPrintFormatHtml(payload));
    popup.document.close();
    return popup;
};
