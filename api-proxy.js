// api/proxy.js - Vercel Serverless Function for CORS proxy
// This is the API gateway that handles all FPL API requests

export default async function handler(req, res) {
  // Enable CORS
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS,POST,PUT,DELETE');
  res.setHeader(
    'Access-Control-Allow-Headers',
    'X-CSRF-Token, X-Requested-With, Accept, Accept-Version, Content-Length, Content-MD5, Content-Type, Date, X-Api-Version'
  );

  // Handle preflight
  if (req.method === 'OPTIONS') {
    res.status(200).end();
    return;
  }

  try {
    const { endpoint } = req.query;

    if (!endpoint) {
      return res.status(400).json({ error: 'Missing endpoint parameter' });
    }

    const fplUrl = `https://fantasy.premierleague.com/api${decodeURIComponent(endpoint)}`;
    
    console.log(`[FPL Proxy] Fetching: ${fplUrl}`);

    const response = await fetch(fplUrl, {
      method: 'GET',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
      }
    });

    if (!response.ok) {
      throw new Error(`FPL API returned ${response.status}`);
    }

    const data = await response.json();

    // Cache for 5 minutes in Vercel
    res.setHeader('Cache-Control', 'public, s-maxage=300, stale-while-revalidate=600');
    res.status(200).json({ success: true, data });
  } catch (error) {
    console.error('[FPL Proxy Error]', error.message);
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
}
