
import fs from 'fs';
import https from 'https';

const themesContent = fs.readFileSync('src/lib/themes.ts', 'utf8');
const urlRegex = /imageUrl:\s*'(https?:\/\/[^']+)'/g;
let match;
const urls = [];

while ((match = urlRegex.exec(themesContent)) !== null) {
    urls.push(match[1]);
}

console.log(`Checking ${urls.length} images...`);

urls.forEach(url => {
    https.get(url, (res) => {
        if (res.statusCode !== 200) {
            console.log(`[FAIL] ${res.statusCode} - ${url}`);
        } else {
            // console.log(`[OK] ${url}`);
        }
    }).on('error', (e) => {
        console.log(`[ERROR] ${e.message} - ${url}`);
    });
});
