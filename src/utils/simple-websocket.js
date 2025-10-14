import { WebSocketServer } from 'ws';
import { randomBytes } from 'crypto';

export class SimpleWebSocketServer {
  constructor(options = {}) {
    this.port = options.port || 8765;
    this.host = options.host || '0.0.0.0';
    this.wss = null;
    this.connections = new Map();
    this.sessions = new Map(); // sessionId -> { browser: ws|null, mcp: ws|null }
  }

  start() {
    this.wss = new WebSocketServer({
      host: this.host,
      port: this.port
    });

    this.wss.on('connection', (ws, req) => {
      console.log(`New connection from ${req.socket.remoteAddress}`);

      ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(ws, message);
        } catch (error) {
          console.error('Message parsing error:', error);
        }
      });

      ws.on('close', () => {
        console.log('Connection closed');
        this.removeConnection(ws);
      });

      ws.on('error', (error) => {
        console.error('WebSocket error:', error);
      });
    });

    console.log(`Simple WebSocket Server running on ws://${this.host}:${this.port}`);
    return this;
  }

  handleMessage(ws, message) {
    switch (message.type) {
      case 'register':
        this.handleRegister(ws, message);
        break;
      case 'execute':
        this.handleExecute(ws, message);
        break;
      case 'result':
        this.handleResult(ws, message);
        break;
    }
  }

  handleRegister(ws, message) {
    const { sessionId, role } = message;

    if (!sessionId) {
      console.error('No session ID provided');
      return;
    }

    // Store connection
    this.connections.set(ws, { sessionId, role });

    // Update session mapping
    if (!this.sessions.has(sessionId)) {
      this.sessions.set(sessionId, { browser: null, mcp: null });
    }

    const session = this.sessions.get(sessionId);

    if (role === 'browser') {
      // Disconnect existing browser for this session
      if (session.browser && session.browser !== ws) {
        console.log(`Disconnecting previous browser for session ${sessionId}`);
        session.browser.close();
      }
      session.browser = ws;
      console.log(`✅ Browser registered for session ${sessionId}`);
    } else if (role === 'mcp') {
      // Disconnect existing MCP for this session
      if (session.mcp && session.mcp !== ws) {
        console.log(`Disconnecting previous MCP for session ${sessionId}`);
        session.mcp.close();
      }
      session.mcp = ws;
      console.log(`✅ MCP server registered for session ${sessionId}`);
    }

    // Send confirmation
    ws.send(JSON.stringify({
      type: 'registered',
      sessionId,
      role,
      timestamp: Date.now()
    }));
  }

  handleExecute(ws, message) {
    const { sessionId, code, requestId } = message;
    const session = this.sessions.get(sessionId);

    if (!session || !session.browser) {
      ws.send(JSON.stringify({
        type: 'result',
        sessionId,
        requestId,
        error: 'No browser connected for this session',
        timestamp: Date.now()
      }));
      return;
    }

    // Forward to browser
    session.browser.send(JSON.stringify({
      type: 'execute',
      sessionId,
      code,
      requestId,
      timestamp: Date.now()
    }));

    console.log(`📤 Forwarded execute request to browser for session ${sessionId}`);
  }

  handleResult(ws, message) {
    const { sessionId, requestId, result, error } = message;
    const session = this.sessions.get(sessionId);

    if (!session || !session.mcp) {
      console.log(`No MCP server to send result to for session ${sessionId}`);
      return;
    }

    // Forward to MCP server
    session.mcp.send(JSON.stringify({
      type: 'result',
      sessionId,
      requestId,
      result,
      error,
      timestamp: Date.now()
    }));

    console.log(`📥 Forwarded result to MCP server for session ${sessionId}`);
  }

  removeConnection(ws) {
    const conn = this.connections.get(ws);
    if (conn) {
      const session = this.sessions.get(conn.sessionId);
      if (session) {
        if (conn.role === 'browser') {
          session.browser = null;
        } else if (conn.role === 'mcp') {
          session.mcp = null;
        }
      }
      this.connections.delete(ws);
      console.log(`${conn.role} disconnected: ${conn.sessionId}`);
    }
  }

  stop() {
    if (this.wss) {
      this.wss.close();
    }
  }
}