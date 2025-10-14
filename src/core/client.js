import WebSocket from 'ws';

export class WebSocketREPLClient {
  constructor(options = {}) {
    this.host = options.host || 'localhost';
    this.port = options.port || 8080;
    this.sessionId = options.sessionId;
    this.role = options.role || 'cli';  // Default to 'cli', can be 'mcp'
    this.ws = null;
    this.connected = false;
    this.pendingRequests = new Map();
    this.requestId = 0;
  }

  connect() {
    return new Promise((resolve, reject) => {
      // Clean up host URL to remove protocol if present
      let cleanHost = this.host;
      if (cleanHost.startsWith('http://')) {
        cleanHost = cleanHost.substring(7);
      } else if (cleanHost.startsWith('https://')) {
        cleanHost = cleanHost.substring(8);
      }

      // Handle case where host already includes port
      let portToUse = this.port;
      if (cleanHost.includes(':')) {
        const [hostOnly, hostPort] = cleanHost.split(':');
        if (hostPort && hostPort !== this.port.toString()) {
          cleanHost = hostOnly;
          portToUse = parseInt(hostPort);
        } else {
          cleanHost = hostOnly;
        }
      }

      // Use appropriate WebSocket protocol
      const wsProtocol = portToUse === 443 ? 'wss' : 'ws';
      this.ws = new WebSocket(`${wsProtocol}://${cleanHost}:${portToUse}/repl`);

      this.ws.on('open', () => {
        this.connected = true;
        this.ws.send(JSON.stringify({
          type: 'register',
          role: this.role,
          sessionId: this.sessionId,
          timestamp: Date.now()
        }));
        console.log(`Connected to browser REPL server (${this.host}:${this.port})`);
        console.log('Type JavaScript code and press Enter to execute.');
        console.log('Type "exit" or "quit" to disconnect.');
        resolve();
      });

      this.ws.on('message', (data) => {
        try {
          const message = JSON.parse(data.toString());
          this.handleMessage(message);
        } catch (error) {
          console.error('Message parsing error:', error);
        }
      });

      this.ws.on('close', () => {
        this.connected = false;
        console.log('Disconnected from browser REPL server');
      });

      this.ws.on('error', (error) => {
        console.error('WebSocket error:', error);
        reject(error);
      });
    });
  }

  handleMessage(message) {
    if (message.type === 'result') {
      const requestId = message.requestId;
      const pending = this.pendingRequests.get(requestId);
      if (pending) {
        if (message.error) {
          console.error('Error:', message.error);
        } else {
          console.log('Result:', message.result);
        }
        this.pendingRequests.delete(requestId);
      } else {
        if (message.error) {
          console.error('Error:', message.error);
        } else {
          console.log('Result:', message.result);
        }
      }
    }
  }

  execute(code) {
    if (!this.connected) {
      console.error('Not connected to server');
      return;
    }

    const requestId = ++this.requestId;
    this.pendingRequests.set(requestId, {
      code,
      timestamp: new Date()
    });

    this.ws.send(JSON.stringify({
      type: 'execute',
      sessionId: this.sessionId,
      code,
      requestId
    }));
  }

  disconnect() {
    if (this.ws) {
      this.ws.close();
    }
  }
}