// start-standalone-https.js
const https = require('https');
const fs = require('fs');
const path = require('path');
const httpProxy = require('http-proxy');
const { spawn } = require('child_process');

// Configurações
const HTTPS_PORT = process.env.PORT || 3000;
const INTERNAL_PORT = 3001; // Porta interna do servidor Next.js
const HOST = '0.0.0.0';

// Caminho dos certificados (gerados pelo `next dev --experimental-https`)
const CERT_DIR = path.join(process.cwd(), 'certificates');
const KEY_PATH = path.join(CERT_DIR, 'localhost-key.pem');
const CERT_PATH = path.join(CERT_DIR, 'localhost.pem');
const CA_PATH = path.join(CERT_DIR, 'localhost-root-ca.pem'); // opcional

// Verifica se os certificados existem
if (!fs.existsSync(KEY_PATH) || !fs.existsSync(CERT_PATH)) {
  console.error('❌ Certificados não encontrados. Gere-os com:');
  console.error('   next dev --experimental-https');
  console.error('   ou use o mkcert para criar novos.');
  process.exit(1);
}

// 1. Inicia o servidor Next.js standalone em HTTP na porta interna
const nextServer = spawn('node', ['.next/standalone/server.js'], {
  env: {
    ...process.env,
    PORT: INTERNAL_PORT,
    HOSTNAME: '127.0.0.1',
  },
  stdio: 'inherit',
});

// 2. Cria o proxy HTTPS
const proxy = httpProxy.createProxyServer({
  target: `http://127.0.0.1:${INTERNAL_PORT}`,
  changeOrigin: true,
});

// 3. Cria o servidor HTTPS
const server = https.createServer(
  {
    key: fs.readFileSync(KEY_PATH),
    cert: fs.readFileSync(CERT_PATH),
    ca: fs.existsSync(CA_PATH) ? fs.readFileSync(CA_PATH) : undefined,
  },
  (req, res) => proxy.web(req, res)
);

// 4. Trata erros e upgrade de WebSocket
server.on('upgrade', (req, socket, head) => proxy.ws(req, socket, head));
proxy.on('error', (err, req, res) => {
  console.error('Erro no proxy:', err);
  if (res && !res.headersSent) {
    res.writeHead(502);
    res.end('Bad Gateway');
  }
});

// 5. Inicia o servidor HTTPS
server.listen(HTTPS_PORT, HOST, () => {
  console.log(`✅ HTTPS server rodando em https://${HOST}:${HTTPS_PORT}`);
  console.log(`   Proxy para Next.js na porta interna ${INTERNAL_PORT}`);
});

// Encerramento limpo
process.on('SIGINT', () => {
  nextServer.kill();
  server.close();
  process.exit(0);
});