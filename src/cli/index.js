#!/usr/bin/env node
import { Command } from 'commander';
import { WebSocketREPLClient } from '../core/client.js';
import { WebSocketREPLServer } from '../core/websocket.js';
import { MCPBrowserREPLServer } from '../mcp/server.js';
import { createInterface } from 'readline';

const program = new Command();

program
  .name('browser-repl')
  .description('WebSocket-based browser REPL with CLI and MCP support')
  .option('--host <host>', 'WebSocket server host', 'localhost')
  .option('--port <port>', 'WebSocket server port', '3000')
  .option('--session <sessionId>', 'Session ID for connection')
  .option('--code <code>', 'Execute single command and exit');

program
  .command('server')
  .description('Start WebSocket server for browser connections')
  .option('--port <port>', 'Server port', '3000')
  .option('--host <host>', 'Server host', '0.0.0.0')
  .action(async (options) => {
    const server = new WebSocketREPLServer({
      port: parseInt(options.port),
      host: options.host
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
  });

program
  .command('mcp')
  .description('Start MCP server for Claude integration')
  .option('--host <host>', 'WebSocket server host', 'localhost')
  .option('--port <port>', 'WebSocket server port', '3000')
  .action(async (options) => {
    const mcpServer = new MCPBrowserREPLServer({
      host: options.host,
      port: parseInt(options.port)
    });

    const StdioServerTransport = class {
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
            const tools = await mcpServer.listTools();
            return {
              jsonrpc: '2.0',
              id: message.id,
              result: tools
            };

          case 'tools/call':
            const result = await mcpServer.callTool(message.params.name, message.params.arguments);
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
    };

    const transport = new StdioServerTransport();
    transport.start();

    process.on('SIGINT', async () => {
      await mcpServer.shutdown();
      process.exit(0);
    });
  });

program
  .command('connect')
  .description('Connect CLI to WebSocket server')
  .option('--host <host>', 'WebSocket server host', 'localhost')
  .option('--port <port>', 'WebSocket server port', '3000')
  .option('--session <sessionId>', 'Session ID for connection')
  .option('--code <code>', 'Execute single command and exit')
  .action(async (options) => {
    const client = new WebSocketREPLClient({
      host: options.host,
      port: parseInt(options.port),
      sessionId: options.sessionId
    });

    try {
      await client.connect();

      if (options.code) {
        client.execute(options.code);
        setTimeout(() => client.disconnect(), 1000);
        return;
      }

      const rl = createInterface({
        input: process.stdin,
        output: process.stdout,
        prompt: 'browser> '
      });

      rl.prompt();

      rl.on('line', (line) => {
        const trimmed = line.trim();

        if (trimmed === 'exit' || trimmed === 'quit') {
          client.disconnect();
          rl.close();
          process.exit(0);
          return;
        }

        if (trimmed) {
          client.execute(trimmed);
        }

        rl.prompt();
      });

      rl.on('close', () => {
        client.disconnect();
        process.exit(0);
      });

      process.on('SIGINT', () => {
        console.log('\nDisconnecting...');
        client.disconnect();
        rl.close();
        process.exit(0);
      });

    } catch (error) {
      console.error('Connection failed:', error.message);
      process.exit(1);
    }
  });

// Default action (backward compatibility)
program.action(async (options) => {
  console.log('Use "browser-repl server" to start server');
  console.log('Use "browser-repl connect" to connect to server');
  console.log('Use "browser-repl mcp" to start MCP server');
});

program.parse();