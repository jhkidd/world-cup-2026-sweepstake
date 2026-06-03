// Monte Carlo simulation for World Cup stage-by-stage probabilities
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

// Normalize team names to match odds data
function normalizeTeamName(name) {
  const normalized = name.trim();
  // Handle special cases
  if (normalized === 'Türkiye' || normalized === 'Turkey') return 'Turkey';
  if (normalized === 'Curaçao' || normalized === 'Curacao') return 'Curacao';
  if (normalized === 'Czech Republic' || normalized === 'Czechia') return 'Czechia';
  if (normalized === 'Bosnia & Herzegovina' || normalized === 'Bosnia and Herzegovina' || normalized === 'Bosnia') return 'Bosnia and Herzegovina';
  return normalized;
}

// ============================================================================
// ELO RATING FUNCTIONS
// ============================================================================

/**
 * Calculate win probability from Elo ratings (binary outcome for knockouts).
 * Uses the standard Elo formula: P(A) = 1 / (1 + 10^((eloB - eloA) / 400))
 * 
 * @param {number} eloA - Elo rating of team A
 * @param {number} eloB - Elo rating of team B
 * @returns {number} - Probability that team A wins (0-1)
 */
export function eloWinProbability(eloA, eloB) {
  return 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
}

/**
 * Calculate match probabilities with draw allocation (for group stage fallback).
 * Scales win/loss probabilities to allocate space for draws.
 * 
 * @param {number} eloA - Elo rating of home team
 * @param {number} eloB - Elo rating of away team  
 * @param {number} drawProb - Fixed draw probability (default 0.26 for World Cup)
 * @returns {Object} - { homeWin, draw, awayWin } probabilities
 */
export function eloMatchProbabilities(eloA, eloB, drawProb = 0.26) {
  const rawWin = eloWinProbability(eloA, eloB);
  const scale = 1 - drawProb;
  return {
    homeWin: rawWin * scale,
    draw: drawProb,
    awayWin: (1 - rawWin) * scale
  };
}

// ============================================================================
// POISSON SCORELINE SIMULATION
// ============================================================================

/**
 * Sample from Poisson distribution.
 * @param {number} lambda - Expected value (mean)
 * @returns {number} - Random sample from Poisson(lambda)
 */
function poissonSample(lambda) {
  if (lambda <= 0) return 0;
  const L = Math.exp(-lambda);
  let k = 0, p = 1;
  do {
    k++;
    p *= Math.random();
  } while (p > L);
  return k - 1;
}

/**
 * Simulate scoreline based on Elo ratings.
 * Expected goals are adjusted based on Elo difference - larger gaps produce
 * larger expected margins.
 * 
 * @param {number} eloA - Elo rating of team A
 * @param {number} eloB - Elo rating of team B
 * @returns {Object} - { goalsA, goalsB }
 */
export function simulateScoreline(eloA, eloB) {
  const eloDiff = eloA - eloB;
  const baseGoals = 1.15;  // Historical World Cup group stage average per team
  const advantage = eloDiff / 800;  // +400 Elo ≈ +0.5 expected goals
  
  return {
    goalsA: poissonSample(Math.max(0.2, baseGoals + advantage)),
    goalsB: poissonSample(Math.max(0.2, baseGoals - advantage))
  };
}

// ============================================================================
// LEGACY STRENGTH-BASED FUNCTIONS (kept for calibration compatibility)
// ============================================================================

/**
 * Derive calibrated team strengths from bookmaker outright probabilities.
 * 
 * Problem: Raw outright probabilities can't be used directly as Bradley-Terry
 * strengths because outright odds already factor in the full tournament path.
 * Using them directly causes "double compounding" - favorites become even more
 * dominant in the simulation than bookmakers predict.
 * 
 * Solution: Apply a damping factor to reduce the spread between strong and weak
 * teams. This is equivalent to taking a root of the probability, which "flattens"
 * the distribution while preserving relative ordering.
 * 
 * @param {Object} outrightProbs - Map of team name to bookmaker win probability
 * @param {number} dampingFactor - Power to raise probabilities to (0.5-0.7 typical)
 * @returns {Object} - Map of team name to calibrated strength rating
 */
export function deriveTeamStrengths(outrightProbs, dampingFactor = 0.55) {
  const strengths = {};
  const minStrength = 0.001; // Floor to avoid numerical issues with longshots
  
  for (const [team, prob] of Object.entries(outrightProbs)) {
    // Apply damping: strength = prob^dampingFactor
    // This reduces the gap between favorites and underdogs
    // Example with damping=0.55: 
    //   Spain (17%) -> 0.17^0.55 = 0.36
    //   Bolivia (0.1%) -> 0.001^0.55 = 0.02
    //   Ratio: 18:1 instead of 170:1
    const dampedStrength = Math.pow(Math.max(prob, minStrength), dampingFactor);
    strengths[team] = dampedStrength;
  }
  
  return strengths;
}

/**
 * Run a quick Monte Carlo to estimate win probabilities with given strengths.
 * Used for calibration - runs fewer iterations for speed.
 */
function quickSimulateWinProbs(tournament, matchOdds, teamStrengths, iterations = 2000) {
  const winCounts = {};
  
  for (const team of tournament.teams) {
    winCounts[normalizeTeamName(team.name)] = 0;
  }
  
  for (let i = 0; i < iterations; i++) {
    const result = simulateTournament(tournament, matchOdds, teamStrengths);
    if (result.winner) {
      const normalized = normalizeTeamName(result.winner);
      if (winCounts[normalized] !== undefined) {
        winCounts[normalized]++;
      }
    }
  }
  
  const winProbs = {};
  for (const [team, count] of Object.entries(winCounts)) {
    winProbs[team] = count / iterations;
  }
  
  return winProbs;
}

