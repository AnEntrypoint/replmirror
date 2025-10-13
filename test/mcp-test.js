import { MCPBrowserREPLServer } from '../src/mcp/server.js';

async function testMCPWorkflow() {
  console.log('🧪 Testing MCP Server Workflow...\n');

  const mcpServer = new MCPBrowserREPLServer({
    host: 'localhost',
    port: 8080
  });

  try {
    console.log('1. Testing listTools...');
    const tools = await mcpServer.listTools();
    console.log('✅ Tools available:', tools.tools.map(t => t.name));

    console.log('\n2. Testing connection workflow...');
    console.log('This should display browser code and wait for connection');

    const connectionResult = await mcpServer.ensureConnected();
    console.log('Connection result:', connectionResult);

    console.log('\n3. Testing JavaScript execution...');
    const result = await mcpServer.executeJavaScript('1 + 1');
    console.log('✅ Execution result:', result);

    console.log('\n4. Testing tool call...');
    const toolResult = await mcpServer.callTool('execute_javascript', {
      code: 'document.title'
    });
    console.log('✅ Tool call result:', toolResult);

    console.log('\n✅ MCP workflow test completed successfully!');

  } catch (error) {
    console.error('❌ Test failed:', error.message);
  } finally {
    await mcpServer.shutdown();
  }
}

testMCPWorkflow();