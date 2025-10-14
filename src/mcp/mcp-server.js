#!/usr/bin/env node
import { MCPBrowserREPLServer } from './server.js';

class StdioServerTransport {
  constructor() {
    this.stdin = process.stdin;
    this.stdout = process.stdout;
    this.buffer = '';
    this.initialized = false;
    this.serverCapabilities = null;
  }

  async start() {
    this.stdin.setEncoding('utf8');

    this.stdin.on('data', async (data) => {
      this.buffer += data.toString();

      // Process complete messages (JSON-RPC messages are separated by newlines)
      const messages = this.buffer.split('\n');
      this.buffer = messages.pop() || ''; // Keep incomplete message in buffer

      for (const messageStr of messages) {
        if (messageStr.trim()) {
          await this.processMessage(messageStr);
        }
      }
    });

    // Handle end of stdin without exiting
    this.stdin.on('end', () => {
      // Keep process alive for MCP protocol
      // MCP servers should not exit when stdin closes
    });

    this.stdin.resume();

    // Prevent the process from exiting
    setInterval(() => {
      // Keep the event loop alive
    }, 1000);
  }

  async processMessage(messageStr) {
    let message;
    try {
      message = JSON.parse(messageStr);
      const response = await this.handleMessage(message);
      if (response) {
        this.stdout.write(JSON.stringify(response) + '\n');
      }
    } catch (error) {
      const errorResponse = {
        jsonrpc: '2.0',
        id: message?.id ?? null,
        error: {
          code: -32700, // Parse error
          message: 'Parse error',
          data: error.message
        }
      };
      this.stdout.write(JSON.stringify(errorResponse) + '\n');
    }
  }

  async handleMessage(message) {
    // Validate JSON-RPC message structure
    if (!message.jsonrpc || message.jsonrpc !== '2.0') {
      return {
        jsonrpc: '2.0',
        id: message.id ?? null,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'Missing or invalid jsonrpc version'
        }
      };
    }

    // Handle notifications (no ID)
    if (message.id === undefined) {
      await this.handleNotification(message);
      return null; // No response for notifications
    }

    // Handle requests
    try {
      const response = await this.handleRequest(message);
      return response;
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32603,
          message: 'Internal error',
          data: error.message
        }
      };
    }
  }

  async handleNotification(message) {
    if (message.method === 'notifications/initialized') {
      this.initialized = true;
    }
  }

  async handleRequest(message) {
    switch (message.method) {
      case 'initialize':
        return this.handleInitialize(message);

      case 'tools/list':
        return this.handleToolsList(message);

      case 'tools/call':
        return this.handleToolsCall(message);

      default:
        return {
          jsonrpc: '2.0',
          id: message.id,
          error: {
            code: -32601,
            message: 'Method not found',
            data: `Unknown method: ${message.method}`
          }
        };
    }
  }

  handleInitialize(message) {
    const params = message.params || {};

    // Validate protocol version
    const requestedVersion = params.protocolVersion;
    const supportedVersion = '2025-06-18';

    if (requestedVersion !== supportedVersion) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32602,
          message: 'Unsupported protocol version',
          data: {
            requested: requestedVersion,
            supported: [supportedVersion]
          }
        }
      };
    }

    // Store server capabilities
    this.serverCapabilities = {
      tools: {
        listChanged: true
      },
      logging: {}
    };

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: {
        protocolVersion: supportedVersion,
        capabilities: this.serverCapabilities,
        serverInfo: {
          name: 'browser-repl-mcp',
          version: '1.0.0'
        }
      }
    };
  }

  async handleToolsList(message) {
    if (!this.initialized) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'Server not initialized'
        }
      };
    }

    const replServer = new MCPBrowserREPLServer({
      host: process.env.REPL_HOST || 'localhost',
      port: parseInt(process.env.REPL_PORT) || 8080,
      sessionId: process.env.REPL_SESSION_ID
    });

    await replServer.initialize();
    const tools = await replServer.listTools();

    return {
      jsonrpc: '2.0',
      id: message.id,
      result: tools
    };
  }

  async handleToolsCall(message) {
    if (!this.initialized) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32600,
          message: 'Invalid Request',
          data: 'Server not initialized'
        }
      };
    }

    const params = message.params || {};
    const toolName = params.name;
    const arguments_ = params.arguments || {};

    if (!toolName) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        error: {
          code: -32602,
          message: 'Invalid params',
          data: 'Missing tool name'
        }
      };
    }

    const replServer = new MCPBrowserREPLServer({
      host: process.env.REPL_HOST || 'localhost',
      port: parseInt(process.env.REPL_PORT) || 8080,
      sessionId: process.env.REPL_SESSION_ID
    });

    try {
      const result = await replServer.callTool(toolName, arguments_);

      // Format result according to MCP specification
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: typeof result === 'string' ? result : JSON.stringify(result)
            }
          ],
          isError: false
        }
      };
    } catch (error) {
      return {
        jsonrpc: '2.0',
        id: message.id,
        result: {
          content: [
            {
              type: 'text',
              text: `Error: ${error.message}`
            }
          ],
          isError: true
        }
      };
    }
  }
}

// Export for use in CLI
export { StdioServerTransport };

// Only start if this file is run directly
if (import.meta.url === `file://${process.argv[1]}`) {
  const transport = new StdioServerTransport();
  transport.start();
}