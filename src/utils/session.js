import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';

const SESSION_FILE = join(homedir(), '.replmirror-session');

export function saveSession(sessionData) {
  try {
    writeFileSync(SESSION_FILE, JSON.stringify(sessionData, null, 2));
    return true;
  } catch (error) {
    console.error('Failed to save session:', error.message);
    return false;
  }
}

export function loadSession() {
  try {
    if (existsSync(SESSION_FILE)) {
      const data = JSON.parse(readFileSync(SESSION_FILE, 'utf8'));
      return data;
    }
  } catch (error) {
    console.error('Failed to load session:', error.message);
  }
  return null;
}

export function getSessionCode() {
  const session = loadSession();
  if (!session) return null;

  // Determine WebSocket protocol based on host (not just port)
  const wsProtocol = session.host.startsWith('https') ? 'wss' : 'ws';

  // Remove protocol from host for WebSocket URL
  const wsHost = session.host.replace(/^https?:\/\//, '');

  return `// ReplMirror Browser Connection Code
// Session: ${session.sessionId}
// Generated: ${session.generated}
// Last Updated: ${session.lastUpdated || 'N/A'}
(function() {
  const ws = new WebSocket('${wsProtocol}://${wsHost}:${session.port}/repl');
  const sessionId = '${session.sessionId}';

  ws.onopen = function() {
    console.log('✅ Connected to ReplMirror MCP server');
    console.log('Session ID:', sessionId);

    // Register with the server
    ws.send(JSON.stringify({
      type: 'register',
      role: 'browser',
      sessionId: sessionId,
      timestamp: Date.now()
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
          requestId: data.requestId,
          timestamp: Date.now()
        }));
      } catch (error) {
        ws.send(JSON.stringify({
          type: 'result',
          sessionId: sessionId,
          result: null,
          error: error.message,
          requestId: data.requestId,
          timestamp: Date.now()
        }));
      }
    }
  };

  ws.onerror = function(error) {
    console.error('❌ WebSocket error:', error);
  };

  ws.onclose = function() {
    console.log('🔌 Disconnected from ReplMirror server');
  };

  // Expose helper for debugging
  window.replMirror = {
    sessionId: sessionId,
    ws: ws,
    status: 'connected'
  };
})();`;
}