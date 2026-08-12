const fs = require('fs');
const http = require('http');
const path = require('path');
const { spawnSync } = require('child_process');

const repositoryRoot = path.resolve(__dirname, '..');
const previewPath = path.join(repositoryRoot, 'mahler-search-app', 'dic_abbreviation_test.html');
const previewUrlPath = '/mahler-search-app/dic_abbreviation_test.html';
const port = Number(process.argv[2] || 4173);

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.gif': 'image/gif',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
};

if (!Number.isInteger(port) || port < 1 || port > 65535) {
  console.error('Port must be an integer from 1 to 65535.');
  process.exit(1);
}

const buildResult = spawnSync(
  process.execPath,
  [path.join(__dirname, 'build-dictionary-preview.js'), previewPath],
  { cwd: repositoryRoot, encoding: 'utf8' }
);

if (buildResult.status !== 0) {
  process.stderr.write(buildResult.stderr || buildResult.stdout || 'Preview generation failed.\n');
  process.exit(buildResult.status || 1);
}

function resolveRequestPath(requestUrl) {
  const pathname = decodeURIComponent(new URL(requestUrl, 'http://localhost').pathname);
  const relativePath = pathname === '/' ? previewUrlPath.slice(1) : pathname.replace(/^\/+/, '');
  const filePath = path.resolve(repositoryRoot, relativePath);
  const relativeToRoot = path.relative(repositoryRoot, filePath);

  if (relativeToRoot.startsWith('..') || path.isAbsolute(relativeToRoot)) {
    return null;
  }
  return filePath;
}

const server = http.createServer((request, response) => {
  let filePath;
  try {
    filePath = resolveRequestPath(request.url || '/');
  } catch (error) {
    response.writeHead(400, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Bad request');
    return;
  }

  if (!filePath || !fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) {
    response.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
    response.end('Not found');
    return;
  }

  const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
  response.writeHead(200, {
    'Cache-Control': 'no-store',
    'Content-Type': contentType
  });

  if (request.method === 'HEAD') {
    response.end();
    return;
  }

  fs.createReadStream(filePath).pipe(response);
});

server.listen(port, '127.0.0.1', () => {
  console.log(`Dictionary preview: http://localhost:${port}${previewUrlPath}`);
  console.log('Press Ctrl+C to stop the server.');
});

server.on('error', error => {
  if (error.code === 'EADDRINUSE') {
    console.error(`Port ${port} is already in use.`);
  } else {
    console.error(error.message);
  }
  process.exit(1);
});
