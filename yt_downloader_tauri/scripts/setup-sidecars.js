const fs = require('fs');
const path = require('path');
const https = require('https');
const { execSync } = require('child_process');

const binDir = path.join(__dirname, '../src-tauri/binaries');
if (!fs.existsSync(binDir)) {
    fs.mkdirSync(binDir, { recursive: true });
}

const EXT = process.platform === 'win32' ? '.exe' : '';

const targets = [
    // Windows
    { platform: 'win32', arch: 'x64', triple: 'x86_64-pc-windows-msvc', ext: '.exe' },
    // macOS (Intel)
    { platform: 'darwin', arch: 'x64', triple: 'x86_64-apple-darwin', ext: '' },
    // macOS (Silicon)
    { platform: 'darwin', arch: 'arm64', triple: 'aarch64-apple-darwin', ext: '' },
    // Linux
    { platform: 'linux', arch: 'x64', triple: 'x86_64-unknown-linux-gnu', ext: '' },
];

// URLs
const YTDLP_LATEST = "https://github.com/yt-dlp/yt-dlp/releases/latest/download";

async function download(url, dest) {
    return new Promise((resolve, reject) => {
        const file = fs.createWriteStream(dest);
        https.get(url, response => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                download(response.headers.location, dest).then(resolve).catch(reject);
                return;
            }
            response.pipe(file);
            file.on('finish', () => {
                file.close();
                resolve();
            });
        }).on('error', err => {
            fs.unlink(dest, () => reject(err));
        });
    });
}

async function main() {
    console.log("Preparing sidecars...");

    for (const target of targets) {
        const ytdlpName = `yt-dlp-${target.triple}${target.ext}`;
        const dest = path.join(binDir, ytdlpName);

        if (fs.existsSync(dest)) {
            console.log(`[SKIP] ${ytdlpName} already exists`);
            continue;
        }

        let urlFilename = 'yt-dlp';
        if (target.platform === 'win32') urlFilename = 'yt-dlp.exe';
        else if (target.platform === 'darwin') urlFilename = 'yt-dlp_macos'; // Universal or legacy? latest is universal usually called yt-dlp_macos
        else if (target.platform === 'linux') urlFilename = 'yt-dlp';

        const url = `${YTDLP_LATEST}/${urlFilename}`;

        console.log(`[DOWNLOAD] Fetching ${ytdlpName}...`);
        try {
            await download(url, dest);
            if (target.platform !== 'win32') {
                fs.chmodSync(dest, 0o755);
            }
            console.log(`[OK] Downloaded ${ytdlpName}`);
        } catch (e) {
            console.error(`[ERROR] Failed to download ${ytdlpName}: ${e.message}`);
        }
    }

    console.log("\nNOTE: FFmpeg binaries must be downloaded manually due to licensing/complexity.");
    console.log("Please place ffmpeg binaries in src-tauri/binaries/ named as ffmpeg-<target-triple>");
}

main();
