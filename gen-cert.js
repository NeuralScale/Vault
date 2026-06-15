// Generates a self-signed cert for HTTPS (required for crypto.subtle on mobile)
// Run once: node gen-cert.js
// Then restart server.js — it will auto-detect and use HTTPS
const { execSync } = require('child_process');
const fs = require('fs');

try {
  execSync('openssl version', { stdio: 'ignore' });
} catch {
  console.error('OpenSSL not found. Install it or use a tool like mkcert.');
  process.exit(1);
}

execSync(
  'openssl req -x509 -newkey rsa:2048 -keyout key.pem -out cert.pem -days 365 -nodes ' +
  '-subj "/CN=localhost" -addext "subjectAltName=IP:192.168.0.0/16,IP:10.0.0.0/8,DNS:localhost"',
  { stdio: 'inherit' }
);

console.log('\nDone. Restart server.js — it will now run on HTTPS.');
console.log('On mobile: accept the browser warning about the self-signed cert, then use normally.');
