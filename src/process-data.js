import { readFileSync, writeFileSync, readdirSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { addDays, parseISO, formatISO } from 'date-fns';
import { runMonteCarloSimulation, runMonteCarloWithPaths, deriveTeamStrengths, calibrateDampingFactor } from './monte-carlo.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

function loadJSON(filepath) {
  return JSON.parse(readFileSync(filepath, 'utf-8'));
}

function getLatestOddsFile() {
  const oddsDir = join(projectRoot, 'data', 'odds');
  const files = readdirSync(oddsDir)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) {
    throw new Error('No odds data found. Run `npm run fetch` first.');
  }
  
  return join(oddsDir, files[0]);
}

function getAllOddsFiles() {
  const oddsDir = join(projectRoot, 'data', 'odds');
  const files = readdirSync(oddsDir)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  return files.map(f => join(oddsDir, f));
}

function oddsToProb(decimalOdds) {
  return 1 / decimalOdds;
}

function averageBookmakerOdds(bookmakers, outcomeKey) {
  const probs = [];
  
  for (const bookie of bookmakers) {
    const market = bookie.markets.find(m => m.key === 'outrights');
    if (!market) continue;
    
    const outcome = market.outcomes.find(o => o.name === outcomeKey);
    if (outcome && outcome.price) {
      probs.push(oddsToProb(outcome.price));
    }
  }
  
  if (probs.length === 0) return null;
  return probs.reduce((sum, p) => sum + p, 0) / probs.length;
}

function averageMatchOdds(bookmakers, teamName) {
  const probs = { win: [], draw: [] };
  
  for (const bookie of bookmakers) {
    const market = bookie.markets.find(m => m.key === 'h2h');
    if (!market) continue;
    
    const outcomes = market.outcomes;
    const teamOutcome = outcomes.find(o => o.name === teamName);
    const drawOutcome = outcomes.find(o => o.name === 'Draw');
    
    if (teamOutcome) probs.win.push(oddsToProb(teamOutcome.price));
    if (drawOutcome) probs.draw.push(oddsToProb(drawOutcome.price));
  }
  
  return {
    win: probs.win.length > 0 ? probs.win.reduce((s, p) => s + p, 0) / probs.win.length : null,
    draw: probs.draw.length > 0 ? probs.draw.reduce((s, p) => s + p, 0) / probs.draw.length : null
  };
}

function normalizeTeamName(name) {
  // Handle common variations
  const normalized = name.trim();
  if (normalized === 'Türkiye' || normalized === 'Turkey') return 'Turkey';
  if (normalized === 'Curaçao' || normalized === 'Curacao') return 'Curaçao';
  if (normalized === 'Czech Republic' || normalized === 'Czechia') return 'Czechia';
  if (normalized === 'Bosnia & Herzegovina' || normalized === 'Bosnia and Herzegovina' || normalized === 'Bosnia') return 'Bosnia and Herzegovina';
  return normalized;
}

