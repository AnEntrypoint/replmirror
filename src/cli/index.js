import { Command } from 'commander';
import { WebSocketREPLClient } from '../core/client.js';
import { WebSocketREPLServer } from '../core/websocket.js';
import { MCPBrowserREPLServer } from '../mcp/server.js';
import { createInterface } from 'readline';
import { randomBytes } from 'crypto';
import { saveSession, loadSession, getSessionCode } from '../utils/session.js';

const program = new Command();

program
  .name('browser-repl')
  .description('WebSocket-based browser REPL with CLI and MCP support');

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
  .action(async () => {
    // Load session from hidden file automatically
    const session = loadSession();

    if (!session) {
      console.error('❌ No session found. Run "npx browser-repl-websocket code" first to generate a session.');
      process.exit(1);
    }

    console.log(`🔗 Using session from ~/.replmirror-session`);
    console.log(`📋 Session ID: ${session.sessionId}`);
    console.log(`🌐 Server: ${session.host}:${session.port}`);

    // Set environment for MCP server
    process.env.REPL_HOST = session.host;
    process.env.REPL_PORT = session.port;
    process.env.REPL_SESSION_ID = session.sessionId;

    // Import and use the proper MCP server
    const { StdioServerTransport } = await import('../mcp/mcp-server.js');

    const transport = new StdioServerTransport();
    await transport.start();

    process.on('SIGINT', async () => {
      process.exit(0);
    });
  });

program
  .command('code')
  .description('Generate browser connection code')
  .option('--host <host>', 'Remote host (e.g., https://replmirror.247420.xyz)')
  .option('--port <port>', 'Remote port (default: 443 for https, 80 for http)')
  .action((options) => {
    // Check if we already have a session
    let existingSession = loadSession();

    let sessionData;
    if (existingSession) {
      console.log('📁 Found existing session in ~/.replmirror-session');
      sessionData = existingSession;

      // If remote host provided, update the session
      if (options.host) {
        console.log('🔄 Updating session with remote host');
        sessionData.host = options.host;
        sessionData.port = options.port || (options.host.startsWith('https') ? '443' : '80');
        sessionData.lastUpdated = new Date().toISOString();

        if (saveSession(sessionData)) {
          console.log('💾 Updated session with remote host');
        }
      }
    } else {
      // Create new session
      const sessionId = randomBytes(16).toString('hex');

      // Use remote host if provided, otherwise default to localhost
      let host = options.host || 'localhost';
      let port = options.port || (host.startsWith('https') ? '443' : '80');

      sessionData = {
        sessionId,
        host,
        port,
        generated: new Date().toISOString()
      };

      // Save to hidden file
      if (saveSession(sessionData)) {
        console.log('💾 Session saved to ~/.replmirror-session');
      }
    }

    const browserCode = getSessionCode();

    console.log('🌐 ReplMirror Browser Connection Code');
    console.log('═'.repeat(50));
    console.log(browserCode);
    console.log('═'.repeat(50));
    console.log(`📋 Session ID: ${sessionData.sessionId}`);
    console.log(`🔗 Server: ${sessionData.host}:${sessionData.port}`);
    console.log(`🕐 Generated: ${sessionData.generated}`);
    console.log('');
    console.log('Instructions:');
    console.log('1. Start WebSocket server: npx browser-repl-websocket@latest server');
    console.log('2. Copy the code above');
    console.log('3. Open your browser console');
    console.log('4. Paste and execute the code');
    console.log('5. The browser is now ready for MCP commands');
    console.log('');
    console.log('💡 Session is automatically saved - MCP server will use it');
    console.log('🔄 Use the same code in multiple browsers to switch the connection');
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


program.parse();