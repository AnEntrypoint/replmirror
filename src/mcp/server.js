import { WebSocketREPLClient } from '../core/client.js';
import { randomBytes } from 'crypto';

export class MCPBrowserREPLServer {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 8080;
    // Use provided session ID or generate new one
    this.sessionId = options.sessionId || process.env.REPL_SESSION_ID || randomBytes(16).toString('hex');
    this.client = new WebSocketREPLClient({
      host: this.host,
      port: this.port,
      sessionId: this.sessionId,
      role: 'mcp'  // This is an MCP server
    });
    this.connected = false;
    this.connectionPromise = null;
    this.initialized = false;
  }

  async initialize() {
    this.initialized = true;
    return true;
  }

  generateBrowserCode() {
    // Clean up host URL to remove protocol if present
    let cleanHost = this.host;
    if (cleanHost.startsWith('http://')) {
      cleanHost = cleanHost.substring(7);
    } else if (cleanHost.startsWith('https://')) {
      cleanHost = cleanHost.substring(8);
    }

    const wsProtocol = this.port === 443 ? 'wss' : 'ws';
    return `(function() {
  const ws = new WebSocket('${wsProtocol}://${cleanHost}:${this.port}/repl');
  const sessionId = '${this.sessionId}';

  ws.onopen = function() {
    console.log('Connected to browser REPL server');
    ws.send(JSON.stringify({
      type: 'register',
      role: 'browser',
      sessionId: sessionId
    }));
  };

  ws.onmessage = function(event) {
    const data = JSON.parse(event.data);
    if (data.type === 'execute') {
      try {
        const result = eval(data.code);
        ws.send(JSON.stringify({
          type: 'result',
          sessionId: sessionId,
          result: result,
          error: null,
          requestId: data.requestId
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'result',
          sessionId: sessionId,
          result: null,
          error: error.message,
          requestId: data.requestId
        }));
      }
    }
  };

  ws.onerror = function(error) {
    console.error('WebSocket error:', error);
  };

  ws.onclose = function() {
    console.log('Disconnected from browser REPL server');
  };

  window.browserREPL = {
    execute: function(code) {
      return eval(code);
    }
  };
})();`;
  }

  async ensureConnected() {
    if (this.connected) return true;

    if (this.connectionPromise) {
      return await this.connectionPromise;
    }

    this.connectionPromise = this.waitForConnection();
    return await this.connectionPromise;
  }

  async waitForConnection() {
    const browserCode = this.generateBrowserCode();

    console.log('\n🌐 BROWSER CONNECTION REQUIRED');
    console.log('Copy and paste this code into your browser console:');
    console.log('─'.repeat(50));
    console.log(browserCode);
    console.log('─'.repeat(50));
    console.log('Waiting for browser connection...\n');

    try {
      await this.client.connect();
      this.connected = true;
      console.log('✅ Browser connected successfully!');
      return true;
    } catch (error) {
      console.error('❌ Connection failed:', error.message);
      this.connectionPromise = null;
      throw error;
    }
  }

  async executeJavaScript(code) {
    await this.ensureConnected();

    return new Promise((resolve, reject) => {
      const originalHandleMessage = this.client.handleMessage.bind(this.client);

      this.client.handleMessage = (message) => {
        if (message.type === 'result') {
          originalHandleMessage(message);

          if (message.error) {
            reject(new Error(message.error));
          } else {
            resolve({
              result: message.result,
              success: true
            });
          }

          this.client.handleMessage = originalHandleMessage;
        }
      };

      this.client.execute(code);

      setTimeout(() => {
        reject(new Error('Execution timeout'));
      }, 10000);
    });
  }

  async listTools() {
    return {
      tools: [
        {
          name: "execute_javascript",
          description: "Execute JavaScript code in the connected browser (will prompt for connection if needed)",
          inputSchema: {
            type: "object",
            properties: {
              code: {
                type: "string",
                description: "JavaScript code to execute in the browser"
              }
            },
            required: ["code"]
          }
        }
      ]
    };
  }

  async callTool(name, args) {
    if (name !== "execute_javascript") {
      throw new Error(`Unknown tool: ${name}`);
    }

    return await this.executeJavaScript(args.code);
  }

  async shutdown() {
    if (this.connected) {
      this.client.disconnect();
      this.connected = false;
      this.connectionPromise = null;
    }
  }
}