function mergeCompletedResults(matchOdds, completedResults, tournament) {
  // Create a copy of matchOdds
  const merged = JSON.parse(JSON.stringify(matchOdds));
  
  if (!completedResults || completedResults.length === 0) {
    return merged; // No completed matches yet
  }
  
  console.log(`   Merging ${completedResults.length} completed match results...`);
  
  // For each completed match, override the odds to force the actual result
  for (const completed of completedResults) {
    const normalizedHome = normalizeTeamName(completed.home_team);
    const normalizedAway = normalizeTeamName(completed.away_team);
    
    // Find matching odds entry
    const oddsMatch = merged.find(m => 
      (normalizeTeamName(m.home_team) === normalizedHome && normalizeTeamName(m.away_team) === normalizedAway) ||
      (normalizeTeamName(m.away_team) === normalizedHome && normalizeTeamName(m.home_team) === normalizedAway)
    );
    
    if (oddsMatch && oddsMatch.bookmakers && oddsMatch.bookmakers.length > 0) {
      // Determine winner
      let homeWinProb, drawProb, awayWinProb;
      
      if (completed.home_score > completed.away_score) {
        homeWinProb = 1.0;  // Home won
        drawProb = 0.0;
        awayWinProb = 0.0;
      } else if (completed.home_score < completed.away_score) {
        homeWinProb = 0.0;
        drawProb = 0.0;
        awayWinProb = 1.0;  // Away won
      } else {
        homeWinProb = 0.0;
        drawProb = 1.0;     // Draw
        awayWinProb = 0.0;
      }
      
      // Convert probabilities to odds (odds = 1 / probability, but handle 0)
      const homeOdds = homeWinProb > 0 ? 1.0 / homeWinProb : 1000.0;
      const drawOdds = drawProb > 0 ? 1.0 / drawProb : 1000.0;
      const awayOdds = awayWinProb > 0 ? 1.0 / awayWinProb : 1000.0;
      
      // Override all bookmakers with the actual result
      for (const bookmaker of oddsMatch.bookmakers) {
        const h2hMarket = bookmaker.markets.find(m => m.key === 'h2h');
        if (h2hMarket) {
          h2hMarket.outcomes = [
            { name: oddsMatch.home_team, price: homeOdds },
            { name: 'Draw', price: drawOdds },
            { name: oddsMatch.away_team, price: awayOdds }
          ];
        }
      }
      
      // Store actual score for goal difference calculations
      oddsMatch.actual_result = {
        home_score: completed.home_score,
        away_score: completed.away_score,
        completed: true
      };
    }
  }
  
  return merged;
}

function processWinnerOdds(oddsData) {
  const winnerData = oddsData.winnerOdds[0];
  if (!winnerData || !winnerData.bookmakers) {
    throw new Error('Invalid winner odds data');
  }
  
  const teamProbs = {};
  
  // Get all unique team names from first bookmaker
  const firstBookie = winnerData.bookmakers[0];
  const outrightsMarket = firstBookie.markets.find(m => m.key === 'outrights');
  if (!outrightsMarket) {
    throw new Error('No outrights market found');
  }
  
  for (const outcome of outrightsMarket.outcomes) {
    const teamName = normalizeTeamName(outcome.name);
    const avgProb = averageBookmakerOdds(winnerData.bookmakers, outcome.name);
    if (avgProb) {
      teamProbs[teamName] = avgProb;
    }
  }
  
  return teamProbs;
}

function calculateParticipantRankings(sweepstake, teamProbs, previousRankings = null) {
  const rankings = [];
  
  for (const participant of sweepstake.participants) {
    const team1Name = normalizeTeamName(participant.teams[0]);
    const team2Name = normalizeTeamName(participant.teams[1]);
    
    const team1Prob = teamProbs[team1Name] || 0;
    const team2Prob = teamProbs[team2Name] || 0;
    const totalProb = team1Prob + team2Prob;
    
    let changeFromLastWeek = null;
    if (previousRankings) {
      const prevData = previousRankings.find(p => p.name === participant.name);
      if (prevData) {
        changeFromLastWeek = totalProb - prevData.total_probability;
      }
    }
    
    rankings.push({
      name: participant.name,
      team1: {
        name: team1Name,
        probability: team1Prob
      },
      team2: {
        name: team2Name,
        probability: team2Prob
      },
      total_probability: totalProb,
      change_from_last_week: changeFromLastWeek
    });
  }
  
  // Sort by total probability (descending)
  rankings.sort((a, b) => b.total_probability - a.total_probability);
  
  // Add ranks
  rankings.forEach((r, i) => r.rank = i + 1);
  
  return rankings;
}

