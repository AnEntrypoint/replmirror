#!/usr/bin/env node
import { MCPBrowserREPLServer } from './server.js';

class StdioServerTransport {
  constructor() {
    this.stdin = process.stdin;
    this.stdout = process.stdout;
  }

  async start() {
    this.stdin.setEncoding('utf8');

    this.stdin.on('data', async (data) => {
      try {
        const message = JSON.parse(data.toString());
        const response = await this.handleMessage(message);
        this.stdout.write(JSON.stringify(response) + '\n');
      } catch (error) {
        const errorResponse = {
          jsonrpc: '2.0',
          id: message.id || null,
          error: {
            code: -32603,
            message: error.message
          }
        };
        this.stdout.write(JSON.stringify(errorResponse) + '\n');
      }
    });

    this.stdin.resume();
  }

  async handleMessage(message) {
    const replServer = new MCPBrowserREPLServer({
      host: process.env.REPL_HOST || 'localhost',
      port: parseInt(process.env.REPL_PORT) || 8080,
      sessionId: process.env.REPL_SESSION
    });

    switch (message.method) {
      case 'initialize':
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: {
            protocolVersion: '2024-11-05',
            capabilities: {
              tools: {}
            },
            serverInfo: {
              name: 'browser-repl-mcp',
              version: '1.0.0'
            }
          }
        };

      case 'tools/list':
        await replServer.initialize();
        const tools = await replServer.listTools();
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: tools
        };

      case 'tools/call':
        const result = await replServer.callTool(message.params.name, message.params.arguments);
        return {
          jsonrpc: '2.0',
          id: message.id,
          result: result
        };

      default:
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: 'Method not found'
          }
        };
    }
  }
}

const transport = new StdioServerTransport();
transport.start();