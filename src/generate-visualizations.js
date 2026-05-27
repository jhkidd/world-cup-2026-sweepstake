import puppeteer from 'puppeteer';
import { readFileSync, writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

async function renderVisualization(templateName, data, outputName) {
  console.log(`Rendering ${outputName}...`);
  
  try {
    // Load template
    const templatePath = join(projectRoot, 'templates', `${templateName}.html`);
    let html = readFileSync(templatePath, 'utf-8');
    
    // Inject data
    html = html.replace('DATA_PLACEHOLDER', JSON.stringify(data));
    
    // Launch browser
    const browser = await puppeteer.launch({
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
    
    const page = await browser.newPage();
    await page.setViewport({ width: 1200, height: 800, deviceScaleFactor: 2 });
    
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
    
    // Render each visualization
    await renderVisualization('leaderboard', data, 'leaderboard');
    await renderVisualization('team-rankings', data, 'team-rankings');
    await renderVisualization('upcoming-matches-v2', data, 'upcoming-matches');
    await renderVisualization('timeline', data, 'timeline');
    await renderVisualization('stage-probabilities', data, 'stage-probabilities');
    
    console.log('\n✅ All visualizations generated successfully!');
    
  } catch (error) {
    console.error('\n❌ Error generating visualizations:', error.message);
    process.exit(1);
  }
}

main();
