const express = require('express');
const cors = require('cors');
const NodeCache = require('node-cache');
const axios = require('axios');

const app = express();
const cache = new NodeCache({ stdTTL: 300 }); // 5 min cache

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// FPL API Base URL
const FPL_API = 'https://fantasy.premierleague.com/api';

// Cache key builder
const getCacheKey = (endpoint) => `fpl_${endpoint}`;

// Error handler wrapper
const handleFPLRequest = async (endpoint) => {
  try {
    const cacheKey = getCacheKey(endpoint);
    
    // Check cache first
    const cached = cache.get(cacheKey);
    if (cached) {
      return { success: true, data: cached, cached: true };
    }

    // Fetch from FPL API
    const response = await axios.get(`${FPL_API}${endpoint}`, {
      headers: {
        'User-Agent': 'BaoussPro League Dashboard'
      },
      timeout: 10000
    });

    // Cache the result
    cache.set(cacheKey, response.data);
    
    return { success: true, data: response.data, cached: false };
  } catch (error) {
    console.error(`[FPL API Error] ${endpoint}:`, error.message);
    return {
      success: false,
      error: error.message,
      status: error.response?.status || 500
    };
  }
};

// ============ ENDPOINTS ============

// 1. Bootstrap Static Data (Teams, Players, Current GW)
app.get('/api/bootstrap', async (req, res) => {
  const result = await handleFPLRequest('/bootstrap-static/');
  res.json(result);
});

// 2. Fixtures
app.get('/api/fixtures', async (req, res) => {
  const result = await handleFPLRequest('/fixtures/');
  res.json(result);
});

// 3. League Classic Standings (with pagination)
app.get('/api/league-classic/:id', async (req, res) => {
  const { id } = req.params;
  const { page = 1 } = req.query;
  
  try {
    const result = await handleFPLRequest(
      `/leagues-classic/${id}/standings/?page_standings=${page}&page_new_entries=1`
    );
    res.json(result);
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 4. Get All League Standings (handles pagination automatically)
app.get('/api/league-all-standings/:id', async (req, res) => {
  const { id } = req.params;
  
  try {
    let allManagers = [];
    let page = 1;
    let hasMore = true;

    while (hasMore && page <= 3) { // Max 3 pages to get 150 managers
      const result = await handleFPLRequest(
        `/leagues-classic/${id}/standings/?page_standings=${page}`
      );

      if (result.success && result.data.results) {
        allManagers.push(...result.data.results);
        hasMore = result.data.results.length > 0;
        page++;
      } else {
        hasMore = false;
      }
    }

    res.json({
      success: true,
      data: {
        results: allManagers,
        total_count: allManagers.length
      }
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
});

// 5. Get Manager Entry Details
app.get('/api/entry/:id', async (req, res) => {
  const { id } = req.params;
  const result = await handleFPLRequest(`/entry/${id}/`);
  res.json(result);
});

// 6. Get Manager's Event (GW) Picks
app.get('/api/entry/:id/event/:gw/picks', async (req, res) => {
  const { id, gw } = req.params;
  const result = await handleFPLRequest(`/entry/${id}/event/${gw}/picks/`);
  res.json(result);
});

// 7. Live Event Data (current GW live scores)
app.get('/api/event/:gw/live', async (req, res) => {
  const { gw } = req.params;
  const result = await handleFPLRequest(`/event/${gw}/live/`);
  res.json(result);
});

// 8. Event Details (GW deadline, status)
app.get('/api/event/:gw', async (req, res) => {
  const { gw } = req.params;
  const result = await handleFPLRequest(`/event/${gw}/`);
  res.json(result);
});

// 9. Health check
app.get('/api/health', (req, res) => {
  res.json({ success: true, status: 'API is running' });
});

// 10. Cache stats (for debugging)
app.get('/api/cache-stats', (req, res) => {
  res.json({
    keys: cache.keys(),
    stats: cache.getStats()
  });
});

// 11. Clear cache endpoint
app.post('/api/cache-clear', (req, res) => {
  cache.flushAll();
  res.json({ success: true, message: 'Cache cleared' });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Unhandled error:', error);
  res.status(500).json({
    success: false,
    error: 'Internal server error',
    message: error.message
  });
});

// Start server
const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Baouss Pro League Dashboard Backend running on port ${PORT}`);
});
