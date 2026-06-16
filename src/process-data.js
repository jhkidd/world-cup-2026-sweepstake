import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
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

/**
 * Load local results from data/results.json (manually maintained).
 * This is the authoritative source for completed match results.
 */
function loadLocalResults() {
  const resultsPath = join(projectRoot, 'data', 'results.json');
  if (!existsSync(resultsPath)) {
    return [];
  }
  try {
    const data = loadJSON(resultsPath);
    return data.matches || [];
  } catch (e) {
    console.warn('⚠ Could not load local results:', e.message);
    return [];
  }
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
  if (normalized === 'Bosnia & Herzegovina' || normalized === 'Bosnia and Herzegovina' || normalized === 'Bosnia' || normalized === 'Bosnia-Herzegovina') return 'Bosnia and Herzegovina';
  if (normalized === 'Côte d\'Ivoire' || normalized === 'Cote d\'Ivoire' || normalized === 'Cote D\'Ivoire' || normalized === 'Ivory Coast') return 'Ivory Coast';
  if (normalized === 'United States' || normalized === 'United States of America') return 'USA';
  if (normalized === 'Cape Verde Islands') return 'Cape Verde';
  return normalized;
}

/**
 * Compute predictions vs results analysis for all completed matches.
 * For each completed match, finds the last odds file before kickoff and
 * extracts averaged bookmaker h2h probabilities.
 */
