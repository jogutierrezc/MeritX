export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body ?? {};
  const endpoint = typeof body.endpoint === 'string' ? body.endpoint : '';
  const queryParams = body.queryParams && typeof body.queryParams === 'object' ? body.queryParams : {};

  if (!endpoint.startsWith('/content/')) {
    return res.status(400).json({ error: 'Invalid endpoint' });
  }

  const apiKey = String(body.apiKey || process.env.SCOPUS_API_KEY || '').trim();
  const instToken = String(body.instToken || process.env.SCOPUS_INST_TOKEN || '').trim();

  if (!apiKey) {
    return res.status(400).json({ error: 'Missing SCOPUS API key' });
  }

  const search = new URLSearchParams();
  for (const [key, value] of Object.entries(queryParams)) {
    if (value === undefined || value === null || value === '') continue;
    search.set(key, String(value));
  }

  const url = `https://api.elsevier.com${endpoint}?${search.toString()}`;

  try {
    const upstream = await fetch(url, {
      method: 'GET',
      headers: {
        'X-ELS-APIKey': apiKey,
        ...(instToken ? { 'X-ELS-Insttoken': instToken } : {}),
        Accept: 'application/json',
      },
    });

    const rawText = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    return res.send(rawText);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Scopus upstream request failed',
    });
  }
}
