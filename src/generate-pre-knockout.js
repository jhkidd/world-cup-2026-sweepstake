// Generate pre-knockout bracket data (one-time snapshot)
//
// This script produces bracket-pre-knockout.json — a Monte Carlo simulation
// of the knockout stage using odds and Elo ratings from just before the first
// knockout match (June 27, 2026). Group stage results are actual (not simulated).
//
// Usage: npm run generate-pre-knockout
// Output: data/processed/bracket-pre-knockout.json

import { readFileSync, writeFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { normalizeTeamName } from './shared/team-names.js';
import {
  simulateGroupStage,
  resolveKnownR32Matchups,
  runMonteCarloWithPaths,
  deriveTeamStrengths
} from './monte-carlo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function loadJSON(filepath) {
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

const ITERATIONS = 50000;
const PRE_KNOCKOUT_ODDS_FILE = '2026-06-27_18-33-08.json';

async function main() {
  console.log('🏆 Generating pre-knockout bracket snapshot...\n');

  // 1. Load source data
  console.log('Loading data files...');
  const tournament = loadJSON(join(projectRoot, 'data', 'tournament.json'));
  const oddsData = loadJSON(join(projectRoot, 'data', 'odds', PRE_KNOCKOUT_ODDS_FILE));
  console.log(`✓ Loaded odds snapshot: ${PRE_KNOCKOUT_ODDS_FILE}`);

  // Load Elo ratings (pre-tournament)
  let eloRatings = {};
  const eloPath = join(projectRoot, 'data', 'elo_ratings_pre_tournament.json');
  if (existsSync(eloPath)) {
    const eloData = loadJSON(eloPath);
    eloRatings = eloData.ratings;
    console.log(`✓ Loaded Elo ratings for ${Object.keys(eloRatings).length} teams`);
  } else {
    console.log('⚠ No pre-tournament Elo ratings found, falling back to bookmaker strengths');
  }

  // Load actual results (group stage only — no knockout results)
  const resultsPath = join(projectRoot, 'data', 'results.json');
  const allResults = loadJSON(resultsPath).matches || [];
  const groupResults = allResults.filter(r => r.stage === 'group_stage' && r.status === 'completed');
  console.log(`✓ Loaded ${groupResults.length} completed group stage results`);

  // 2. Merge group stage results into match odds so MC uses actual outcomes
  const matchOdds = JSON.parse(JSON.stringify(oddsData.matchOdds || []));
  for (const result of groupResults) {
    const normalizedHome = normalizeTeamName(result.home_team);
    const normalizedAway = normalizeTeamName(result.away_team);

    let oddsMatch = matchOdds.find(m =>
      (normalizeTeamName(m.home_team) === normalizedHome && normalizeTeamName(m.away_team) === normalizedAway) ||
      (normalizeTeamName(m.away_team) === normalizedHome && normalizeTeamName(m.home_team) === normalizedAway)
    );

    if (oddsMatch) {
      oddsMatch.actual_result = {
        completed: true,
        home_score: result.home_score,
        away_score: result.away_score
      };
    } else {
      // Add as a synthetic entry so the group simulation picks it up
      matchOdds.push({
        home_team: result.home_team,
        away_team: result.away_team,
        actual_result: {
          completed: true,
          home_score: result.home_score,
          away_score: result.away_score
        }
      });
    }
  }
  console.log(`✓ Merged ${groupResults.length} actual group results into match odds`);

  // 3. Resolve R32 matchups from actual group positions
  console.log('\nResolving R32 matchups from actual group stage results...');
  const groups = simulateGroupStage(tournament, matchOdds, {});

  // Verify group results are deterministic (all actual)
  for (const [groupName, standings] of Object.entries(groups)) {
    console.log(`  Group ${groupName}: ${standings.map(t => t.name).join(', ')}`);
  }

  // Use the ACTUAL R32 matchups from results.json (FIFA's confirmed pairings)
  // This avoids the non-deterministic 3rd-place allocation algorithm
  const knockoutResults = allResults.filter(r => r.stage === 'last_32' && r.status === 'completed');
  if (knockoutResults.length !== 16) {
    console.error(`❌ Expected 16 R32 results, got ${knockoutResults.length}. Cannot generate accurate snapshot.`);
    process.exit(1);
  }

  // Map actual R32 matches to slot IDs by comparing to current bracket's slot assignments
  // The slot definitions are based on group positions — we use the same logic as bracket.json
  const knownR32Matchups = resolveKnownR32Matchups(
    knockoutResults.map(r => ({ home_team: r.home_team, away_team: r.away_team })),
    groups
  );

  if (knownR32Matchups) {
    console.log(`✓ Resolved all 16 R32 matchups from actual results`);
    for (const [id, m] of Object.entries(knownR32Matchups)) {
      console.log(`  ${id}: ${m.team1} vs ${m.team2}`);
    }
  } else {
    // Fallback: manually build from actual results using the same order as bracket.json
    // These are the confirmed FIFA pairings from the tournament
    console.log('⚠ resolveKnownR32Matchups could not map all slots, using hardcoded actual pairings...');
  }

  // If resolution failed, hardcode the actual matchups (they're known and fixed)
  const actualR32Matchups = knownR32Matchups || {
    'R32-1':  { team1: normalizeTeamName('South Africa'), team2: normalizeTeamName('Canada') },
    'R32-2':  { team1: normalizeTeamName('Germany'), team2: normalizeTeamName('Paraguay') },
    'R32-3':  { team1: normalizeTeamName('Netherlands'), team2: normalizeTeamName('Morocco') },
    'R32-4':  { team1: normalizeTeamName('Brazil'), team2: normalizeTeamName('Japan') },
    'R32-5':  { team1: normalizeTeamName('France'), team2: normalizeTeamName('Sweden') },
    'R32-6':  { team1: normalizeTeamName('Ivory Coast'), team2: normalizeTeamName('Norway') },
    'R32-7':  { team1: normalizeTeamName('Mexico'), team2: normalizeTeamName('Ecuador') },
    'R32-8':  { team1: normalizeTeamName('England'), team2: normalizeTeamName('DR Congo') },
    'R32-9':  { team1: normalizeTeamName('USA'), team2: normalizeTeamName('Bosnia and Herzegovina') },
    'R32-10': { team1: normalizeTeamName('Belgium'), team2: normalizeTeamName('Senegal') },
    'R32-11': { team1: normalizeTeamName('Portugal'), team2: normalizeTeamName('Croatia') },
    'R32-12': { team1: normalizeTeamName('Spain'), team2: normalizeTeamName('Austria') },
    'R32-13': { team1: normalizeTeamName('Switzerland'), team2: normalizeTeamName('Algeria') },
    'R32-14': { team1: normalizeTeamName('Argentina'), team2: normalizeTeamName('Cape Verde') },
    'R32-15': { team1: normalizeTeamName('Colombia'), team2: normalizeTeamName('Ghana') },
    'R32-16': { team1: normalizeTeamName('Australia'), team2: normalizeTeamName('Egypt') },
  };

  // 4. Determine team strengths for any non-Elo fallbacks
  let teamStrengths = {};
  if (Object.keys(eloRatings).length === 0 && oddsData.winnerOdds?.[0]) {
    const winnerData = oddsData.winnerOdds[0];
    const outrightsMarket = winnerData.bookmakers[0]?.markets.find(m => m.key === 'outrights');
    if (outrightsMarket) {
      const teamProbs = {};
      for (const outcome of outrightsMarket.outcomes) {
        teamProbs[normalizeTeamName(outcome.name)] = 1 / outcome.price;
      }
      const total = Object.values(teamProbs).reduce((s, v) => s + v, 0);
      for (const team of Object.keys(teamProbs)) {
        teamProbs[team] /= total;
      }
      teamStrengths = deriveTeamStrengths(teamProbs);
    }
  }

  // 5. Run Monte Carlo simulation
  console.log(`\n🎲 Running ${ITERATIONS.toLocaleString()} Monte Carlo simulations...`);
  const { bracketData } = runMonteCarloWithPaths(
    tournament,
    matchOdds,
    teamStrengths,
    ITERATIONS,
    Object.keys(eloRatings).length > 0 ? eloRatings : null,
    actualR32Matchups
  );

  // 6. Set empty actualResults (no knockout matches played yet)
  bracketData.actualResults = {};

  // 7. Verify output
  console.log('\n📊 Verification:');
  console.log(`   Runs: ${bracketData.runs.length}`);
  console.log(`   Teams indexed: ${Object.keys(bracketData.teamIndex).length}`);
  console.log(`   Elements per run: ${bracketData.runs[0]?.length || 0}`);
  console.log(`   Actual results: ${Object.keys(bracketData.actualResults).length} (should be 0)`);

  // Spot-check: R32 participants should be deterministic (same teams in every run)
  const sampleRun = bracketData.runs[0];
  console.log('\n   R32 matchups in sample run:');
  for (let i = 0; i < 16; i++) {
    const t1 = bracketData.indexToTeam[sampleRun[i * 2]];
    const t2 = bracketData.indexToTeam[sampleRun[i * 2 + 1]];
    console.log(`     R32-${i + 1}: ${t1} vs ${t2}`);
  }

  // Check R32 participants are the same across all runs
  let consistent = true;
  for (let run = 1; run < Math.min(100, bracketData.runs.length); run++) {
    for (let pos = 0; pos < 32; pos++) {
      if (bracketData.runs[run][pos] !== sampleRun[pos]) {
        consistent = false;
        break;
      }
    }
    if (!consistent) break;
  }
  console.log(`\n   R32 participants consistent across runs: ${consistent ? '✓ Yes' : '✗ No (WARNING)'}`);

  // Count tournament winners
  const winCounts = {};
  for (const run of bracketData.runs) {
    const winner = bracketData.indexToTeam[run[62]];
    winCounts[winner] = (winCounts[winner] || 0) + 1;
  }
  console.log('\n   Top 5 predicted winners:');
  Object.entries(winCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .forEach(([team, count]) => {
      console.log(`     ${team}: ${(count / bracketData.runs.length * 100).toFixed(1)}%`);
    });

  // 8. Save output
  const outputPath = join(projectRoot, 'data', 'processed', 'bracket-pre-knockout.json');
  writeFileSync(outputPath, JSON.stringify(bracketData));
  const sizeKB = Math.round(JSON.stringify(bracketData).length / 1024);
  console.log(`\n✅ Saved to: data/processed/bracket-pre-knockout.json (${sizeKB} KB)`);
}

main().catch(err => {
  console.error('❌ Error:', err);
  process.exit(1);
});
