#!/usr/bin/env node
import { WebSocketREPLServer } from '../core/websocket.js';

const server = new WebSocketREPLServer({
  port: process.env.PORT ? parseInt(process.env.PORT) : 8080,
  host: process.env.HOST || '0.0.0.0'
});

process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  server.stop();
  process.exit(0);
});

process.on('SIGTERM', () => {
  console.log('\nShutting down server...');
  server.stop();
  process.exit(0);
});

server.start();