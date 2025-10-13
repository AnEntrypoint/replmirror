# MCP Server Setup

## Configuration

Add this to your Claude MCP configuration (`~/.claude/claude_desktop_config.json`):

```json
{
  "mcpServers": {
    "browser-repl": {
      "command": "node",
      "args": ["C:\\dev\\replmirror\\src\\mcp\\mcp-server.js"],
      "env": {
        "REPL_HOST": "localhost",
        "REPL_PORT": "8080"
      }
    }
  }
}
```

## Usage Workflow

1. **Start WebSocket Server** (required for MCP to connect):
   ```bash
   npm start
   # or
   browser-repl-server
   ```

2. **Use in Claude**:
   - Ask Claude to execute JavaScript in browser
   - First time: It will show browser connection code
   - Paste the code in browser console
   - Claude will confirm connection and execute commands

## Example Claude Prompts

```
Execute JavaScript in browser: document.title
```

```
Click on the first button: document.querySelector('button').click()
```

```
Get the page URL: window.location.href
```

```
Change the page title: document.title = "New Title"
```

## Features

- ✅ **Single Tool**: `execute_javascript` for all browser operations
- ✅ **Auto-Connection**: Prompts for browser connection when needed
- ✅ **Connection Reuse**: Stays connected after initial setup
- ✅ **Error Handling**: Clear error messages from browser
- ✅ **Session Management**: Secure unique session IDs

## Architecture

```
Claude → MCP Server → WebSocket Server → Browser
```

The MCP server handles:
- Connection management
- Browser code generation
- Session routing
- Error propagation