function getTeamRankings(tournament, teamProbs, sweepstake) {
  const teams = [];
  
  // Build owner lookup
  const ownerLookup = {};
  for (const participant of sweepstake.participants) {
    for (const team of participant.teams) {
      ownerLookup[normalizeTeamName(team)] = participant.name;
    }
  }
  
  for (const team of tournament.teams) {
    const teamName = normalizeTeamName(team.name);
    teams.push({
      name: teamName,
      group: team.group,
      confederation: team.confederation,
      win_probability: teamProbs[teamName] || 0,
      status: 'active', // TODO: Calculate based on results and date
      owner: ownerLookup[teamName] || null
    });
  }
  
  // Sort by probability
  teams.sort((a, b) => b.win_probability - a.win_probability);
  teams.forEach((t, i) => t.rank = i + 1);
  
  return teams;
}

function getMatchesForMatchday(matchday, oddsData, tournament, ownerLookup) {
  const matches = [];
  
  for (const match of tournament.matches.group_stage) {
    if (match.matchday !== matchday) continue;
    
    // Normalize team names for matching
    const normalizedHome = normalizeTeamName(match.home);
    const normalizedAway = normalizeTeamName(match.away);
    
    // Find odds for this match (with normalization)
    const oddsMatch = oddsData.matchOdds.find(m => {
      const oddsHome = normalizeTeamName(m.home_team);
      const oddsAway = normalizeTeamName(m.away_team);
      return (oddsHome === normalizedHome && oddsAway === normalizedAway) ||
             (oddsAway === normalizedHome && oddsHome === normalizedAway);
    });
    
    let homeWinProb = null, drawProb = null, awayWinProb = null;
    
    if (oddsMatch && oddsMatch.bookmakers && oddsMatch.bookmakers.length > 0) {
      const market = oddsMatch.bookmakers[0].markets.find(m => m.key === 'h2h');
      if (market) {
        // Normalize outcome names for matching
        const homeOutcome = market.outcomes.find(o => normalizeTeamName(o.name) === normalizedHome);
        const awayOutcome = market.outcomes.find(o => normalizeTeamName(o.name) === normalizedAway);
        const drawOutcome = market.outcomes.find(o => o.name === 'Draw');
        
        homeWinProb = homeOutcome ? (1 / homeOutcome.price) : null;
        awayWinProb = awayOutcome ? (1 / awayOutcome.price) : null;
        drawProb = drawOutcome ? (1 / drawOutcome.price) : null;
        
        // Normalize probabilities
        if (homeWinProb !== null && awayWinProb !== null && drawProb !== null) {
          const total = homeWinProb + awayWinProb + drawProb;
          homeWinProb /= total;
          awayWinProb /= total;
          drawProb /= total;
        }
      }
    }
    
    matches.push({
      matchday: match.matchday,
      group: match.group,
      home_team: match.home,
      away_team: match.away,
      home_owner: ownerLookup[normalizeTeamName(match.home)] || null,
      away_owner: ownerLookup[normalizeTeamName(match.away)] || null,
      commence_time: match.kickoff_utc,
      home_win_prob: homeWinProb,
      draw_prob: drawProb,
      away_win_prob: awayWinProb,
      venue: match.venue_key,
      actual_result: oddsMatch?.actual_result || null
    });
  }
  
  // Sort by date, then group
  matches.sort((a, b) => {
    const dateA = new Date(a.commence_time);
    const dateB = new Date(b.commence_time);
    if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
    return a.group.localeCompare(b.group);
  });
  
  return matches;
}

function getAllMatchdays(oddsData, tournament, sweepstake) {
  // Build owner lookup
  const ownerLookup = {};
  for (const participant of sweepstake.participants) {
    for (const team of participant.teams) {
      ownerLookup[normalizeTeamName(team)] = participant.name;
    }
  }
  
  return {
    matchday1: getMatchesForMatchday(1, oddsData, tournament, ownerLookup),
    matchday2: getMatchesForMatchday(2, oddsData, tournament, ownerLookup),
    matchday3: getMatchesForMatchday(3, oddsData, tournament, ownerLookup)
  };
}

