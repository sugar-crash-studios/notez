/**
 * Application configuration loaded at startup
 * Caches values that don't change during runtime to avoid repeated I/O
 */

import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Cache app version from package.json at module load time
let appVersion = '1.0.0';

try {
  const packageJsonPath = join(__dirname, '../../package.json');
  const packageJson = JSON.parse(readFileSync(packageJsonPath, 'utf-8'));
  appVersion = packageJson.version || '1.0.0';
} catch (error) {
  console.warn('⚠️  Could not read package.json for version, using default:', appVersion);
}

export const APP_VERSION = appVersion;
export const NODE_VERSION = process.version;
