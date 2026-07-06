import axios from 'axios';
import { readFileSync, writeFileSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

const API_KEY = process.env.THE_ODDS_API_KEY;
const ODDS_API_BASE = 'https://api.the-odds-api.com/v4';

async function fetchWithRetry(url, retries = 1) {
  try {
    console.log(`Fetching: ${url}`);
    const response = await axios.get(url);
    
    // Log remaining API calls
    const remaining = response.headers['x-requests-remaining'];
    if (remaining) {
      console.log(`API calls remaining: ${remaining}`);
      if (parseInt(remaining) < 50) {
        console.warn('⚠️  WARNING: Less than 50 API calls remaining this month!');
      }
    }
    
    return response.data;
  } catch (error) {
    if (retries > 0 && error.response?.status >= 500) {
      console.log(`Retrying after 1 second...`);
      await new Promise(resolve => setTimeout(resolve, 1000));
      return fetchWithRetry(url, retries - 1);
    }
    throw error;
  }
}

async function fetchMatchOdds() {
  const url = `${ODDS_API_BASE}/sports/soccer_fifa_world_cup/odds?` +
    `apiKey=${API_KEY}&regions=uk&markets=h2h&oddsFormat=decimal`;
  return await fetchWithRetry(url);
}

async function fetchTournamentWinnerOdds() {
  const url = `${ODDS_API_BASE}/sports/soccer_fifa_world_cup_winner/odds?` +
    `apiKey=${API_KEY}&regions=uk&markets=outrights&oddsFormat=decimal`;
  return await fetchWithRetry(url);
}

async function fetchMatchResultsFromWorldCup26() {
  const url = 'https://worldcup26.ir/get/games';
  console.log(`   Trying worldcup26.ir...`);
  console.log(`   Fetching: ${url}`);
  const response = await axios.get(url, { timeout: 10000 });
  const matches = response.data.games || response.data;
  
  const completed = matches.filter(m => 
    m.finished === 'TRUE' || m.finished === true || m.time_elapsed === 'finished'
  );
  
  console.log(`   ✓ Found ${completed.length} completed matches from worldcup26.ir`);
  
  return completed.map(m => ({
    id: m.id || `${m.home_team_name_en}-${m.away_team_name_en}`,
    home_team: m.home_team_name_en || m.home_team,
    away_team: m.away_team_name_en || m.away_team,
    home_score: parseInt(m.home_score) || 0,
    away_score: parseInt(m.away_score) || 0,
    status: 'completed',
    group: m.group,
    stage: m.type === 'group' ? 'group_stage' : (m.type || 'group_stage'),
    date: m.local_date,
    matchday: parseInt(m.matchday) || null
  }));
}

async function fetchMatchResultsFromFootballData() {
  const footballApiKey = process.env.FOOTBALL_DATA_API_KEY;
  if (!footballApiKey) {
    throw new Error('FOOTBALL_DATA_API_KEY not set');
  }
  
  const url = `https://api.football-data.org/v4/competitions/WC/matches?status=FINISHED`;
  console.log(`   Trying football-data.org...`);
  console.log(`   Fetching: ${url}`);
  const response = await axios.get(url, {
    headers: { 'X-Auth-Token': footballApiKey },
    timeout: 15000
  });
  
  const matches = response.data.matches || [];
  console.log(`   ✓ Found ${matches.length} completed matches from football-data.org`);
  
  return matches.map(m => {
    const isKnockout = m.stage !== 'GROUP_STAGE';
    const duration = m.score?.duration || 'REGULAR';
    // regularTime is the 90-minute score; fullTime includes extra time
    const regularHome = m.score?.regularTime?.home;
    const regularAway = m.score?.regularTime?.away;
    const fullHome = m.score?.fullTime?.home ?? 0;
    const fullAway = m.score?.fullTime?.away ?? 0;
    const penaltiesHome = m.score?.penalties?.home ?? null;
    const penaltiesAway = m.score?.penalties?.away ?? null;

    // For 90-minute score: use regularTime if available, else fullTime (group stage has no ET)
    const home90 = regularHome != null ? regularHome : fullHome;
    const away90 = regularAway != null ? regularAway : fullAway;

    return {
      id: `${m.homeTeam.name}-${m.awayTeam.name}`,
      home_team: m.homeTeam.name,
      away_team: m.awayTeam.name,
      home_score: fullHome,
      away_score: fullAway,
      home_score_90min: home90,
      away_score_90min: away90,
      home_penalties: penaltiesHome,
      away_penalties: penaltiesAway,
      duration: isKnockout ? duration : 'REGULAR',
      status: 'completed',
      group: m.group ? m.group.replace('GROUP_', '') : null,
      stage: m.stage === 'GROUP_STAGE' ? 'group_stage' : (m.stage || 'group_stage').toLowerCase(),
      date: m.utcDate ? m.utcDate.split('T')[0] : null,
      matchday: m.matchday || null
    };
  });
}

async function fetchMatchResults() {
  // Try multiple sources in order, falling back as needed
  // 1. football-data.org (reliable, works from GitHub Actions)
  // 2. worldcup26.ir (free, no key, but DNS issues from GH Actions)
  // 3. Local data/results.json fallback
  
  try {
    return await fetchMatchResultsFromFootballData();
  } catch (error) {
    console.log(`   Note: football-data.org failed (${error.message})`);
  }
  
  try {
    return await fetchMatchResultsFromWorldCup26();
  } catch (error) {
    console.log(`   Note: worldcup26.ir failed (${error.message})`);
  }
  
  // Final fallback: local results.json
  console.log('   Falling back to local data/results.json...');
  try {
    const localPath = join(projectRoot, 'data', 'results.json');
    const localData = JSON.parse(readFileSync(localPath, 'utf-8'));
    const results = localData.matches || [];
    console.log(`   Loaded ${results.length} results from local fallback`);
    return results;
  } catch (fallbackError) {
    console.log('   No local results available either');
    return [];
  }
}

async function main() {
  console.log('🏆 Fetching World Cup odds and results...\n');
  
  try {
    // Fetch all data
    console.log('1. Fetching match odds (h2h)...');
    const matchOdds = await fetchMatchOdds();
    console.log(`   ✓ Fetched odds for ${matchOdds.length} matches\n`);
    
    console.log('2. Fetching tournament winner odds (outrights)...');
    const winnerOdds = await fetchTournamentWinnerOdds();
    console.log(`   ✓ Fetched winner odds\n`);
    
    console.log('3. Fetching match results...');
    const results = await fetchMatchResults();
    console.log(`   ✓ Fetched ${results.length} completed matches\n`);
    
    // Combine all data
    const data = {
      timestamp: new Date().toISOString(),
      matchOdds,
      winnerOdds,
      results
    };
    
    // Save with timestamp
    const timestamp = new Date().toISOString()
      .replace(/:/g, '-')
      .replace(/\..+/, '')
      .replace('T', '_');
    const filename = `${timestamp}.json`;
    const oddsDir = join(projectRoot, 'data', 'odds');
    const filepath = join(oddsDir, filename);
    
    // Ensure directory exists
    mkdirSync(oddsDir, { recursive: true });
    
    writeFileSync(filepath, JSON.stringify(data, null, 2));
    console.log(`✅ Data saved to: data/odds/${filename}`);
    
    // Also update data/results.json so it stays current as a fallback
    if (results.length > 0) {
      const resultsPath = join(projectRoot, 'data', 'results.json');
      const resultsData = {
        description: "Auto-updated match results from external APIs. Used as fallback for completed matches.",
        last_updated: new Date().toISOString(),
        matches: results
      };
      writeFileSync(resultsPath, JSON.stringify(resultsData, null, 2));
      console.log(`✅ Updated data/results.json with ${results.length} results`);
    }
    
  } catch (error) {
    console.error('❌ Error fetching odds:', error.message);
    if (error.response) {
      console.error(`   Status: ${error.response.status}`);
      console.error(`   Message: ${error.response.data?.message || error.response.statusText}`);
    }
    process.exit(1);
  }
}

main();