function getUpcomingMatches(oddsData, tournament, sweepstake) {
  // For backwards compatibility, returns only the next matchday
  const now = new Date();
  
  // Build owner lookup
  const ownerLookup = {};
  for (const participant of sweepstake.participants) {
    for (const team of participant.teams) {
      ownerLookup[normalizeTeamName(team)] = participant.name;
    }
  }
  
  // Find the earliest future matchday
  let earliestMatchday = null;
  let earliestDate = null;
  
  for (const match of tournament.matches.group_stage) {
    const matchDate = parseISO(match.kickoff_utc);
    if (matchDate >= now) {
      if (!earliestDate || matchDate < earliestDate) {
        earliestDate = matchDate;
        earliestMatchday = match.matchday;
      }
    }
  }
  
  if (!earliestMatchday) {
    return []; // No upcoming matches
  }
  
  return getMatchesForMatchday(earliestMatchday, oddsData, tournament, ownerLookup);
}

function buildTimeline(allOddsFiles, sweepstake) {
  const timeline = [];
  
  for (const filepath of allOddsFiles) {
    try {
      const oddsData = loadJSON(filepath);
      const teamProbs = processWinnerOdds(oddsData);
      
      const participants = {};
      for (const participant of sweepstake.participants) {
        const team1Prob = teamProbs[normalizeTeamName(participant.teams[0])] || 0;
        const team2Prob = teamProbs[normalizeTeamName(participant.teams[1])] || 0;
        participants[participant.name] = team1Prob + team2Prob;
      }
      
      timeline.push({
        date: oddsData.timestamp,
        participants
      });
    } catch (error) {
      console.warn(`Skipping file ${filepath}:`, error.message);
    }
  }
  
  timeline.sort((a, b) => new Date(a.date) - new Date(b.date));
  return timeline;
}

