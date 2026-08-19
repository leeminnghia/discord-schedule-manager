import http from 'http';
import { discordClient } from '../discord/client.js';
import { prisma } from '../database/prisma.js';
import { env } from '../config/env.js';
import { logger } from '../utils/logger.js';

let server: http.Server | null = null;

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

  server.listen(port, () => {
    logger.info(`🌐 Health check server listening on port ${port} (/health)`);
  });

  return server;
}

export function stopHealthServer(): Promise<void> {
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
