# Browser REPL WebSocket

A WebSocket-based browser automation tool with seamless MCP (Model Context Protocol) integration for Claude. Execute JavaScript in browsers remotely with zero configuration.

## ✨ Features

- 🚀 **Zero Configuration**: No environment variables or setup required
- 🔗 **Automatic Session Management**: Sessions saved automatically in `~/.replmirror-session`
- 🔄 **Session Switching**: Paste code in multiple browsers to switch connections
- 🌐 **WebSocket Secure**: Uses WSS for secure browser connections
- 🤖 **MCP Integration**: Works seamlessly with Claude via browser-repl MCP tool
- 📱 **Multi-Browser Support**: Multiple browsers can connect to the same session

## 🚀 Quick Start

### 1. Generate Browser Connection Code

```bash
npx browser-repl-websocket@latest code
```

This will:
- Generate a unique session ID
- Save the session automatically to `~/.replmirror-session`
- Display browser connection code

### 2. Connect Browser

Copy the generated JavaScript code and paste it into your browser's developer console.

### 3. Use with Claude

The MCP server automatically detects your session and connects to the browser. Simply ask Claude to use the browser-repl tool to execute JavaScript!

## 📋 Available Commands

### Generate Browser Code
```bash
npx browser-repl-websocket@latest code
npx browser-repl-websocket@latest code --host https://replmirror.247420.xyz
```
- Creates a new browser session (defaults to localhost:8080)
- `--host` option sets remote host (e.g., `https://replmirror.247420.xyz`)
- `--port` option sets custom port (auto-detected from host protocol)
- Saves session to hidden file for persistence
- Outputs connection code for browser

### Start MCP Server
```bash
npx browser-repl-websocket@latest mcp
```
- Automatically loads saved session
- Starts MCP server for Claude integration
- **No arguments required** - everything is automatic!

### CLI Connection (Advanced)
```bash
npx browser-repl-websocket@latest connect --session <session-id>
```

## 🔧 Claude MCP Configuration

Add this to your `.mcp.json` file:

```json
{
  "mcpServers": {
    "browser-repl": {
      "command": "npx",
      "args": ["-y", "browser-repl-websocket@latest", "mcp"]
    }
  }
}
```

Or add via CLI:
```bash
claude mcp add --scope project browser-repl -- npx -y browser-repl-websocket@latest mcp
```

## 🎯 Usage Examples

### Basic JavaScript Execution
```javascript
// Ask Claude to execute this:
document.title = "Hello from Claude!";
window.location.href
```

### Get Page Information
```javascript
return {
  title: document.title,
  url: window.location.href,
  userAgent: navigator.userAgent
};
```

### DOM Manipulation
```javascript
document.body.style.backgroundColor = 'lightblue';
document.querySelectorAll('a').forEach(link => console.log(link.href));
```

## 🔄 Session Management

- **Automatic Persistence**: Sessions saved to `~/.replmirror-session`
- **Remote Host Support**: Use `--host https://example.com` to connect to remote WebSocket servers
- **Session Switching**: Latest browser connection gets priority
- **Multi-MCP Support**: Multiple MCP servers can connect to same session
- **Isolation**: Different sessions don't interfere with each other

## 🌐 Remote Host Configuration

### Set Remote Host for New Session
```bash
npx browser-repl-websocket@latest code --host https://your-server.com
```

### Update Existing Session to Remote Host
```bash
npx browser-repl-websocket@latest code --host https://replmirror.247420.xyz
```

### Custom Port Configuration
```bash
npx browser-repl-websocket@latest code --host https://your-server.com --port 8080
```

The remote host configuration is automatically saved and will be used by both the browser connection code and the MCP server.

## 🏗️ Architecture

- `src/core/websocket.js` - WebSocket server with session management
- `src/core/client.js` - WebSocket client with role-based connections
- `src/mcp/server.js` - MCP browser automation server
- `src/mcp/mcp-server.js` - MCP protocol implementation
- `src/utils/session.js` - Session persistence and management

## 🛠️ Development

```bash
# Install dependencies
npm install

# Run locally
npm start

# Run tests
npm test

# Publish new version
npm version patch
npm publish
```

## 📄 License

MIT