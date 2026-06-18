/**
 * Fetch extended player stats from TheSportsDB.
 * 
 * This is a ONE-TIME script - run manually, not on every deploy.
 * Player stats (height, weight, club, etc.) are relatively static.
 * 
 * Usage: npm run fetch-player-stats
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { SPORTSDB_TEAM_IDS } from './shared/team-ids.js';
import { normalizeTeamName } from './shared/team-names.js';
import { sleep } from './shared/utils.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const STATS_FILE = path.join(__dirname, '..', 'data', 'player_stats.json');
const TEAM_DETAILS_FILE = path.join(__dirname, '..', 'data', 'team_details.json');

// TheSportsDB free API
const API_BASE = 'https://www.thesportsdb.com/api/v1/json/3';

// Rate limit: 30 calls per minute = 2 seconds between calls
const API_DELAY = 2500;

async function fetchTeamPlayers(teamId) {
  const url = `${API_BASE}/lookup_all_players.php?id=${teamId}`;
  const response = await fetch(url);
  if (!response.ok) return [];
  const data = await response.json();
  return data.player || [];
}

async function fetchPlayerDetails(playerId) {
  const url = `${API_BASE}/lookupplayer.php?id=${playerId}`;
  const response = await fetch(url);
  if (!response.ok) return null;
  const data = await response.json();
  return data.players?.[0] || null;
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
  console.log('Fetching extended player stats from TheSportsDB...\n');
  
  // Load existing stats if any (to resume interrupted runs)
  let playerStats = {};
  if (fs.existsSync(STATS_FILE)) {
    playerStats = JSON.parse(fs.readFileSync(STATS_FILE, 'utf8'));
    console.log(`Loaded ${Object.keys(playerStats).length} existing player stats\n`);
  }
  
  // Load team details to get player names
  const teamDetails = JSON.parse(fs.readFileSync(TEAM_DETAILS_FILE, 'utf8'));
  
  // Build list of all players we need stats for
  const allPlayers = [];
  for (const [country, details] of Object.entries(teamDetails)) {
    if (!details.squad) continue;
    for (const player of details.squad) {
      allPlayers.push({
        name: player.name,
        country: country
      });
    }
  }
  
  console.log(`Total players in squads: ${allPlayers.length}`);
  console.log(`Already have stats for: ${Object.keys(playerStats).length}`);
  
  // For each team, fetch players from TheSportsDB and match
  let fetchedCount = 0;
  let matchedCount = 0;
  
  for (const [country, teamId] of Object.entries(SPORTSDB_TEAM_IDS)) {
    const normalizedCountry = normalizeTeamName(country);
    
    // Get squad for this country from our data
    const countryData = Object.entries(teamDetails).find(
      ([k]) => normalizeTeamName(k) === normalizedCountry
    );
    
    if (!countryData || !countryData[1].squad) {
      console.log(`⚠️  No squad data for ${country}`);
      continue;
    }
    
    const squad = countryData[1].squad;
    const squadNames = squad.map(p => p.name.toLowerCase());
    
    // Check if we already have all players for this team
    const missingPlayers = squad.filter(p => !playerStats[p.name]);
    if (missingPlayers.length === 0) {
      console.log(`✓ ${country}: All ${squad.length} players already cached`);
      continue;
    }
    
    console.log(`\n📥 ${country}: Fetching players (${missingPlayers.length} missing)...`);
    
    // Fetch team players from TheSportsDB
    await sleep(API_DELAY);
    const sdbPlayers = await fetchTeamPlayers(teamId);
    fetchedCount++;
    
    if (!sdbPlayers.length) {
      console.log(`  ⚠️  No players found in TheSportsDB`);
      continue;
    }
    
    // Match players by name
    for (const sdbPlayer of sdbPlayers) {
      const sdbName = sdbPlayer.strPlayer?.toLowerCase();
      if (!sdbName) continue;
      
      // Find matching player in our squad
      const matchedSquadPlayer = squad.find(p => {
        const squadName = p.name.toLowerCase();
        // Exact match or partial match
        return squadName === sdbName || 
               squadName.includes(sdbName) || 
               sdbName.includes(squadName) ||
               // Match last names
               squadName.split(' ').pop() === sdbName.split(' ').pop();
      });
      
      if (matchedSquadPlayer && !playerStats[matchedSquadPlayer.name]) {
        // Fetch detailed stats for this player
        await sleep(API_DELAY);
        const details = await fetchPlayerDetails(sdbPlayer.idPlayer);
        fetchedCount++;
        
        if (details) {
          const stats = extractPlayerStats(details);
          if (stats) {
            playerStats[matchedSquadPlayer.name] = stats;
            matchedCount++;
            console.log(`  ✓ ${matchedSquadPlayer.name}: ${stats.height || 'no height'}, ${stats.club || 'no club'}`);
          }
        }
        
        // Save periodically
        if (matchedCount % 10 === 0) {
          fs.writeFileSync(STATS_FILE, JSON.stringify(playerStats, null, 2));
        }
      }
    }
  }
  
  // Final save
  fs.writeFileSync(STATS_FILE, JSON.stringify(playerStats, null, 2));
  
  console.log(`\n${'='.repeat(50)}`);
  console.log(`Done! API calls made: ${fetchedCount}`);
  console.log(`Players with stats: ${Object.keys(playerStats).length}`);
  console.log(`Saved to: ${STATS_FILE}`);
}

main().catch(console.error);