/**
 * Calculate mean squared error between simulated and target probabilities.
 * Weights favorites more heavily since they're the visible concern.
 */
function calculateCalibrationError(simulated, target) {
  let totalError = 0;
  let count = 0;
  
  for (const [team, targetProb] of Object.entries(target)) {
    const simProb = simulated[team] || 0;
    // Weight by target probability - we care more about favorites being accurate
    const weight = Math.sqrt(targetProb);
    const error = (simProb - targetProb) * weight;
    totalError += error * error;
    count++;
  }
  
  return count > 0 ? Math.sqrt(totalError / count) : 0;
}

/**
 * Find optimal damping factor via binary search.
 * Runs quick simulations at different damping values to find the one that
 * produces win probabilities closest to bookmaker odds.
 * 
 * @param {Object} tournament - Tournament structure
 * @param {Array} matchOdds - Match odds data
 * @param {Object} outrightProbs - Target bookmaker probabilities
 * @param {Object} options - Calibration options
 * @returns {Object} - { dampingFactor, strengths, error, iterations }
 */
export function calibrateDampingFactor(tournament, matchOdds, outrightProbs, options = {}) {
  const {
    minDamping = 0.2,
    maxDamping = 0.7,
    tolerance = 0.003,
    maxIterations = 12,
    simIterations = 2000
  } = options;
  
  console.log('   Calibrating damping factor...');
  
  let low = minDamping;
  let high = maxDamping;
  let bestDamping = (low + high) / 2;
  let bestError = Infinity;
  let bestStrengths = null;
  let iteration = 0;
  
  // Binary search for optimal damping
  while (iteration < maxIterations && (high - low) > tolerance) {
    const mid = (low + high) / 2;
    const strengths = deriveTeamStrengths(outrightProbs, mid);
    const simulated = quickSimulateWinProbs(tournament, matchOdds, strengths, simIterations);
    const error = calculateCalibrationError(simulated, outrightProbs);
    
    // Check if top team is over or under-estimated
    const topTeam = Object.entries(outrightProbs)
      .sort((a, b) => b[1] - a[1])[0][0];
    const topSimulated = simulated[topTeam] || 0;
    const topTarget = outrightProbs[topTeam];
    
    if (error < bestError) {
      bestError = error;
      bestDamping = mid;
      bestStrengths = strengths;
    }
    
    // Higher damping = prob^higher_power = MORE spread between favorites and underdogs
    // Lower damping = MORE flattening = favorites less dominant
    // So: if favorites are over-estimated, DECREASE damping (search lower half)
    //     if favorites are under-estimated, INCREASE damping (search upper half)
    if (topSimulated > topTarget) {
      high = mid;  // Favorites too high, need lower damping to flatten
    } else {
      low = mid;   // Favorites too low, need higher damping to sharpen
    }
    
    iteration++;
    process.stdout.write(`\r   Calibration iteration ${iteration}: damping=${mid.toFixed(3)}, error=${error.toFixed(4)}, top team sim=${(topSimulated*100).toFixed(1)}% vs target=${(topTarget*100).toFixed(1)}%`);
  }
  
  console.log(`\n   ✓ Calibration complete: damping=${bestDamping.toFixed(3)}, error=${bestError.toFixed(4)}`);
  
  return {
    dampingFactor: bestDamping,
    strengths: bestStrengths,
    error: bestError,
    iterations: iteration
  };
}

// Simulate a single match given win probabilities
function simulateMatch(team1WinProb, drawProb) {
  const rand = Math.random();
  if (rand < team1WinProb) return 'team1';
  if (rand < team1WinProb + drawProb) return 'draw';
  return 'team2';
}

// Bradley-Terry model: estimate h2h probability from team strengths
function estimateMatchProb(strength1, strength2) {
  const team1Win = strength1 / (strength1 + strength2);
  // For knockout: no draws, just win probabilities
  return { team1Win, team2Win: 1 - team1Win };
}

