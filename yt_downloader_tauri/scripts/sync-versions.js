/**
 * Sync version from package.json to Cargo.toml and tauri.conf.json
 * 
 * Usage: 
 *   node scripts/sync-versions.js        # Sync current version
 *   node scripts/sync-versions.js 1.0.3  # Set and sync specific version
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const ROOT = path.join(__dirname, '..');
const PACKAGE_JSON = path.join(ROOT, 'package.json');
const CARGO_TOML = path.join(ROOT, 'src-tauri', 'Cargo.toml');
const TAURI_CONF = path.join(ROOT, 'src-tauri', 'tauri.conf.json');

// Get version from args or package.json
const newVersion = process.argv[2];
const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf-8'));
const version = newVersion || pkg.version;

console.log(`📦 Syncing version: ${version}\n`);

// Update package.json (if new version provided)
if (newVersion) {
    pkg.version = version;
    fs.writeFileSync(PACKAGE_JSON, JSON.stringify(pkg, null, 2) + '\n');
    console.log(`✅ package.json -> ${version}`);
} else {
    console.log(`📋 package.json: ${version} (source)`);
}

// Update Cargo.toml
let cargo = fs.readFileSync(CARGO_TOML, 'utf-8');
cargo = cargo.replace(/^version = ".*"$/m, `version = "${version}"`);
fs.writeFileSync(CARGO_TOML, cargo);
console.log(`✅ Cargo.toml -> ${version}`);

// Update tauri.conf.json
const tauriConf = JSON.parse(fs.readFileSync(TAURI_CONF, 'utf-8'));
tauriConf.version = version;
fs.writeFileSync(TAURI_CONF, JSON.stringify(tauriConf, null, 2) + '\n');
console.log(`✅ tauri.conf.json -> ${version}`);

console.log(`\n🎉 All versions synced to ${version}`);
