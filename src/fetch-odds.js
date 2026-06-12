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

async function fetchMatchResults() {
  // Primary source: worldcup26.ir API (free, no API key, live scores)
  const url = 'https://worldcup26.ir/get/games';
  
  try {
    console.log(`Fetching: ${url}`);
    const response = await axios.get(url);
    const matches = response.data.games || response.data;
    
    // Filter to only completed matches
    const completed = matches.filter(m => 
      m.finished === 'TRUE' || m.finished === true || m.time_elapsed === 'finished'
    );
    
    console.log(`   Found ${completed.length} completed matches from worldcup26.ir`);
    
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
  } catch (error) {
    console.log(`   Note: Could not fetch from worldcup26.ir (${error.message})`);
    console.log('   Falling back to local data/results.json if available');
    
    // Fallback: read from local results.json
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
