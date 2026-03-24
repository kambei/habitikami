import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const rootChangelog = path.join(__dirname, '..', '..', 'CHANGELOG.md');
const targetChangelog = path.join(__dirname, '..', 'CHANGELOG.md');

try {
    if (fs.existsSync(rootChangelog)) {
        fs.copyFileSync(rootChangelog, targetChangelog);
        console.log('✓ Synchronized CHANGELOG.md to web folder');
    } else {
        console.warn('! root CHANGELOG.md not found at', rootChangelog);
    }
} catch (err) {
    console.error('Failed to sync changelog:', err);
}