// Simulate group stage
export function simulateGroupStage(tournament, matchOdds, teamStrengths, eloRatings = null) {
  const groups = {};
  
  // Initialize groups
  for (const group of Object.keys(tournament.groups)) {
    groups[group] = tournament.groups[group].teams.map(team => ({
      name: team,
      points: 0,
      goalsFor: 0,
      goalsAgainst: 0,
      played: 0
    }));
  }
  
  // Simulate all group stage matches
  for (const match of tournament.matches.group_stage) {
    const homeTeam = match.home;
    const awayTeam = match.away;
    const group = match.group;
    const normalizedHome = normalizeTeamName(homeTeam);
    const normalizedAway = normalizeTeamName(awayTeam);
    
    // Find odds for this match
    const oddsMatch = matchOdds.find(m => {
      const mHome = normalizeTeamName(m.home_team);
      const mAway = normalizeTeamName(m.away_team);
      return (mHome === normalizedHome && mAway === normalizedAway) ||
             (mAway === normalizedHome && mHome === normalizedAway);
    });
    
    let homeGoals, awayGoals;
    
    // Check if this match has an actual result (completed match)
    if (oddsMatch && oddsMatch.actual_result && oddsMatch.actual_result.completed) {
      // Use actual result - no simulation needed
      const matchHomeTeam = normalizeTeamName(oddsMatch.home_team);
      if (matchHomeTeam === normalizedHome) {
        homeGoals = oddsMatch.actual_result.home_score;
        awayGoals = oddsMatch.actual_result.away_score;
      } else {
        homeGoals = oddsMatch.actual_result.away_score;
        awayGoals = oddsMatch.actual_result.home_score;
      }
    } else if (oddsMatch && oddsMatch.bookmakers && oddsMatch.bookmakers.length > 0) {
      // Use H2H bookmaker odds to determine result
      const market = oddsMatch.bookmakers[0].markets.find(m => m.key === 'h2h');
      if (market) {
        const outcomes = market.outcomes;
        const matchHomeTeam = normalizeTeamName(oddsMatch.home_team);
        const homeOutcome = outcomes.find(o => normalizeTeamName(o.name) === matchHomeTeam);
        const awayOutcome = outcomes.find(o => normalizeTeamName(o.name) !== matchHomeTeam && o.name !== 'Draw');
        const drawOutcome = outcomes.find(o => o.name === 'Draw');
        
        let homeProb = homeOutcome ? 1 / homeOutcome.price : 0.33;
        let awayProb = awayOutcome ? 1 / awayOutcome.price : 0.33;
        let drawProb = drawOutcome ? 1 / drawOutcome.price : 0.33;
        
        // Normalize
        const total = homeProb + awayProb + drawProb;
        homeProb /= total;
        awayProb /= total;
        drawProb /= total;
        
        // Swap if our home team is the odds away team
        if (matchHomeTeam !== normalizedHome) {
          [homeProb, awayProb] = [awayProb, homeProb];
        }
        
        // Determine outcome
        const rand = Math.random();
        
        // Generate scoreline using Elo-based Poisson if available
        if (eloRatings) {
          const eloHome = eloRatings[normalizedHome] || eloRatings[homeTeam] || 1500;
          const eloAway = eloRatings[normalizedAway] || eloRatings[awayTeam] || 1500;
          const score = simulateScoreline(eloHome, eloAway);
          
          // Use Poisson scoreline but constrain to match bookmaker outcome
          if (rand < homeProb) {
            // Home win - ensure home > away
            homeGoals = Math.max(score.goalsA, score.goalsB + 1);
            awayGoals = Math.min(score.goalsB, score.goalsA - 1);
          } else if (rand < homeProb + drawProb) {
            // Draw
            const avgGoals = Math.round((score.goalsA + score.goalsB) / 2);
            homeGoals = avgGoals;
            awayGoals = avgGoals;
          } else {
            // Away win
            homeGoals = Math.min(score.goalsA, score.goalsB - 1);
            awayGoals = Math.max(score.goalsB, score.goalsA + 1);
          }
        } else {
          // No Elo - use fixed scorelines
          if (rand < homeProb) {
            homeGoals = 2; awayGoals = 0;
          } else if (rand < homeProb + drawProb) {
            homeGoals = 1; awayGoals = 1;
          } else {
            homeGoals = 0; awayGoals = 2;
          }
        }
      } else {
        // No H2H market - fall back to Elo
        if (eloRatings) {
          const eloHome = eloRatings[normalizedHome] || eloRatings[homeTeam] || 1500;
          const eloAway = eloRatings[normalizedAway] || eloRatings[awayTeam] || 1500;
          const score = simulateScoreline(eloHome, eloAway);
          homeGoals = score.goalsA;
          awayGoals = score.goalsB;
        } else {
          // Fallback to strengths
          const homeStrength = teamStrengths[homeTeam] || 0.02;
          const awayStrength = teamStrengths[awayTeam] || 0.02;
          const probs = estimateMatchProb(homeStrength, awayStrength);
          const result = simulateMatch(probs.team1Win * 0.7, 0.25);
          homeGoals = result === 'team1' ? 2 : (result === 'draw' ? 1 : 0);
          awayGoals = result === 'team2' ? 2 : (result === 'draw' ? 1 : 0);
        }
      }
    } else {
      // No odds data - use Elo-based Poisson simulation
      if (eloRatings) {
        const eloHome = eloRatings[normalizedHome] || eloRatings[homeTeam] || 1500;
        const eloAway = eloRatings[normalizedAway] || eloRatings[awayTeam] || 1500;
        const score = simulateScoreline(eloHome, eloAway);
        homeGoals = score.goalsA;
        awayGoals = score.goalsB;
      } else {
        // Ultimate fallback - use team strengths
        const homeStrength = teamStrengths[homeTeam] || 0.02;
        const awayStrength = teamStrengths[awayTeam] || 0.02;
        const probs = estimateMatchProb(homeStrength, awayStrength);
        const result = simulateMatch(probs.team1Win * 0.7, 0.25);
        homeGoals = result === 'team1' ? 2 : (result === 'draw' ? 1 : 0);
        awayGoals = result === 'team2' ? 2 : (result === 'draw' ? 1 : 0);
      }
    }
    
    // Update standings
    const homeIdx = groups[group].findIndex(t => t.name === homeTeam);
    const awayIdx = groups[group].findIndex(t => t.name === awayTeam);
    
    if (homeIdx >= 0 && awayIdx >= 0) {
      groups[group][homeIdx].played++;
      groups[group][awayIdx].played++;
      
      groups[group][homeIdx].goalsFor += homeGoals;
      groups[group][homeIdx].goalsAgainst += awayGoals;
      groups[group][awayIdx].goalsFor += awayGoals;
      groups[group][awayIdx].goalsAgainst += homeGoals;
      
      if (homeGoals > awayGoals) {
        groups[group][homeIdx].points += 3;
      } else if (awayGoals > homeGoals) {
        groups[group][awayIdx].points += 3;
      } else {
        groups[group][homeIdx].points += 1;
        groups[group][awayIdx].points += 1;
      }
    }
  }
  
  // Sort groups
  for (const group of Object.keys(groups)) {
    groups[group].sort((a, b) => {
      if (b.points !== a.points) return b.points - a.points;
      const aGD = a.goalsFor - a.goalsAgainst;
      const bGD = b.goalsFor - b.goalsAgainst;
      if (bGD !== aGD) return bGD - aGD;
      if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
      return Math.random() - 0.5; // Random tiebreaker
    });
  }
  
  return groups;
}

