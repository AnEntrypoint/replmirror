# NPX Usage

## Install and Run with NPX

### Start Server
```bash
npx browser-repl-websocket server
```

### Connect CLI to Server
```bash
npx browser-repl-websocket connect --session YOUR_SESSION_ID
```

### Start MCP Server
```bash
npx browser-repl-websocket mcp
```

### MCP Configuration
Add to Claude MCP config:
```json
{
  "mcpServers": {
    "browser-repl": {
      "command": "npx",
      "args": ["browser-repl-websocket", "mcp"],
      "env": {
        "REPL_HOST": "localhost",
        "REPL_PORT": "3000"
      }
    }
  }
}
```

## Features

- ✅ **Server Mode**: `npx browser-repl-websocket server`
- ✅ **MCP Mode**: `npx browser-repl-websocket mcp`
- ✅ **Connect Mode**: `npx browser-repl-websocket connect`
- ✅ **Port 3000**: Default server port
- ✅ **Auto-start**: Nixpacks deployment ready
- ✅ **Zero Install**: Works immediately with NPX