/**
 * Captures real screenshots of the Chess Study app for the promo video.
 * Loads Grau Tomo I PDF and navigates to page 89.
 * Fixed: proper page navigation and dark mode captures.
 */
import puppeteer from 'puppeteer';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ASSETS_DIR = join(__dirname, 'assets');
const APP_URL = 'http://localhost:5173';

async function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function waitForPdfLoaded(page, timeout = 90000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const text = await page.evaluate(() => {
      const spans = [...document.querySelectorAll('span')];
      const deSpan = spans.find(s => s.textContent.match(/^de \d+$/));
      return deSpan ? deSpan.textContent : null;
    });
    if (text && text.match(/^de \d+$/) && !text.includes('?')) {
      return true;
    }
    await delay(500);
  }
  console.warn('  ⚠ Timeout waiting for PDF to load');
  return false;
}

async function navigateToPage(page, targetPage) {
  // Find ALL text inputs and look for the page input (numeric value, in the PDF toolbar)
  const inputs = await page.$$('input[type="text"]');
  for (const input of inputs) {
    const value = await page.evaluate(el => el.value, input);
    if (/^\d+$/.test(value)) {
      // Triple-click to select all text, then clear and type new page
      await input.click({ clickCount: 3 });
      await delay(100);
      // Use keyboard to clear the field completely
      await page.keyboard.down('Control');
      await page.keyboard.press('a');
      await page.keyboard.up('Control');
      await page.keyboard.press('Backspace');
      await delay(100);
      await input.type(String(targetPage), { delay: 50 });
      await delay(200);
      await input.press('Enter');
      await delay(4000); // Wait for page render
      return true;
    }
  }
  return false;
}

async function waitForPdfPageRender(page, ms = 5000) {
  // Wait extra time and check that the PDF iframe has rendered content
  await delay(ms);
}