// Get best 3rd place teams
export function getBestThirdPlaceTeams(groups) {
  const thirdPlaceTeams = [];
  
  for (const group of Object.keys(groups)) {
    if (groups[group].length >= 3) {
      thirdPlaceTeams.push({
        ...groups[group][2],
        group
      });
    }
  }
  
  // Sort by points, GD, GF
  thirdPlaceTeams.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points;
    const aGD = a.goalsFor - a.goalsAgainst;
    const bGD = b.goalsFor - b.goalsAgainst;
    if (bGD !== aGD) return bGD - aGD;
    if (b.goalsFor !== a.goalsFor) return b.goalsFor - a.goalsFor;
    return Math.random() - 0.5;
  });
  
  return thirdPlaceTeams.slice(0, 8);
}

// Simulate knockout match with H2H odds → Elo fallback cascade
export function simulateKnockoutMatch(team1, team2, matchOdds, eloRatings, teamStrengths) {
  const normalized1 = normalizeTeamName(team1);
  const normalized2 = normalizeTeamName(team2);
  
  // 1. Check if this matchup has actual result or H2H odds
  if (matchOdds) {
    const oddsMatch = matchOdds.find(m => {
      const home = normalizeTeamName(m.home_team);
      const away = normalizeTeamName(m.away_team);
      return (home === normalized1 && away === normalized2) ||
             (home === normalized2 && away === normalized1);
    });
    
    if (oddsMatch?.actual_result?.completed) {
      // Match already played - return actual winner
      const homeWon = oddsMatch.actual_result.home_score > oddsMatch.actual_result.away_score;
      const homeTeam = normalizeTeamName(oddsMatch.home_team);
      if (homeWon) {
        return homeTeam === normalized1 ? team1 : team2;
      } else {
        return homeTeam === normalized1 ? team2 : team1;
      }
    }
    
    if (oddsMatch?.bookmakers?.length > 0) {
      // Use H2H bookmaker odds
      const market = oddsMatch.bookmakers[0].markets.find(m => m.key === 'h2h');
      if (market) {
        const homeTeam = normalizeTeamName(oddsMatch.home_team);
        const homeOutcome = market.outcomes.find(o => normalizeTeamName(o.name) === homeTeam);
        const awayOutcome = market.outcomes.find(o => normalizeTeamName(o.name) !== homeTeam && o.name !== 'Draw');
        
        if (homeOutcome && awayOutcome) {
          const homeProb = 1 / homeOutcome.price;
          const awayProb = 1 / awayOutcome.price;
          const total = homeProb + awayProb; // Normalize (no draw in knockouts)
          const team1IsHome = homeTeam === normalized1;
          const team1WinProb = team1IsHome ? (homeProb / total) : (awayProb / total);
          return Math.random() < team1WinProb ? team1 : team2;
        }
      }
    }
  }
  
  // 2. Fall back to Elo ratings
  if (eloRatings) {
    const elo1 = eloRatings[normalized1] || eloRatings[team1] || 1500;
    const elo2 = eloRatings[normalized2] || eloRatings[team2] || 1500;
    const prob1 = eloWinProbability(elo1, elo2);
    return Math.random() < prob1 ? team1 : team2;
  }
  
  // 3. Legacy fallback to damped strengths (backward compatibility)
  const strength1 = teamStrengths?.[normalized1] || teamStrengths?.[team1] || 0.02;
  const strength2 = teamStrengths?.[normalized2] || teamStrengths?.[team2] || 0.02;
  const probs = estimateMatchProb(strength1, strength2);
  return Math.random() < probs.team1Win ? team1 : team2;
}

/**
 * Assign 3rd-place teams to R32 slots based on which groups they qualified from.
 * Uses a simplified assignment: for each slot, pick the best available 3rd-place team
 * from the eligible groups.
 */
