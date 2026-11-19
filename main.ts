/**
 * VICE FRAME — make.fun `gta6-cover-art-01` submission entrypoint (Node 22, stdlib only).
 * Copies the static offline web app (`app/`) and verified renders (`screenshots/`) into
 * the output directory and writes a deterministic `dossier.json` via `vendor/makefun-app.ts`.
 */

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

const REPO_ROOT = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = process.env.MAKEFUN_OUTPUT_DIR || '/output';

const GATE_CAPS = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

function publishEntryArtifact(): void {
  mkdirSync(OUTPUT_DIR, { recursive: true });

  const appSourceDir = join(REPO_ROOT, 'app');
  const appOutputDir = join(OUTPUT_DIR, 'app');
  cpSync(appSourceDir, appOutputDir, { recursive: true, force: true });

  const shotsSourceDir = join(REPO_ROOT, 'screenshots');
  const shotsOutputDir = join(OUTPUT_DIR, 'screenshots');
  mkdirSync(shotsOutputDir, { recursive: true });
  if (existsSync(shotsSourceDir)) {
    cpSync(shotsSourceDir, shotsOutputDir, { recursive: true, force: true });
  }

  const dossierBytes = buildDossier(OUTPUT_DIR, GATE_CAPS);
  writeFileSync(join(OUTPUT_DIR, 'dossier.json'), dossierBytes);
}

publishEntryArtifact();
