import { readFileSync, writeFileSync, readdirSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { addDays, parseISO, formatISO } from 'date-fns';
import { runMonteCarloSimulation, runMonteCarloWithPaths, deriveTeamStrengths, calibrateDampingFactor, resolveKnownR32Matchups, simulateGroupStage } from './monte-carlo.js';
import { normalizeTeamName } from './shared/team-names.js';

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
    
    // Try group stage first, then use result date for knockout matches
    let kickoffUtc = null;
    let tournamentMatch = tournament.matches.group_stage.find(m => {
      const tHome = normalizeTeamName(m.home);
      const tAway = normalizeTeamName(m.away);
      return (tHome === normalizedHome && tAway === normalizedAway) ||
             (tAway === normalizedHome && tHome === normalizedAway);
    });
    
    if (tournamentMatch) {
      kickoffUtc = tournamentMatch.kickoff_utc;
    } else if (result.date) {
      // Knockout match — use date from result (end of day as upper bound for odds lookup)
      kickoffUtc = `${result.date}T23:59:59Z`;
      tournamentMatch = { home: result.home_team, away: result.away_team, group: null };
    } else {
      continue;
    }
    
    const isKnockout = result.stage && result.stage !== 'group_stage';
    
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
    // For knockout matches, use 90-minute score (bookmaker odds predict 90-min result)
    const useScore90 = isKnockout && result.home_score_90min != null && result.away_score_90min != null;
    const resultHomeScore = useScore90 ? result.home_score_90min : result.home_score;
    const resultAwayScore = useScore90 ? result.away_score_90min : result.away_score;

    const homeScore = result.home_team === tournamentMatch.home ? resultHomeScore :
                      normalizeTeamName(result.home_team) === tournamentHomeNorm ? resultHomeScore : resultAwayScore;
    const awayScore = result.home_team === tournamentMatch.home ? resultAwayScore :
                      normalizeTeamName(result.home_team) === tournamentHomeNorm ? resultAwayScore : resultHomeScore;
    
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
      stage: isKnockout ? (result.stage || 'knockout') : 'group_stage',
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
      teamStats[match.home_team] = { matches: 0, expected_pts: 0, actual_pts: 0, total_rps: 0, total_signed_surprise: 0 };
    }
    teamStats[match.home_team].matches++;
    const homeExpPts = match.pre_match_probs.home_win * 3 + match.pre_match_probs.draw * 1;
    const homeActPts = match.actual_outcome === 'home_win' ? 3 : match.actual_outcome === 'draw' ? 1 : 0;
    teamStats[match.home_team].expected_pts += homeExpPts;
    teamStats[match.home_team].actual_pts += homeActPts;
    teamStats[match.home_team].total_rps += match.rps;
    // Signed surprise: positive when overperforming, negative when underperforming
    const homeSign = homeActPts > homeExpPts ? 1 : homeActPts < homeExpPts ? -1 : 0;
    teamStats[match.home_team].total_signed_surprise += homeSign * match.surprise_bits;
    
    // Away team
    if (!teamStats[match.away_team]) {
      teamStats[match.away_team] = { matches: 0, expected_pts: 0, actual_pts: 0, total_rps: 0, total_signed_surprise: 0 };
    }
    teamStats[match.away_team].matches++;
    const awayExpPts = match.pre_match_probs.away_win * 3 + match.pre_match_probs.draw * 1;
    const awayActPts = match.actual_outcome === 'away_win' ? 3 : match.actual_outcome === 'draw' ? 1 : 0;
    teamStats[match.away_team].expected_pts += awayExpPts;
    teamStats[match.away_team].actual_pts += awayActPts;
    teamStats[match.away_team].total_rps += match.rps;
    // Signed surprise for away team
    const awaySign = awayActPts > awayExpPts ? 1 : awayActPts < awayExpPts ? -1 : 0;
    teamStats[match.away_team].total_signed_surprise += awaySign * match.surprise_bits;
  }
  
  const teamPerformance = Object.entries(teamStats).map(([team, stats]) => ({
    team,
    matches_played: stats.matches,
    avg_rps: Math.round((stats.total_rps / stats.matches) * 1000) / 1000,
    expected_points: Math.round(stats.expected_pts * 100) / 100,
    actual_points: stats.actual_pts,
    delta: Math.round((stats.actual_pts - stats.expected_pts) * 100) / 100,
    surprise_per_match: Math.round((stats.total_signed_surprise / stats.matches) * 100) / 100,
    direction: stats.total_signed_surprise > 0 ? 'overperforming' :
               stats.total_signed_surprise < 0 ? 'underperforming' : 'as_expected'
  })).sort((a, b) => b.surprise_per_match - a.surprise_per_match);
  
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
    
    // Align scores to the odds entry's home/away orientation
    const oddsHome = normalizeTeamName(oddsMatch.home_team);
    const sameOrientation = oddsHome === normalizedHome;
    const oddsHomeScore = sameOrientation ? completed.home_score : completed.away_score;
    const oddsAwayScore = sameOrientation ? completed.away_score : completed.home_score;
    
    // Determine winner relative to odds entry's home/away
    let homeWinProb, drawProb, awayWinProb;
    
    if (oddsHomeScore > oddsAwayScore) {
      homeWinProb = 1.0;
      drawProb = 0.0;
      awayWinProb = 0.0;
    } else if (oddsHomeScore < oddsAwayScore) {
      homeWinProb = 0.0;
      drawProb = 0.0;
      awayWinProb = 1.0;
    } else {
      homeWinProb = 0.0;
      drawProb = 1.0;
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
    
    // Store actual score aligned to odds entry's home/away
    oddsMatch.actual_result = {
      home_score: oddsHomeScore,
      away_score: oddsAwayScore,
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
      home_team: normalizedHome,
      away_team: normalizedAway,
      home_owner: ownerLookup[normalizedHome] || null,
      away_owner: ownerLookup[normalizedAway] || null,
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

function getKnockoutMatches(oddsData, sweepstake, localResults = []) {
  // Build owner lookup
  const ownerLookup = {};
  for (const participant of sweepstake.participants) {
    for (const team of participant.teams) {
      ownerLookup[normalizeTeamName(team)] = participant.name;
    }
  }

  const matchOdds = oddsData.matchOdds || [];

  // Build a set of knockout results from localResults (stage != 'group_stage')
  const knockoutResults = localResults.filter(r => r.stage && r.stage !== 'group_stage');

  if (matchOdds.length === 0 && knockoutResults.length === 0) {
    return { round_of_32: [], round_of_16: [], quarter_finals: [], semi_finals: [], third_place: [], final: [] };
  }

  // Determine round based on number of matches and dates
  // Round of 32 = 16 matches, Round of 16 = 8, QF = 4, SF = 2, Final = 1
  // For now, categorize by commence_time clusters and match count
  const matches = matchOdds.map(m => {
    const normalizedHome = normalizeTeamName(m.home_team);
    const normalizedAway = normalizeTeamName(m.away_team);

    // Check local results for this match
    const localResult = knockoutResults.find(r => {
      const rHome = normalizeTeamName(r.home_team);
      const rAway = normalizeTeamName(r.away_team);
      return (rHome === normalizedHome && rAway === normalizedAway) ||
             (rAway === normalizedHome && rHome === normalizedAway);
    });

    let actualResult = null;
    let homeWinProb = null, drawProb = null, awayWinProb = null;

    if (localResult) {
      const localHome = normalizeTeamName(localResult.home_team);
      if (localHome === normalizedHome) {
        actualResult = {
          home_score: localResult.home_score, away_score: localResult.away_score, completed: true,
          home_penalties: localResult.home_penalties || null, away_penalties: localResult.away_penalties || null
        };
      } else {
        actualResult = {
          home_score: localResult.away_score, away_score: localResult.home_score, completed: true,
          home_penalties: localResult.away_penalties || null, away_penalties: localResult.home_penalties || null
        };
      }
      // Set probabilities to 100% for actual result
      if (actualResult.home_score > actualResult.away_score) {
        homeWinProb = 1.0; drawProb = 0.0; awayWinProb = 0.0;
      } else if (actualResult.away_score > actualResult.home_score) {
        homeWinProb = 0.0; drawProb = 0.0; awayWinProb = 1.0;
      } else if (actualResult.home_penalties != null && actualResult.away_penalties != null) {
        // Penalty shootout: winner is whoever won on pens
        if (actualResult.home_penalties > actualResult.away_penalties) {
          homeWinProb = 1.0; drawProb = 0.0; awayWinProb = 0.0;
        } else {
          homeWinProb = 0.0; drawProb = 0.0; awayWinProb = 1.0;
        }
      } else {
        homeWinProb = 0.0; drawProb = 1.0; awayWinProb = 0.0;
      }
    } else {
      // Extract probabilities from first bookmaker's h2h market
      if (m.bookmakers && m.bookmakers.length > 0) {
        const market = m.bookmakers[0].markets.find(mk => mk.key === 'h2h');
        if (market) {
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
    }

    return {
      home_team: normalizedHome,
      away_team: normalizedAway,
      home_owner: ownerLookup[normalizedHome] || null,
      away_owner: ownerLookup[normalizedAway] || null,
      commence_time: m.commence_time,
      home_win_prob: homeWinProb,
      draw_prob: drawProb,
      away_win_prob: awayWinProb,
      actual_result: actualResult
    };
  });

  // Add completed knockout matches that are no longer in the odds API
  for (const result of knockoutResults) {
    const rHome = normalizeTeamName(result.home_team);
    const rAway = normalizeTeamName(result.away_team);
    const alreadyIncluded = matches.some(m =>
      (m.home_team === rHome && m.away_team === rAway) ||
      (m.home_team === rAway && m.away_team === rHome)
    );
    if (!alreadyIncluded) {
      matches.push({
        home_team: rHome,
        away_team: rAway,
        home_owner: ownerLookup[rHome] || null,
        away_owner: ownerLookup[rAway] || null,
        commence_time: result.date ? new Date(result.date).toISOString() : new Date().toISOString(),
        home_win_prob: result.home_score > result.away_score ? 1.0 : 0.0,
        draw_prob: result.home_score === result.away_score ? 1.0 : 0.0,
        away_win_prob: result.away_score > result.home_score ? 1.0 : 0.0,
        actual_result: {
          home_score: result.home_score, away_score: result.away_score, completed: true,
          home_penalties: result.home_penalties || null, away_penalties: result.away_penalties || null
        }
      });
    }
  }

  // Sort by date
  matches.sort((a, b) => new Date(a.commence_time) - new Date(b.commence_time));

  // Assign rounds based on match count (16 = R32, 8 = R16, 4 = QF, 2 = SF, 1 = Final)
  // Group by date clusters to identify rounds
  const result = { round_of_32: [], round_of_16: [], quarter_finals: [], semi_finals: [], third_place: [], final: [] };
  
  if (matches.length >= 16) {
    result.round_of_32 = matches.slice(0, 16);
    if (matches.length >= 24) {
      result.round_of_16 = matches.slice(16, 24);
    }
    if (matches.length >= 28) {
      result.quarter_finals = matches.slice(24, 28);
    }
    if (matches.length >= 30) {
      result.semi_finals = matches.slice(28, 30);
    }
    if (matches.length >= 31) {
      result.third_place = matches.slice(30, 31);
    }
    if (matches.length >= 32) {
      result.final = matches.slice(31, 32);
    }
  } else {
    // Fewer than 16 — assign all to the earliest applicable round
    result.round_of_32 = matches;
  }

  return result;
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
    
    // Combine remote results (from odds API) with local results (authoritative)
    // Local results override API results when both exist for the same match
    // This must happen before getAllMatchdays so matchday 2/3 results are available
    const combinedResults = [...(oddsData.results || [])];
    for (const localResult of localResults) {
      const existingIdx = combinedResults.findIndex(r => 
        (normalizeTeamName(r.home_team) === normalizeTeamName(localResult.home_team) &&
         normalizeTeamName(r.away_team) === normalizeTeamName(localResult.away_team)) ||
        (normalizeTeamName(r.home_team) === normalizeTeamName(localResult.away_team) &&
         normalizeTeamName(r.away_team) === normalizeTeamName(localResult.home_team))
      );
      const entry = {
        id: localResult.id,
        home_team: localResult.home_team,
        away_team: localResult.away_team,
        home_score: localResult.home_score,
        away_score: localResult.away_score,
        home_penalties: localResult.home_penalties || null,
        away_penalties: localResult.away_penalties || null,
        status: 'completed',
        group: localResult.group,
        stage: localResult.stage || 'group_stage',
        date: localResult.date
      };
      if (existingIdx !== -1) {
        combinedResults[existingIdx] = entry; // Local overrides API
      } else {
        combinedResults.push(entry);
      }
    }
    console.log(`✓ Combined ${combinedResults.length} match results (${localResults.length} local + ${(oddsData.results || []).length} from API)`);

    // Upcoming matches (next matchday only - for backwards compatibility)
    console.log('\nFinding upcoming matches...');
    const upcomingMatches = getUpcomingMatches(oddsData, tournament, sweepstake, combinedResults);
    console.log(`✓ Found ${upcomingMatches.length} matches in next matchday`);
    
    // All matchdays (for web site)
    console.log('\nProcessing all group stage matchdays...');
    const allMatchdays = getAllMatchdays(oddsData, tournament, sweepstake, combinedResults);
    console.log(`✓ Matchday 1: ${allMatchdays.matchday1.length} matches`);
    console.log(`✓ Matchday 2: ${allMatchdays.matchday2.length} matches`);
    console.log(`✓ Matchday 3: ${allMatchdays.matchday3.length} matches`);

    // Knockout matches
    console.log('\nProcessing knockout match odds...');
    const knockoutMatches = getKnockoutMatches(oddsData, sweepstake, combinedResults);
    const knockoutTotal = Object.values(knockoutMatches).reduce((sum, arr) => sum + arr.length, 0);
    console.log(`✓ Found ${knockoutTotal} knockout matches (R32: ${knockoutMatches.round_of_32.length}, R16: ${knockoutMatches.round_of_16.length}, QF: ${knockoutMatches.quarter_finals.length}, SF: ${knockoutMatches.semi_finals.length}, F: ${knockoutMatches.final.length})`);
    
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
    const matchOddsWithResults = mergeCompletedResults(oddsData.matchOdds, combinedResults, tournament);
    
    // Resolve known R32 matchups from odds API knockout data + completed results
    // This avoids the ambiguous 3rd-place allocation by using FIFA's confirmed matchups
    let knownR32Matchups = null;
    if (oddsData.matchOdds && oddsData.matchOdds.length > 0) {
      // Run group stage once to get standings for resolving matchups
      const groups = simulateGroupStage(tournament, matchOddsWithResults, {});
      // Include completed knockout results alongside odds API matches
      // Completed results come FIRST so they claim their correct R32 slots
      // before predicted R16+ matches from odds API can incorrectly fill them
      const completedKnockout = combinedResults
        .filter(r => r.stage && r.stage !== 'group_stage')
        .map(r => ({ home_team: r.home_team, away_team: r.away_team }));
      const allKnockoutMatchups = [...completedKnockout, ...oddsData.matchOdds];
      knownR32Matchups = resolveKnownR32Matchups(allKnockoutMatchups, groups);
      if (knownR32Matchups) {
        console.log('   ✓ Resolved 16 confirmed R32 matchups from odds API + completed results');
      } else {
        console.log('   ⚠ Could not resolve all R32 matchups from odds API, using allocation algorithm');
      }
    }
    
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
      50000,
      Object.keys(eloRatings).length > 0 ? eloRatings : null,
      knownR32Matchups
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
      knockout_matches: knockoutMatches,
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
    
    // Add actual results to bracket data by matching knockout_matches to R32 positions
    const actualResults = {};
    if (bracketData.runs.length > 0) {
      const sampleRun = bracketData.runs[0];
      const allKnockoutRounds = [
        ...knockoutMatches.round_of_32,
        ...knockoutMatches.round_of_16,
        ...knockoutMatches.quarter_finals,
        ...knockoutMatches.semi_finals,
        ...knockoutMatches.third_place,
        ...knockoutMatches.final
      ];
      // Map R32 matches: positions 0-31 in pairs → R32-1 through R32-16
      for (let i = 0; i < 16; i++) {
        const t1Name = bracketData.indexToTeam[sampleRun[i * 2]];
        const t2Name = bracketData.indexToTeam[sampleRun[i * 2 + 1]];
        if (!t1Name || !t2Name) continue;
        const nt1 = normalizeTeamName(t1Name);
        const nt2 = normalizeTeamName(t2Name);
        const match = allKnockoutRounds.find(m => {
          const mh = normalizeTeamName(m.home_team);
          const ma = normalizeTeamName(m.away_team);
          return (mh === nt1 && ma === nt2) || (mh === nt2 && ma === nt1);
        });
        if (match?.actual_result?.completed) {
          const mh = normalizeTeamName(match.home_team);
          const homeIdx = mh === nt1 ? sampleRun[i * 2] : sampleRun[i * 2 + 1];
          const awayIdx = mh === nt1 ? sampleRun[i * 2 + 1] : sampleRun[i * 2];
          let winnerIdx;
          if (match.actual_result.home_score !== match.actual_result.away_score) {
            winnerIdx = match.actual_result.home_score > match.actual_result.away_score ? homeIdx : awayIdx;
          } else if (match.actual_result.home_penalties != null && match.actual_result.away_penalties != null) {
            winnerIdx = match.actual_result.home_penalties > match.actual_result.away_penalties ? homeIdx : awayIdx;
          } else {
            winnerIdx = awayIdx; // fallback
          }
          actualResults[`R32-${i + 1}`] = {
            winnerIdx,
            homeIdx,
            awayIdx,
            homeScore: match.actual_result.home_score,
            awayScore: match.actual_result.away_score,
            homePenalties: match.actual_result.home_penalties || null,
            awayPenalties: match.actual_result.away_penalties || null
          };
        }
      }
      // Map R16 matches: use R32 winner indices to identify R16 participants
      const r16Feeds = [
        { id: 'R16-1', feeds: ['R32-2', 'R32-5'] },
        { id: 'R16-2', feeds: ['R32-1', 'R32-3'] },
        { id: 'R16-3', feeds: ['R32-4', 'R32-6'] },
        { id: 'R16-4', feeds: ['R32-7', 'R32-8'] },
        { id: 'R16-5', feeds: ['R32-11', 'R32-12'] },
        { id: 'R16-6', feeds: ['R32-9', 'R32-10'] },
        { id: 'R16-7', feeds: ['R32-14', 'R32-16'] },
        { id: 'R16-8', feeds: ['R32-13', 'R32-15'] }
      ];
      const r32WinnerOffset = 32; // R32 winners start at index 32
      const r32IdToOffset = (id) => parseInt(id.replace('R32-', '')) - 1;

      for (let i = 0; i < r16Feeds.length; i++) {
        const { id, feeds } = r16Feeds[i];
        const team1Idx = sampleRun[r32WinnerOffset + r32IdToOffset(feeds[0])];
        const team2Idx = sampleRun[r32WinnerOffset + r32IdToOffset(feeds[1])];
        const t1Name = bracketData.indexToTeam[team1Idx];
        const t2Name = bracketData.indexToTeam[team2Idx];
        if (!t1Name || !t2Name) continue;
        const nt1 = normalizeTeamName(t1Name);
        const nt2 = normalizeTeamName(t2Name);
        const match = allKnockoutRounds.find(m => {
          const mh = normalizeTeamName(m.home_team);
          const ma = normalizeTeamName(m.away_team);
          return (mh === nt1 && ma === nt2) || (mh === nt2 && ma === nt1);
        });
        if (match?.actual_result?.completed) {
          const mh = normalizeTeamName(match.home_team);
          const homeIdx = mh === nt1 ? team1Idx : team2Idx;
          const awayIdx = mh === nt1 ? team2Idx : team1Idx;
          let winnerIdx;
          if (match.actual_result.home_score !== match.actual_result.away_score) {
            winnerIdx = match.actual_result.home_score > match.actual_result.away_score ? homeIdx : awayIdx;
          } else if (match.actual_result.home_penalties != null && match.actual_result.away_penalties != null) {
            winnerIdx = match.actual_result.home_penalties > match.actual_result.away_penalties ? homeIdx : awayIdx;
          } else {
            winnerIdx = awayIdx;
          }
          actualResults[id] = {
            winnerIdx, homeIdx, awayIdx,
            homeScore: match.actual_result.home_score,
            awayScore: match.actual_result.away_score,
            homePenalties: match.actual_result.home_penalties || null,
            awayPenalties: match.actual_result.away_penalties || null
          };
        }
      }

      // Map QF matches: use R16 winner indices
      const qfFeeds = [
        { id: 'QF-1', feeds: ['R16-1', 'R16-2'] },
        { id: 'QF-2', feeds: ['R16-3', 'R16-4'] },
        { id: 'QF-3', feeds: ['R16-5', 'R16-6'] },
        { id: 'QF-4', feeds: ['R16-7', 'R16-8'] }
      ];
      const r16WinnerOffset = 48;
      const r16IdToOffset = (id) => parseInt(id.replace('R16-', '')) - 1;

      for (const { id, feeds } of qfFeeds) {
        const team1Idx = sampleRun[r16WinnerOffset + r16IdToOffset(feeds[0])];
        const team2Idx = sampleRun[r16WinnerOffset + r16IdToOffset(feeds[1])];
        const t1Name = bracketData.indexToTeam[team1Idx];
        const t2Name = bracketData.indexToTeam[team2Idx];
        if (!t1Name || !t2Name) continue;
        const nt1 = normalizeTeamName(t1Name);
        const nt2 = normalizeTeamName(t2Name);
        const match = allKnockoutRounds.find(m => {
          const mh = normalizeTeamName(m.home_team);
          const ma = normalizeTeamName(m.away_team);
          return (mh === nt1 && ma === nt2) || (mh === nt2 && ma === nt1);
        });
        if (match?.actual_result?.completed) {
          const mh = normalizeTeamName(match.home_team);
          const homeIdx = mh === nt1 ? team1Idx : team2Idx;
          const awayIdx = mh === nt1 ? team2Idx : team1Idx;
          let winnerIdx;
          if (match.actual_result.home_score !== match.actual_result.away_score) {
            winnerIdx = match.actual_result.home_score > match.actual_result.away_score ? homeIdx : awayIdx;
          } else if (match.actual_result.home_penalties != null && match.actual_result.away_penalties != null) {
            winnerIdx = match.actual_result.home_penalties > match.actual_result.away_penalties ? homeIdx : awayIdx;
          } else {
            winnerIdx = awayIdx;
          }
          actualResults[id] = {
            winnerIdx, homeIdx, awayIdx,
            homeScore: match.actual_result.home_score,
            awayScore: match.actual_result.away_score,
            homePenalties: match.actual_result.home_penalties || null,
            awayPenalties: match.actual_result.away_penalties || null
          };
        }
      }

      // Map SF matches: use QF winner indices
      const sfFeeds = [
        { id: 'SF-1', feeds: ['QF-1', 'QF-3'] },
        { id: 'SF-2', feeds: ['QF-2', 'QF-4'] }
      ];
      const qfWinnerOffset = 56;
      const qfIdToOffset = (id) => parseInt(id.replace('QF-', '')) - 1;

      for (const { id, feeds } of sfFeeds) {
        const team1Idx = sampleRun[qfWinnerOffset + qfIdToOffset(feeds[0])];
        const team2Idx = sampleRun[qfWinnerOffset + qfIdToOffset(feeds[1])];
        const t1Name = bracketData.indexToTeam[team1Idx];
        const t2Name = bracketData.indexToTeam[team2Idx];
        if (!t1Name || !t2Name) continue;
        const nt1 = normalizeTeamName(t1Name);
        const nt2 = normalizeTeamName(t2Name);
        const match = allKnockoutRounds.find(m => {
          const mh = normalizeTeamName(m.home_team);
          const ma = normalizeTeamName(m.away_team);
          return (mh === nt1 && ma === nt2) || (mh === nt2 && ma === nt1);
        });
        if (match?.actual_result?.completed) {
          const mh = normalizeTeamName(match.home_team);
          const homeIdx = mh === nt1 ? team1Idx : team2Idx;
          const awayIdx = mh === nt1 ? team2Idx : team1Idx;
          let winnerIdx;
          if (match.actual_result.home_score !== match.actual_result.away_score) {
            winnerIdx = match.actual_result.home_score > match.actual_result.away_score ? homeIdx : awayIdx;
          } else if (match.actual_result.home_penalties != null && match.actual_result.away_penalties != null) {
            winnerIdx = match.actual_result.home_penalties > match.actual_result.away_penalties ? homeIdx : awayIdx;
          } else {
            winnerIdx = awayIdx;
          }
          actualResults[id] = {
            winnerIdx, homeIdx, awayIdx,
            homeScore: match.actual_result.home_score,
            awayScore: match.actual_result.away_score,
            homePenalties: match.actual_result.home_penalties || null,
            awayPenalties: match.actual_result.away_penalties || null
          };
        }
      }

      // Map Final: use SF winner indices
      const sfWinnerOffset = 60;
      const sfIdToOffset = (id) => parseInt(id.replace('SF-', '')) - 1;
      const finalTeam1Idx = sampleRun[sfWinnerOffset + sfIdToOffset('SF-1')];
      const finalTeam2Idx = sampleRun[sfWinnerOffset + sfIdToOffset('SF-2')];
      const ft1Name = bracketData.indexToTeam[finalTeam1Idx];
      const ft2Name = bracketData.indexToTeam[finalTeam2Idx];
      if (ft1Name && ft2Name) {
        const fnt1 = normalizeTeamName(ft1Name);
        const fnt2 = normalizeTeamName(ft2Name);
        const finalMatch = allKnockoutRounds.find(m => {
          const mh = normalizeTeamName(m.home_team);
          const ma = normalizeTeamName(m.away_team);
          return (mh === fnt1 && ma === fnt2) || (mh === fnt2 && ma === fnt1);
        });
        if (finalMatch?.actual_result?.completed) {
          const mh = normalizeTeamName(finalMatch.home_team);
          const homeIdx = mh === fnt1 ? finalTeam1Idx : finalTeam2Idx;
          const awayIdx = mh === fnt1 ? finalTeam2Idx : finalTeam1Idx;
          let winnerIdx;
          if (finalMatch.actual_result.home_score !== finalMatch.actual_result.away_score) {
            winnerIdx = finalMatch.actual_result.home_score > finalMatch.actual_result.away_score ? homeIdx : awayIdx;
          } else if (finalMatch.actual_result.home_penalties != null && finalMatch.actual_result.away_penalties != null) {
            winnerIdx = finalMatch.actual_result.home_penalties > finalMatch.actual_result.away_penalties ? homeIdx : awayIdx;
          } else {
            winnerIdx = awayIdx;
          }
          actualResults['F'] = {
            winnerIdx, homeIdx, awayIdx,
            homeScore: finalMatch.actual_result.home_score,
            awayScore: finalMatch.actual_result.away_score,
            homePenalties: finalMatch.actual_result.home_penalties || null,
            awayPenalties: finalMatch.actual_result.away_penalties || null
          };
        }
      }
    }
    bracketData.actualResults = actualResults;
    const completedCount = Object.keys(actualResults).length;
    if (completedCount > 0) {
      console.log(`✓ Mapped ${completedCount} completed knockout match(es) to bracket positions`);
    }

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
