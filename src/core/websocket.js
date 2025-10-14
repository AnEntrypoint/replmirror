import { WebSocketServer } from 'ws';
import { randomBytes } from 'crypto';

export class WebSocketREPLServer {
  constructor(options = {}) {
    this.port = options.port || 8080;
    this.host = options.host || '0.0.0.0';
    this.wss = null;
    this.connections = new Map();
    this.sessions = new Map();
  }

  generateSessionId() {
    return randomBytes(16).toString('hex');
  }

  generateBrowserCode(sessionId) {
    return `(function() {
      const ws = new WebSocket('ws://${this.host}:${this.port}/repl');
      const sessionId = '${sessionId}';

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

  generateCLICode(sessionId) {
    return `Connect with: browser-repl --session ${sessionId} --host ${this.host} --port ${this.port}`;
  }

  start() {
    this.wss = new WebSocketServer({
      host: this.host,
      port: this.port
    });

    this.wss.on('connection', (ws, req) => {
      const sessionId = this.generateSessionId();

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());

          if (message.type === 'register') {
            const regSessionId = message.sessionId || sessionId;
            const role = message.role;

            // Handle session switching for browsers (only when another browser connects)
            if (role === 'browser') {
              // Disconnect any existing browser with this session ID
              for (const [existingWs, existingConn] of this.connections) {
                if (existingConn.role === 'browser' && existingConn.sessionId === regSessionId && existingWs !== ws) {
                  console.log(`🔄 Switching browser session: disconnecting previous browser for session ${regSessionId}`);
                  existingWs.close();
                  this.connections.delete(existingWs);
                }
              }
            }

            // Handle multiple CLI/MCP servers per session (keep latest, disconnect others)
            if (role === 'cli' || role === 'mcp') {
              for (const [existingWs, existingConn] of this.connections) {
                if ((existingConn.role === 'cli' || existingConn.role === 'mcp') &&
                    existingConn.sessionId === regSessionId && existingWs !== ws) {
                  console.log(`🔄 Switching CLI/MCP: disconnecting previous CLI/MCP for session ${regSessionId}`);
                  existingWs.close();
                  this.connections.delete(existingWs);
                }
              }
            }

            this.connections.set(ws, {
              sessionId: regSessionId,
              role: role,
              connected: new Date(),
              timestamp: message.timestamp
            });

            if (role === 'browser') {
              console.log(`✅ Browser connected: ${regSessionId}`);
              if (message.timestamp) {
                console.log(`   Connection time: ${new Date(message.timestamp).toISOString()}`);
              }
            } else if (role === 'cli') {
              console.log(`CLI connected: ${regSessionId}`);
            }
          } else if (message.type === 'execute') {
            this.handleExecute(ws, message);
          } else if (message.type === 'result') {
            this.handleResult(ws, message);
          }
        } catch (error) {
          console.error('Message parsing error:', error);
        }
      });

      ws.on('close', () => {
        const conn = this.connections.get(ws);
        if (conn) {
          console.log(`${conn.role} disconnected: ${conn.sessionId}`);
          this.connections.delete(ws);
        }
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    console.log(`WebSocket REPL Server running on ws://${this.host}:${this.port}`);

    const sessionId = this.generateSessionId();
    console.log('\n=== SESSION SETUP ===');
    console.log('Browser code (paste in browser console):');
    console.log(this.generateBrowserCode(sessionId));
    console.log('\nCLI command:');
    console.log(this.generateCLICode(sessionId));
    console.log('=====================\n');
  }

  handleExecute(ws, message) {
    const conn = this.connections.get(ws);
    if (!conn) return;

    for (const [clientWs, clientConn] of this.connections) {
      if (clientConn.role === 'browser' && clientConn.sessionId === conn.sessionId) {
        clientWs.send(JSON.stringify({
          type: 'execute',
          sessionId: conn.sessionId,
          code: message.code,
          requestId: message.requestId
        }));
        break;
      }
    }
  }

  handleResult(ws, message) {
    const conn = this.connections.get(ws);
    if (!conn) return;

    for (const [clientWs, clientConn] of this.connections) {
      if (clientConn.role === 'cli' && clientConn.sessionId === conn.sessionId) {
        clientWs.send(JSON.stringify({
          type: 'result',
          sessionId: conn.sessionId,
          result: message.result,
          error: message.error,
          requestId: message.requestId
        }));
        break;
      }
    }
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
  }
}