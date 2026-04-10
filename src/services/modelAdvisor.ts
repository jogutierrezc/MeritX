import type { ModelAlternative, ModelTestConditions } from '../types/config';

const MODEL_CATALOG: Array<Omit<ModelAlternative, 'finalScore' | 'reason'>> = [
  {
    provider: 'gemini',
    model: 'gemini-2.5-flash',
    estimatedLatencyMs: 900,
    costTier: 1,
    qualityScore: 4,
    ragCompatibility: true,
  },
  {
    provider: 'gemini',
    model: 'gemini-2.5-pro',
    estimatedLatencyMs: 2200,
    costTier: 3,
    qualityScore: 5,
    ragCompatibility: true,
  },
  {
    provider: 'apifreellm',
    model: 'gpt-4o-mini',
    estimatedLatencyMs: 1200,
    costTier: 2,
    qualityScore: 4,
    ragCompatibility: true,
  },
  {
    provider: 'apifreellm',
    model: 'claude-3.5-haiku',
    estimatedLatencyMs: 1400,
    costTier: 2,
    qualityScore: 4,
    ragCompatibility: true,
  },
  {
    provider: 'apifreellm',
    model: 'llama-3.1-70b-instruct',
    estimatedLatencyMs: 1700,
    costTier: 1,
    qualityScore: 3,
    ragCompatibility: true,
  },
];

const taskWeight = (taskType: ModelTestConditions['taskType']) => {
  switch (taskType) {
    case 'legal':
      return { quality: 0.55, latency: 0.15, cost: 0.1, rag: 0.2 };
    case 'scoring':
      return { quality: 0.45, latency: 0.25, cost: 0.15, rag: 0.15 };
    case 'classification':
      return { quality: 0.35, latency: 0.35, cost: 0.2, rag: 0.1 };
    case 'email':
      return { quality: 0.3, latency: 0.35, cost: 0.25, rag: 0.1 };
    default:
      return { quality: 0.4, latency: 0.25, cost: 0.2, rag: 0.15 };
  }
};

export const getModelAlternatives = (conditions: ModelTestConditions): {
  alternatives: ModelAlternative[];
  recommended: ModelAlternative | null;
} => {
  const weights = taskWeight(conditions.taskType);

  const alternatives = MODEL_CATALOG.map((model) => {
    const qualityFit = Math.max(0, 1 - Math.abs(model.qualityScore - conditions.minimumQuality) / 5);
    const latencyFit = Math.max(0, 1 - model.estimatedLatencyMs / Math.max(conditions.maxLatencyMs, 1));
    const costFit = Math.max(0, 1 - model.costTier / Math.max(conditions.maxCostTier, 1));
    const ragFit = conditions.ragRequired ? (model.ragCompatibility ? 1 : 0) : 1;

    const finalScore =
      qualityFit * weights.quality + latencyFit * weights.latency + costFit * weights.cost + ragFit * weights.rag;

    const reasonParts = [
      `Calidad ${model.qualityScore}/5`,
      `Latencia estimada ${model.estimatedLatencyMs}ms`,
      `Costo nivel ${model.costTier}`,
      model.ragCompatibility ? 'Compatible con RAG' : 'Sin compatibilidad RAG',
    ];

    return {
      ...model,
      finalScore: Number(finalScore.toFixed(4)),
      reason: reasonParts.join(' · '),
    };
  })
    .filter((item) => {
      if (conditions.ragRequired && !item.ragCompatibility) return false;
      if (item.qualityScore < conditions.minimumQuality) return false;
      if (item.costTier > conditions.maxCostTier) return false;
      return true;
    })
    .sort((a, b) => b.finalScore - a.finalScore);

  return {
    alternatives,
    recommended: alternatives[0] || null,
  };
};
