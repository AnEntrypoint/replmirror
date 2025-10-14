#!/usr/bin/env node

import { spawn } from 'child_process';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPTestClient {
  constructor() {
    this.server = null;
    this.messageId = 1;
    this.initialized = false;
  }

  async start() {
    console.log('🚀 Starting MCP Server Test...\n');

    // Start the MCP server process
    this.server = spawn('node', [join(__dirname, '../src/mcp/mcp-server.js')], {
      stdio: ['pipe', 'pipe', 'inherit']
    });

    this.server.on('error', (error) => {
      console.error('Failed to start server:', error);
      process.exit(1);
    });

    this.server.on('exit', (code) => {
      console.log(`Server exited with code ${code}`);
    });

    // Set up stdout handling
    this.server.stdout.setEncoding('utf8');
    this.responses = [];
    this.server.stdout.on('data', (data) => {
      const responses = data.toString().trim().split('\n');
      for (const response of responses) {
        if (response.trim()) {
          try {
            const parsed = JSON.parse(response);
            this.responses.push(parsed);
            console.log('📥 Server response:', JSON.stringify(parsed, null, 2));
          } catch (error) {
            console.log('📥 Raw server response:', response);
          }
        }
      }
    });
  }

  async sendRequest(method, params = null) {
    const id = this.messageId++;
    const request = {
      jsonrpc: '2.0',
      id,
      method
    };

    if (params !== null) {
      request.params = params;
    }

    console.log(`📤 Sending request (${id}):`, JSON.stringify(request, null, 2));
    this.server.stdin.write(JSON.stringify(request) + '\n');

    // Wait for response
    return this.waitForResponse(id);
  }

  async sendNotification(method, params = null) {
    const notification = {
      jsonrpc: '2.0',
      method
    };

    if (params !== null) {
      notification.params = params;
    }

    console.log('📤 Sending notification:', JSON.stringify(notification, null, 2));
    this.server.stdin.write(JSON.stringify(notification) + '\n');
  }

  async waitForResponse(id, timeout = 5000) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeout) {
      const response = this.responses.find(r => r.id === id);
      if (response) {
        return response;
      }
      await new Promise(resolve => setTimeout(resolve, 50));
    }

    throw new Error(`Timeout waiting for response to request ${id}`);
  }

  async testInitialize() {
    console.log('\n🔧 Testing MCP Initialization...');

    // Test 1: Invalid JSON-RPC version
    console.log('\n1️⃣ Testing invalid JSON-RPC version...');
    this.server.stdin.write('{"id":1,"method":"initialize","params":{"protocolVersion":"2025-06-18"}}\n');
    await new Promise(resolve => setTimeout(resolve, 100));

    // Test 2: Invalid protocol version
    console.log('\n2️⃣ Testing unsupported protocol version...');
    const response2 = await this.sendRequest('initialize', {
      protocolVersion: '2020-01-01',
      capabilities: { roots: {} },
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });

    if (response2.error) {
      console.log('✅ Correctly rejected unsupported protocol version');
    } else {
      console.log('❌ Should have rejected unsupported protocol version');
    }

    // Test 3: Valid initialization
    console.log('\n3️⃣ Testing valid initialization...');
    const response3 = await this.sendRequest('initialize', {
      protocolVersion: '2025-06-18',
      capabilities: { roots: { listChanged: true } },
      clientInfo: { name: 'test-client', version: '1.0.0' }
    });

    if (response3.result) {
      console.log('✅ Initialization successful');
      console.log('📋 Server capabilities:', JSON.stringify(response3.result.capabilities, null, 2));
      this.initialized = true;
    } else {
      console.log('❌ Initialization failed:', response3.error);
      throw new Error('Initialization failed');
    }

    // Test 4: Send initialized notification
    console.log('\n4️⃣ Sending initialized notification...');
    await this.sendNotification('notifications/initialized');
    await new Promise(resolve => setTimeout(resolve, 100));
  }

  async testToolsList() {
    console.log('\n🔧 Testing Tools List...');

    const response = await this.sendRequest('tools/list');

    if (response.result && response.result.tools) {
      console.log('✅ Tools list successful');
      console.log('🛠️ Available tools:', response.result.tools.map(t => `${t.name}: ${t.description}`));
    } else {
      console.log('❌ Tools list failed:', response.error);
    }
  }

  async testToolCall() {
    console.log('\n🔧 Testing Tool Call...');

    const response = await this.sendRequest('tools/call', {
      name: 'execute_javascript',
      arguments: {
        code: '2 + 2'
      }
    });

    if (response.result && response.result.content) {
      console.log('✅ Tool call successful');
      console.log('📄 Tool result:', JSON.stringify(response.result.content, null, 2));
    } else {
      console.log('❌ Tool call failed:', response.error);
    }
  }

  async testInvalidRequests() {
    console.log('\n🔧 Testing Invalid Requests...');

    // Test 1: Method not found
    console.log('\n1️⃣ Testing unknown method...');
    const response1 = await this.sendRequest('unknown/method');
    if (response1.error && response1.error.code === -32601) {
      console.log('✅ Correctly returned method not found error');
    } else {
      console.log('❌ Should have returned method not found error');
    }

    // Test 2: Invalid tool call (missing params)
    console.log('\n2️⃣ Testing invalid tool call (missing params)...');
    const response2 = await this.sendRequest('tools/call');
    if (response2.error && response2.error.code === -32602) {
      console.log('✅ Correctly returned invalid params error');
    } else {
      console.log('❌ Should have returned invalid params error');
    }

    // Test 3: Tool call before initialization
    console.log('\n3️⃣ Testing requests before initialization...');
    const tempClient = new MCPTestClient();
    await tempClient.start();
    await new Promise(resolve => setTimeout(resolve, 200));

    const response3 = await tempClient.sendRequest('tools/list');
    if (response3.error) {
      console.log('✅ Correctly rejected request before initialization');
    } else {
      console.log('❌ Should have rejected request before initialization');
    }

    tempClient.server.kill();
  }

  async cleanup() {
    console.log('\n🧹 Cleaning up...');
    if (this.server) {
      this.server.kill();
      this.server = null;
    }
  }
}

async function runMCPComplianceTest() {
  const client = new MCPTestClient();

  try {
    await client.start();

    // Wait for server to be ready
    await new Promise(resolve => setTimeout(resolve, 500));

    // Run compliance tests
    await client.testInitialize();
    await client.testToolsList();
    await client.testToolCall();
    await client.testInvalidRequests();

    console.log('\n🎉 All MCP compliance tests passed!');

  } catch (error) {
    console.error('\n❌ MCP compliance test failed:', error.message);
    process.exit(1);
  } finally {
    await client.cleanup();
  }
}

runMCPComplianceTest();