function computePredictionsVsResults(tournament, localResults, ownerLookup) {
  const oddsDir = join(projectRoot, 'data', 'odds');
  const oddsFiles = readdirSync(oddsDir)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  if (oddsFiles.length === 0 || localResults.length === 0) {
    return null;
  }
  
  const matches = [];
  
  for (const result of localResults) {
    // Find the tournament match to get kickoff time
    const normalizedHome = normalizeTeamName(result.home_team);
    const normalizedAway = normalizeTeamName(result.away_team);
    
    const tournamentMatch = tournament.matches.group_stage.find(m => {
      const tHome = normalizeTeamName(m.home);
      const tAway = normalizeTeamName(m.away);
      return (tHome === normalizedHome && tAway === normalizedAway) ||
             (tAway === normalizedHome && tHome === normalizedAway);
    });
    
    if (!tournamentMatch) continue;
    
    const kickoffUtc = tournamentMatch.kickoff_utc;
    // Convert kickoff to comparable timestamp (files are named YYYY-MM-DD_HH-MM-SS)
    const kickoffTs = kickoffUtc.replace(/:/g, '-').replace('T', '_').replace('Z', '');
    
    // Find last odds file before kickoff
    const preMatchFiles = oddsFiles.filter(f => f < kickoffTs);
    if (preMatchFiles.length === 0) continue;
    
    const preMatchFile = preMatchFiles[preMatchFiles.length - 1];
    const oddsData = JSON.parse(readFileSync(join(oddsDir, preMatchFile), 'utf-8'));
    
    // Find this match in the odds data
    const oddsMatch = (oddsData.matchOdds || []).find(m => {
      const oHome = normalizeTeamName(m.home_team);
      const oAway = normalizeTeamName(m.away_team);
      return (oHome === normalizedHome && oAway === normalizedAway) ||
             (oAway === normalizedHome && oHome === normalizedAway);
    });
    
    if (!oddsMatch || !oddsMatch.bookmakers || oddsMatch.bookmakers.length === 0) continue;
    
    // Average probabilities across all bookmakers
    const homeProbs = [], drawProbs = [], awayProbs = [];
    
    // Determine which team is "home" in the odds (may differ from tournament)
    const oddsHomeNorm = normalizeTeamName(oddsMatch.home_team);
    const tournamentHomeNorm = normalizeTeamName(tournamentMatch.home);
    const sameOrientation = (oddsHomeNorm === tournamentHomeNorm);
    
    for (const bookie of oddsMatch.bookmakers) {
      const market = bookie.markets.find(m => m.key === 'h2h');
      if (!market) continue;
      
      const oddsHome = market.outcomes.find(o => normalizeTeamName(o.name) === oddsHomeNorm);
      const oddsDraw = market.outcomes.find(o => o.name === 'Draw');
      const oddsAway = market.outcomes.find(o => 
        normalizeTeamName(o.name) !== oddsHomeNorm && o.name !== 'Draw'
      );
      
      if (oddsHome && oddsDraw && oddsAway) {
        if (sameOrientation) {
          homeProbs.push(1 / oddsHome.price);
          drawProbs.push(1 / oddsDraw.price);
          awayProbs.push(1 / oddsAway.price);
        } else {
          // Odds file has teams swapped relative to tournament
          homeProbs.push(1 / oddsAway.price);
          drawProbs.push(1 / oddsDraw.price);
          awayProbs.push(1 / oddsHome.price);
        }
      }
    }
    
    if (homeProbs.length === 0) continue;
    
    // Average and normalize
    let homeWinProb = homeProbs.reduce((s, p) => s + p, 0) / homeProbs.length;
    let drawProb = drawProbs.reduce((s, p) => s + p, 0) / drawProbs.length;
    let awayWinProb = awayProbs.reduce((s, p) => s + p, 0) / awayProbs.length;
    const total = homeWinProb + drawProb + awayWinProb;
    homeWinProb /= total;
    drawProb /= total;
    awayWinProb /= total;
    
    // Determine actual outcome (relative to tournament home team)
    const homeScore = result.home_team === tournamentMatch.home ? result.home_score :
                      normalizeTeamName(result.home_team) === tournamentHomeNorm ? result.home_score : result.away_score;
    const awayScore = result.home_team === tournamentMatch.home ? result.away_score :
                      normalizeTeamName(result.home_team) === tournamentHomeNorm ? result.away_score : result.home_score;
    
    let actualOutcome;
    if (homeScore > awayScore) actualOutcome = 'home_win';
    else if (awayScore > homeScore) actualOutcome = 'away_win';
    else actualOutcome = 'draw';
    
    // Predicted outcome = most likely
    const predictedOutcome = homeWinProb >= drawProb && homeWinProb >= awayWinProb ? 'home_win' :
                             awayWinProb >= homeWinProb && awayWinProb >= drawProb ? 'away_win' : 'draw';
    
    // Surprise (information content in bits)
    const actualProb = actualOutcome === 'home_win' ? homeWinProb :
                       actualOutcome === 'draw' ? drawProb : awayWinProb;
    const surpriseBits = -Math.log2(Math.max(actualProb, 0.001)); // floor at 0.1% to avoid infinity
    
    // RPS (Ranked Probability Score) - ordinal: [home_win, draw, away_win]
    const predCdf = [homeWinProb, homeWinProb + drawProb];
    const actualVector = actualOutcome === 'home_win' ? [1, 0, 0] :
                         actualOutcome === 'draw' ? [0, 1, 0] : [0, 0, 1];
    const actualCdf = [actualVector[0], actualVector[0] + actualVector[1]];
    const rps = 0.5 * ((predCdf[0] - actualCdf[0]) ** 2 + (predCdf[1] - actualCdf[1]) ** 2);
    
    // Find best bookmaker odds on the actual outcome
    let bestOdds = 0;
    let bestBookie = null;
    for (const bookie of oddsMatch.bookmakers) {
      const market = bookie.markets.find(m => m.key === 'h2h');
      if (!market) continue;
      
      let targetOutcomeName;
      if (actualOutcome === 'draw') {
        targetOutcomeName = 'Draw';
      } else if (actualOutcome === 'home_win') {
        targetOutcomeName = sameOrientation ? oddsMatch.home_team : oddsMatch.away_team;
      } else {
        targetOutcomeName = sameOrientation ? oddsMatch.away_team : oddsMatch.home_team;
      }
      
      const outcome = market.outcomes.find(o => 
        o.name === targetOutcomeName || normalizeTeamName(o.name) === normalizeTeamName(targetOutcomeName)
      );
      if (outcome && outcome.price > bestOdds) {
        bestOdds = outcome.price;
        bestBookie = bookie.title;
      }
    }
    
    matches.push({
      home_team: tournamentMatch.home,
      away_team: tournamentMatch.away,
      group: tournamentMatch.group || result.group,
      date: kickoffUtc,
      pre_match_probs: {
        home_win: Math.round(homeWinProb * 10000) / 10000,
        draw: Math.round(drawProb * 10000) / 10000,
        away_win: Math.round(awayWinProb * 10000) / 10000
      },
      predicted_outcome: predictedOutcome,
      actual_outcome: actualOutcome,
      actual_score: { home: homeScore, away: awayScore },
      surprise_bits: Math.round(surpriseBits * 100) / 100,
      raw_probability: Math.round(actualProb * 1000) / 1000,
      rps: Math.round(rps * 1000) / 1000,
      best_bet: bestOdds > 0 ? { odds: bestOdds, return_10: Math.round(bestOdds * 10 * 100) / 100, bookie: bestBookie } : null,
      home_owner: ownerLookup[normalizeTeamName(tournamentMatch.home)] || null,
      away_owner: ownerLookup[normalizeTeamName(tournamentMatch.away)] || null
    });
  }
  
  if (matches.length === 0) return null;
  
  // Sort by surprise (most surprising first)
  matches.sort((a, b) => b.surprise_bits - a.surprise_bits);
  
  // Summary stats
  const avgRps = matches.reduce((s, m) => s + m.rps, 0) / matches.length;
  const avgSurprise = matches.reduce((s, m) => s + m.surprise_bits, 0) / matches.length;
  const correctPredictions = matches.filter(m => m.predicted_outcome === m.actual_outcome).length;
  
  // Team performance aggregation
  const teamStats = {};
  for (const match of matches) {
    // Home team
    if (!teamStats[match.home_team]) {
      teamStats[match.home_team] = { matches: 0, expected_pts: 0, actual_pts: 0, total_rps: 0 };
    }
    teamStats[match.home_team].matches++;
    teamStats[match.home_team].expected_pts += match.pre_match_probs.home_win * 3 + match.pre_match_probs.draw * 1;
    teamStats[match.home_team].actual_pts += match.actual_outcome === 'home_win' ? 3 : match.actual_outcome === 'draw' ? 1 : 0;
    teamStats[match.home_team].total_rps += match.rps;
    
    // Away team
    if (!teamStats[match.away_team]) {
      teamStats[match.away_team] = { matches: 0, expected_pts: 0, actual_pts: 0, total_rps: 0 };
    }
    teamStats[match.away_team].matches++;
    teamStats[match.away_team].expected_pts += match.pre_match_probs.away_win * 3 + match.pre_match_probs.draw * 1;
    teamStats[match.away_team].actual_pts += match.actual_outcome === 'away_win' ? 3 : match.actual_outcome === 'draw' ? 1 : 0;
    teamStats[match.away_team].total_rps += match.rps;
  }
  
  const teamPerformance = Object.entries(teamStats).map(([team, stats]) => ({
    team,
    matches_played: stats.matches,
    avg_rps: Math.round((stats.total_rps / stats.matches) * 1000) / 1000,
    expected_points: Math.round(stats.expected_pts * 100) / 100,
    actual_points: stats.actual_pts,
    delta: Math.round((stats.actual_pts - stats.expected_pts) * 100) / 100,
    direction: stats.actual_pts > stats.expected_pts ? 'overperforming' :
               stats.actual_pts < stats.expected_pts ? 'underperforming' : 'as_expected'
  })).sort((a, b) => b.delta - a.delta);
  
  // Calibration bins - pool all outcome probabilities
  const bins = [
    { predicted_range: [0, 0.2], predictions: [], actuals: [] },
    { predicted_range: [0.2, 0.4], predictions: [], actuals: [] },
    { predicted_range: [0.4, 0.6], predictions: [], actuals: [] },
    { predicted_range: [0.6, 0.8], predictions: [], actuals: [] },
    { predicted_range: [0.8, 1.0], predictions: [], actuals: [] }
  ];
  
  for (const match of matches) {
    // Each match contributes 3 data points (one per outcome)
    const probs = [
      { prob: match.pre_match_probs.home_win, occurred: match.actual_outcome === 'home_win' },
      { prob: match.pre_match_probs.draw, occurred: match.actual_outcome === 'draw' },
      { prob: match.pre_match_probs.away_win, occurred: match.actual_outcome === 'away_win' }
    ];
    
    for (const { prob, occurred } of probs) {
      const bin = bins.find(b => prob >= b.predicted_range[0] && prob < b.predicted_range[1]);
      if (bin) {
        bin.predictions.push(prob);
        bin.actuals.push(occurred ? 1 : 0);
      } else if (prob >= 1.0) {
        // Edge case: prob = 1.0 goes in last bin
        bins[bins.length - 1].predictions.push(prob);
        bins[bins.length - 1].actuals.push(occurred ? 1 : 0);
      }
    }
  }
  
  const calibration = {
    bins: bins.map(b => ({
      predicted_range: b.predicted_range,
      count: b.predictions.length,
      avg_predicted: b.predictions.length > 0 ? 
        Math.round((b.predictions.reduce((s, p) => s + p, 0) / b.predictions.length) * 1000) / 1000 : null,
      actual_frequency: b.actuals.length > 0 ?
        Math.round((b.actuals.reduce((s, a) => s + a, 0) / b.actuals.length) * 1000) / 1000 : null
    }))
  };
  
  return {
    summary: {
      matches_played: matches.length,
      total_matches: 104,
      average_rps: Math.round(avgRps * 1000) / 1000,
      average_surprise_bits: Math.round(avgSurprise * 100) / 100,
      correct_predictions: correctPredictions,
      correct_pct: Math.round((correctPredictions / matches.length) * 100)
    },
    matches,
    team_performance: teamPerformance,
    calibration
  };
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
    let oddsMatch = merged.find(m => 
      (normalizeTeamName(m.home_team) === normalizedHome && normalizeTeamName(m.away_team) === normalizedAway) ||
      (normalizeTeamName(m.away_team) === normalizedHome && normalizeTeamName(m.home_team) === normalizedAway)
    );
    
    // If no odds entry exists (match dropped from API), create a synthetic one
    if (!oddsMatch) {
      oddsMatch = {
        id: completed.id || `${completed.home_team}-${completed.away_team}`,
        sport_key: 'soccer_fifa_world_cup',
        home_team: completed.home_team,
        away_team: completed.away_team,
        bookmakers: [{
          key: 'result',
          title: 'Actual Result',
          markets: [{ key: 'h2h', outcomes: [] }]
        }]
      };
      merged.push(oddsMatch);
    }
    
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

function getMatchesForMatchday(matchday, oddsData, tournament, ownerLookup, localResults = []) {
  const matches = [];
  
  for (const match of tournament.matches.group_stage) {
    if (match.matchday !== matchday) continue;
    
    // Normalize team names for matching
    const normalizedHome = normalizeTeamName(match.home);
    const normalizedAway = normalizeTeamName(match.away);
    
    // Check local results first (authoritative source for completed matches)
    const localResult = localResults.find(r => {
      const rHome = normalizeTeamName(r.home_team);
      const rAway = normalizeTeamName(r.away_team);
      return (rHome === normalizedHome && rAway === normalizedAway) ||
             (rAway === normalizedHome && rHome === normalizedAway);
    });
    
    let actualResult = null;
    if (localResult) {
      // Determine scores relative to tournament match home/away
      const localHome = normalizeTeamName(localResult.home_team);
      if (localHome === normalizedHome) {
        actualResult = {
          home_score: localResult.home_score,
          away_score: localResult.away_score,
          completed: true
        };
      } else {
        actualResult = {
          home_score: localResult.away_score,
          away_score: localResult.home_score,
          completed: true
        };
      }
    }
    
    // Find odds for this match (with normalization)
    const oddsMatch = oddsData.matchOdds.find(m => {
      const oddsHome = normalizeTeamName(m.home_team);
      const oddsAway = normalizeTeamName(m.away_team);
      return (oddsHome === normalizedHome && oddsAway === normalizedAway) ||
             (oddsAway === normalizedHome && oddsHome === normalizedAway);
    });
    
    let homeWinProb = null, drawProb = null, awayWinProb = null;
    
    if (actualResult) {
      // Completed match - set probabilities to 100% for actual result
      if (actualResult.home_score > actualResult.away_score) {
        homeWinProb = 1.0; drawProb = 0.0; awayWinProb = 0.0;
      } else if (actualResult.away_score > actualResult.home_score) {
        homeWinProb = 0.0; drawProb = 0.0; awayWinProb = 1.0;
      } else {
        homeWinProb = 0.0; drawProb = 1.0; awayWinProb = 0.0;
      }
    } else if (oddsMatch && oddsMatch.bookmakers && oddsMatch.bookmakers.length > 0) {
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
    
    // Use local result, or fall back to odds-merged result
    const finalResult = actualResult || oddsMatch?.actual_result || null;
    
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
      actual_result: finalResult
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

function getAllMatchdays(oddsData, tournament, sweepstake, localResults = []) {
  // Build owner lookup
  const ownerLookup = {};
  for (const participant of sweepstake.participants) {
    for (const team of participant.teams) {
      ownerLookup[normalizeTeamName(team)] = participant.name;
    }
  }
  
  return {
    matchday1: getMatchesForMatchday(1, oddsData, tournament, ownerLookup, localResults),
    matchday2: getMatchesForMatchday(2, oddsData, tournament, ownerLookup, localResults),
    matchday3: getMatchesForMatchday(3, oddsData, tournament, ownerLookup, localResults)
  };
}

function getUpcomingMatches(oddsData, tournament, sweepstake, localResults = []) {
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
  
  return getMatchesForMatchday(earliestMatchday, oddsData, tournament, ownerLookup, localResults);
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
    
    // Load local results (authoritative source for completed matches)
    const localResults = loadLocalResults();
    if (localResults.length > 0) {
      console.log(`✓ Loaded ${localResults.length} completed match results from data/results.json`);
    } else {
      console.log('ℹ No local results found (data/results.json)');
    }
    
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
    const upcomingMatches = getUpcomingMatches(oddsData, tournament, sweepstake, localResults);
    console.log(`✓ Found ${upcomingMatches.length} matches in next matchday`);
    
    // All matchdays (for web site)
    console.log('\nProcessing all group stage matchdays...');
    const allMatchdays = getAllMatchdays(oddsData, tournament, sweepstake, localResults);
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
    
    // Combine remote results (from odds API) with local results (authoritative)
    const combinedResults = [...(oddsData.results || [])];
    for (const localResult of localResults) {
      // Add local results in the format mergeCompletedResults expects
      const alreadyExists = combinedResults.find(r => 
        normalizeTeamName(r.home_team) === normalizeTeamName(localResult.home_team) &&
        normalizeTeamName(r.away_team) === normalizeTeamName(localResult.away_team)
      );
      if (!alreadyExists) {
        combinedResults.push({
          id: localResult.id,
          home_team: localResult.home_team,
          away_team: localResult.away_team,
          home_score: localResult.home_score,
          away_score: localResult.away_score,
          status: 'completed',
          group: localResult.group,
          stage: localResult.stage || 'group_stage',
          date: localResult.date
        });
      }
    }
    
    // Merge completed results with match odds (override odds to 100% for actual winners)
    const matchOddsWithResults = mergeCompletedResults(oddsData.matchOdds, combinedResults, tournament);
    
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
    
    // Compute predictions vs results analysis
    console.log('\n📊 Computing predictions vs results analysis...');
    const predictionsOwnerLookup = {};
    for (const participant of sweepstake.participants) {
      for (const team of participant.teams) {
        predictionsOwnerLookup[normalizeTeamName(team)] = participant.name;
      }
    }
    const predictionsVsResults = computePredictionsVsResults(tournament, localResults, predictionsOwnerLookup);
    if (predictionsVsResults) {
      console.log(`✓ Analysed ${predictionsVsResults.summary.matches_played} completed matches`);
      console.log(`  Avg surprise: ${predictionsVsResults.summary.average_surprise_bits} bits`);
      console.log(`  Avg RPS: ${predictionsVsResults.summary.average_rps}`);
      console.log(`  Correct predictions: ${predictionsVsResults.summary.correct_predictions}/${predictionsVsResults.summary.matches_played} (${predictionsVsResults.summary.correct_pct}%)`);
    } else {
      console.log('ℹ No completed matches for predictions analysis');
    }
    
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
      predictions_vs_results: predictionsVsResults,
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
