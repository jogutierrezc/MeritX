export * from './firebase';
export * from './orcid';
export * from './scopus';
export * from './spacetime';

/**
 * AI Analysis Service for generating CAP (Comité de Asuntos Profesorales) opinions
 */
export const generateAIAnalysis = async (
  profesorName: string,
  points: number,
  category: string,
  apiKey: string
): Promise<string> => {
  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `Analiza este caso docente. Docente: ${profesorName}. Puntos: ${points.toFixed(1)}. Categoría: ${category}.`,
                },
              ],
            },
          ],
          systemInstruction: {
            parts: [
              {
                text: `Actúa como Comité de Asuntos Profesorales (CAP). Dictamen formal en 3 secciones: Legal, Doctrinal y Retención.`,
              },
            ],
          },
        }),
      }
    );

    if (!response.ok) throw new Error('Failed to generate AI analysis');
    const data = await response.json();
    return data.candidates?.[0]?.content?.parts?.[0]?.text || 'Error en dictamen.';
  } catch (error) {
    console.error('Error generating AI analysis:', error);
    return 'Error al generar el dictamen.';
  }
};