function assignThirdPlaceTeams(best3rd, thirdPlaceSlots) {
  // Use backtracking to ensure all 8 slots can be filled
  const slotList = Object.entries(thirdPlaceSlots)
    .map(([matchId, config]) => ({ matchId, eligibleGroups: config.eligible_groups }));
  
  const qualifiedGroups = best3rd.map(t => t.group);
  
  function backtrack(slotIdx, assignments, usedGroups) {
    if (slotIdx === slotList.length) {
      return { ...assignments }; // Success - all slots filled
    }
    
    const { matchId, eligibleGroups } = slotList[slotIdx];
    
    // Find eligible groups for this slot that are qualified and not yet used
    const available = eligibleGroups.filter(g => qualifiedGroups.includes(g) && !usedGroups.has(g));
    
    for (const group of available) {
      const team = best3rd.find(t => t.group === group);
      assignments[matchId] = team.name;
      usedGroups.add(group);
      
      const result = backtrack(slotIdx + 1, assignments, usedGroups);
      if (result) return result;
      
      // Backtrack
      delete assignments[matchId];
      usedGroups.delete(group);
    }
    
    return null; // No valid assignment found
  }
  
  const result = backtrack(0, {}, new Set());
  
  if (!result) {
    // Fallback: use greedy (shouldn't happen with valid FIFA rules, but safer)
    console.warn('Warning: backtracking failed for 3rd-place assignment, using greedy fallback');
    const assignments = {};
    const availableTeams = [...best3rd];
    
    const sortedSlots = slotList.sort((a, b) => a.eligibleGroups.length - b.eligibleGroups.length);
    
    for (const { matchId, eligibleGroups } of sortedSlots) {
      const eligibleTeam = availableTeams.find(t => eligibleGroups.includes(t.group));
      if (eligibleTeam) {
        assignments[matchId] = eligibleTeam.name;
        availableTeams.splice(availableTeams.indexOf(eligibleTeam), 1);
      }
    }
    return assignments;
  }
  
  return result;
}

/**
 * Parse slot description to get team from group results.
 * E.g., "Winner Group A" → look up 1st place in group A
 */
function resolveSlot(slotDesc, groups, thirdPlaceAssignments) {
  if (slotDesc.startsWith('Winner Group ')) {
    const groupLetter = slotDesc.replace('Winner Group ', '');
    return groups[groupLetter]?.[0]?.name;
  }
  if (slotDesc.startsWith('Runner-up Group ')) {
    const groupLetter = slotDesc.replace('Runner-up Group ', '');
    return groups[groupLetter]?.[1]?.name;
  }
  if (slotDesc.startsWith('Best 3rd from Groups ')) {
    // This is handled by thirdPlaceAssignments lookup via match ID
    return null; // Resolved separately
  }
  return null;
}

