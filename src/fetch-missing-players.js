/**
 * Fetch missing player data via string search, with DOB validation.
 * 
 * This script searches for players we don't have stats for by name,
 * then validates the result matches our expected date of birth.
 * 
 * Usage: npm run fetch-missing
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';
import { sleep } from './shared/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const TEAM_DETAILS_FILE = path.join(__dirname, '..', 'data', 'team_details.json');
const PLAYER_STATS_FILE = path.join(__dirname, '..', 'data', 'player_stats.json');
const PLAYER_PHOTOS_FILE = path.join(__dirname, '..', 'data', 'player_photos.json');
const PHOTOS_DIR = path.join(__dirname, '..', 'data', 'player_photos');

// TheSportsDB free API
const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

// Rate limit: 30 calls per minute = 2 seconds between calls
const API_DELAY = 2500;

// Image settings
const IMAGE_SIZE = 100;

function parseDate(dateStr) {
  if (!dateStr) return null;
  const d = new Date(dateStr);
  return isNaN(d.getTime()) ? null : d;
}

function datesMatch(date1Str, date2Str, toleranceDays = 365) {
  const d1 = parseDate(date1Str);
  const d2 = parseDate(date2Str);
  if (!d1 || !d2) return false;
  
  const diffMs = Math.abs(d1.getTime() - d2.getTime());
  const diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays <= toleranceDays;
}

function exactDateMatch(date1Str, date2Str) {
  const d1 = parseDate(date1Str);
  const d2 = parseDate(date2Str);
  if (!d1 || !d2) return false;
  
  return d1.getFullYear() === d2.getFullYear() &&
         d1.getMonth() === d2.getMonth() &&
         d1.getDate() === d2.getDate();
}

async function searchPlayer(name) {
  const url = `${API_BASE}/searchplayers.php?p=${encodeURIComponent(name)}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.player?.[0] || null;
  } catch (error) {
    console.error(`  Error searching for ${name}:`, error.message);
    return null;
  }
}

async function getPlayerDetails(playerId) {
  const url = `${API_BASE}/lookupplayer.php?id=${playerId}`;
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    const data = await response.json();
    return data.players?.[0] || null;
  } catch (error) {
    console.error(`  Error fetching details for ${playerId}:`, error.message);
    return null;
  }
}

function hasCompleteStats(stats) {
  if (!stats) return false;
  // Consider stats complete if we have at least height or bio
  return !!(stats.height || stats.bio);
}

async function downloadPhoto(url, playerName) {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const buffer = Buffer.from(await response.arrayBuffer());
    const filename = playerName.toLowerCase()
      .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '') + '.webp';
    
    const outputPath = path.join(PHOTOS_DIR, filename);
    
    await sharp(buffer)
      .resize(IMAGE_SIZE, IMAGE_SIZE, { fit: 'cover' })
      .webp({ quality: 80 })
      .toFile(outputPath);
    
    return filename;
  } catch (error) {
    return null;
  }
}

function extractPlayerStats(player) {
  if (!player) return null;
  
  return {
    height: player.strHeight || null,
    weight: player.strWeight || null,
    club: player.strTeam || null,
    preferredFoot: player.strSide || null,
    birthLocation: player.strBirthLocation || null,
    bio: player.strDescriptionEN || null,
    instagram: player.strInstagram || null,
    twitter: player.strTwitter || null
  };
}

async function main() {
  console.log('Searching for missing player data via name search...\n');
  
  // Load existing data
  const teamDetails = JSON.parse(fs.readFileSync(TEAM_DETAILS_FILE, 'utf8'));
  let playerStats = {};
  let playerPhotos = {};
  
  if (fs.existsSync(PLAYER_STATS_FILE)) {
    playerStats = JSON.parse(fs.readFileSync(PLAYER_STATS_FILE, 'utf8'));
  }
  if (fs.existsSync(PLAYER_PHOTOS_FILE)) {
    playerPhotos = JSON.parse(fs.readFileSync(PLAYER_PHOTOS_FILE, 'utf8'));
  }
  
  // Build list of all players with DOB
  const allPlayers = [];
  for (const [country, details] of Object.entries(teamDetails)) {
    if (!details.squad) continue;
    for (const player of details.squad) {
      allPlayers.push({
        name: player.name,
        dob: player.date_of_birth,
        country: country
      });
    }
  }
  
  // Find players missing stats OR with incomplete stats
  const missingPlayers = allPlayers.filter(p => !hasCompleteStats(playerStats[p.name]));
  
  console.log(`Total players in squads: ${allPlayers.length}`);
  console.log(`Already have stats for: ${Object.keys(playerStats).length}`);
  console.log(`Missing stats for: ${missingPlayers.length}`);
  console.log(`\nStarting search (estimated time: ${Math.ceil(missingPlayers.length * 5 / 60)} minutes)...\n`);
  
  // Stats tracking
  let searched = 0;
  let found = 0;
  let matched = 0;
  let dobMismatch = 0;
  let notFound = 0;
  let photosDownloaded = 0;
  
  for (const player of missingPlayers) {
    searched++;
    
    // Progress update
    if (searched % 20 === 0 || searched === missingPlayers.length) {
      const pct = Math.round((searched / missingPlayers.length) * 100);
      console.log(`\n--- Progress: ${searched}/${missingPlayers.length} (${pct}%) | Matched: ${matched} | DOB Mismatch: ${dobMismatch} | Not Found: ${notFound} ---\n`);
      
      // Save progress
      fs.writeFileSync(PLAYER_STATS_FILE, JSON.stringify(playerStats, null, 2));
      fs.writeFileSync(PLAYER_PHOTOS_FILE, JSON.stringify(playerPhotos, null, 2));
    }
    
    await sleep(API_DELAY);
    
    const result = await searchPlayer(player.name);
    
    if (!result) {
      notFound++;
      console.log(`❌ ${player.name} (${player.country}): No results`);
      continue;
    }
    
    found++;
    
    // Check DOB match
    const apiDob = result.dateBorn;
    const ourDob = player.dob;
    
    if (!exactDateMatch(apiDob, ourDob)) {
      dobMismatch++;
      const apiYear = apiDob ? new Date(apiDob).getFullYear() : '?';
      const ourYear = ourDob ? new Date(ourDob).getFullYear() : '?';
      console.log(`⚠️  ${player.name} (${player.country}): DOB mismatch - API: ${apiYear}, Ours: ${ourYear}`);
      continue;
    }
    
    // DOB matches - fetch full details via lookupplayer
    matched++;
    
    await sleep(API_DELAY);
    const fullDetails = await getPlayerDetails(result.idPlayer);
    const stats = extractPlayerStats(fullDetails || result);
    playerStats[player.name] = stats;
    
    // Try to download photo if we don't have one
    let photoStatus = '';
    if (!playerPhotos[player.name] && result.strCutout) {
      const filename = await downloadPhoto(result.strCutout, player.name);
      if (filename) {
        playerPhotos[player.name] = filename;
        photosDownloaded++;
        photoStatus = ' + photo';
      }
    }
    
    console.log(`✅ ${player.name} (${player.country}): Matched!${photoStatus} - ${stats.club || 'no club'}`);
  }
  
  // Final save
  fs.writeFileSync(PLAYER_STATS_FILE, JSON.stringify(playerStats, null, 2));
  fs.writeFileSync(PLAYER_PHOTOS_FILE, JSON.stringify(playerPhotos, null, 2));
  
  // Summary
  console.log(`\n${'='.repeat(60)}`);
  console.log('SUMMARY');
  console.log('='.repeat(60));
  console.log(`Total searched:     ${searched}`);
  console.log(`Found in API:       ${found}`);
  console.log(`DOB matched:        ${matched}`);
  console.log(`DOB mismatch:       ${dobMismatch}`);
  console.log(`Not found:          ${notFound}`);
  console.log(`Photos downloaded:  ${photosDownloaded}`);
  console.log('='.repeat(60));
  console.log(`\nTotal players with stats now: ${Object.keys(playerStats).length}`);
  console.log(`Total players with photos now: ${Object.keys(playerPhotos).length}`);
}

main().catch(console.error);
