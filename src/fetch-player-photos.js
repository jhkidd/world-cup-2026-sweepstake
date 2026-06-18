/**
 * Fetch player photos from TheSportsDB and save as compressed webp files.
 * 
 * This is a ONE-TIME script - run manually, not on every deploy.
 * Photos are static and don't need updating.
 * 
 * Usage: npm run fetch-photos
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { SPORTSDB_TEAM_IDS } from './shared/team-ids.js';
import { slugify, sleep } from './shared/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PHOTOS_DIR = path.join(__dirname, '..', 'data', 'player_photos');
const MAPPING_FILE = path.join(__dirname, '..', 'data', 'player_photos.json');

// TheSportsDB free API
const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

// Rate limit: 30 calls per minute = 2 seconds between calls
const API_DELAY = 2500;

// Image settings
const IMAGE_SIZE = 100; // 100x100 px for circular avatars

// Normalize name for matching
function normalizeName(name) {
  return name
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z\s]/g, '')
    .trim();
}

// Fetch with retry and rate limit handling
async function fetchWithRetry(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url);
      if (response.status === 429) {
        console.log('  ⏳ Rate limited, waiting 60s...');
        await sleep(60000);
        continue;
      }
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }
      return await response.json();
    } catch (error) {
      if (i === retries - 1) throw error;
      console.log(`  Retry ${i + 1}/${retries}...`);
      await sleep(5000);
    }
  }
}

// Download and process image
async function downloadAndProcessImage(imageUrl, outputPath) {
  try {
    const response = await fetch(imageUrl);
    if (!response.ok) return false;
    
    const buffer = Buffer.from(await response.arrayBuffer());
    
    await sharp(buffer)
      .resize(IMAGE_SIZE, IMAGE_SIZE, {
        fit: 'cover',
        position: 'top' // Focus on face
      })
      .webp({ quality: 80 })
      .toFile(outputPath);
    
    return true;
  } catch (error) {
    console.log(`    Failed to process image: ${error.message}`);
    return false;
  }
}

// Get all players for a team from TheSportsDB
async function getTeamPlayers(teamId) {
  const url = `${API_BASE}/lookup_all_players.php?id=${teamId}`;
  const data = await fetchWithRetry(url);
  return data.player || [];
}

// Get full player details (including strCutout)
async function getPlayerDetails(playerId) {
  const url = `${API_BASE}/lookupplayer.php?id=${playerId}`;
  const data = await fetchWithRetry(url);
  return data.players?.[0] || null;
}

// Main function
async function main() {
  console.log('🖼️  Fetching player photos from TheSportsDB...\n');
  console.log('Rate limit: 30 calls/min - using 2.5s delay between calls\n');
  
  // Ensure output directory exists
  if (!fs.existsSync(PHOTOS_DIR)) {
    fs.mkdirSync(PHOTOS_DIR, { recursive: true });
  }
  
  // Load existing mapping if any
  let photoMapping = {};
  if (fs.existsSync(MAPPING_FILE)) {
    photoMapping = JSON.parse(fs.readFileSync(MAPPING_FILE, 'utf8'));
    console.log(`Loaded existing mapping with ${Object.keys(photoMapping).length} players\n`);
  }
  
  // Load our team_details.json to know which players we need
  const teamDetailsPath = path.join(__dirname, '..', 'data', 'team_details.json');
  let ourTeamDetails = {};
  if (fs.existsSync(teamDetailsPath)) {
    ourTeamDetails = JSON.parse(fs.readFileSync(teamDetailsPath, 'utf8'));
  }
  
  const teams = Object.keys(SPORTSDB_TEAM_IDS);
  console.log(`Processing ${teams.length} teams...\n`);
  
  let totalPlayers = 0;
  let photosDownloaded = 0;
  let photosSkipped = 0;
  let playersNotFound = 0;
  let apiCalls = 0;
  
  for (const teamName of teams) {
    const teamId = SPORTSDB_TEAM_IDS[teamName];
    console.log(`\n📍 ${teamName} (ID: ${teamId})`);
    
    // Get players from TheSportsDB
    const sportsDbPlayers = await getTeamPlayers(teamId);
    apiCalls++;
    await sleep(API_DELAY);
    
    console.log(`  TheSportsDB has ${sportsDbPlayers.length} players`);
    
    // Get our squad for this team (for name matching)
    const ourSquad = ourTeamDetails[teamName]?.squad || [];
    const ourPlayerNames = new Set(ourSquad.map(p => normalizeName(p.name)));
    
    // Create lookup for matching
    const sportsDbLookup = {};
    for (const p of sportsDbPlayers) {
      if (p.strPlayer) {
        sportsDbLookup[normalizeName(p.strPlayer)] = p;
        // Also add by last name
        const parts = p.strPlayer.split(' ');
        if (parts.length > 1) {
          sportsDbLookup[normalizeName(parts[parts.length - 1])] = p;
        }
      }
    }
    
    // Process each TheSportsDB player
    for (const player of sportsDbPlayers) {
      const playerName = player.strPlayer;
      if (!playerName) continue;
      
      totalPlayers++;
      
      // Check if already have photo
      if (photoMapping[playerName]) {
        console.log(`  ✓ ${playerName} (cached)`);
        photosSkipped++;
        continue;
      }
      
      // Get full player details for strCutout
      let photoUrl = player.strCutout || player.strThumb;
      
      // If no photo in basic data, fetch full details
      if (!photoUrl && player.idPlayer) {
        const details = await getPlayerDetails(player.idPlayer);
        apiCalls++;
        await sleep(API_DELAY);
        
        if (details) {
          photoUrl = details.strCutout || details.strThumb || details.strRender;
        }
      }
      
      if (!photoUrl) {
        console.log(`  ✗ ${playerName} (no photo)`);
        playersNotFound++;
        continue;
      }
      
      // Download and process image
      const slug = slugify(playerName);
      const outputPath = path.join(PHOTOS_DIR, `${slug}.webp`);
      
      const success = await downloadAndProcessImage(photoUrl, outputPath);
      
      if (success) {
        photoMapping[playerName] = `${slug}.webp`;
        photosDownloaded++;
        console.log(`  ✓ ${playerName}`);
        
        // Also try to map to our player names if they differ slightly
        for (const ourPlayer of ourSquad) {
          const ourNorm = normalizeName(ourPlayer.name);
          const theirNorm = normalizeName(playerName);
          
          // Match by last name or similar
          if (ourNorm.includes(theirNorm.split(' ').pop()) || 
              theirNorm.includes(ourNorm.split(' ').pop())) {
            if (!photoMapping[ourPlayer.name] && ourPlayer.name !== playerName) {
              photoMapping[ourPlayer.name] = `${slug}.webp`;
              console.log(`    ↳ Also mapped to: ${ourPlayer.name}`);
            }
          }
        }
      } else {
        playersNotFound++;
      }
      
      // Save mapping periodically
      if (photosDownloaded % 10 === 0) {
        fs.writeFileSync(MAPPING_FILE, JSON.stringify(photoMapping, null, 2));
      }
      
      await sleep(500); // Small extra delay for image downloads
    }
  }
  
  // Final save
  fs.writeFileSync(MAPPING_FILE, JSON.stringify(photoMapping, null, 2));
  
  console.log('\n' + '='.repeat(50));
  console.log('📊 Summary:');
  console.log(`   Teams processed: ${teams.length}`);
  console.log(`   TheSportsDB players found: ${totalPlayers}`);
  console.log(`   Photos downloaded: ${photosDownloaded}`);
  console.log(`   Photos already cached: ${photosSkipped}`);
  console.log(`   Players without photos: ${playersNotFound}`);
  console.log(`   Total API calls made: ${apiCalls}`);
  console.log(`\n✅ Mapping saved to: ${MAPPING_FILE}`);
  console.log(`✅ Photos saved to: ${PHOTOS_DIR}`);
}

main().catch(console.error);