// Simulate entire tournament with proper FIFA bracket structure
export function simulateTournament(tournament, matchOdds, teamStrengths, eloRatings = null) {
  const results = {
    groupStage: {},
    qualified: [],
    r32: [],
    r16: [],
    quarters: [],
    semis: [],
    final: [],
    winner: null
  };
  
  // 1. Simulate group stage
  const groups = simulateGroupStage(tournament, matchOdds, teamStrengths, eloRatings);
  results.groupStage = groups;
  
  // 2. Get qualifiers (top 2 from each group + 8 best 3rd)
  const groupWinners = {};
  const groupRunners = {};
  
  for (const group of Object.keys(groups)) {
    groupWinners[group] = groups[group][0].name;
    groupRunners[group] = groups[group][1].name;
  }
  
  const best3rd = getBestThirdPlaceTeams(groups);
  const qualifiedTeams = [];
  
  for (const group of Object.keys(groups)) {
    qualifiedTeams.push(groups[group][0].name);
    qualifiedTeams.push(groups[group][1].name);
  }
  best3rd.forEach(t => qualifiedTeams.push(t.name));
  results.qualified = qualifiedTeams;
  
  // 3. Assign 3rd-place teams to R32 slots
  const thirdPlaceSlots = {
    'R32-2': { eligible_groups: ['A','B','C','D','F'] },      // M74
    'R32-5': { eligible_groups: ['C','D','F','G','H'] },      // M77
    'R32-7': { eligible_groups: ['C','E','F','H','I'] },      // M79
    'R32-8': { eligible_groups: ['E','H','I','J','K'] },      // M80
    'R32-9': { eligible_groups: ['B','E','F','I','J'] },      // M81
    'R32-10': { eligible_groups: ['A','E','H','I','J'] },     // M82
    'R32-13': { eligible_groups: ['E','F','G','I','J'] },     // M85
    'R32-15': { eligible_groups: ['D','E','I','J','L'] }      // M87
  };
  
  const thirdPlaceAssignments = assignThirdPlaceTeams(best3rd, thirdPlaceSlots);
  
  // 4. Build R32 bracket based on FIFA structure
  // R32 matchups (from tournament.json)
  const r32Bracket = [
    { id: 'R32-1',  slot1: 'Runner-up Group A', slot2: 'Runner-up Group B' },
    { id: 'R32-2',  slot1: 'Winner Group E', slot2: '3rd' },  // 3rd from A/B/C/D/F
    { id: 'R32-3',  slot1: 'Winner Group F', slot2: 'Runner-up Group C' },
    { id: 'R32-4',  slot1: 'Winner Group C', slot2: 'Runner-up Group F' },
    { id: 'R32-5',  slot1: 'Winner Group I', slot2: '3rd' },  // 3rd from C/D/F/G/H
    { id: 'R32-6',  slot1: 'Runner-up Group E', slot2: 'Runner-up Group I' },
    { id: 'R32-7',  slot1: 'Winner Group A', slot2: '3rd' },  // 3rd from C/E/F/H/I
    { id: 'R32-8',  slot1: 'Winner Group L', slot2: '3rd' },  // 3rd from E/H/I/J/K
    { id: 'R32-9',  slot1: 'Winner Group D', slot2: '3rd' },  // 3rd from B/E/F/I/J
    { id: 'R32-10', slot1: 'Winner Group G', slot2: '3rd' },  // 3rd from A/E/H/I/J
    { id: 'R32-11', slot1: 'Runner-up Group K', slot2: 'Runner-up Group L' },
    { id: 'R32-12', slot1: 'Winner Group H', slot2: 'Runner-up Group J' },
    { id: 'R32-13', slot1: 'Winner Group B', slot2: '3rd' },  // 3rd from E/F/G/I/J
    { id: 'R32-14', slot1: 'Winner Group J', slot2: 'Runner-up Group H' },
    { id: 'R32-15', slot1: 'Winner Group K', slot2: '3rd' },  // 3rd from D/E/I/J/L
    { id: 'R32-16', slot1: 'Runner-up Group D', slot2: 'Runner-up Group G' }
  ];
  
  const r32Winners = {};
  const r32Matchups = [];
  
  for (const match of r32Bracket) {
    let team1, team2;
    
    // Resolve slot 1
    if (match.slot1.startsWith('Winner Group ')) {
      team1 = groupWinners[match.slot1.replace('Winner Group ', '')];
    } else if (match.slot1.startsWith('Runner-up Group ')) {
      team1 = groupRunners[match.slot1.replace('Runner-up Group ', '')];
    }
    
    // Resolve slot 2
    if (match.slot2 === '3rd') {
      team2 = thirdPlaceAssignments[match.id];
    } else if (match.slot2.startsWith('Winner Group ')) {
      team2 = groupWinners[match.slot2.replace('Winner Group ', '')];
    } else if (match.slot2.startsWith('Runner-up Group ')) {
      team2 = groupRunners[match.slot2.replace('Runner-up Group ', '')];
    }
    
    if (team1 && team2) {
      const winner = simulateKnockoutMatch(team1, team2, matchOdds, eloRatings, teamStrengths);
      r32Winners[match.id] = winner;
      results.r32.push(winner);
      r32Matchups.push({ id: match.id, team1, team2, winner });
    }
  }
  
  // 5. Round of 16 (based on R32 winners)
  const r16Bracket = [
    { id: 'R16-1', slot1: 'R32-2', slot2: 'R32-5' },
    { id: 'R16-2', slot1: 'R32-1', slot2: 'R32-3' },
    { id: 'R16-3', slot1: 'R32-4', slot2: 'R32-7' },
    { id: 'R16-4', slot1: 'R32-6', slot2: 'R32-8' },
    { id: 'R16-5', slot1: 'R32-9', slot2: 'R32-10' },
    { id: 'R16-6', slot1: 'R32-11', slot2: 'R32-13' },
    { id: 'R16-7', slot1: 'R32-12', slot2: 'R32-14' },
    { id: 'R16-8', slot1: 'R32-15', slot2: 'R32-16' }
  ];
  
  const r16Winners = {};
  
  for (const match of r16Bracket) {
    const team1 = r32Winners[match.slot1];
    const team2 = r32Winners[match.slot2];
    if (team1 && team2) {
      const winner = simulateKnockoutMatch(team1, team2, matchOdds, eloRatings, teamStrengths);
      r16Winners[match.id] = winner;
      results.r16.push(winner);
    }
  }
  
  // 6. Quarter-finals
  const qfBracket = [
    { id: 'QF-1', slot1: 'R16-1', slot2: 'R16-2' },
    { id: 'QF-2', slot1: 'R16-3', slot2: 'R16-4' },
    { id: 'QF-3', slot1: 'R16-5', slot2: 'R16-6' },
    { id: 'QF-4', slot1: 'R16-7', slot2: 'R16-8' }
  ];
  
  const qfWinners = {};
  
  for (const match of qfBracket) {
    const team1 = r16Winners[match.slot1];
    const team2 = r16Winners[match.slot2];
    if (team1 && team2) {
      const winner = simulateKnockoutMatch(team1, team2, matchOdds, eloRatings, teamStrengths);
      qfWinners[match.id] = winner;
      results.quarters.push(winner);
    }
  }
  
  // 7. Semi-finals
  const sfBracket = [
    { id: 'SF-1', slot1: 'QF-1', slot2: 'QF-2' },
    { id: 'SF-2', slot1: 'QF-3', slot2: 'QF-4' }
  ];
  
  const sfWinners = {};
  
  for (const match of sfBracket) {
    const team1 = qfWinners[match.slot1];
    const team2 = qfWinners[match.slot2];
    if (team1 && team2) {
      const winner = simulateKnockoutMatch(team1, team2, matchOdds, eloRatings, teamStrengths);
      sfWinners[match.id] = winner;
      results.semis.push(winner);
    }
  }
  
  // 8. Final
  const finalist1 = sfWinners['SF-1'];
  const finalist2 = sfWinners['SF-2'];
  if (finalist1 && finalist2) {
    results.final = [finalist1, finalist2];
    results.winner = simulateKnockoutMatch(finalist1, finalist2, matchOdds, eloRatings, teamStrengths);
  }
  
  // Store full bracket path for probabilistic bracket feature
  results.bracketPath = {
    r32Matchups,
    r16Winners: { ...r16Winners },
    qfWinners: { ...qfWinners },
    sfWinners: { ...sfWinners }
  };
  
  return results;
}

