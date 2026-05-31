/**
 * Fetch team metadata from TheSportsDB (badge, nickname, description, kit).
 * 
 * ONE-TIME script - run manually, data is static.
 * 
 * Usage: npm run fetch-metadata
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const OUTPUT_FILE = path.join(__dirname, '..', 'data', 'team_metadata.json');
const BADGES_DIR = path.join(__dirname, '..', 'data', 'team_badges');
const KITS_DIR = path.join(__dirname, '..', 'data', 'team_kits');

const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

// Rate limit: 30 calls/min = 2.5s between calls
const API_DELAY = 2500;

// TheSportsDB team IDs (same as fetch-player-photos.js)
const TEAM_IDS = {
  'Algeria': 134516,
  'Argentina': 134509,
  'Australia': 134500,
  'Austria': 135986,
  'Belgium': 134515,
  'Bosnia and Herzegovina': 134510,
  'Brazil': 134496,
  'Canada': 140073,
  'Cape Verde': 136477,
  'Colombia': 134501,
  'Croatia': 133912,
  'Curaçao': 140271,
  'Czechia': 133904,
  'DR Congo': 136475,
  'Ecuador': 134507,
  'Egypt': 136138,
  'England': 133914,
  'France': 133913,
  'Germany': 133907,
  'Ghana': 134513,
  'Haiti': 140175,
  'Iran': 134511,
  'Iraq': 140148,
  'Ivory Coast': 134502,
  'Japan': 134503,
  'Jordan': 140145,
  'Mexico': 134497,
  'Morocco': 136139,
  'Netherlands': 133905,
  'New Zealand': 137449,
  'Norway': 136516,
  'Panama': 136141,
  'Paraguay': 136471,
  'Portugal': 133908,
  'Qatar': 136472,
  'Saudi Arabia': 136137,
  'Scotland': 136450,
  'Senegal': 136143,
  'South Africa': 136482,
  'South Korea': 134517,
  'Spain': 133909,
  'Sweden': 133916,
  'Switzerland': 134506,
  'Tunisia': 136142,
  'Türkiye': 135985,
  'Uruguay': 134504,
  'USA': 134514,
  'Uzbekistan': 140151
};

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

function slugify(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
}

async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        console.log('  ⏳ Rate limited, waiting 60s...');
        await sleep(60000);
        continue;
      }
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`  Retry ${i + 1}/${retries}...`);
      await sleep(5000);
    }
  }
}

async function downloadImage(url, outputPath) {
  try {
    const response = await fetch(url);
    if (!response.ok) return false;
    
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(outputPath, buffer);
    return true;
  } catch (error) {
    console.log(`    Failed to download: ${error.message}`);
    return false;
  }
}

function extractNickname(keywords) {
  if (!keywords) return null;
  
  // Extract nickname from strKeywords like "الأفناك  (The Fennecs)"
  const match = keywords.match(/\(([^)]+)\)/);
  return match ? match[1] : keywords;
}

async function main() {
  console.log('🏆 Fetching team metadata from TheSportsDB...\n');
  console.log('Rate limit: 30 calls/min - using 2.5s delay\n');
  
  // Create directories
  for (const dir of [BADGES_DIR, KITS_DIR]) {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }
  
  // Load existing metadata if any
  let metadata = {};
  if (fs.existsSync(OUTPUT_FILE)) {
    metadata = JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8'));
    console.log(`Loaded existing metadata for ${Object.keys(metadata).length} teams\n`);
  }
  
  const teams = Object.entries(TEAM_IDS);
  let downloaded = 0;
  let skipped = 0;
  
  for (const [teamName, teamId] of teams) {
    // Skip if already have complete data
    if (metadata[teamName]?.description && metadata[teamName]?.badge) {
      console.log(`✓ ${teamName} (cached)`);
      skipped++;
      continue;
    }
    
    console.log(`📍 ${teamName} (ID: ${teamId})`);
    
    const url = `${API_BASE}/lookupteam.php?id=${teamId}`;
    const data = await fetchWithRetry(url);
    await sleep(API_DELAY);
    
    const team = data?.teams?.[0];
    if (!team) {
      console.log(`  ✗ No data found`);
      continue;
    }
    
    const slug = slugify(teamName);
    
    // Extract data
    metadata[teamName] = {
      nickname: extractNickname(team.strKeywords),
      description: team.strDescriptionEN || null,
      formedYear: team.intFormedYear || null,
      stadium: team.strStadium || null,
      location: team.strLocation || null,
      colors: {
        primary: team.strColour1 || null,
        secondary: team.strColour2 || null,
        tertiary: team.strColour3 || null
      },
      badge: null,
      kit: null
    };
    
    // Download badge
    if (team.strBadge) {
      const badgePath = path.join(BADGES_DIR, `${slug}.png`);
      if (await downloadImage(team.strBadge, badgePath)) {
        metadata[teamName].badge = `${slug}.png`;
        console.log(`  ✓ Badge downloaded`);
      }
    }
    
    // Download kit/equipment
    if (team.strEquipment) {
      const kitPath = path.join(KITS_DIR, `${slug}.png`);
      if (await downloadImage(team.strEquipment, kitPath)) {
        metadata[teamName].kit = `${slug}.png`;
        console.log(`  ✓ Kit downloaded`);
      }
    }
    
    if (metadata[teamName].nickname) {
      console.log(`  ✓ Nickname: "${metadata[teamName].nickname}"`);
    }
    if (metadata[teamName].description) {
      console.log(`  ✓ Description: ${metadata[teamName].description.slice(0, 50)}...`);
    }
    
    downloaded++;
    
    // Save periodically
    if (downloaded % 5 === 0) {
      fs.writeFileSync(OUTPUT_FILE, JSON.stringify(metadata, null, 2));
    }
  }
  
  // Final save
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(metadata, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   Teams processed: ${downloaded}`);
  console.log(`   Teams skipped (cached): ${skipped}`);
  console.log(`\n✅ Metadata saved to: ${OUTPUT_FILE}`);
  console.log(`✅ Badges saved to: ${BADGES_DIR}`);
  console.log(`✅ Kits saved to: ${KITS_DIR}`);
}

main().catch(console.error);