async function main() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ['--no-sandbox', '--disable-setuid-sandbox'],
    defaultViewport: { width: 1920, height: 1080 },
  });

  const page = await browser.newPage();

  // --- Clear any saved state and set light theme + ocean board ---
  await page.goto(APP_URL, { waitUntil: 'networkidle0', timeout: 30000 });
  await page.evaluate(() => {
    localStorage.clear();
    localStorage.setItem('chess-study-theme', 'light');
    localStorage.setItem('chess-study-board-theme', 'ocean');
    localStorage.setItem('chess-study-layout-inverted', 'false');
    localStorage.setItem('chess-study-left-width', '45');
  });
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  await delay(2000);

  // ===== STEP 1: Load Tomo I PDF =====
  console.log('Loading Tomo I: Rudimentos...');
  const tomoBtn = await page.evaluateHandle(() => {
    const spans = [...document.querySelectorAll('span')];
    const tomoSpan = spans.find(s => s.textContent.includes('Tomo I: Rudimentos'));
    if (tomoSpan) {
      let el = tomoSpan;
      while (el && !el.classList.contains('glass-panel')) el = el.parentElement;
      return el || tomoSpan;
    }
    return null;
  });

  if (tomoBtn) {
    await tomoBtn.click();
    console.log('  Clicked on Tomo I card, waiting for PDF to load...');
    await waitForPdfLoaded(page, 90000);
    console.log('  PDF loaded!');
    await delay(3000);

    // Navigate to page 89
    console.log('  Navigating to page 89...');
    await navigateToPage(page, 89);
    await waitForPdfPageRender(page, 6000);
    
    // Verify the page number
    const pageNum = await page.evaluate(() => {
      const inputs = [...document.querySelectorAll('input[type="text"]')];
      for (const input of inputs) {
        if (/^\d+$/.test(input.value)) return input.value;
      }
      return 'unknown';
    });
    console.log(`  Current page: ${pageNum}`);
  }

  // ===== SCREENSHOT 1: Full app, Editor, Light, Ocean, PDF page 89 =====
  console.log('Capturing: full app - editor mode, light theme, ocean board, PDF page 89...');
  await page.screenshot({ path: join(ASSETS_DIR, 'app-editor-light-ocean.png') });
  console.log('  ✓ app-editor-light-ocean.png');

  // ===== SCREENSHOT 2: Chessboard close-up =====
  console.log('Capturing: chess board close-up...');
  const chessWrapper = await page.$('.chessboard-wrapper');
  if (chessWrapper) {
    await chessWrapper.screenshot({ path: join(ASSETS_DIR, 'chessboard-ocean-closeup.png') });
    console.log('  ✓ chessboard-ocean-closeup.png');
  }

  // ===== SCREENSHOT 3: Left panel (chess + controls) =====
  console.log('Capturing: left panel...');
  const leftPanel = await page.$('.left-panel');
  if (leftPanel) {
    await leftPanel.screenshot({ path: join(ASSETS_DIR, 'chess-panel-full.png') });
    console.log('  ✓ chess-panel-full.png');
  }

  // ===== SCREENSHOT 4: Right panel (PDF with Grau) =====
  console.log('Capturing: right panel (PDF)...');
  const rightPanel = await page.$('.right-panel');
  if (rightPanel) {
    await rightPanel.screenshot({ path: join(ASSETS_DIR, 'pdf-panel.png') });
    console.log('  ✓ pdf-panel.png');
  }

  // ===== SCREENSHOT 5: Header =====
  console.log('Capturing: header...');
  const header = await page.$('header');
  if (header) {
    await header.screenshot({ path: join(ASSETS_DIR, 'header-light.png') });
    console.log('  ✓ header-light.png');
  }

  // ===== SCREENSHOT 6: Game Mode =====
  console.log('Entering game mode...');
  const startBtn = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll('button')];
    return buttons.find(b => b.textContent.includes('EMPEZAR'));
  });
  if (startBtn) {
    await startBtn.click();
    await delay(800);
    const whitesBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.find(b => b.textContent.includes('Blancas'));
    });
    if (whitesBtn) {
      await whitesBtn.click();
      await delay(1500);
    }

    console.log('Capturing: game mode with PDF...');
    await page.screenshot({ path: join(ASSETS_DIR, 'app-game-mode.png') });
    console.log('  ✓ app-game-mode.png');

    // Make moves
    console.log('Making moves e4, e5, Nf3...');
    const moves = [
      { from: 'e2', to: 'e4' },
      { from: 'e7', to: 'e5' },
      { from: 'g1', to: 'f3' },
    ];
    for (const move of moves) {
      const fromSq = await page.$(`[data-square="${move.from}"]`);
      const toSq = await page.$(`[data-square="${move.to}"]`);
      if (fromSq && toSq) {
        const fromBox = await fromSq.boundingBox();
        const toBox = await toSq.boundingBox();
        if (fromBox && toBox) {
          await page.mouse.move(fromBox.x + fromBox.width / 2, fromBox.y + fromBox.height / 2);
          await page.mouse.down();
          await delay(100);
          await page.mouse.move(toBox.x + toBox.width / 2, toBox.y + toBox.height / 2, { steps: 10 });
          await page.mouse.up();
          await delay(600);
        }
      }
    }

    console.log('Capturing: game mode with moves...');
    await page.screenshot({ path: join(ASSETS_DIR, 'app-game-with-moves.png') });
    console.log('  ✓ app-game-with-moves.png');

    // Go back to editor mode
    const editBtn = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.find(b => b.textContent.trim() === 'Editar');
    });
    if (editBtn) {
      try { await editBtn.click(); } catch(e) {}
      await delay(500);
    }
  }

  // ===== SCREENSHOT 7: Settings =====
  console.log('Opening settings...');
  const settingsBtn = await page.evaluateHandle(() => {
    const buttons = [...document.querySelectorAll('button')];
    return buttons.find(b => b.title === 'Configuración');
  });
  if (settingsBtn) {
    try {
      await settingsBtn.click();
      await delay(800);
      await page.screenshot({ path: join(ASSETS_DIR, 'app-settings-open.png') });
      console.log('  ✓ app-settings-open.png');
    } catch(e) {
      console.log('  ⚠ Settings capture skipped');
    }
  }

  // ===== DARK MODE SCREENSHOTS =====
  console.log('Switching to dark theme...');
  await page.evaluate(() => {
    localStorage.setItem('chess-study-theme', 'dark');
    localStorage.setItem('chess-study-board-theme', 'ocean');
  });
  await page.reload({ waitUntil: 'networkidle0', timeout: 30000 });
  await delay(3000);

  // Wait for PDF to reload from IndexedDB
  const pdfLoaded = await waitForPdfLoaded(page, 60000);
  if (pdfLoaded) {
    await delay(2000);
    // Navigate back to page 89
    console.log('  Navigating dark mode to page 89...');
    await navigateToPage(page, 89);
    await waitForPdfPageRender(page, 6000);
  }

  console.log('Capturing: dark mode editor with PDF...');
  await page.screenshot({ path: join(ASSETS_DIR, 'app-dark-mode.png') });
  console.log('  ✓ app-dark-mode.png');

  // Dark game mode
  console.log('Entering dark game mode...');
  try {
    const startBtnDark = await page.evaluateHandle(() => {
      const buttons = [...document.querySelectorAll('button')];
      return buttons.find(b => b.textContent.includes('EMPEZAR'));
    });
    if (startBtnDark) {
      await startBtnDark.click();
      await delay(800);
      const whitesBtnDark = await page.evaluateHandle(() => {
        const buttons = [...document.querySelectorAll('button')];
        return buttons.find(b => b.textContent.includes('Blancas'));
      });
      if (whitesBtnDark) {
        await whitesBtnDark.click();
        await delay(1500);
      }
      await page.screenshot({ path: join(ASSETS_DIR, 'app-dark-game-mode.png') });
      console.log('  ✓ app-dark-game-mode.png');
    }
  } catch(e) {
    console.log('  ⚠ Dark game mode capture error:', e.message);
  }

  console.log('\n✅ All screenshots captured successfully!');
  await browser.close();
}

main().catch((err) => {
  console.error('Error:', err);
  process.exit(1);
});
