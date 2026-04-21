import { MeritxReportPayload } from './meritxReportWindow';

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
}: MeritxReportPayload) => {
  const generatedLabel = new Date().toLocaleDateString('es-CO', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });

  const barrier = selectedAnalysis.suggested.barrierDiagnosis;
  const isMissingTitle = barrier?.missingTitle ? 'X' : '';
  const isMissingPts = barrier?.missingPts ? 'X' : '';
  // Usually missing points implies missing production or experience.
  // We'll mark experience or production if they are missing points, though we can't definitively know which one.
  // Actually, we'll just mark "Puntaje Mínimo Requerido".
  
  // Also idioma is not explicitly in the checkboxes, maybe we add it or add to "Observaciones"
  const observaciones = barrier?.missingIdioma
    ? `No acredita el nivel de idioma requerido (${barrier.requiredIdioma}).`
    : '';

  // 1. Estudios Cursados
  const titlesRows = selectedAnalysis.titles.map((t) => {
    // Find the corresponding row in selectedAnalysis.rows to get the points
    const row = selectedAnalysis.rows.find(r => r.section === 'Estudios Cursados' && r.criterio === t.titleLevel);
    const cant = row ? 1 : '';
    const valor = row ? formatNumber(row.valor) : '';
    const puntaje = (row && row.hasSupport) ? formatNumber(row.puntaje) : '0.0';
    return `
      <tr>
        <td>${escapeHtml(t.titleLevel)}</td>
        <td>${escapeHtml(t.titleName)}</td>
        <td class="text-center">${cant}</td>
        <td class="text-center">${valor}</td>
        <td class="text-center">${puntaje}</td>
      </tr>
    `;
  });

  const languagesRows = selectedAnalysis.languages.map((l) => {
    const row = selectedAnalysis.rows.find(r => r.section === 'Estudios Cursados' && r.criterio === 'IDIOMA EXTRANJERO');
    const cant = row ? 1 : '';
    const valor = row ? formatNumber(row.valor) : '';
    const puntaje = (row && row.hasSupport) ? formatNumber(row.puntaje) : '0.0';
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
  const expRowsMap = new Map();
  selectedAnalysis.experiences.forEach(e => {
    const type = e.experienceType;
    if (!expRowsMap.has(type)) {
      expRowsMap.set(type, { years: 0 });
    }
  });
  
  // Get the calculated rows for experience
  const expRowsHtml = selectedAnalysis.rows
    .filter(r => r.section === 'Experiencia')
    .map(r => {
      const type = r.criterio;
      const years = formatNumber(r.cantidad);
      const valor = formatNumber(r.valor);
      const puntaje = r.hasSupport ? formatNumber(r.puntaje) : '0.0';
      return `
        <tr>
          <td>${escapeHtml(type)}</td>
          <td class="text-center">${years}</td>
          <td class="text-center">${valor}</td>
          <td class="text-center">${puntaje}</td>
        </tr>
      `;
    }).join('');

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
    <title>Formato de Categorización Docente - UDES</title>
    <style>
        :root {
            --udes-blue: #1a365d;
            --udes-green: #2d6a4f;
            --border-color: #000;
        }

        body {
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            font-size: 10pt;
            line-height: 1.3;
            color: #333;
            margin: 0;
            padding: 0;
            background-color: #f9f9f9;
        }

        /* Estilos de Impresión */
        @media print {
            body { background-color: white; }
            .no-print { display: none; }
            .page-container {
                box-shadow: none !important;
                margin: 0 !important;
                padding: 0.5cm !important;
                width: 100% !important;
            }
            .section-title { background-color: #e2e8f0 !important; -webkit-print-color-adjust: exact; }
            th { background-color: #f2f2f2 !important; -webkit-print-color-adjust: exact; }
            .section-title-dark { background-color: #1a365d !important; color: white !important; -webkit-print-color-adjust: exact; }
        }

        .page-container {
            background-color: white;
            width: 21cm; 
            min-height: 29.7cm;
            margin: 20px auto;
            padding: 1.2cm;
            box-shadow: 0 0 10px rgba(0,0,0,0.1);
            box-sizing: border-box;
        }

        /* Encabezado */
        .header-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
        }

        .header-table td {
            border: 1px solid var(--border-color);
            padding: 8px;
            text-align: center;
            vertical-align: middle;
        }

        .logo-cell { width: 25%; }
        .title-cell { width: 50%; font-weight: bold; font-size: 11pt; text-transform: uppercase; }
        .info-cell { width: 25%; font-size: 7.5pt; text-align: left !important; }

        /* Información General */
        .general-info { width: 100%; margin-bottom: 15px; }
        .info-row { display: flex; margin-bottom: 4px; border-bottom: 1px solid #eee; }
        .info-label { font-weight: bold; width: 140px; text-transform: uppercase; font-size: 8.5pt; }
        .info-value { flex-grow: 1; }

        /* Tablas */
        table.data-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; }
        table.data-table th, table.data-table td { border: 1px solid var(--border-color); padding: 5px; text-align: left; }
        table.data-table th { background-color: #f2f2f2; font-size: 8.5pt; text-transform: uppercase; text-align: center; }

        .section-title {
            background-color: #e2e8f0;
            font-weight: bold;
            padding: 4px 10px;
            margin-top: 15px;
            border: 1px solid var(--border-color);
            border-bottom: none;
            text-transform: uppercase;
            font-size: 9.5pt;
        }

        .text-center { text-align: center !important; }
        .text-bold { font-weight: bold; }

        /* Firmas */
        .signatures { margin-top: 35px; display: flex; justify-content: space-between; margin-bottom: 15px; }
        .signature-box { width: 45%; }
        .signature-line { border-top: 1px solid #000; margin-top: 40px; margin-bottom: 4px; }
        .signature-label { font-size: 8.5pt; font-weight: bold; }

        /* NUEVA SECCIÓN: Requisitos y Justificación */
        .requirements-container {
            margin-top: 20px;
            border: 1px solid var(--border-color);
            padding: 10px;
        }

        .justification-area {
            margin-top: 10px;
            font-size: 9pt;
        }

        .checkbox-group {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 5px;
            margin-top: 5px;
        }

        .checkbox-item {
            display: flex;
            align-items: center;
        }

        .box {
            width: 14px;
            height: 14px;
            border: 1px solid black;
            margin-right: 8px;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-weight: bold;
            font-size: 10px;
        }

        /* Botón Impresión */
        .print-btn {
            position: fixed;
            bottom: 20px;
            right: 20px;
            background: #2d6a4f;
            color: white;
            border: none;
            padding: 12px 24px;
            border-radius: 50px;
            cursor: pointer;
            font-weight: bold;
            box-shadow: 0 4px 6px rgba(0,0,0,0.2);
            z-index: 100;
        }

    </style>
</head>
<body>

    <button class="print-btn no-print" onclick="window.print()">🖨️ Imprimir Formato</button>

    <div class="page-container">
        <!-- Encabezado -->
        <table class="header-table">
            <tr>
                <td class="logo-cell">
                    <div style="font-weight: bold; color: var(--udes-green); font-size: 14pt;">UDES</div>
                    <div style="font-size: 7pt;">Universidad de Santander</div>
                </td>
                <td class="title-cell">FORMATO DE CATEGORIZACIÓN DOCENTE</td>
                <td class="info-cell">
                    <strong>Código:</strong> F-TH-02 <br>
                    <strong>Versión:</strong> 05 <br>
                    <strong>Fecha Aprob:</strong> 11/11/2025
                </td>
            </tr>
        </table>

        <!-- Datos Generales -->
        <div class="general-info">
            <div class="info-row">
                <span class="info-label">Campus:</span> <span class="info-value">BUCARAMANGA</span>
                <span class="info-label" style="width: 70px;">Periodo:</span> <span class="info-value">2026-01</span>
                <span class="info-label" style="width: 70px;">Fecha:</span> <span class="info-value">${generatedLabel}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Cédula:</span> <span class="info-value">${escapeHtml(selectedAnalysisRequest.documento)}</span>
                <span class="info-label">Nombres:</span> <span class="info-value">${escapeHtml(selectedAnalysisRequest.nombre)}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Programa:</span> <span class="info-value">${escapeHtml(selectedAnalysisRequest.programa || 'No especificado')}</span>
            </div>
            <div class="info-row">
                <span class="info-label">Facultad:</span> <span class="info-value">${escapeHtml(selectedAnalysisRequest.facultad || 'No especificada')}</span>
            </div>
        </div>

        <!-- Estudios Cursados -->
        <div class="section-title">1. Estudios Cursados</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 30%;">Nivel de Formación</th>
                    <th style="width: 40%;">Título Obtenido</th>
                    <th style="width: 10%;">Cant.</th>
                    <th style="width: 10%;">Valor</th>
                    <th style="width: 10%;">Puntaje</th>
                </tr>
            </thead>
            <tbody>
                ${estudiosHtml || '<tr><td colspan="5" class="text-center">No se reportan estudios</td></tr>'}
            </tbody>
        </table>

        <!-- Experiencia -->
        <div class="section-title">2. Experiencia Laboral y Docente</div>
        <table class="data-table">
            <thead>
                <tr>
                    <th style="width: 45%;">Tipo de Experiencia</th>
                    <th style="width: 25%;">Años</th>
                    <th style="width: 15%;">Valor x Año</th>
                    <th style="width: 15%;">Total</th>
                </tr>
            </thead>
            <tbody>
                ${expRowsHtml || '<tr><td colspan="4" class="text-center">No se reporta experiencia</td></tr>'}
            </tbody>
        </table>

        <!-- Resumen -->
        <table class="data-table">
            <tr>
                <td style="width: 70%; font-weight: bold; background-color: #f2f2f2; text-align: right;">PUNTAJE TOTAL ACUMULADO:</td>
                <td style="width: 30%; font-weight: bold; text-align: center; font-size: 11pt;">${formatNumber(selectedAnalysis.suggested.finalPts)}</td>
            </tr>
            <tr>
                <td style="width: 70%; font-weight: bold; background-color: #f2f2f2; text-align: right;">CATEGORÍA DOCENTE ASIGNADA:</td>
                <td style="width: 30%; font-weight: bold; text-align: center;">${escapeHtml(selectedAnalysis.suggested.finalCat.name.toUpperCase())}</td>
            </tr>
        </table>

        <!-- Firmas -->
        <div class="signatures">
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">ELABORADO POR (Firma)</div>
                <div style="font-size: 7.5pt;">Analista de Talento Humano</div>
            </div>
            <div class="signature-box">
                <div class="signature-line"></div>
                <div class="signature-label">APROBADO POR (Firma)</div>
                <div style="font-size: 7.5pt;">Presidente Comité de Categorización</div>
            </div>
        </div>
        
        <!-- Soportes Presentados -->
        <div class="section-title">ANEXO: SOPORTES PRESENTADOS</div>
        <div style="border: 1px solid var(--border-color); padding: 10px; font-size: 8pt; border-top: none;">
            <ul style="margin: 0; padding-left: 20px;">
                ${soportesPresentados || '<li>No se reportaron soportes válidos.</li>'}
            </ul>
        </div>

        <!-- COMPLEMENTO: Requisitos y Justificación -->
        <div style="border-top: 2px dashed #ccc; margin: 20px 0;"></div>
        
        <div class="section-title section-title-dark">ANEXO: CRITERIOS DE CATEGORIZACIÓN</div>
        <table class="data-table" style="font-size: 8.5pt;">
            <thead>
                <tr>
                    <th>Categoría</th>
                    <th>Formación Académica Mínima</th>
                    <th>Experiencia Docente</th>
                    <th>Puntaje Mínimo</th>
                </tr>
            </thead>
            <tbody>
                <tr ${selectedAnalysis.suggested.finalCat.name.toLowerCase() === 'auxiliar' ? 'style="background-color: #e6f2ff;"' : ''}>
                    <td class="text-bold">AUXILIAR</td>
                    <td>Título Profesional</td>
                    <td>Sin experiencia mínima</td>
                    <td class="text-center">340 Pts</td>
                </tr>
                <tr ${selectedAnalysis.suggested.finalCat.name.toLowerCase() === 'asistente' ? 'style="background-color: #e6f2ff;"' : ''}>
                    <td class="text-bold">ASISTENTE</td>
                    <td>Especialización / Nivel A2</td>
                    <td>Dos (2) años</td>
                    <td class="text-center">481 Pts</td>
                </tr>
                <tr ${selectedAnalysis.suggested.finalCat.name.toLowerCase() === 'asociado' ? 'style="background-color: #e6f2ff;"' : ''}>
                    <td class="text-bold">ASOCIADO</td>
                    <td>Maestría / Nivel B1</td>
                    <td>Cinco (5) años</td>
                    <td class="text-center">751 Pts</td>
                </tr>
                <tr ${selectedAnalysis.suggested.finalCat.name.toLowerCase() === 'titular' ? 'style="background-color: #e6f2ff;"' : ''}>
                    <td class="text-bold">TITULAR</td>
                    <td>Doctorado / Nivel B2</td>
                    <td>Ocho (8) años</td>
                    <td class="text-center">981 Pts</td>
                </tr>
            </tbody>
        </table>

        <div class="requirements-container">
            <div class="text-bold" style="text-decoration: underline; margin-bottom: 5px;">JUSTIFICACIÓN DE LA CATEGORÍA ASIGNADA:</div>
            <div class="justification-area">
                Se asigna la categoría indicada anteriormente debido a que el docente <strong>NO</strong> cumple con los requisitos mínimos para la categoría inmediatamente superior por los siguientes motivos:
                
                <div class="checkbox-group">
                    <div class="checkbox-item"><div class="box">${isMissingTitle}</div> Formación Académica (Nivel de estudios)</div>
                    <div class="checkbox-item"><div class="box"></div> Años de Experiencia Docente / Profesional</div>
                    <div class="checkbox-item"><div class="box">${isMissingPts}</div> Puntaje Mínimo Requerido</div>
                    <div class="checkbox-item"><div class="box"></div> Producción Intelectual / Investigativa</div>
                </div>

                <div style="margin-top: 10px;">
                    <strong>Observaciones adicionales:</strong><br>
                    ${observaciones ? `<div style="margin-top: 5px;">${escapeHtml(observaciones)}</div>` : ''}
                    <div style="border-bottom: 1px solid #000; height: 20px; margin-top: 5px;"></div>
                    <div style="border-bottom: 1px solid #000; height: 20px; margin-top: 5px;"></div>
                </div>
            </div>
        </div>

        <div style="margin-top: 20px; text-align: center; font-size: 7pt; color: #777;">
            Este formato es de uso exclusivo para el proceso de escalafón docente de la Universidad de Santander UDES.
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
