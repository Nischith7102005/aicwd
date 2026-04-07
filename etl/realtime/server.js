/**
 * Real-time Security Metrics Streaming Server
 * Polls Neon Postgres for new security metrics and pushes to dashboard clients
 */

const { Pool } = require('pg');
const http = require('http');
const WebSocket = require('ws');
const url = require('url');

const PORT = process.env.PORT || 3002;

// Neon Postgres connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://neondb_owner:npg_JW06qdtpwmYh@ep-plain-water-aisvxre7-pooler.c-4.us-east-1.aws.neon.tech/neondb?sslmode=require&channel_binding=require',
  ssl: { rejectUnauthorized: false }
});

// Connected WebSocket clients
const clients = new Set();

// Session-based subscriptions
const sessionSubscriptions = new Map(); // sessionId -> Set of ws clients

// ============================================================================
// HTTP Server with SSE endpoint
// ============================================================================

const server = http.createServer(async (req, res) => {
  const parsedUrl = url.parse(req.url, true);
  const path = parsedUrl.pathname;

  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Health check
  if (path === '/health' && req.method === 'GET') {
    try {
      await pool.query('SELECT 1');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'ok', database: 'connected' }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ status: 'error', message: err.message }));
    }
    return;
  }

  // SSE endpoint for real-time metrics
  if (path === '/stream/metrics' && req.method === 'GET') {
    const sessionId = parsedUrl.query.session;
    
    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    });

    // Send initial data
    try {
      const metrics = await getLatestMetrics(sessionId);
      res.write(`data: ${JSON.stringify({ type: 'initial', metrics })}\n\n`);
    } catch (err) {
      res.write(`data: ${JSON.stringify({ type: 'error', message: err.message })}\n\n`);
    }

    // Add client to SSE clients
    const clientId = Date.now();
    const client = { res, sessionId, id: clientId };
    clients.add(client);

    // Send heartbeat every 30 seconds
    const heartbeat = setInterval(() => {
      res.write(':heartbeat\n\n');
    }, 30000);

    // Clean up on close
    req.on('close', () => {
      clearInterval(heartbeat);
      clients.delete(client);
    });

    return;
  }

  // REST API: Get latest metrics
  if (path === '/api/metrics/latest' && req.method === 'GET') {
    const sessionId = parsedUrl.query.session;
    const limit = parseInt(parsedUrl.query.limit) || 30;
    
    try {
      const metrics = await getLatestMetrics(sessionId, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, metrics }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // REST API: Get session summary
  if (path === '/api/session/summary' && req.method === 'GET') {
    const sessionId = parsedUrl.query.session;
    
    if (!sessionId) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: 'session required' }));
      return;
    }
    
    try {
      const summary = await getSessionSummary(sessionId);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, summary }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  // REST API: Get security events
  if (path === '/api/security/events' && req.method === 'GET') {
    const sessionId = parsedUrl.query.session;
    const limit = parseInt(parsedUrl.query.limit) || 50;
    
    try {
      const events = await getSecurityEvents(sessionId, limit);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: true, events }));
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ success: false, error: err.message }));
    }
    return;
  }

  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

// ============================================================================
// WebSocket Server
// ============================================================================

const wss = new WebSocket.Server({ server });

wss.on('connection', (ws, req) => {
  console.log('WebSocket client connected');
  
  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      if (data.type === 'subscribe' && data.sessionId) {
        // Subscribe to session updates
        if (!sessionSubscriptions.has(data.sessionId)) {
          sessionSubscriptions.set(data.sessionId, new Set());
        }
        sessionSubscriptions.get(data.sessionId).add(ws);
        ws.sessionId = data.sessionId;
        
        // Send initial data
        const metrics = await getLatestMetrics(data.sessionId);
        ws.send(JSON.stringify({ type: 'initial', metrics }));
      }
      
      if (data.type === 'ping') {
        ws.send(JSON.stringify({ type: 'pong' }));
      }
    } catch (err) {
      ws.send(JSON.stringify({ type: 'error', message: err.message }));
    }
  });
  
  ws.on('close', () => {
    if (ws.sessionId && sessionSubscriptions.has(ws.sessionId)) {
      sessionSubscriptions.get(ws.sessionId).delete(ws);
    }
  });
});

// ============================================================================
// Database Query Functions
// ============================================================================

async function getLatestMetrics(sessionId, limit = 30) {
  let query = `
    SELECT 
      sm.*,
      rle.prompt,
      rle.response,
      rle.input_tokens,
      rle.output_tokens,
      rle.latency_ms,
      rle.model,
      rle.provider,
      rle.timestamp as event_timestamp
    FROM security_metrics sm
    JOIN raw_llm_events rle ON sm.raw_event_id = rle.id
  `;
  
  const params = [];
  if (sessionId) {
    query += ' WHERE sm.session_id = $1';
    params.push(sessionId);
  }
  
  query += ' ORDER BY sm.computed_at DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  
  const result = await pool.query(query, params);
  return result.rows;
}

