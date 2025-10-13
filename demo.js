import { WebSocketREPLServer } from './src/core/websocket.js';

console.log('=== Browser REPL Demo ===\n');

const server = new WebSocketREPLServer({
  port: 8080,
  host: 'localhost'
});

server.start();

console.log('\n📋 Instructions:');
console.log('1. Copy the browser code above and paste it into your browser console');
console.log('2. Copy the CLI command above and run it in a separate terminal');
console.log('3. In the CLI, try these commands:');
console.log('   - document.title');
console.log('   - window.location.href');
console.log('   - document.body.innerHTML = "<h1>Hello from CLI!</h1>"');
console.log('   - navigator.userAgent');
console.log('   - 1 + 1');
console.log('\nPress Ctrl+C to stop the server');

process.on('SIGINT', () => {
  console.log('\nShutting down demo server...');
  server.stop();
  process.exit(0);
});