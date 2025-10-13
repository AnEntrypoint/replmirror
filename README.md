# Browser REPL WebSocket

A WebSocket-based browser REPL tool that provides programmatic access to browser sessions via CLI and MCP server.

## Features

- WebSocket server for browser REPL connections
- CLI tool for interactive JavaScript execution
- MCP server integration for seamless automation
- Playwright testing support
- Modular architecture for reusability

## Installation

```bash
npm install
```

## Usage

### 1. Start the WebSocket Server

```bash
npm start
# or
browser-repl-server
```

The server will output connection codes for both browser and CLI.

### 2. Connect Browser

Paste the provided JavaScript code into your browser's developer console.

### 3. Connect CLI

Use the provided CLI command:

```bash
browser-repl --session YOUR_SESSION_ID --host localhost --port 8080
```

### 4. MCP Server Configuration

Add to your Claude MCP configuration:

```json
{
  "mcpServers": {
    "browser-repl": {
      "command": "node",
      "args": ["src/mcp/mcp-server.js"],
      "env": {
        "REPL_HOST": "localhost",
        "REPL_PORT": "8080",
        "REPL_SESSION": "YOUR_SESSION_ID"
      }
    }
  }
}
```

## Architecture

- `src/core/websocket.js` - Core WebSocket server implementation
- `src/core/client.js` - WebSocket client for CLI connections
- `src/server/index.js` - Standalone WebSocket server
- `src/cli/index.js` - Interactive CLI client
- `src/mcp/server.js` - MCP server wrapper
- `src/mcp/mcp-server.js` - MCP protocol implementation

## Testing

```bash
npm test
```

## API

### WebSocketREPLServer

```javascript
import { WebSocketREPLServer } from './src/core/websocket.js';

const server = new WebSocketREPLServer({
  port: 8080,
  host: '0.0.0.0'
});

server.start();
```

### WebSocketREPLClient

```javascript
import { WebSocketREPLClient } from './src/core/client.js';

const client = new WebSocketREPLClient({
  host: 'localhost',
  port: 8080,
  sessionId: 'your-session-id'
});

await client.connect();
client.execute('document.title');
```

### MCPBrowserREPLServer

```javascript
import { MCPBrowserREPLServer } from './src/mcp/server.js';

const mcpServer = new MCPBrowserREPLServer({
  host: 'localhost',
  port: 8080,
  sessionId: 'your-session-id'
});

await mcpServer.initialize();
const result = await mcpServer.executeJavaScript('1 + 1');
```

## License

MIT