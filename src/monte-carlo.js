// Monte Carlo simulation for World Cup stage-by-stage probabilities
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');

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
export function simulateGroupStage(tournament, matchOdds, teamStrengths) {
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
    
    // Find odds for this match
    const oddsMatch = matchOdds.find(m => 
      (m.home_team === homeTeam && m.away_team === awayTeam) ||
      (m.away_team === homeTeam && m.home_team === awayTeam)
    );
    
    let result;
    if (oddsMatch && oddsMatch.bookmakers && oddsMatch.bookmakers.length > 0) {
      // Use actual h2h odds
      const market = oddsMatch.bookmakers[0].markets.find(m => m.key === 'h2h');
      if (market) {
        const outcomes = market.outcomes;
        const homeOutcome = outcomes.find(o => o.name === homeTeam);
        const awayOutcome = outcomes.find(o => o.name === awayTeam);
        const drawOutcome = outcomes.find(o => o.name === 'Draw');
        
        const homeProb = homeOutcome ? 1 / homeOutcome.price : 0.33;
        const awayProb = awayOutcome ? 1 / awayOutcome.price : 0.33;
        const drawProb = drawOutcome ? 1 / drawOutcome.price : 0.33;
        
        // Normalize
        const total = homeProb + awayProb + drawProb;
        result = simulateMatch(homeProb / total, drawProb / total);
      } else {
        // Fallback to strengths
        const homeStrength = teamStrengths[homeTeam] || 0.02;
        const awayStrength = teamStrengths[awayTeam] || 0.02;
        const probs = estimateMatchProb(homeStrength, awayStrength);
        result = simulateMatch(probs.team1Win * 0.7, 0.25); // Add draw probability
      }
    } else {
      // Use team strengths
      const homeStrength = teamStrengths[homeTeam] || 0.02;
      const awayStrength = teamStrengths[awayTeam] || 0.02;
      const probs = estimateMatchProb(homeStrength, awayStrength);
      result = simulateMatch(probs.team1Win * 0.7, 0.25);
    }
    
    // Update standings
    const homeIdx = groups[group].findIndex(t => t.name === homeTeam);
    const awayIdx = groups[group].findIndex(t => t.name === awayTeam);
    
    groups[group][homeIdx].played++;
    groups[group][awayIdx].played++;
    
    if (result === 'team1') {
      groups[group][homeIdx].points += 3;
      groups[group][homeIdx].goalsFor += 2;
      groups[group][awayIdx].goalsAgainst += 2;
    } else if (result === 'team2') {
      groups[group][awayIdx].points += 3;
      groups[group][awayIdx].goalsFor += 2;
      groups[group][homeIdx].goalsAgainst += 2;
    } else {
      groups[group][homeIdx].points += 1;
      groups[group][awayIdx].points += 1;
      groups[group][homeIdx].goalsFor += 1;
      groups[group][homeIdx].goalsAgainst += 1;
      groups[group][awayIdx].goalsFor += 1;
      groups[group][awayIdx].goalsAgainst += 1;
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

// Simulate knockout match
export function simulateKnockoutMatch(team1, team2, teamStrengths) {
  const strength1 = teamStrengths[team1] || 0.02;
  const strength2 = teamStrengths[team2] || 0.02;
  const probs = estimateMatchProb(strength1, strength2);
  
  return Math.random() < probs.team1Win ? team1 : team2;
}

// Simulate entire tournament
export function simulateTournament(tournament, matchOdds, teamStrengths) {
  const results = {
    groupStage: {},
    qualified: [],
    r16: [],
    quarters: [],
    semis: [],
    final: [],
    winner: null
  };
  
  // 1. Simulate group stage
  const groups = simulateGroupStage(tournament, matchOdds, teamStrengths);
  results.groupStage = groups;
  
  // 2. Get qualifiers (top 2 from each group + 8 best 3rd)
  const qualifiers = [];
  for (const group of Object.keys(groups)) {
    qualifiers.push({ team: groups[group][0].name, position: 'first', group });
    qualifiers.push({ team: groups[group][1].name, position: 'second', group });
  }
  
  const best3rd = getBestThirdPlaceTeams(groups);
  best3rd.forEach(t => {
    qualifiers.push({ team: t.name, position: 'third', group: t.group });
  });
  
  results.qualified = qualifiers.map(q => q.team);
  
  // 3. Build R32 bracket (simplified - just pair qualifiers)
  // In reality, there's a complex bracket structure based on group positions
  // For simplicity, we'll pair them sequentially
  const r32Teams = qualifiers.map(q => q.team);
  const r16Teams = [];
  
  for (let i = 0; i < r32Teams.length; i += 2) {
    if (i + 1 < r32Teams.length) {
      const winner = simulateKnockoutMatch(r32Teams[i], r32Teams[i + 1], teamStrengths);
      r16Teams.push(winner);
    }
  }
  results.r16 = r16Teams;
  
  // 4. Round of 16 → Quarters
  const quarterTeams = [];
  for (let i = 0; i < r16Teams.length; i += 2) {
    if (i + 1 < r16Teams.length) {
      const winner = simulateKnockoutMatch(r16Teams[i], r16Teams[i + 1], teamStrengths);
      quarterTeams.push(winner);
    }
  }
  results.quarters = quarterTeams;
  
  // 5. Quarters → Semis
  const semiTeams = [];
  for (let i = 0; i < quarterTeams.length; i += 2) {
    if (i + 1 < quarterTeams.length) {
      const winner = simulateKnockoutMatch(quarterTeams[i], quarterTeams[i + 1], teamStrengths);
      semiTeams.push(winner);
    }
  }
  results.semis = semiTeams;
  
  // 6. Semis → Final
  const finalTeams = [];
  for (let i = 0; i < semiTeams.length; i += 2) {
    if (i + 1 < semiTeams.length) {
      const winner = simulateKnockoutMatch(semiTeams[i], semiTeams[i + 1], teamStrengths);
      finalTeams.push(winner);
    }
  }
  results.final = finalTeams;
  
  // 7. Final
  if (finalTeams.length === 2) {
    results.winner = simulateKnockoutMatch(finalTeams[0], finalTeams[1], teamStrengths);
  }
  
  return results;
}

// Run Monte Carlo simulation
export function runMonteCarloSimulation(tournament, matchOdds, teamStrengths, iterations = 10000) {
  console.log(`\nRunning Monte Carlo simulation (${iterations} iterations)...`);
  
  const teamStats = {};
  
  // Initialize stats for all teams
  for (const team of tournament.teams) {
    teamStats[team.name] = {
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
    
    const result = simulateTournament(tournament, matchOdds, teamStrengths);
    
    // Track group positions
    for (const group of Object.keys(result.groupStage)) {
      const teams = result.groupStage[group];
      if (teams[0]) teamStats[teams[0].name].group_first++;
      if (teams[1]) teamStats[teams[1].name].group_second++;
      if (teams[2]) teamStats[teams[2].name].group_third++;
    }
    
    // Track knockout progression
    result.qualified.forEach(team => {
      if (teamStats[team]) teamStats[team].make_r16++;
    });
    
    result.r16.forEach(team => {
      if (teamStats[team]) teamStats[team].make_quarters++;
    });
    
    result.quarters.forEach(team => {
      if (teamStats[team]) teamStats[team].make_semis++;
    });
    
    result.semis.forEach(team => {
      if (teamStats[team]) teamStats[team].make_final++;
    });
    
    result.final.forEach(team => {
      if (teamStats[team]) teamStats[team].make_final++;
    });
    
    if (result.winner && teamStats[result.winner]) {
      teamStats[result.winner].win_tournament++;
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
