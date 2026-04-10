export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const authHeader = req.headers.authorization;
  if (!authHeader) {
    return res.status(400).json({ error: 'Missing Authorization header' });
  }

  try {
    const upstream = await fetch('https://apifreellm.com/api/v1/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: authHeader,
      },
      body: JSON.stringify(req.body ?? {}),
    });

    const rawText = await upstream.text();
    const contentType = upstream.headers.get('content-type') || 'application/json; charset=utf-8';

    res.status(upstream.status);
    res.setHeader('Content-Type', contentType);
    return res.send(rawText);
  } catch (error) {
    return res.status(502).json({
      error: error instanceof Error ? error.message : 'Upstream request failed',
    });
  }
}