async function main() {
  console.log('📊 Processing World Cup data...\n');
  
  try {
    // Load data files
    console.log('Loading data files...');
    const sweepstake = loadJSON(join(projectRoot, 'data', 'sweepstake.json'));
    const tournament = loadJSON(join(projectRoot, 'data', 'tournament.json'));
    
    // Load team details if available (optional - from fetch-team-data.js)
    let teamDetails = {};
    const teamDetailsPath = join(projectRoot, 'data', 'team_details.json');
    try {
      teamDetails = loadJSON(teamDetailsPath);
      console.log(`✓ Loaded team details for ${Object.keys(teamDetails).length} teams`);
    } catch (e) {
      console.log('ℹ No team details found (run npm run fetch-teams to fetch)');
    }
    
    const latestOddsFile = getLatestOddsFile();
    console.log(`Using latest odds: ${latestOddsFile.split(/[/\\]/).pop()}`);
    const oddsData = loadJSON(latestOddsFile);
    
    // Validate sweepstake teams exist in tournament
    console.log('\nValidating sweepstake assignments...');
    const tournamentTeams = new Set(tournament.teams.map(t => normalizeTeamName(t.name)));
    for (const participant of sweepstake.participants) {
      for (const team of participant.teams) {
        const normalized = normalizeTeamName(team);
        if (!tournamentTeams.has(normalized)) {
          throw new Error(`Team "${team}" in sweepstake not found in tournament`);
        }
      }
    }
    console.log('✓ All teams valid');
    
    // Process winner odds
    console.log('\nCalculating tournament winner probabilities...');
    const teamProbs = processWinnerOdds(oddsData);
    console.log(`✓ Processed odds for ${Object.keys(teamProbs).length} teams`);
    
    // Calculate participant rankings
    console.log('\nCalculating participant rankings...');
    const allOddsFiles = getAllOddsFiles();
    let previousRankings = null;
    if (allOddsFiles.length >= 2) {
      const previousOdds = loadJSON(allOddsFiles[allOddsFiles.length - 2]);
      const previousTeamProbs = processWinnerOdds(previousOdds);
      previousRankings = calculateParticipantRankings(sweepstake, previousTeamProbs);
    }
    
    const leaderboard = calculateParticipantRankings(sweepstake, teamProbs, previousRankings);
    console.log(`✓ Calculated rankings for ${leaderboard.length} participants`);
    
    // Team rankings
    console.log('\nCreating team rankings...');
    const teamRankings = getTeamRankings(tournament, teamProbs, sweepstake);
    console.log(`✓ Ranked ${teamRankings.length} teams`);
    
    // Upcoming matches (next matchday only - for backwards compatibility)
    console.log('\nFinding upcoming matches...');
    const upcomingMatches = getUpcomingMatches(oddsData, tournament, sweepstake);
    console.log(`✓ Found ${upcomingMatches.length} matches in next matchday`);
    
    // All matchdays (for web site)
    console.log('\nProcessing all group stage matchdays...');
    const allMatchdays = getAllMatchdays(oddsData, tournament, sweepstake);
    console.log(`✓ Matchday 1: ${allMatchdays.matchday1.length} matches`);
    console.log(`✓ Matchday 2: ${allMatchdays.matchday2.length} matches`);
    console.log(`✓ Matchday 3: ${allMatchdays.matchday3.length} matches`);
    
    // Build timeline
    console.log('\nBuilding historical timeline...');
    const timeline = buildTimeline(allOddsFiles, sweepstake);
    console.log(`✓ Built timeline from ${timeline.length} data points`);
    
    // Load Elo ratings
    console.log('\nLoading Elo ratings...');
    let eloRatings = {};
    try {
      const eloData = loadJSON(join(projectRoot, 'data', 'elo_ratings.json'));
      eloRatings = eloData.ratings;
      console.log(`✓ Loaded Elo ratings for ${Object.keys(eloRatings).length} teams (source: ${eloData.source})`);
    } catch (e) {
      console.log('⚠ No Elo ratings found - using bookmaker-derived strengths as fallback');
    }
    
    // Run Monte Carlo simulation with Elo ratings
    console.log('\n🎲 Running Monte Carlo simulation for stage probabilities...');
    
    // Merge completed results with match odds (override odds to 100% for actual winners)
    const matchOddsWithResults = mergeCompletedResults(oddsData.matchOdds, oddsData.results, tournament);
    
    // Use Elo ratings directly for knockout matches, bookmaker H2H for group stage
    // Fall back to calibrated strengths if no Elo available
    let calibratedStrengths = null;
    if (Object.keys(eloRatings).length === 0) {
      console.log('   Deriving calibrated team strengths from bookmaker odds (no Elo data)...');
      const calibration = calibrateDampingFactor(tournament, matchOddsWithResults, teamProbs, {
        simIterations: 2000,
        maxIterations: 8
      });
      calibratedStrengths = calibration.strengths;
    } else {
      console.log('   Using Elo ratings for knockout match predictions...');
    }
    
    const { teamStats: stageProbabilities, bracketData } = runMonteCarloWithPaths(
      tournament, 
      matchOddsWithResults, 
      calibratedStrengths || teamProbs, // Fallback strengths
      10000,
      Object.keys(eloRatings).length > 0 ? eloRatings : null
    );
    console.log('✓ Monte Carlo simulation complete');
    
    // Validation: compare simulated vs bookmaker win probabilities
    console.log('\n📊 Validation: Simulated vs Bookmaker Outright Odds');
    console.log('━'.repeat(60));
    console.log('Team'.padEnd(20) + 'Bookmaker'.padEnd(12) + 'Simulated'.padEnd(12) + 'Diff'.padEnd(10) + 'Status');
    console.log('━'.repeat(60));
    
    const topTeams = Object.entries(teamProbs)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 10);
    
    let totalError = 0;
    let maxDiff = 0;
    let maxDiffTeam = '';
    
    for (const [team, bookmakerProb] of topTeams) {
      const simProb = stageProbabilities[team]?.win_tournament || 0;
      const diff = simProb - bookmakerProb;
      const absDiff = Math.abs(diff);
      totalError += absDiff;
      
      if (absDiff > maxDiff) {
        maxDiff = absDiff;
        maxDiffTeam = team;
      }
      
      const diffStr = (diff >= 0 ? '+' : '') + (diff * 100).toFixed(1) + '%';
      const status = absDiff < 0.03 ? '✓' : (absDiff < 0.05 ? '~' : '⚠');
      
      console.log(
        team.padEnd(20) + 
        ((bookmakerProb * 100).toFixed(1) + '%').padEnd(12) +
        ((simProb * 100).toFixed(1) + '%').padEnd(12) +
        diffStr.padEnd(10) +
        status
      );
    }
    
    const mae = totalError / topTeams.length;
    console.log('━'.repeat(60));
    console.log(`Mean Absolute Error: ${(mae * 100).toFixed(2)}%`);
    console.log(`Max Deviation: ${maxDiffTeam} (${(maxDiff * 100).toFixed(1)}%)`);
    
    // Enrich team rankings with simulated probabilities
    for (const team of teamRankings) {
      const simData = stageProbabilities[team.name];
      team.bookmaker_win_probability = team.win_probability; // Keep original
      team.simulated_win_probability = simData?.win_tournament || 0;
      // Re-sort by simulated probability for display
    }
    // Re-sort by simulated probability and update ranks
    teamRankings.sort((a, b) => b.simulated_win_probability - a.simulated_win_probability);
    teamRankings.forEach((t, i) => t.rank = i + 1);
    
    // Build output
    const output = {
      timestamp: oddsData.timestamp,
      tournament_stage: 'Pre-Tournament', // TODO: Calculate based on current date
      leaderboard,
      teams: teamRankings,
      upcoming_matches: upcomingMatches,
      matchdays: allMatchdays,
      timeline,
      stage_probabilities: stageProbabilities,
      team_details: teamDetails,
      elo_source: Object.keys(eloRatings).length > 0 ? 'eloratings.net' : null,
      validation: {
        mean_absolute_error: mae,
        max_deviation: { team: maxDiffTeam, diff: maxDiff }
      },
      bracket: {
        topology: bracketData.bracketTopology,
        teamCount: Object.keys(bracketData.teamIndex).length,
        runCount: bracketData.runs.length,
        note: 'Full bracket paths stored in bracket.json'
      }
    };
    
    // Save processed data
    const processedDir = join(projectRoot, 'data', 'processed');
    mkdirSync(processedDir, { recursive: true });
    const outputPath = join(processedDir, 'latest.json');
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n✅ Processed data saved to: data/processed/latest.json`);
    
    // Save bracket data separately (large file, loaded on demand by client)
    const bracketPath = join(processedDir, 'bracket.json');
    writeFileSync(bracketPath, JSON.stringify(bracketData));
    const bracketSizeKB = Math.round(JSON.stringify(bracketData).length / 1024);
    console.log(`✅ Bracket data saved to: data/processed/bracket.json (${bracketSizeKB} KB)`);
    
    // Summary
    console.log('\n📈 Summary:');
    console.log(`   Top 3 participants:`);
    for (let i = 0; i < 3 && i < leaderboard.length; i++) {
      const p = leaderboard[i];
      const pct = (p.total_probability * 100).toFixed(2);
      const change = p.change_from_last_week 
        ? ` (${p.change_from_last_week > 0 ? '+' : ''}${(p.change_from_last_week * 100).toFixed(2)}%)`
        : '';
      console.log(`   ${i + 1}. ${p.name}: ${pct}%${change}`);
    }
    
  } catch (error) {
    console.error('❌ Error processing data:', error.message);
    process.exit(1);
  }
}

main();
