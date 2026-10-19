import { execSync } from 'node:child_process';

// The test servers serve dist/, so the client is built once for the whole run. E2E_SKIP_BUILD=1 reuses the last build.
export default function globalSetup(): void {
  if (process.env.E2E_SKIP_BUILD !== '1') execSync('npx vite build', { stdio: 'inherit' });
}
