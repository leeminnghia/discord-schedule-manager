import http from 'http';
import { discordClient } from '../discord/client.js';
import { prisma } from '../database/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let server: http.Server | null = null;
let keepAliveTimer: NodeJS.Timeout | null = null;

export function startHealthServer(port: number = env.PORT): http.Server {
  server = http.createServer(async (req, res) => {
    if ((req.url === '/' || req.url === '/health') && req.method === 'GET') {
      let dbStatus = 'disconnected';
      try {
        await prisma.$queryRaw`SELECT 1`;
        dbStatus = 'connected';
      } catch {
        dbStatus = 'error';
      }

      const discordStatus = discordClient.isReady() ? 'connected' : 'disconnected';
      const isHealthy = dbStatus === 'connected' && discordStatus === 'connected';

      const responsePayload = {
        status: isHealthy ? 'ok' : 'degraded',
        discord: discordStatus,
        database: dbStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };

      res.writeHead(isHealthy ? 200 : 503, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responsePayload));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info(`🌐 Health check server listening on 0.0.0.0:${port} (/health)`);
  });

  // Start 24/7 Keep-Alive Self-Ping every 8 minutes to prevent Render Free Plan from sleeping
  startKeepAlivePing();

  return server;
}

function startKeepAlivePing() {
  const publicUrl = process.env.RENDER_EXTERNAL_URL || 'https://discord-schedule-manager.onrender.com';
  const pingInterval = 8 * 60 * 1000; // Every 8 minutes

  keepAliveTimer = setInterval(async () => {
    try {
      const res = await fetch(`${publicUrl}/health`);
      logger.info(`💓 Keep-alive ping to ${publicUrl}/health: HTTP ${res.status}`);
    } catch (err: any) {
      logger.warn(`⚠️ Keep-alive ping failed: ${err?.message}`);
    }
  }, pingInterval);
}

export function stopHealthServer(): Promise<void> {
  if (keepAliveTimer) {
    clearInterval(keepAliveTimer);
    keepAliveTimer = null;
  }

  return new Promise((resolve) => {
    if (server) {
      server.close(() => {
        logger.info('Health check server closed.');
        resolve();
      });
    } else {
      resolve();
    }
  });
}
