import axios from 'axios';
import { writeFileSync } from 'fs';
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
  // worldcup2026 API - check GitHub repo for exact endpoint
  // For now, returning empty array as placeholder until we confirm the endpoint
  console.log('Note: Match results fetching not yet implemented (need to confirm worldcup2026 API endpoint)');
  return [];
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
    const filepath = join(projectRoot, 'data', 'odds', filename);
    
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
