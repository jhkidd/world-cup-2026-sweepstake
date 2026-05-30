/**
 * Fetch team data from football-data.org API
 * 
 * This script fetches squad, coach, and competition info for all World Cup teams.
 * Rate limited to 10 requests/minute on free tier.
 */

import { existsSync, mkdirSync, writeFileSync, readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// API configuration
const API_KEY = process.env.FOOTBALL_DATA_API_KEY;
const API_BASE = 'https://api.football-data.org/v4';
const RATE_LIMIT_DELAY = 6500; // 6.5 seconds between requests (safe for 10/min limit)

// Mapping from our team names to football-data.org team IDs
// Based on GET /v4/competitions/WC/teams response
const TEAM_ID_MAP = {
  'Argentina': 762,
  'Algeria': 778,
  'Australia': 779,
  'Austria': 816,
  'Belgium': 805,
  'Bosnia and Herzegovina': 1060,
  'Brazil': 764,
  'Canada': 828,
  'Cape Verde': 1930,
  'Colombia': 818,
  'Croatia': 799,
  'Curaçao': 9460,
  'Czechia': 798,
  'DR Congo': 1934,
  'Ecuador': 791,
  'Egypt': 825,
  'England': 770,
  'France': 773,
  'Germany': 759,
  'Ghana': 763,
  'Haiti': 836,
  'Iran': 840,
  'Iraq': 8062,
  'Ivory Coast': 1935,
  'Japan': 766,
  'Jordan': 8049,
  'Mexico': 769,
  'Morocco': 815,
  'Netherlands': 8601,
  'New Zealand': 783,
  'Norway': 8872,
  'Panama': 1836,
  'Paraguay': 761,
  'Portugal': 765,
  'Qatar': 8030,
  'Saudi Arabia': 801,
  'Scotland': 8873,
  'Senegal': 804,
  'South Africa': 774,
  'South Korea': 772,
  'Spain': 760,
  'Sweden': 792,
  'Switzerland': 788,
  'Tunisia': 802,
  'Turkey': 803,
  'Türkiye': 803, // Alternative spelling
  'Uruguay': 758,
  'USA': 771,
  'Uzbekistan': 8070
};

// Flag emoji mapping
const FLAG_MAP = {
  'Argentina': '🇦🇷',
  'Algeria': '🇩🇿',
  'Australia': '🇦🇺',
  'Austria': '🇦🇹',
  'Belgium': '🇧🇪',
  'Bosnia and Herzegovina': '🇧🇦',
  'Brazil': '🇧🇷',
  'Canada': '🇨🇦',
  'Cape Verde': '🇨🇻',
  'Colombia': '🇨🇴',
  'Croatia': '🇭🇷',
  'Curaçao': '🇨🇼',
  'Czechia': '🇨🇿',
  'DR Congo': '🇨🇩',
  'Ecuador': '🇪🇨',
  'Egypt': '🇪🇬',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  'France': '🇫🇷',
  'Germany': '🇩🇪',
  'Ghana': '🇬🇭',
  'Haiti': '🇭🇹',
  'Iran': '🇮🇷',
  'Iraq': '🇮🇶',
  'Ivory Coast': '🇨🇮',
  'Japan': '🇯🇵',
  'Jordan': '🇯🇴',
  'Mexico': '🇲🇽',
  'Morocco': '🇲🇦',
  'Netherlands': '🇳🇱',
  'New Zealand': '🇳🇿',
  'Norway': '🇳🇴',
  'Panama': '🇵🇦',
  'Paraguay': '🇵🇾',
  'Portugal': '🇵🇹',
  'Qatar': '🇶🇦',
  'Saudi Arabia': '🇸🇦',
  'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'Senegal': '🇸🇳',
  'South Africa': '🇿🇦',
  'South Korea': '🇰🇷',
  'Spain': '🇪🇸',
  'Sweden': '🇸🇪',
  'Switzerland': '🇨🇭',
  'Tunisia': '🇹🇳',
  'Turkey': '🇹🇷',
  'Türkiye': '🇹🇷',
  'Uruguay': '🇺🇾',
  'USA': '🇺🇸',
  'Uzbekistan': '🇺🇿'
};

/**
 * Sleep for specified milliseconds
 */
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Fetch from football-data.org API with auth header
 */
async function fetchApi(endpoint) {
  const url = `${API_BASE}${endpoint}`;
  console.log(`  Fetching: ${url}`);
  
  const response = await fetch(url, {
    headers: {
      'X-Auth-Token': API_KEY
    }
  });
  
  if (!response.ok) {
    throw new Error(`API error ${response.status}: ${response.statusText}`);
  }
  
  // Log remaining rate limit
  const remaining = response.headers.get('X-Requests-Available-Minute');
  if (remaining) {
    console.log(`  Rate limit remaining: ${remaining}/10`);
  }
  
  return response.json();
}

/**
 * Fetch team details including squad and coach
 */
async function fetchTeamDetails(teamName, teamId) {
  try {
    const data = await fetchApi(`/teams/${teamId}`);
    
    return {
      name: teamName,
      api_id: teamId,
      tla: data.tla,
      crest: data.crest,
      flag: FLAG_MAP[teamName] || '🏳️',
      coach: data.coach ? {
        name: data.coach.name,
        nationality: data.coach.nationality
      } : null,
      squad: (data.squad || []).map(player => ({
        id: player.id,
        name: player.name,
        position: player.position,
        shirt_number: player.shirtNumber,
        nationality: player.nationality,
        date_of_birth: player.dateOfBirth
      })),
      fetched_at: new Date().toISOString()
    };
  } catch (error) {
    console.error(`  Error fetching ${teamName}: ${error.message}`);
    return {
      name: teamName,
      api_id: teamId,
      flag: FLAG_MAP[teamName] || '🏳️',
      error: error.message,
      fetched_at: new Date().toISOString()
    };
  }
}

/**
 * Fetch World Cup competition standings (group tables)
 */
async function fetchStandings() {
  try {
    const data = await fetchApi('/competitions/WC/standings');
    return data.standings || [];
  } catch (error) {
    console.error(`Error fetching standings: ${error.message}`);
    return [];
  }
}

/**
 * Main execution
 */
async function main() {
  console.log('🏆 Fetching World Cup team data from football-data.org...\n');
  
  if (!API_KEY) {
    console.error('❌ FOOTBALL_DATA_API_KEY environment variable not set');
    process.exit(1);
  }
  
  // Create output directory
  const teamsDir = join(projectRoot, 'data', 'teams');
  if (!existsSync(teamsDir)) {
    mkdirSync(teamsDir, { recursive: true });
  }
  
  // Load tournament data to get list of teams
  const tournamentPath = join(projectRoot, 'data', 'tournament.json');
  const tournament = JSON.parse(readFileSync(tournamentPath, 'utf8'));
  const teams = tournament.teams;
  
  console.log(`Found ${teams.length} teams to fetch\n`);
  
  // First, fetch group standings
  console.log('1. Fetching group standings...');
  const standings = await fetchStandings();
  console.log(`   ✓ Fetched standings for ${standings.length} groups\n`);
  await sleep(RATE_LIMIT_DELAY);
  
  // Fetch each team's details
  console.log('2. Fetching team details...\n');
  const teamDetails = {};
  
  for (let i = 0; i < teams.length; i++) {
    const team = teams[i];
    const teamName = team.name;
    const teamId = TEAM_ID_MAP[teamName];
    
    if (!teamId) {
      console.log(`   ⚠️ No API ID for ${teamName}, skipping`);
      continue;
    }
    
    console.log(`   [${i + 1}/${teams.length}] ${teamName}...`);
    const details = await fetchTeamDetails(teamName, teamId);
    teamDetails[teamName] = {
      ...details,
      group: team.group,
      confederation: team.confederation
    };
    
    // Rate limit delay between requests
    if (i < teams.length - 1) {
      await sleep(RATE_LIMIT_DELAY);
    }
  }
  
  // Save team details to data/team_details.json (format expected by process-data.js)
  // The file is keyed by team name for easy lookup
  const outputPath = join(projectRoot, 'data', 'team_details.json');
  writeFileSync(outputPath, JSON.stringify(teamDetails, null, 2));
  console.log(`\n✅ Saved team data to ${outputPath}`);
  
  // Summary
  const successCount = Object.values(teamDetails).filter(t => !t.error).length;
  const errorCount = Object.values(teamDetails).filter(t => t.error).length;
  console.log(`\n📊 Summary: ${successCount} teams fetched, ${errorCount} errors`);
}

main().catch(error => {
  console.error('❌ Fatal error:', error);
  process.exit(1);
});