async function getSessionSummary(sessionId) {
  const query = `
    SELECT 
      COUNT(*) as total_interactions,
      AVG(cri) as avg_cri,
      MAX(cri) as max_cri,
      AVG(injection_risk) as avg_injection_risk,
      AVG(leakage_risk) as avg_leakage_risk,
      AVG(hallucination_risk) as avg_hallucination_risk,
      AVG(anomaly_risk) as avg_anomaly_risk,
      COUNT(CASE WHEN cri_level = 'critical' THEN 1 END) as critical_count,
      COUNT(CASE WHEN cri_level = 'high' THEN 1 END) as high_count,
      COUNT(CASE WHEN action = 'block' THEN 1 END) as blocked_count,
      MAX(computed_at) as last_activity
    FROM security_metrics
    WHERE session_id = $1
  `;
  
  const result = await pool.query(query, [sessionId]);
  return result.rows[0];
}

async function getSecurityEvents(sessionId, limit = 50) {
  // Return security events with pattern details
  let query = `
    SELECT 
      sm.computed_at as timestamp,
      sm.session_id,
      sm.cri,
      sm.cri_level,
      sm.action,
      sm.matched_patterns,
      sm.escalation_triggered,
      sm.escalation_reason,
      rle.prompt_preview as prompt
    FROM security_metrics sm
    JOIN (
      SELECT id, LEFT(prompt, 100) as prompt_preview 
      FROM raw_llm_events
    ) rle ON sm.raw_event_id = rle.id
  `;
  
  const params = [];
  if (sessionId) {
    query += ' WHERE sm.session_id = $1';
    params.push(sessionId);
  }
  
  query += ' AND sm.escalation_triggered = true ORDER BY sm.computed_at DESC LIMIT $' + (params.length + 1);
  params.push(limit);
  
  const result = await pool.query(query, params);
  return result.rows;
}

// ============================================================================
// Real-time Polling with NOTIFY/LISTEN
// ============================================================================

async function startPolling() {
  const client = await pool.connect();
  
  try {
    // Listen for Postgres NOTIFY events
    await client.query('LISTEN new_security_metric');
    
    client.on('notification', async (msg) => {
      try {
        const payload = JSON.parse(msg.payload);
        console.log('New security metric:', payload);
        
        // Broadcast to SSE clients
        for (const client of clients) {
          if (!client.sessionId || client.sessionId === payload.session_id) {
            client.res.write(`data: ${JSON.stringify({ type: 'update', metric: payload })}\n\n`);
          }
        }
        
        // Broadcast to WebSocket clients
        if (sessionSubscriptions.has(payload.session_id)) {
          const wsClients = sessionSubscriptions.get(payload.session_id);
          for (const ws of wsClients) {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify({ type: 'update', metric: payload }));
            }
          }
        }
      } catch (err) {
        console.error('Error broadcasting notification:', err);
      }
    });
    
    console.log('Listening for Postgres notifications...');
  } catch (err) {
    console.error('Error setting up LISTEN:', err);
    client.release();
  }
  
  // Fallback polling every 2 seconds for clients without NOTIFY support
  setInterval(async () => {
    try {
      const result = await pool.query(`
        SELECT 
          sm.*,
          rle.prompt,
          rle.response,
          rle.input_tokens,
          rle.output_tokens,
          rle.latency_ms,
          rle.model,
          rle.provider,
          rle.timestamp as event_timestamp
        FROM security_metrics sm
        JOIN raw_llm_events rle ON sm.raw_event_id = rle.id
        WHERE sm.computed_at > NOW() - INTERVAL '2 seconds'
        ORDER BY sm.computed_at DESC
      `);
      
      if (result.rows.length > 0) {
        for (const row of result.rows) {
          // Broadcast to SSE clients
          for (const client of clients) {
            if (!client.sessionId || client.sessionId === row.session_id) {
              client.res.write(`data: ${JSON.stringify({ type: 'update', metric: row })}\n\n`);
            }
          }
          
          // Broadcast to WebSocket clients
          if (sessionSubscriptions.has(row.session_id)) {
            const wsClients = sessionSubscriptions.get(row.session_id);
            for (const ws of wsClients) {
              if (ws.readyState === WebSocket.OPEN) {
                ws.send(JSON.stringify({ type: 'update', metric: row }));
              }
            }
          }
        }
      }
    } catch (err) {
      console.error('Polling error:', err);
    }
  }, 2000);
}

// ============================================================================
// Start Server
// ============================================================================

server.listen(PORT, () => {
  console.log(`Real-time streaming server running on port ${PORT}`);
  console.log(`SSE endpoint: http://localhost:${PORT}/stream/metrics`);
  console.log(`WebSocket: ws://localhost:${PORT}`);
  console.log(`REST API: http://localhost:${PORT}/api/metrics/latest`);
  
  startPolling();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('Shutting down gracefully...');
  await pool.end();
  server.close(() => {
    process.exit(0);
  });
});
