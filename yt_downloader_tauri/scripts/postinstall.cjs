/**
 * Postinstall script to download required binaries
 * Runs automatically after `npm install`
 */

const https = require('https');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BINARIES_DIR = path.join(__dirname, 'src-tauri', 'binaries');

const BINARIES = {
    'yt-dlp': {
        url: 'https://github.com/yt-dlp/yt-dlp/releases/latest/download/yt-dlp.exe',
        filename: 'yt-dlp-x86_64-pc-windows-msvc.exe'
    },
    'aria2c': {
        url: 'https://github.com/aria2/aria2/releases/download/release-1.37.0/aria2-1.37.0-win-64bit-build1.zip',
        filename: 'aria2c-x86_64-pc-windows-msvc.exe',
        isZip: true,
        zipPath: 'aria2-1.37.0-win-64bit-build1/aria2c.exe'
    },
    'ffmpeg': {
        url: 'https://github.com/yt-dlp/FFmpeg-Builds/releases/download/latest/ffmpeg-master-latest-win64-gpl.zip',
        filename: 'ffmpeg-x86_64-pc-windows-msvc.exe',
        isZip: true,
        zipPath: 'ffmpeg-master-latest-win64-gpl/bin/ffmpeg.exe'
    }
};

function downloadFile(url, dest) {
    return new Promise((resolve, reject) => {
        console.log(`Downloading: ${url}`);

        const file = fs.createWriteStream(dest);

        const request = (url) => {
            https.get(url, (response) => {
                if (response.statusCode === 302 || response.statusCode === 301) {
                    // Follow redirect
                    request(response.headers.location);
                    return;
                }

                if (response.statusCode !== 200) {
                    reject(new Error(`Failed to download: ${response.statusCode}`));
                    return;
                }

                response.pipe(file);
                file.on('finish', () => {
                    file.close();
                    resolve();
                });
            }).on('error', reject);
        };

        request(url);
    });
}

async function extractFromZip(zipPath, entryPath, destPath) {
    console.log(`Extracting ${entryPath} from ${zipPath}...`);

    // Use PowerShell to extract
    const tempDir = path.join(BINARIES_DIR, 'temp_extract');

    try {
        execSync(`powershell -Command "Expand-Archive -Path '${zipPath}' -DestinationPath '${tempDir}' -Force"`, { stdio: 'inherit' });

        const sourcePath = path.join(tempDir, entryPath);
        fs.copyFileSync(sourcePath, destPath);

        // Cleanup
        fs.rmSync(tempDir, { recursive: true, force: true });
        fs.unlinkSync(zipPath);
    } catch (err) {
        console.error(`Failed to extract: ${err.message}`);
        throw err;
    }
}

async function main() {
    console.log('\n📦 Downloading required binaries...\n');

    // Create binaries directory
    if (!fs.existsSync(BINARIES_DIR)) {
        fs.mkdirSync(BINARIES_DIR, { recursive: true });
    }

    for (const [name, config] of Object.entries(BINARIES)) {
        const destPath = path.join(BINARIES_DIR, config.filename);

        if (fs.existsSync(destPath)) {
            console.log(`✅ ${name} already exists`);
            continue;
        }

        try {
            if (config.isZip) {
                const zipPath = path.join(BINARIES_DIR, `${name}.zip`);
                await downloadFile(config.url, zipPath);
                await extractFromZip(zipPath, config.zipPath, destPath);
            } else {
                await downloadFile(config.url, destPath);
            }
            console.log(`✅ ${name} downloaded successfully`);
        } catch (err) {
            console.error(`❌ Failed to download ${name}: ${err.message}`);
        }
    }

    console.log('\n✅ All binaries ready!\n');
}

main().catch(console.error);
