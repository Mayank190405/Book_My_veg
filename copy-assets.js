const fs = require('fs');
const path = require('path');

const srcDir = 'C:\\Users\\MAYANK\\.gemini\\antigravity-ide\\brain\\351d4570-8ccd-4160-a134-4d573696b4f4';
const destDir = path.join(__dirname, 'client', 'public', 'images');

if (!fs.existsSync(destDir)) {
    fs.mkdirSync(destDir, { recursive: true });
}

// Read brain directory files
const files = fs.readdirSync(srcDir);
let bannerCopied = false;

files.forEach(file => {
    if (file.startsWith('hero_banner_') && file.endsWith('.png')) {
        fs.copyFileSync(path.join(srcDir, file), path.join(destDir, 'hero_banner.png'));
        console.log(`Copied ${file} to hero_banner.png`);
        bannerCopied = true;
    }
});

if (!bannerCopied) {
    console.log("No hero banner image found to copy yet.");
}
