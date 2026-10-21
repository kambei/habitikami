// Smoke test for the static routes the native apps depend on.
//
// Starts server.js against the freshly built dist/ with dummy credentials and
// checks that /.well-known/assetlinks.json (Digital Asset Links, required for
// the Android TWA to run without the browser address bar) and /manifest.json
// are served with status 200 and a JSON content type.
//
// Usage: npm run build && npm run test:smoke
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const webDir = join(dirname(fileURLToPath(import.meta.url)), '..');
const port = 3900 + Math.floor(Math.random() * 100);
const base = `http://127.0.0.1:${port}`;

const server = spawn(process.execPath, ['server.js'], {
    cwd: webDir,
    env: {
        ...process.env,
        PORT: String(port),
        NODE_ENV: 'test',
        VITE_GOOGLE_CLIENT_ID: 'smoke.apps.googleusercontent.com',
        VITE_SPREADSHEET_ID: 'smoke',
        GOOGLE_CLIENT_SECRET: 'smoke',
        ALLOWED_ORIGINS: 'https://habitikami.kambei.dev',
    },
    stdio: ['ignore', 'pipe', 'pipe'],
});
let serverOutput = '';
server.stdout.on('data', (d) => { serverOutput += d; });
server.stderr.on('data', (d) => { serverOutput += d; });

const CHECKS = [
    { path: '/.well-known/assetlinks.json', mustContain: '"package_name": "dev.kambei.habitikami"' },
    { path: '/manifest.json', mustContain: '"start_url"' },
];

async function waitForServer() {
    for (let i = 0; i < 50; i++) {
        try {
            await fetch(`${base}/robots.txt`);
            return;
        } catch {
            await new Promise((r) => setTimeout(r, 200));
        }
    }
    throw new Error(`server did not start on ${base}\n${serverOutput}`);
}

const failures = [];
try {
    await waitForServer();
    for (const check of CHECKS) {
        const res = await fetch(`${base}${check.path}`, { redirect: 'manual' });
        const type = res.headers.get('content-type') || '';
        const body = await res.text();
        const ok = res.status === 200 && type.startsWith('application/json') && body.includes(check.mustContain);
        console.log(`${ok ? 'ok  ' : 'FAIL'} ${check.path} -> ${res.status} ${type}`);
        if (!ok) failures.push(check.path);
    }
} catch (e) {
    failures.push(e.message);
} finally {
    server.kill();
}

if (failures.length) {
    console.error(`\nSmoke test failed: ${failures.join(', ')}`);
    process.exit(1);
}
console.log('\nStatic smoke test passed.');
