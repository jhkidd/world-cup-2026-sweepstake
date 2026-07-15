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

  // Build the set of known knockout matchups from the odds API
  // These are the R32 matches the bookmakers already had odds for
  const knockoutMatchups = matchOdds.filter(m => {
    const date = m.commence_time;
    return date && date >= '2026-06-28';
  });

  // Also add any group-results-derived knockout matchups
  const knownR32Matchups = resolveKnownR32Matchups(knockoutMatchups, groups);
  if (knownR32Matchups) {
    console.log(`✓ Resolved all 16 R32 matchups`);
    for (const [id, m] of Object.entries(knownR32Matchups)) {
      console.log(`  ${id}: ${m.team1} vs ${m.team2}`);
    }
  } else {
    console.log('⚠ Could not resolve all 16 R32 matchups — using allocation algorithm as fallback');
  }

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
    knownR32Matchups
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