// Run Monte Carlo simulation
export function runMonteCarloSimulation(tournament, matchOdds, teamStrengths, iterations = 10000, eloRatings = null) {
  console.log(`\nRunning Monte Carlo simulation (${iterations} iterations)...`);
  
  const teamStats = {};
  
  // Initialize stats for all teams
  for (const team of tournament.teams) {
    teamStats[normalizeTeamName(team.name)] = {
      group_first: 0,
      group_second: 0,
      group_third: 0,
      make_r16: 0,
      make_quarters: 0,
      make_semis: 0,
      make_final: 0,
      win_tournament: 0
    };
  }
  
  // Run simulations
  for (let i = 0; i < iterations; i++) {
    if (i % 1000 === 0 && i > 0) {
      process.stdout.write(`\r   Progress: ${i}/${iterations} simulations`);
    }
    
    const result = simulateTournament(tournament, matchOdds, teamStrengths, eloRatings);
    
    // Track group positions
    for (const group of Object.keys(result.groupStage)) {
      const teams = result.groupStage[group];
      if (teams[0]) teamStats[normalizeTeamName(teams[0].name)].group_first++;
      if (teams[1]) teamStats[normalizeTeamName(teams[1].name)].group_second++;
      if (teams[2]) teamStats[normalizeTeamName(teams[2].name)].group_third++;
    }
    
    // Track knockout progression
    // The arrays contain WINNERS of each round, who advance to play in the NEXT round
    // result.r32 = 16 R32 winners → they MADE it to R16
    // result.r16 = 8 R16 winners → they MADE it to QF
    // result.quarters = 4 QF winners → they MADE it to SF
    // result.semis = 2 SF winners → they MADE it to Final
    
    if (result.r32) {
      result.r32.forEach(team => {
        const normalized = normalizeTeamName(team);
        if (teamStats[normalized]) teamStats[normalized].make_r16++;
      });
    }
    
    result.r16.forEach(team => {
      const normalized = normalizeTeamName(team);
      if (teamStats[normalized]) teamStats[normalized].make_quarters++;
    });
    
    result.quarters.forEach(team => {
      const normalized = normalizeTeamName(team);
      if (teamStats[normalized]) teamStats[normalized].make_semis++;
    });
    
    result.semis.forEach(team => {
      const normalized = normalizeTeamName(team);
      if (teamStats[normalized]) teamStats[normalized].make_final++;
    });
    
    if (result.winner) {
      const normalized = normalizeTeamName(result.winner);
      if (teamStats[normalized]) {
        teamStats[normalized].win_tournament++;
      }
    }
  }
  
  console.log(`\r   Progress: ${iterations}/${iterations} simulations - Complete!`);
  
  // Convert counts to probabilities
  for (const team of Object.keys(teamStats)) {
    for (const stat of Object.keys(teamStats[team])) {
      teamStats[team][stat] = teamStats[team][stat] / iterations;
    }
  }
  
  return teamStats;
}

/**
 * Run Monte Carlo simulation and return both aggregated stats AND full bracket paths.
 * Bracket paths are stored in compact indexed format for client-side filtering.
 * 
 * @returns {{ teamStats: Object, bracketData: Object }}
 *   - teamStats: same as runMonteCarloSimulation output
 *   - bracketData: { teamIndex, bracketTopology, runs }
 *     - teamIndex: { teamName: index } mapping
 *     - bracketTopology: fixed bracket structure (which matches feed into which)
 *     - runs: array of compact run arrays [r32 participants..., r32 winners..., r16 winners..., qf..., sf..., final]
 */
