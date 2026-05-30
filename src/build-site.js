import { existsSync, mkdirSync, cpSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const projectRoot = join(__dirname, '..');
const distDir = join(projectRoot, 'dist');

console.log('🔨 Building static site...\n');

// Clean and create dist directory
if (existsSync(distDir)) {
  rmSync(distDir, { recursive: true });
}
mkdirSync(distDir);
mkdirSync(join(distDir, 'data'));
mkdirSync(join(distDir, 'profiles'));
mkdirSync(join(distDir, 'css'));
mkdirSync(join(distDir, 'js'));

// Copy latest.json
console.log('Copying data files...');
cpSync(
  join(projectRoot, 'data', 'processed', 'latest.json'),
  join(distDir, 'data', 'latest.json')
);
console.log('✓ Copied latest.json');

// Copy profile pictures
console.log('\nCopying profile pictures...');
const profilesDir = join(projectRoot, 'data', 'profiles');
const profiles = readdirSync(profilesDir).filter(f => f.endsWith('.jpg'));
for (const profile of profiles) {
  cpSync(join(profilesDir, profile), join(distDir, 'profiles', profile));
}
console.log(`✓ Copied ${profiles.length} profile pictures`);

// Copy logo
console.log('\nCopying logo...');
cpSync(join(projectRoot, 'INRIX_Logo.webp'), join(distDir, 'INRIX_Logo.webp'));
console.log('✓ Copied logo');

// Generate CSS
console.log('\nGenerating CSS...');
const css = `/* INRIX World Cup Sweepstake Styles */
* {
  margin: 0;
  padding: 0;
  box-sizing: border-box;
}

body {
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
  background: #f5f5f5;
  min-height: 100vh;
}

/* Header */
.header {
  background: #002D72;
  color: white;
  padding: 16px 24px;
}

.header h1 {
  font-size: 18px;
  font-weight: 600;
  display: flex;
  align-items: center;
  gap: 10px;
}

.header-logo {
  height: 48px;
  width: auto;
}

/* Navigation */
.nav {
  background: white;
  padding: 0 24px;
  border-bottom: 1px solid #e0e0e0;
}

.nav-tabs {
  display: flex;
  gap: 32px;
  list-style: none;
}

.nav-tabs a {
  display: block;
  padding: 14px 0;
  text-decoration: none;
  color: #666;
  font-size: 14px;
  border-bottom: 2px solid transparent;
  margin-bottom: -1px;
}

.nav-tabs a:hover {
  color: #002D72;
}

.nav-tabs a.active {
  color: #002D72;
  font-weight: 600;
  border-bottom-color: #002D72;
}

/* Secondary nav for matchdays */
.nav-secondary {
  background: #f8f9fa;
  padding: 0 24px;
  border-bottom: 1px solid #e0e0e0;
  display: none;
}

.nav-secondary.visible {
  display: block;
}

.nav-secondary .nav-tabs {
  gap: 24px;
}

.nav-secondary .nav-tabs a {
  padding: 10px 0;
  font-size: 13px;
}

/* Main content */
.main {
  padding: 24px;
  max-width: 1400px;
  margin: 0 auto;
}

.card {
  background: white;
  border-radius: 4px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  padding: 20px;
  margin-bottom: 20px;
}

.card-title {
  font-size: 24px;
  font-weight: 400;
  color: #2C3E50;
  margin-bottom: 8px;
}

.card-subtitle {
  font-size: 12px;
  color: #999;
  margin-bottom: 20px;
}

/* Tables */
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

th {
  background: #f5f5f5;
  text-align: left;
  padding: 8px;
  font-weight: 700;
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.3px;
  color: #5A6C7D;
}

th.center {
  text-align: center;
}

/* Grouped header row */
.header-group {
  background: #f5f5f5;
  border-bottom: 1px solid #e0e0e0;
}

.header-group th {
  padding: 10px 8px 4px;
  font-size: 11px;
  font-weight: 600;
  color: #5A6C7D;
  border-bottom: none;
}

.header-cols th {
  padding: 4px 8px 10px;
  border-bottom: 2px solid #e0e0e0;
}

td {
  padding: 10px 8px;
  border-bottom: 1px solid #f0f0f0;
}

tr:nth-child(odd) td {
  background: #fafafa;
}

/* Section separator row */
tr.section-break td {
  border-bottom: 3px solid #e0e0e0;
}

.team-name {
  font-weight: 600;
  font-size: 14px;
  color: #2C3E50;
  max-width: 180px;
}

.team-name .team-flag {
  font-size: 18px;
  margin-right: 6px;
}

/* Probability cells */
.prob-cell {
  text-align: center;
  font-weight: 600;
  padding: 10px 6px;
}

/* Knockout stage columns - equal width */
.ko-col {
  width: 90px;
  min-width: 90px;
}

/* Win Cup column - subtle distinction */
.win-cup {
  border-left: 2px solid #ccc;
}

/* Win Cup cells in body */
tbody td:last-child {
  border-left: 2px solid #ccc;
}

/* Profile pictures */
.profile-pic {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  object-fit: cover;
  margin-left: 8px;
  vertical-align: middle;
  border: 1px solid #e0e0e0;
}

.initials-circle {
  display: inline-block;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  line-height: 24px;
  text-align: center;
  font-size: 10px;
  font-weight: 600;
  color: white;
  margin-left: 8px;
  vertical-align: middle;
}

/* Matches - Two column layout with groups */
.matches-container {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 40px;
}

.group-section {
  margin-bottom: 24px;
}

.group-title {
  font-size: 14px;
  font-weight: 700;
  color: #2C3E50;
  margin-bottom: 12px;
  padding-bottom: 8px;
  border-bottom: 1px solid #e0e0e0;
}

.match-row {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
  font-size: 13px;
}

.match-home {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  width: 200px;
  text-align: right;
}

.match-home .owner {
  font-size: 11px;
  color: #999;
  margin-right: 8px;
}

.match-home .team-name {
  font-weight: 600;
  margin-right: 6px;
}

.match-home .team-name.favorite {
  font-weight: 800;
}

.match-home .team-flag {
  font-size: 20px;
}

.match-bar {
  flex: 1;
  margin: 0 12px;
}

.split-bar {
  height: 28px;
  display: flex;
  border-radius: 3px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 600;
}

.split-bar .home {
  background: #002D72;
  color: white;
  display: flex;
  align-items: center;
  justify-content: flex-start;
  padding-left: 6px;
}

.split-bar .draw {
  background: #e4e4e6;
  color: #666;
  display: flex;
  align-items: center;
  justify-content: center;
}

.split-bar .away {
  background: #E3A344;
  color: white;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  padding-right: 6px;
}

/* Completed match result bar */
.result-bar {
  width: 100%;
  height: 100%;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.result-bar.home-win {
  background: #002D72;
}

.result-bar.away-win {
  background: #E3A344;
}

.result-bar.draw-result {
  background: #e4e4e6;
}

.result-text {
  color: white;
  font-size: 13px;
  font-weight: 500;
}

.result-bar.draw-result .result-text {
  color: #555;
}

/* Next match highlight - pulsing glow */
.match-row.next-match {
  animation: pulseGlow 2s ease-in-out infinite;
  border-radius: 4px;
}

@keyframes pulseGlow {
  0%, 100% {
    background: rgba(0, 45, 114, 0.03);
    box-shadow: 0 0 0 0 rgba(0, 45, 114, 0);
  }
  50% {
    background: rgba(0, 45, 114, 0.08);
    box-shadow: 0 0 8px 2px rgba(0, 45, 114, 0.15);
  }
}

.match-away {
  display: flex;
  align-items: center;
  width: 200px;
}

.match-away .team-name {
  font-weight: 600;
  margin-left: 6px;
}

.match-away .team-name.favorite {
  font-weight: 800;
}

.match-away .team-flag {
  font-size: 20px;
}

.match-away .owner {
  font-size: 11px;
  color: #999;
  margin-left: 8px;
}

.match-date {
  font-size: 11px;
  color: #999;
  margin-left: auto;
  white-space: nowrap;
}

/* Legend */
.legend {
  display: flex;
  gap: 20px;
  margin-bottom: 16px;
  font-size: 11px;
  color: #666;
}

.legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.legend-box {
  width: 16px;
  height: 12px;
  border-radius: 2px;
}

.legend-box.home { background: #002D72; }
.legend-box.draw { background: #e4e4e6; }
.legend-box.away { background: #E3A344; }

.legend-note {
  margin-left: auto;
  font-style: italic;
}

/* Timeline chart container */
#timeline-chart {
  width: 100%;
  height: 400px;
}

/* Loading state */
.loading {
  text-align: center;
  padding: 60px;
  color: #999;
}

/* Top teams highlight - team, pts, group, and group stage finish columns */
.top-team td:nth-child(1),
.top-team td:nth-child(2),
.top-team td:nth-child(3),
.top-team td:nth-child(4),
.top-team td:nth-child(5) {
  background: #fffbe6 !important;
}

/* Row hover highlight - team, pts, group, and group stage finish columns */
tbody tr:hover td:nth-child(1),
tbody tr:hover td:nth-child(2),
tbody tr:hover td:nth-child(3),
tbody tr:hover td:nth-child(4),
tbody tr:hover td:nth-child(5) {
  background-color: rgba(0, 45, 114, 0.08) !important;
}

/* Owner name - hidden by default, fades in on hover */
.owner-name {
  opacity: 0;
  transition: opacity 250ms ease-out;
  margin-left: 8px;
  color: #7F8C8D;
  font-weight: 400;
}

tbody tr:hover .owner-name {
  opacity: 1;
}

/* Emoji font support */
.team-flag {
  font-family: "Noto Color Emoji", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}
`;

writeFileSync(join(distDir, 'css', 'styles.css'), css);
console.log('✓ Generated styles.css');

// Generate JavaScript
console.log('\nGenerating JavaScript...');
const js = `// INRIX World Cup Sweepstake - Single Page App

let data = null;

// Flag emojis
const flagEmojis = {
  'Argentina': '🇦🇷', 'Australia': '🇦🇺', 'Austria': '🇦🇹', 'Algeria': '🇩🇿',
  'Belgium': '🇧🇪', 'Brazil': '🇧🇷', 'Bosnia and Herzegovina': '🇧🇦',
  'Canada': '🇨🇦', 'Colombia': '🇨🇴', 'Croatia': '🇭🇷', 'Czechia': '🇨🇿', 'Curaçao': '🇨🇼',
  'DR Congo': '🇨🇩', 'Denmark': '🇩🇰',
  'England': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'Ecuador': '🇪🇨', 'Egypt': '🇪🇬',
  'France': '🇫🇷',
  'Germany': '🇩🇪', 'Ghana': '🇬🇭',
  'Haiti': '🇭🇹',
  'Iran': '🇮🇷', 'Iraq': '🇮🇶', 'Ivory Coast': '🇨🇮', 'Italy': '🇮🇹',
  'Japan': '🇯🇵', 'Jordan': '🇯🇴',
  'Kosovo': '🇽🇰',
  'Mexico': '🇲🇽', 'Morocco': '🇲🇦',
  'Netherlands': '🇳🇱', 'New Zealand': '🇳🇿', 'Norway': '🇳🇴',
  'Panama': '🇵🇦', 'Paraguay': '🇵🇾', 'Portugal': '🇵🇹', 'Poland': '🇵🇱',
  'Qatar': '🇶🇦',
  'Saudi Arabia': '🇸🇦', 'Scotland': '🏴󠁧󠁢󠁳󠁣󠁴󠁿', 'Senegal': '🇸🇳', 'South Africa': '🇿🇦', 'South Korea': '🇰🇷',
  'Spain': '🇪🇸', 'Sweden': '🇸🇪', 'Switzerland': '🇨🇭',
  'Tunisia': '🇹🇳', 'Turkey': '🇹🇷', 'Türkiye': '🇹🇷',
  'Uruguay': '🇺🇾', 'USA': '🇺🇸', 'Uzbekistan': '🇺🇿',
  'Cape Verde': '🇨🇻'
};

// Profile picture colors for initials fallback
const profileColors = ['#3498DB', '#E74C3C', '#9B59B6', '#F39C12', '#1ABC9C', 
                       '#E67E22', '#2ECC71', '#34495E', '#16A085', '#C0392B',
                       '#8E44AD', '#27AE60'];

function getColorForName(name) {
  const index = name.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % profileColors.length;
  return profileColors[index];
}

function getInitials(name) {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function getFirstName(name) {
  if (!name) return '';
  return name.split(' ')[0];
}

function renderProfilePic(name) {
  if (!name) return '';
  const filename = name.toLowerCase() + '.jpg';
  const initials = getInitials(name);
  const color = getColorForName(name);
  return \`<img src="profiles/\${filename}" class="profile-pic" alt="\${name}" 
           onerror="this.outerHTML='<span class=\\\\'initials-circle\\\\' style=\\\\'background:\${color}\\\\'>\${initials}</span>'">\`;
}

// Heat map color interpolation
function hexToRgb(hex) {
  const result = /^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16)
  } : null;
}

function interpolateColor(color1, color2, factor) {
  const c1 = hexToRgb(color1);
  const c2 = hexToRgb(color2);
  const r = Math.round(c1.r + factor * (c2.r - c1.r));
  const g = Math.round(c1.g + factor * (c2.g - c1.g));
  const b = Math.round(c1.b + factor * (c2.b - c1.b));
  return \`rgb(\${r},\${g},\${b})\`;
}

function getColorForProbability(prob) {
  const stops = [
    { prob: 1.00, color: '#6DACA8' },
    { prob: 0.90, color: '#78B4A9' },
    { prob: 0.80, color: '#86BDAA' },
    { prob: 0.70, color: '#94C4AB' },
    { prob: 0.60, color: '#A1CBAC' },
    { prob: 0.50, color: '#B1D5AE' },
    { prob: 0.40, color: '#B9DBB1' },
    { prob: 0.30, color: '#CAE4B5' },
    { prob: 0.20, color: '#DCEEC1' },
    { prob: 0.10, color: '#ECF6D0' },
    { prob: 0.02, color: '#FAFDF0' },
    { prob: 0.00, color: '#FFFFFE' }
  ];
  
  for (let i = 0; i < stops.length - 1; i++) {
    if (prob >= stops[i + 1].prob) {
      const lower = stops[i + 1];
      const upper = stops[i];
      const range = upper.prob - lower.prob;
      const factor = (prob - lower.prob) / range;
      return interpolateColor(lower.color, upper.color, factor);
    }
  }
  return stops[stops.length - 1].color;
}

function getTextColorForBackground(bgColor) {
  const rgb = hexToRgb(bgColor) || { r: 255, g: 255, b: 255 };
  const brightness = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
  return brightness > 180 ? '#333' : 'white';
}

// View renderers
function renderStandings() {
  const ownerLookup = {};
  data.leaderboard.forEach(p => {
    ownerLookup[p.team1.name] = p.name;
    ownerLookup[p.team2.name] = p.name;
  });

  // Calculate group stage points from completed matches
  const teamPoints = {};
  const teamGames = {};
  
  ['matchday1', 'matchday2', 'matchday3'].forEach(md => {
    const matches = data.matchdays[md] || [];
    matches.forEach(match => {
      if (match.actual_result) {
        const homeTeam = match.home_team;
        const awayTeam = match.away_team;
        const homeScore = match.actual_result.home_score;
        const awayScore = match.actual_result.away_score;
        
        // Initialize if needed
        if (!teamPoints[homeTeam]) { teamPoints[homeTeam] = 0; teamGames[homeTeam] = 0; }
        if (!teamPoints[awayTeam]) { teamPoints[awayTeam] = 0; teamGames[awayTeam] = 0; }
        
        // Count game
        teamGames[homeTeam]++;
        teamGames[awayTeam]++;
        
        // Award points
        if (homeScore > awayScore) {
          teamPoints[homeTeam] += 3;
        } else if (awayScore > homeScore) {
          teamPoints[awayTeam] += 3;
        } else {
          teamPoints[homeTeam] += 1;
          teamPoints[awayTeam] += 1;
        }
      }
    });
  });

  const teams = data.teams.map(team => ({
    ...team,
    probs: data.stage_probabilities[team.name] || {},
    owner: ownerLookup[team.name],
    points: teamPoints[team.name] || 0,
    gamesPlayed: teamGames[team.name] || 0
  })).sort((a, b) => (b.probs.win_tournament || 0) - (a.probs.win_tournament || 0));

  const rows = teams.map((team, i) => {
    const probs = team.probs;
    const flag = flagEmojis[team.name] || '🏴';
    const profilePic = renderProfilePic(team.owner);
    const topClass = i < 3 ? 'top-team' : '';
    const sectionBreak = (i === 7 || i === 15) ? 'section-break' : '';

    const renderCell = (prob, noBackground = false) => {
      const pct = ((prob || 0) * 100).toFixed(0);
      if (noBackground) {
        return \`<td class="prob-cell">\${pct}%</td>\`;
      }
      const bgColor = getColorForProbability(prob || 0);
      const textColor = getTextColorForBackground(bgColor);
      return \`<td class="prob-cell" style="background:\${bgColor};color:\${textColor}">\${pct}%</td>\`;
    };

    const maxPts = team.gamesPlayed * 3;
    const ptsDisplay = \`\${team.points} / \${maxPts}\`;

    return \`<tr class="\${topClass} \${sectionBreak}">
      <td class="team-name"><span class="team-flag">\${flag}</span> \${team.name}\${profilePic}\${team.owner ? \`<span class="owner-name">\${team.owner}</span>\` : ''}</td>
      <td class="pts-cell" style="text-align:center;color:#7F8C8D;font-size:12px">\${ptsDisplay}</td>
      <td style="text-align:center;color:#7F8C8D">\${team.group}</td>
      \${renderCell(probs.group_first, true)}
      \${renderCell(probs.group_second, true)}
      \${renderCell(probs.make_r16)}
      \${renderCell(probs.make_quarters)}
      \${renderCell(probs.make_semis)}
      \${renderCell(probs.make_final)}
      \${renderCell(probs.win_tournament)}
    </tr>\`;
  }).join('');

  const date = new Date(data.timestamp);
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return \`
    <div class="card">
      <div class="card-title">World Cup 2026 - Stage-by-Stage Probabilities</div>
      <div class="card-subtitle">Based on 10,000 Monte Carlo simulations • Updated \${dateStr}</div>
      <table>
        <thead>
          <tr class="header-group">
            <th rowspan="2">Team</th>
            <th rowspan="2" class="center">Pts</th>
            <th rowspan="2" class="center">Group</th>
            <th colspan="2" class="center">Group Stage Finish</th>
            <th colspan="5" class="center">Knockout Stage Chances</th>
          </tr>
          <tr class="header-cols">
            <th class="center">1st Place</th>
            <th class="center">2nd Place</th>
            <th class="center ko-col">Make R16</th>
            <th class="center ko-col">Make Quarters</th>
            <th class="center ko-col">Make Semis</th>
            <th class="center ko-col">Make Final</th>
            <th class="center ko-col win-cup">Win Cup</th>
          </tr>
        </thead>
        <tbody>\${rows}</tbody>
      </table>
    </div>
  \`;
}

function renderMatches(matchday) {
  const matches = data.matchdays[\`matchday\${matchday}\`] || [];
  
  // Find the "next match day" - today if there are matches, otherwise the next day with matches
  // Use US Eastern timezone to match FIFA's venue-local dates
  const todayUS = new Date().toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  
  // Get all unique match dates (in US timezone) and sort them
  const matchDates = [...new Set(matches.map(m => {
    const d = new Date(m.commence_time);
    return d.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
  }))].sort((a, b) => new Date(a) - new Date(b));
  
  // Find the first date that is today or in the future
  let nextMatchDate = matchDates.find(dateStr => new Date(dateStr) >= new Date(todayUS));
  // If all matches are in the past (or we're before the tournament), use the first date
  if (!nextMatchDate) nextMatchDate = matchDates[0];
  
  // Group matches by group letter
  const groups = {};
  matches.forEach(match => {
    if (!groups[match.group]) groups[match.group] = [];
    groups[match.group].push(match);
  });
  
  // Sort groups alphabetically
  const sortedGroups = Object.keys(groups).sort();
  
  // Split into left (A, C, E, G, I, K) and right (B, D, F, H, J, L) columns
  const leftGroups = sortedGroups.filter((_, i) => i % 2 === 0);
  const rightGroups = sortedGroups.filter((_, i) => i % 2 === 1);
  
  const renderMatch = (match) => {
    const homeFlag = flagEmojis[match.home_team] || '🏴';
    const awayFlag = flagEmojis[match.away_team] || '🏴';
    
    const matchDate = new Date(match.commence_time);
    // Use US Eastern timezone to match FIFA's venue-local dates
    const dateStr = matchDate.toLocaleDateString('en-GB', { 
      day: 'numeric', 
      month: 'short',
      timeZone: 'America/New_York'
    });
    // For next match comparison, also use US Eastern
    const matchDateUS = matchDate.toLocaleDateString('en-US', { timeZone: 'America/New_York' });
    const isNextMatch = matchDateUS === nextMatchDate;

    // Handle completed match
    if (match.actual_result) {
      const homeScore = match.actual_result.home_score;
      const awayScore = match.actual_result.away_score;
      let barClass, resultText;
      
      if (homeScore > awayScore) {
        barClass = 'home-win';
        resultText = \`\${match.home_team} won \${homeScore}-\${awayScore}\`;
      } else if (awayScore > homeScore) {
        barClass = 'away-win';
        resultText = \`\${match.away_team} won \${awayScore}-\${homeScore}\`;
      } else {
        barClass = 'draw-result';
        resultText = \`tie \${homeScore}-\${awayScore}\`;
      }

      return \`
        <div class="match-row completed\${isNextMatch ? ' next-match' : ''}">
          <div class="match-home">
            <span class="owner">\${getFirstName(match.home_owner)}</span>
            <span class="team-name">\${match.home_team}</span>
            <span class="team-flag">\${homeFlag}</span>
          </div>
          <div class="match-bar">
            <div class="result-bar \${barClass}">
              <span class="result-text">\${resultText}</span>
            </div>
          </div>
          <div class="match-away">
            <span class="team-flag">\${awayFlag}</span>
            <span class="team-name">\${match.away_team}</span>
            <span class="owner">\${getFirstName(match.away_owner)}</span>
          </div>
          <span class="match-date">\${dateStr}</span>
        </div>
      \`;
    }

    // Upcoming match with probabilities
    const homeWin = ((match.home_win_prob || 0) * 100).toFixed(0);
    const draw = ((match.draw_prob || 0) * 100).toFixed(0);
    const awayWin = ((match.away_win_prob || 0) * 100).toFixed(0);
    const homeFav = match.home_win_prob > match.away_win_prob;
    const awayFav = match.away_win_prob > match.home_win_prob;

    return \`
      <div class="match-row\${isNextMatch ? ' next-match' : ''}">
        <div class="match-home">
          <span class="owner">\${getFirstName(match.home_owner)}</span>
          <span class="team-name \${homeFav ? 'favorite' : ''}">\${match.home_team}</span>
          <span class="team-flag">\${homeFlag}</span>
        </div>
        <div class="match-bar">
          <div class="split-bar">
            <div class="home" style="width:\${homeWin}%">\${homeWin > 12 ? homeWin + '%' : ''}</div>
            <div class="draw" style="width:\${draw}%">\${draw > 12 ? draw + '%' : ''}</div>
            <div class="away" style="width:\${awayWin}%">\${awayWin > 12 ? awayWin + '%' : ''}</div>
          </div>
        </div>
        <div class="match-away">
          <span class="team-flag">\${awayFlag}</span>
          <span class="team-name \${awayFav ? 'favorite' : ''}">\${match.away_team}</span>
          <span class="owner">\${getFirstName(match.away_owner)}</span>
        </div>
        <span class="match-date">\${dateStr}</span>
      </div>
    \`;
  };
  
  const renderColumn = (groupList) => {
    return groupList.map(groupLetter => {
      const groupMatches = groups[groupLetter] || [];
      return \`
        <div class="group-section">
          <div class="group-title">GROUP \${groupLetter}</div>
          \${groupMatches.map(renderMatch).join('')}
        </div>
      \`;
    }).join('');
  };

  const date = new Date(data.timestamp);
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return \`
    <div class="card">
      <div class="card-title">Upcoming Matches - Matchday \${matchday}</div>
      <div class="card-subtitle">Updated \${dateStr} • Match odds from bookmakers</div>
      <div class="legend">
        <div class="legend-item"><div class="legend-box home"></div> Left team win</div>
        <div class="legend-item"><div class="legend-box draw"></div> Draw</div>
        <div class="legend-item"><div class="legend-box away"></div> Right team win</div>
        <div class="legend-note">Bold name = favourite</div>
      </div>
      <div class="matches-container">
        <div class="matches-column">\${renderColumn(leftGroups)}</div>
        <div class="matches-column">\${renderColumn(rightGroups)}</div>
      </div>
    </div>
  \`;
}

function renderTimeline() {
  // Get top 8 participants
  const top8 = data.leaderboard.slice(0, 8);
  
  // 17 distinct colors for all participants (no reuse)
  const allColors = [
    '#002D72', // Navy blue
    '#E3A344', // Gold
    '#2ECC71', // Emerald green
    '#E74C3C', // Red
    '#9B59B6', // Purple
    '#1ABC9C', // Teal
    '#E67E22', // Orange
    '#3498DB', // Sky blue
    '#C0392B', // Dark red
    '#27AE60', // Forest green
    '#8E44AD', // Dark purple
    '#16A085', // Dark teal
    '#D35400', // Burnt orange
    '#2980B9', // Dark blue
    '#F1C40F', // Yellow
    '#7F8C8D', // Grey
    '#1F618D'  // Steel blue
  ];

  const datasets = top8.map((p, i) => ({
    label: p.name,
    data: data.timeline.map(t => ({
      x: new Date(t.date),
      y: (t.participants[p.name] || 0) * 100
    })),
    borderColor: allColors[i],
    backgroundColor: allColors[i],
    tension: 0.3,
    pointRadius: 3,
    pointHoverRadius: 5,
    borderWidth: 2.5,
    hoverBorderWidth: 3.5
  }));

  // Store current odds for labels
  const currentOdds = {};
  top8.forEach(p => {
    currentOdds[p.name] = (p.total_probability * 100).toFixed(1);
  });

  // Render chart after DOM update
  setTimeout(() => {
    const ctx = document.getElementById('timeline-canvas');
    if (ctx && window.Chart) {
      let activeDatasetIndex = null;
      
      const chart = new Chart(ctx, {
        type: 'line',
        data: { datasets },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          interaction: {
            mode: 'nearest',
            axis: 'xy',
            intersect: false
          },
          scales: {
            x: {
              type: 'time',
              time: { unit: 'day' }
            },
            y: {
              title: { display: true, text: 'Win Probability (%)' },
              min: 0
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false }
          },
          onHover: (event, elements, chart) => {
            const newIndex = elements.length > 0 ? elements[0].datasetIndex : null;
            if (newIndex !== activeDatasetIndex) {
              activeDatasetIndex = newIndex;
              
              // Update line opacity
              chart.data.datasets.forEach((ds, i) => {
                if (activeDatasetIndex === null) {
                  ds.borderColor = allColors[i];
                  ds.backgroundColor = allColors[i];
                  ds.borderWidth = 2.5;
                } else if (i === activeDatasetIndex) {
                  ds.borderColor = allColors[i];
                  ds.backgroundColor = allColors[i];
                  ds.borderWidth = 3.5;
                } else {
                  // Desaturate - add transparency
                  ds.borderColor = allColors[i] + '30';
                  ds.backgroundColor = allColors[i] + '30';
                  ds.borderWidth = 1.5;
                }
              });
              
              chart.update('none');
              updateEndLabels(chart, activeDatasetIndex);
            }
          }
        }
      });

      // Create end labels container - covers entire chart for proper positioning
      const container = document.getElementById('timeline-chart');
      const labelsDiv = document.createElement('div');
      labelsDiv.id = 'end-labels';
      labelsDiv.style.cssText = 'position:absolute;top:0;left:0;right:0;bottom:0;pointer-events:none;overflow:visible;';
      container.appendChild(labelsDiv);

      function updateEndLabels(chart, activeIndex) {
        const labelsDiv = document.getElementById('end-labels');
        if (!labelsDiv) return;
        
        if (activeIndex === null) {
          labelsDiv.innerHTML = '';
          return;
        }

        const participant = top8[activeIndex];
        const meta = chart.getDatasetMeta(activeIndex);
        const lastPointMeta = meta.data[meta.data.length - 1];
        
        if (!lastPointMeta) return;
        
        const x = lastPointMeta.x;
        const y = lastPointMeta.y;
        const color = allColors[activeIndex];
        const odds = currentOdds[participant.name];
        const profileName = participant.name.toLowerCase();
        const initials = participant.name.split(' ').map(n=>n[0]).join('');

        labelsDiv.innerHTML = \`
          <div style="position:absolute;left:\${x + 10}px;top:\${y - 18}px;display:flex;align-items:center;gap:6px;background:white;padding:4px 8px;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,0.15);z-index:100;white-space:nowrap;">
            <img src="profiles/\${profileName}.jpg" 
                 onerror="this.style.display='none';this.nextElementSibling.style.display='flex';"
                 style="width:28px;height:28px;border-radius:50%;object-fit:cover;border:2px solid \${color};">
            <div style="display:none;width:28px;height:28px;border-radius:50%;background:\${color};color:white;align-items:center;justify-content:center;font-size:11px;font-weight:600;">\${initials}</div>
            <div style="display:flex;flex-direction:column;line-height:1.2;">
              <span style="font-size:12px;font-weight:600;color:#333;">\${participant.name}</span>
              <span style="font-size:11px;color:\${color};font-weight:700;">\${odds}%</span>
            </div>
          </div>
        \`;
      }
    }
  }, 100);

  return \`
    <div class="card">
      <div class="card-title">Probability Race</div>
      <div class="card-subtitle">Top 8 participants over time • Hover lines for details</div>
      <div id="timeline-chart" style="position:relative;">
        <canvas id="timeline-canvas"></canvas>
      </div>
    </div>
  \`;
}

// Router
function route() {
  const hash = window.location.hash || '#standings';
  const parts = hash.slice(1).split('/');
  const view = parts[0];
  const param = parts[1];
  
  console.log('Routing to:', view, param);
  
  // Update main nav active states
  document.querySelectorAll('.nav > .nav-tabs a').forEach(a => {
    const href = a.getAttribute('href');
    if (view === 'matches') {
      a.classList.toggle('active', href.startsWith('#matches'));
    } else {
      a.classList.toggle('active', href === '#' + view);
    }
  });
  
  // Update secondary nav active states
  document.querySelectorAll('.nav-secondary .nav-tabs a').forEach(a => {
    const href = a.getAttribute('href');
    const matchday = param || '1';
    a.classList.toggle('active', href === '#matches/' + matchday);
  });

  // Show/hide secondary nav
  const secondaryNav = document.querySelector('.nav-secondary');
  secondaryNav.classList.toggle('visible', view === 'matches');

  // Render view
  const main = document.querySelector('.main');
  
  switch (view) {
    case 'standings':
      main.innerHTML = renderStandings();
      break;
    case 'matches':
      main.innerHTML = renderMatches(parseInt(param) || 1);
      break;
    case 'timeline':
      main.innerHTML = renderTimeline();
      break;
    default:
      window.location.hash = '#standings';
  }
}

// Initialize
async function init() {
  try {
    const response = await fetch('data/latest.json', { cache: 'no-store' });
    data = await response.json();
    
    // Handle hash changes
    window.addEventListener('hashchange', route);
    
    // Handle clicks on nav links to ensure routing works
    document.querySelectorAll('.nav-tabs a').forEach(a => {
      a.addEventListener('click', (e) => {
        const href = a.getAttribute('href');
        if (href.startsWith('#')) {
          e.preventDefault();
          window.location.hash = href;
          route();
        }
      });
    });
    
    route();
  } catch (error) {
    document.querySelector('.main').innerHTML = \`
      <div class="card">
        <div class="card-title">Error Loading Data</div>
        <p>\${error.message}</p>
      </div>
    \`;
  }
}

init();
`;

writeFileSync(join(distDir, 'js', 'app.js'), js);
console.log('✓ Generated app.js');

// Generate HTML
console.log('\nGenerating HTML...');
const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Football World Cup 2026 - Sweepstakes</title>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Color+Emoji&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="css/styles.css">
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
  <script src="https://cdn.jsdelivr.net/npm/chartjs-adapter-date-fns@3.0.0/dist/chartjs-adapter-date-fns.bundle.min.js"></script>
</head>
<body>
  <header class="header">
    <h1><img src="INRIX_Logo.webp" alt="INRIX" class="header-logo"> Football World Cup 2026 - Sweepstakes</h1>
  </header>
  
  <nav class="nav">
    <ul class="nav-tabs">
      <li><a href="#standings">Standings</a></li>
      <li><a href="#matches/1">Matches</a></li>
      <li><a href="#timeline">Timeline</a></li>
    </ul>
  </nav>
  
  <nav class="nav-secondary">
    <ul class="nav-tabs">
      <li><a href="#matches/1">Matchday 1</a></li>
      <li><a href="#matches/2">Matchday 2</a></li>
      <li><a href="#matches/3">Matchday 3</a></li>
    </ul>
  </nav>
  
  <main class="main">
    <div class="loading">Loading...</div>
  </main>
  
  <script src="js/app.js"></script>
</body>
</html>
`;

writeFileSync(join(distDir, 'index.html'), html);
console.log('✓ Generated index.html');

console.log('\n✅ Build complete! Site generated in dist/');
