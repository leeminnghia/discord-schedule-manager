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

      const discordStatus = discordClient.isReady() ? 'connected' : 'connecting';

      const responsePayload = {
        status: 'ok',
        discord: discordStatus,
        database: dbStatus,
        uptime: process.uptime(),
        timestamp: new Date().toISOString(),
      };

      // Always return 200 OK so Cloud Load Balancer passes health probe
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(responsePayload));
      return;
    }

    res.writeHead(404, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ error: 'Not Found' }));
  });

  server.listen(port, '0.0.0.0', () => {
    logger.info(`🌐 Health check server listening on 0.0.0.0:${port} (/health)`);
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
