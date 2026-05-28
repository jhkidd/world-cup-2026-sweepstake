import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Load profile pictures as base64
function loadProfilePictures() {
  const profilesDir = join(projectRoot, 'data', 'profiles');
  const profiles = {};
  
  const names = [
    'allan chan', 'andrew turner', 'bryn mills', 'caitlin kilcoyne',
    'dave moseley', 'emma ryan', 'ian whelan', 'joshua kidd',
    'nicholas burgoyne', 'tina buckley'
  ];
  
  for (const name of names) {
    const filePath = join(profilesDir, `${name}.jpg`);
    if (existsSync(filePath)) {
      const imageData = readFileSync(filePath);
      const base64 = imageData.toString('base64');
      profiles[name] = `data:image/jpeg;base64,${base64}`;
    }
  }
  
  return profiles;
}

async function renderVisualization(templateName, data, outputName, profilePictures = {}) {
  console.log(`Rendering ${outputName}...`);
  
  try {
    // Load template
    const templatePath = join(projectRoot, 'templates', `${templateName}.html`);
    let html = readFileSync(templatePath, 'utf-8');
    
    // Inject data
    html = html.replace('DATA_PLACEHOLDER', JSON.stringify(data));
    
    // Inject profile pictures if provided
    html = html.replace('PROFILE_PICTURES_PLACEHOLDER', JSON.stringify(profilePictures));
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    
    // Adjust viewport based on template (two-column needs more width)
    const viewportWidth = templateName === 'upcoming-matches-two-column' ? 1550 : 1200;
    await page.setViewport({ width: viewportWidth, height: 800, deviceScaleFactor: 2 });
    
    // Enable console logging from the page for debugging
    page.on('console', msg => console.log('  Browser:', msg.text()));
    page.on('pageerror', error => console.error('  Page error:', error.message));
    
    // Load HTML
    await page.setContent(html, { waitUntil: 'networkidle0' });
    
    // Wait for render-complete class
    await page.waitForSelector('.render-complete', { timeout: 5000 });
    
    // Take screenshot
    const outputPath = join(projectRoot, 'output', `${outputName}.png`);
    await page.screenshot({
      path: outputPath,
      fullPage: true
    });
    
    await browser.close();
    console.log(`✓ Saved to output/${outputName}.png`);
    
  } catch (error) {
    console.error(`✗ Error rendering ${outputName}:`, error.message);
    throw error;
  }
}

async function main() {
  console.log('🎨 Generating visualizations...\n');
  
  try {
    // Load processed data
    const dataPath = join(projectRoot, 'data', 'processed', 'latest.json');
    const data = JSON.parse(readFileSync(dataPath, 'utf-8'));
    
    // Load profile pictures
    const profilePictures = loadProfilePictures();
    console.log(`Loaded ${Object.keys(profilePictures).length} profile pictures\n`);
    
    // Render each visualization
    await renderVisualization('upcoming-matches-two-column', data, 'upcoming-matches');
    await renderVisualization('timeline', data, 'timeline', profilePictures);
    await renderVisualization('stage-probabilities', data, 'stage-probabilities', profilePictures);
    
    console.log('\n✅ All visualizations generated successfully!');
    
  } catch (error) {
    console.error('\n❌ Error generating visualizations:', error.message);
    process.exit(1);
  }
}

main();
