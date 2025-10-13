import { chromium } from 'playwright';
import { spawn } from 'child_process';
import { WebSocketREPLServer } from '../src/core/websocket.js';
import { WebSocketREPLClient } from '../src/core/client.js';

async function runTest() {
  console.log('Starting browser REPL test...');

  const server = new WebSocketREPLServer({ port: 8081 });
  server.start();

  await new Promise(resolve => setTimeout(resolve, 1000));

  const browser = await chromium.launch();
  const page = await browser.newPage();

  const sessionId = 'test-session-123';

  const browserCode = server.generateBrowserCode(sessionId);
  await page.evaluate(browserCode);
  await new Promise(resolve => setTimeout(resolve, 500));

  const client = new WebSocketREPLClient({
    host: 'localhost',
    port: 8081,
    sessionId: sessionId
  });

  await client.connect();

  console.log('Testing basic execution...');

  let testResults = [];

  client.execute('1 + 1');
  await new Promise(resolve => setTimeout(resolve, 500));

  client.execute('document.title');
  await new Promise(resolve => setTimeout(resolve, 500));

  client.execute('window.location.href');
  await new Promise(resolve => setTimeout(resolve, 500));

  client.execute('navigator.userAgent');
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('Testing error handling...');
  client.execute('undefinedVariable');
  await new Promise(resolve => setTimeout(resolve, 500));

  client.execute('throw new Error("Test error")');
  await new Promise(resolve => setTimeout(resolve, 500));

  console.log('Testing DOM manipulation...');
  client.execute('document.body.innerHTML = "<h1>Test Page</h1>"');
  await new Promise(resolve => setTimeout(resolve, 500));

  const bodyContent = await page.evaluate(() => document.body.innerHTML);
  if (bodyContent.includes('<h1>Test Page</h1>')) {
    console.log('✓ DOM manipulation test passed');
    testResults.push('DOM manipulation: PASSED');
  } else {
    console.log('✗ DOM manipulation test failed');
    console.log('Expected content with <h1>Test Page</h1>, got:', bodyContent);
    testResults.push('DOM manipulation: FAILED');
  }

  console.log('Test Results:', testResults);

  client.disconnect();
  await browser.close();
  server.stop();

  console.log('Test completed!');
}

runTest().catch(console.error);