export function runMonteCarloWithPaths(tournament, matchOdds, teamStrengths, iterations = 10000, eloRatings = null) {
  console.log(`\nRunning Monte Carlo with path recording (${iterations} iterations)...`);
  
  // Build team index for compact encoding
  const teamIndex = {};
  tournament.teams.forEach((team, idx) => {
    teamIndex[normalizeTeamName(team.name)] = idx;
  });
  
  const teamStats = {};
  for (const team of tournament.teams) {
    teamStats[normalizeTeamName(team.name)] = {
      group_first: 0,
      group_second: 0,
      group_third: 0,
      make_r16: 0,
      make_quarters: 0,
      make_semis: 0,
      make_final: 0,
      win_tournament: 0
    };
  }
  
  // Fixed bracket topology for client reference
  const bracketTopology = {
    r32: [
      { id: 'R32-1' }, { id: 'R32-2' }, { id: 'R32-3' }, { id: 'R32-4' },
      { id: 'R32-5' }, { id: 'R32-6' }, { id: 'R32-7' }, { id: 'R32-8' },
      { id: 'R32-9' }, { id: 'R32-10' }, { id: 'R32-11' }, { id: 'R32-12' },
      { id: 'R32-13' }, { id: 'R32-14' }, { id: 'R32-15' }, { id: 'R32-16' }
    ],
    r16: [
      { id: 'R16-1', feeds: ['R32-2', 'R32-5'] },
      { id: 'R16-2', feeds: ['R32-1', 'R32-3'] },
      { id: 'R16-3', feeds: ['R32-4', 'R32-7'] },
      { id: 'R16-4', feeds: ['R32-6', 'R32-8'] },
      { id: 'R16-5', feeds: ['R32-9', 'R32-10'] },
      { id: 'R16-6', feeds: ['R32-11', 'R32-13'] },
      { id: 'R16-7', feeds: ['R32-12', 'R32-14'] },
      { id: 'R16-8', feeds: ['R32-15', 'R32-16'] }
    ],
    qf: [
      { id: 'QF-1', feeds: ['R16-1', 'R16-2'] },
      { id: 'QF-2', feeds: ['R16-3', 'R16-4'] },
      { id: 'QF-3', feeds: ['R16-5', 'R16-6'] },
      { id: 'QF-4', feeds: ['R16-7', 'R16-8'] }
    ],
    sf: [
      { id: 'SF-1', feeds: ['QF-1', 'QF-2'] },
      { id: 'SF-2', feeds: ['QF-3', 'QF-4'] }
    ],
    final: [
      { id: 'F', feeds: ['SF-1', 'SF-2'] }
    ]
  };
  
  // Collect all runs as compact arrays
  // Format per run: 63 integers
  //   [0-31]:  R32 participants (16 matches × 2 teams)
  //   [32-47]: R32 winners (16 matches)
  //   [48-55]: R16 winners (8 matches)
  //   [56-59]: QF winners (4 matches)
  //   [60-61]: SF winners (2 matches)
  //   [62]:    Final winner
  const runs = [];
  
  // R32 match order for consistent indexing
  const r32Order = ['R32-1','R32-2','R32-3','R32-4','R32-5','R32-6','R32-7','R32-8',
                    'R32-9','R32-10','R32-11','R32-12','R32-13','R32-14','R32-15','R32-16'];
  const r16Order = ['R16-1','R16-2','R16-3','R16-4','R16-5','R16-6','R16-7','R16-8'];
  const qfOrder = ['QF-1','QF-2','QF-3','QF-4'];
  const sfOrder = ['SF-1','SF-2'];
  
  for (let i = 0; i < iterations; i++) {
    if (i % 1000 === 0 && i > 0) {
      process.stdout.write(`\r   Progress: ${i}/${iterations} simulations`);
    }
    
    const result = simulateTournament(tournament, matchOdds, teamStrengths, eloRatings);
    
    // Aggregate stats (same as runMonteCarloSimulation)
    for (const group of Object.keys(result.groupStage)) {
      const teams = result.groupStage[group];
      if (teams[0]) teamStats[normalizeTeamName(teams[0].name)].group_first++;
      if (teams[1]) teamStats[normalizeTeamName(teams[1].name)].group_second++;
      if (teams[2]) teamStats[normalizeTeamName(teams[2].name)].group_third++;
    }
    
    if (result.r32) {
      result.r32.forEach(team => {
        const normalized = normalizeTeamName(team);
        if (teamStats[normalized]) teamStats[normalized].make_r16++;
      });
    }
    result.r16.forEach(team => {
      const normalized = normalizeTeamName(team);
      if (teamStats[normalized]) teamStats[normalized].make_quarters++;
    });
    result.quarters.forEach(team => {
      const normalized = normalizeTeamName(team);
      if (teamStats[normalized]) teamStats[normalized].make_semis++;
    });
    result.semis.forEach(team => {
      const normalized = normalizeTeamName(team);
      if (teamStats[normalized]) teamStats[normalized].make_final++;
    });
    if (result.winner) {
      const normalized = normalizeTeamName(result.winner);
      if (teamStats[normalized]) teamStats[normalized].win_tournament++;
    }
    
    // Record bracket path as compact array
    const path = [];
    const bp = result.bracketPath;
    
    // R32 participants (32 values: 16 pairs)
    for (const matchId of r32Order) {
      const matchup = bp.r32Matchups.find(m => m.id === matchId);
      if (matchup) {
        path.push(teamIndex[normalizeTeamName(matchup.team1)] ?? -1);
        path.push(teamIndex[normalizeTeamName(matchup.team2)] ?? -1);
      } else {
        path.push(-1, -1);
      }
    }
    
    // R32 winners (16 values)
    for (const matchId of r32Order) {
      const matchup = bp.r32Matchups.find(m => m.id === matchId);
      path.push(matchup ? (teamIndex[normalizeTeamName(matchup.winner)] ?? -1) : -1);
    }
    
    // R16 winners (8 values)
    for (const matchId of r16Order) {
      const winner = bp.r16Winners[matchId];
      path.push(winner ? (teamIndex[normalizeTeamName(winner)] ?? -1) : -1);
    }
    
    // QF winners (4 values)
    for (const matchId of qfOrder) {
      const winner = bp.qfWinners[matchId];
      path.push(winner ? (teamIndex[normalizeTeamName(winner)] ?? -1) : -1);
    }
    
    // SF winners (2 values)
    for (const matchId of sfOrder) {
      const winner = bp.sfWinners[matchId];
      path.push(winner ? (teamIndex[normalizeTeamName(winner)] ?? -1) : -1);
    }
    
    // Final winner (1 value)
    path.push(result.winner ? (teamIndex[normalizeTeamName(result.winner)] ?? -1) : -1);
    
    runs.push(path);
  }
  
  console.log(`\r   Progress: ${iterations}/${iterations} simulations - Complete!`);
  
  // Convert counts to probabilities
  for (const team of Object.keys(teamStats)) {
    for (const stat of Object.keys(teamStats[team])) {
      teamStats[team][stat] = teamStats[team][stat] / iterations;
    }
  }
  
  // Invert team index for client-side lookup (index → name)
  const indexToTeam = Object.entries(teamIndex).reduce((acc, [name, idx]) => {
    acc[idx] = name;
    return acc;
  }, {});
  
  return {
    teamStats,
    bracketData: {
      teamIndex,
      indexToTeam,
      bracketTopology,
      runs
    }
  };
}