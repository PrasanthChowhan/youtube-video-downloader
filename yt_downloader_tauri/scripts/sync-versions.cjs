/**
 * sync-versions.js
 * 
 * Reads version from package.json (single source of truth)
 * and syncs it to tauri.conf.json and Cargo.toml
 * 
 * Usage: node scripts/sync-versions.js
 */

const fs = require('fs');
const path = require('path');

// Paths relative to yt_downloader_tauri folder
const PACKAGE_JSON = path.join(__dirname, '..', 'package.json');
const TAURI_CONF = path.join(__dirname, '..', 'src-tauri', 'tauri.conf.json');
const CARGO_TOML = path.join(__dirname, '..', 'src-tauri', 'Cargo.toml');

function getVersion() {
    const pkg = JSON.parse(fs.readFileSync(PACKAGE_JSON, 'utf8'));
    return pkg.version;
}

function updateTauriConf(version) {
    const conf = JSON.parse(fs.readFileSync(TAURI_CONF, 'utf8'));
    const oldVersion = conf.version;
    conf.version = version;
    fs.writeFileSync(TAURI_CONF, JSON.stringify(conf, null, 2) + '\n');
    console.log(`✓ tauri.conf.json: ${oldVersion} → ${version}`);
}

function updateCargoToml(version) {
    let content = fs.readFileSync(CARGO_TOML, 'utf8');
    const oldVersion = content.match(/^version = "(.+)"$/m)?.[1];
    content = content.replace(/^version = ".+"$/m, `version = "${version}"`);
    fs.writeFileSync(CARGO_TOML, content);
    console.log(`✓ Cargo.toml: ${oldVersion} → ${version}`);
}

function main() {
    const version = getVersion();
    console.log(`\n📦 Syncing version: ${version}\n`);

    updateTauriConf(version);
    updateCargoToml(version);

    console.log(`\n✅ All files synced to v${version}\n`);
}

main();
