import puppeteer from 'puppeteer-core';
import fs from 'fs';
import path from 'path';

const chromePaths = [
  'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe',
  'C:\\Program Files (x86)\\Google\\Chrome\\Application\\chrome.exe'
];

let executablePath = '';
for (const p of chromePaths) {
  if (fs.existsSync(p)) {
    executablePath = p;
    break;
  }
}

if (!executablePath) {
  console.error("Could not find Google Chrome installation.");
  process.exit(1);
}

const artifactDir = 'C:\\Users\\arrej\\.gemini\\antigravity-ide\\brain\\0e55d084-3ef6-4e6f-8059-b594557a8c96';

(async () => {
  const browser = await puppeteer.launch({
    executablePath,
    headless: true,
    defaultViewport: { width: 1920, height: 1080 },
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  
  page.on('console', msg => {
    console.log(`[STUDIO CONSOLE] ${msg.type().toUpperCase()}: ${msg.text()}`);
  });

  try {
    console.log("Navigating to http://localhost:3002/#project/video...");
    await page.goto('http://localhost:3002/#project/video', { waitUntil: 'networkidle2' });
    await new Promise(r => setTimeout(r, 4000));

    // Seek to 6s:
    // x = 430 + (1286 * 6 / 45) = 601
    // y = 828
    console.log("Seeking to 6s (should show PDF on page 77 directly)...");
    await page.mouse.click(601, 828);
    await new Promise(r => setTimeout(r, 4000)); // wait for load
    await page.screenshot({ path: path.join(artifactDir, 'media_inspect_editor_6s.png') });
    console.log("Saved 6s screenshot.");

    // Seek to 10s:
    // x = 430 + (1286 * 10 / 45) = 716
    // y = 828
    console.log("Seeking to 10s (should show scrolling down)...");
    await page.mouse.click(716, 828);
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(artifactDir, 'media_inspect_editor_10s.png') });
    console.log("Saved 10s screenshot.");

    // Seek to 14s:
    // x = 430 + (1286 * 14 / 45) = 830
    // y = 828
    console.log("Seeking to 14s (should be near page 81)...");
    await page.mouse.click(830, 828);
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(artifactDir, 'media_inspect_editor_14s.png') });
    console.log("Saved 14s screenshot.");

    // Seek to 16s:
    // x = 430 + (1286 * 16 / 45) = 887
    // y = 828
    console.log("Seeking to 16s (should show zoomed chessboard vertically centered)...");
    await page.mouse.click(887, 828);
    await new Promise(r => setTimeout(r, 3000));
    await page.screenshot({ path: path.join(artifactDir, 'media_inspect_editor_16s.png') });
    console.log("Saved 16s screenshot.");

  } catch (err) {
    console.error(`Error: ${err.message}`);
  }

  await browser.close();
  console.log("Finished seeking checks.");
})();
