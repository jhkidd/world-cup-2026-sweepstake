import { readFileSync, writeFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { addDays, parseISO, formatISO } from 'date-fns';
import { runMonteCarloSimulation } from './monte-carlo.js';

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
  if (normalized === 'Bosnia' || normalized === 'Bosnia and Herzegovina') return 'Bosnia and Herzegovina';
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

function getUpcomingMatches(oddsData, tournament, sweepstake) {
  // Get the next matchday (group of matches happening soonish)
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
  
  // Get all matches from that matchday
  const upcoming = [];
  
  for (const match of tournament.matches.group_stage) {
    if (match.matchday !== earliestMatchday) continue;
    
    const matchDate = parseISO(match.kickoff_utc);
    
    // Find odds for this match
    const oddsMatch = oddsData.matchOdds.find(m => 
      (m.home_team === match.home && m.away_team === match.away) ||
      (m.away_team === match.home && m.home_team === match.away)
    );
    
    let homeWinProb = null, drawProb = null, awayWinProb = null;
    
    if (oddsMatch && oddsMatch.bookmakers && oddsMatch.bookmakers.length > 0) {
      const market = oddsMatch.bookmakers[0].markets.find(m => m.key === 'h2h');
      if (market) {
        const homeOutcome = market.outcomes.find(o => o.name === match.home);
        const awayOutcome = market.outcomes.find(o => o.name === match.away);
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
    
    upcoming.push({
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
      venue: match.venue_key
    });
  }
  
  // Sort by date, then group
  upcoming.sort((a, b) => {
    const dateA = new Date(a.commence_time);
    const dateB = new Date(b.commence_time);
    if (dateA.getTime() !== dateB.getTime()) return dateA - dateB;
    return a.group.localeCompare(b.group);
  });
  
  return upcoming;
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
    
    // Upcoming matches
    console.log('\nFinding upcoming matches...');
    const upcomingMatches = getUpcomingMatches(oddsData, tournament, sweepstake);
    console.log(`✓ Found ${upcomingMatches.length} matches in next matchday`);
    
    // Build timeline
    console.log('\nBuilding historical timeline...');
    const timeline = buildTimeline(allOddsFiles, sweepstake);
    console.log(`✓ Built timeline from ${timeline.length} data points`);
    
    // Run Monte Carlo simulation
    console.log('\n🎲 Running Monte Carlo simulation for stage probabilities...');
    
    // Merge completed results with match odds (override odds to 100% for actual winners)
    const matchOddsWithResults = mergeCompletedResults(oddsData.matchOdds, oddsData.results, tournament);
    
    const stageProbabilities = runMonteCarloSimulation(
      tournament, 
      matchOddsWithResults, 
      teamProbs,
      10000
    );
    console.log('✓ Monte Carlo simulation complete');
    
    // Build output
    const output = {
      timestamp: oddsData.timestamp,
      tournament_stage: 'Pre-Tournament', // TODO: Calculate based on current date
      leaderboard,
      teams: teamRankings,
      upcoming_matches: upcomingMatches,
      timeline,
      stage_probabilities: stageProbabilities,
      bracket: {
        // TODO: Implement bracket data structure
        note: 'Bracket visualization to be implemented'
      }
    };
    
    // Save processed data
    const outputPath = join(projectRoot, 'data', 'processed', 'latest.json');
    writeFileSync(outputPath, JSON.stringify(output, null, 2));
    console.log(`\n✅ Processed data saved to: data/processed/latest.json`);
    
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
