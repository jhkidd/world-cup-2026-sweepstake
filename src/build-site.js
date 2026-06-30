import { existsSync, mkdirSync, cpSync, rmSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { FLAG_EMOJIS } from './shared/flags.js';
import { normalizeTeamName } from './shared/team-names.js';

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

// Copy bracket.json (loaded on demand by knockout page)
const bracketSrcPath = join(projectRoot, 'data', 'processed', 'bracket.json');
if (existsSync(bracketSrcPath)) {
  cpSync(bracketSrcPath, join(distDir, 'data', 'bracket.json'));
  console.log('✓ Copied bracket.json');
}

// Copy profile pictures
console.log('\nCopying profile pictures...');
const profilesDir = join(projectRoot, 'data', 'profiles');
const profiles = readdirSync(profilesDir).filter(f => f.endsWith('.jpg'));
for (const profile of profiles) {
  cpSync(join(profilesDir, profile), join(distDir, 'profiles', profile));
}
console.log(`✓ Copied ${profiles.length} profile pictures`);

// Copy player photos if they exist
console.log('\nCopying player photos...');
const playerPhotosDir = join(projectRoot, 'data', 'player_photos');
let playerPhotoMapping = {};
if (existsSync(playerPhotosDir)) {
  mkdirSync(join(distDir, 'player_photos'), { recursive: true });
  const photos = readdirSync(playerPhotosDir).filter(f => f.endsWith('.webp'));
  for (const photo of photos) {
    cpSync(join(playerPhotosDir, photo), join(distDir, 'player_photos', photo));
  }
  console.log(`✓ Copied ${photos.length} player photos`);
  
  // Load mapping
  const mappingPath = join(projectRoot, 'data', 'player_photos.json');
  if (existsSync(mappingPath)) {
    playerPhotoMapping = JSON.parse(readFileSync(mappingPath, 'utf8'));
    console.log(`✓ Loaded photo mapping for ${Object.keys(playerPhotoMapping).length} players`);
  }
} else {
  console.log('✓ No player photos yet (run npm run fetch-photos)');
}

// Load player stats
let playerStats = {};
const playerStatsPath = join(projectRoot, 'data', 'player_stats.json');
if (existsSync(playerStatsPath)) {
  playerStats = JSON.parse(readFileSync(playerStatsPath, 'utf8'));
  console.log(`✓ Loaded stats for ${Object.keys(playerStats).length} players`);
}

// Copy team badges and kits
console.log('\nCopying team badges and kits...');
let teamMetadata = {};
const badgesDir = join(projectRoot, 'data', 'team_badges');
const kitsDir = join(projectRoot, 'data', 'team_kits');
const metadataPath = join(projectRoot, 'data', 'team_metadata.json');

if (existsSync(badgesDir)) {
  mkdirSync(join(distDir, 'team_badges'), { recursive: true });
  const badges = readdirSync(badgesDir).filter(f => f.endsWith('.png'));
  for (const badge of badges) {
    cpSync(join(badgesDir, badge), join(distDir, 'team_badges', badge));
  }
  console.log(`✓ Copied ${badges.length} team badges`);
}

if (existsSync(kitsDir)) {
  mkdirSync(join(distDir, 'team_kits'), { recursive: true });
  const kits = readdirSync(kitsDir).filter(f => f.endsWith('.png'));
  for (const kit of kits) {
    cpSync(join(kitsDir, kit), join(distDir, 'team_kits', kit));
  }
  console.log(`✓ Copied ${kits.length} team kits`);
}

if (existsSync(metadataPath)) {
  teamMetadata = JSON.parse(readFileSync(metadataPath, 'utf8'));
  console.log(`✓ Loaded metadata for ${Object.keys(teamMetadata).length} teams`);
}

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

.card-header-row {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 20px;
}

.card-header-row .card-subtitle {
  margin-bottom: 0;
}

.how-it-works-link {
  font-size: 13px;
  color: #3498db;
  text-decoration: none;
  white-space: nowrap;
  padding: 6px 12px;
  border: 1px solid #3498db;
  border-radius: 4px;
  transition: background 0.2s, color 0.2s;
}

.how-it-works-link:hover {
  background: #3498db;
  color: #fff;
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

/* Rowspan headers need bottom border since they span to second row */
.header-group th[rowspan] {
  border-bottom: 2px solid #e0e0e0;
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

/* Group stage finish columns */
.gs-col {
  width: 100px;
  min-width: 100px;
}

/* Knockout stage columns - equal width */
.ko-col {
  width: 115px;
  min-width: 115px;
}

/* Win Cup column - subtle distinction (standings table only) */
.win-cup {
  border-left: 2px solid #ccc;
}

/* Win Cup cells in body - second-to-last column (before Bookie) */
.standings-table tbody td:nth-last-child(2) {
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

.knockout-round-section {
  margin-bottom: 32px;
}

.knockout-round-section .group-title {
  font-size: 16px;
}

.knockout-tbd {
  color: #7F8C8D;
  font-style: italic;
  font-size: 13px;
  padding: 16px 0;
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
  height: 28px;
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

/* Team links - clickable team names */
.team-link {
  text-decoration: none;
  color: inherit;
  transition: color 0.15s ease;
}
.team-link:hover {
  color: #002D72;
  text-decoration: underline;
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

/* Top teams highlight - standings table only */
.standings-table .top-team td:nth-child(1),
.standings-table .top-team td:nth-child(2),
.standings-table .top-team td:nth-child(3),
.standings-table .top-team td:nth-child(4),
.standings-table .top-team td:nth-child(5) {
  background: #fffbe6 !important;
}

/* Row hover highlight - standings table only (avoid highlighting heatmap columns) */
.standings-table tbody tr:hover td:nth-child(1),
.standings-table tbody tr:hover td:nth-child(2),
.standings-table tbody tr:hover td:nth-child(3),
.standings-table tbody tr:hover td:nth-child(4),
.standings-table tbody tr:hover td:nth-child(5) {
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

.standings-table tbody tr:hover .owner-name {
  opacity: 1;
}

/* Clickable rows */
.clickable-row {
  cursor: pointer;
}
.clickable-row:hover {
  outline: 2px solid rgba(0, 45, 114, 0.3);
  outline-offset: -2px;
}

/* Emoji font support */
.team-flag {
  font-family: "Noto Color Emoji", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

/* Teams List Page */
.teams-list-container {
  padding: 20px 0;
}

.section-title {
  font-size: 24px;
  font-weight: 700;
  color: #2C3E50;
  margin-bottom: 8px;
}

.section-subtitle {
  color: #7F8C8D;
  margin-bottom: 24px;
}

.teams-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 12px;
}

.team-card {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  background: white;
  border-radius: 8px;
  text-decoration: none;
  color: #2C3E50;
  border: 1px solid #e0e0e0;
  transition: all 150ms ease;
}

.team-card:hover {
  border-color: #002D72;
  box-shadow: 0 2px 8px rgba(0, 45, 114, 0.15);
  transform: translateY(-1px);
}

.team-card-flag {
  font-size: 24px;
  font-family: "Noto Color Emoji", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.team-card-name {
  font-weight: 500;
  font-size: 14px;
}

/* Team Detail Page */
.team-detail-container {
  padding: 20px 0;
}

.back-link {
  display: inline-block;
  color: #002D72;
  text-decoration: none;
  margin-bottom: 16px;
  font-size: 14px;
}

.back-link:hover {
  text-decoration: underline;
}

.team-hero {
  background: #002D72;
  color: white;
  padding: 24px;
  border-radius: 12px;
  margin-bottom: 24px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
}

.team-hero-main {
  display: flex;
  align-items: center;
  gap: 16px;
}

.team-hero-flag {
  font-size: 48px;
  font-family: "Noto Color Emoji", -apple-system, BlinkMacSystemFont, "Segoe UI", Arial, sans-serif;
}

.team-hero-badge {
  width: 64px;
  height: 64px;
  object-fit: contain;
}

.team-hero-name {
  font-size: 28px;
  font-weight: 700;
  margin: 0;
}

.team-hero-nickname {
  font-size: 15px;
  font-style: italic;
  opacity: 0.85;
  margin-top: 2px;
}

.team-hero-meta {
  opacity: 0.8;
  font-size: 14px;
  margin-top: 4px;
}

.team-hero-stats {
  display: flex;
  gap: 24px;
  margin-left: 32px;
}

.hero-stat {
  text-align: center;
}

.hero-stat-value {
  font-size: 28px;
  font-weight: 700;
}

.hero-stat-label {
  font-size: 12px;
  opacity: 0.8;
  text-transform: uppercase;
}

.team-hero-kit {
  width: 80px;
  height: auto;
  margin-left: auto;
  margin-right: 24px;
}

.team-hero-owner {
  display: flex;
  flex-direction: column;
  align-items: flex-end;
  gap: 4px;
}

.team-hero-owner .owner-label {
  font-size: 12px;
  opacity: 0.7;
}

.team-hero-owner .owner-name {
  font-weight: 600;
  opacity: 1;
  margin-left: 0;
  color: white;
}

/* About section */
.team-about {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  margin-bottom: 24px;
  line-height: 1.6;
  color: #333;
  font-size: 14px;
}

.team-about-title {
  font-size: 18px;
  font-weight: 600;
  margin-bottom: 12px;
  color: #002D72;
}

.team-about-text {
  max-height: 150px;
  overflow: hidden;
  position: relative;
}

.team-about-text.expanded {
  max-height: none;
}

.team-about-toggle {
  color: #002D72;
  cursor: pointer;
  font-weight: 500;
  margin-top: 8px;
  display: inline-block;
}

.team-about-toggle:hover {
  text-decoration: underline;
}

/* Team Content Grid */
.team-content-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-bottom: 24px;
}

@media (max-width: 900px) {
  .team-content-grid {
    grid-template-columns: 1fr;
  }
}

.team-section {
  background: white;
  border-radius: 8px;
  padding: 20px;
  border: 1px solid #e0e0e0;
}

.section-header {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
  margin-bottom: 16px;
  padding-bottom: 8px;
  border-bottom: 2px solid #002D72;
}

/* Group Standings Table */
.group-standings-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.group-standings-table th,
.group-standings-table td {
  padding: 8px;
  text-align: left;
}

.group-standings-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #666;
  font-size: 11px;
  text-transform: uppercase;
}

.group-standings-table tbody tr {
  border-top: 1px solid #eee;
}

.group-standings-table tbody tr:hover {
  background: #f8f9fa;
}

.group-standings-table .current-team {
  background: #e8f5e9 !important;
}

.group-standings-table .current-team:hover {
  background: #c8e6c9 !important;
}

.group-standings-table .team-cell {
  font-weight: 500;
}

/* Team Matches */
.team-matches {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

/* Matchday label for team page matches */
.matchday-label {
  font-size: 10px;
  color: #999;
  margin-right: 8px;
  font-weight: 500;
}

/* Team page uses match-row from Matches page - just ensure proper container styling */
.team-section .match-row {
  font-size: 13px;
}

.team-section .match-home {
  width: 180px;
}

.team-section .match-away {
  width: 180px;
}

/* Squad Table */
.squad-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
}

.squad-table th,
.squad-table td {
  padding: 10px 8px;
  text-align: left;
}

.squad-table th {
  background: #f8f9fa;
  font-weight: 600;
  color: #666;
  font-size: 11px;
  text-transform: uppercase;
}

.squad-table tbody tr {
  border-top: 1px solid #eee;
}

.squad-table tbody tr:hover {
  background: #f8f9fa;
}

/* Player photo styles */
.photo-col {
  width: 44px;
}

.player-photo-cell {
  padding: 6px 8px !important;
}

.player-photo {
  width: 36px;
  height: 36px;
  border-radius: 50%;
  background: #e0e0e0;
  display: flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
}

.player-photo img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.player-initials {
  font-size: 12px;
  font-weight: 600;
  color: #666;
}

.num-col {
  width: 40px;
  text-align: center !important;
}

.player-name-cell {
  font-weight: 500;
}

.position-cell {
  color: #666;
}

.club-cell {
  color: #666;
  font-size: 12px;
}

.birthplace-cell {
  color: #666;
  font-size: 12px;
  max-width: 150px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* Player bio expandable rows */
.player-row.has-bio {
  cursor: pointer;
}

.player-row.has-bio:hover {
  background: #f0f7ff;
}

.bio-indicator {
  margin-left: 6px;
  font-size: 11px;
  opacity: 0.6;
}

.player-bio-row {
  display: none;
}

.player-bio-row.expanded {
  display: table-row;
}

.player-bio-row td {
  padding: 0 !important;
  background: #f8f9fa;
  border-top: none !important;
}

.player-bio-content {
  padding: 16px 20px;
  font-size: 13px;
  line-height: 1.6;
  color: #444;
  border-left: 3px solid #2ecc71;
  margin: 8px 12px;
  background: white;
  border-radius: 4px;
}

.player-bio-content p {
  margin: 0 0 12px 0;
}

.player-bio-content p:last-child {
  margin-bottom: 0;
}

.placeholder-text {
  color: #999;
  font-style: italic;
  text-align: center;
  padding: 20px;
}

.team-not-found {
  text-align: center;
  padding: 60px;
}

.team-not-found h2 {
  color: #E74C3C;
  margin-bottom: 16px;
}

.team-not-found a {
  color: #002D72;
}

/* ============================================
   PREDICTIONS VS REALITY TAB
   ============================================ */

.predictions-page {
  max-width: 1100px;
  margin: 0 auto;
}

.predictions-page .section-subtitle {
  color: #666;
  margin-bottom: 8px;
}

.progress-bar-container {
  background: #E4E4E6;
  border-radius: 4px;
  height: 6px;
  margin-bottom: 24px;
  overflow: hidden;
}

.progress-bar-container .progress-bar {
  height: 100%;
  background: linear-gradient(90deg, #28346E, #E3A344);
  border-radius: 4px;
  transition: width 0.5s ease;
}

.stat-cards {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  gap: 16px;
  margin-bottom: 32px;
}

.stat-card {
  background: white;
  border: 1px solid #E4E4E6;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.stat-card .stat-value {
  font-size: 2rem;
  font-weight: 700;
  color: #28346E;
}

.stat-card .stat-label {
  font-size: 0.85rem;
  font-weight: 600;
  color: #333;
  margin-top: 4px;
}

.stat-card .stat-note {
  font-size: 0.75rem;
  color: #999;
  margin-top: 2px;
}

.subsection-title {
  font-size: 1.3rem;
  color: #28346E;
  margin: 24px 0 4px;
}

.subsection-subtitle {
  font-size: 0.85rem;
  color: #666;
  margin-bottom: 12px;
}

/* Upsets Table */
.upsets-table-wrapper {
  overflow-x: auto;
  margin-bottom: 32px;
}

.upsets-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.9rem;
}

.upsets-table thead th {
  background: #28346E;
  color: white;
  padding: 10px 12px;
  text-align: left;
  font-weight: 500;
  font-size: 0.8rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.upsets-table tbody tr {
  border-bottom: 1px solid #eee;
  transition: background 0.15s;
}

.upsets-table tbody tr:hover {
  background: #f7f8fc;
}

.upsets-table tbody tr.correct {
  background: rgba(76, 175, 80, 0.06);
}

.upsets-table tbody tr.adjacent-miss {
  background: rgba(255, 193, 7, 0.06);
}

.upsets-table tbody tr.max-miss {
  background: rgba(244, 67, 54, 0.06);
}

.upsets-table td {
  padding: 10px 12px;
  vertical-align: middle;
}

.rank-cell {
  font-weight: 700;
  color: #28346E;
  width: 30px;
}

.match-cell {
  white-space: nowrap;
}

.match-cell .mini-flag {
  font-size: 1.1rem;
}

.match-cell .team-short {
  font-weight: 500;
  margin: 0 4px;
}

.match-cell .vs-text {
  color: #999;
  font-size: 0.8rem;
  margin: 0 4px;
}

.bar-cell {
  min-width: 150px;
  width: 20%;
}

.mini-split-bar {
  display: flex;
  height: 14px;
  border-radius: 3px;
  overflow: hidden;
  position: relative;
}

.mini-bar-section.left-win {
  background: #28346E;
}

.mini-bar-section.draw {
  background: #999;
}

.mini-bar-section.right-win {
  background: #E3A344;
}

.actual-marker {
  position: absolute;
  top: -3px;
  width: 3px;
  height: 20px;
  background: #f44336;
  border-radius: 2px;
  transform: translateX(-50%);
}

.result-cell .score {
  font-weight: 700;
  margin-right: 8px;
  color: #28346E;
}

.result-cell .outcome-label {
  font-size: 0.75rem;
  padding: 2px 6px;
  border-radius: 3px;
  font-weight: 500;
}

.result-cell .outcome-label.home_win {
  background: rgba(40, 52, 110, 0.1);
  color: #28346E;
}

.result-cell .outcome-label.draw {
  background: rgba(153, 153, 153, 0.15);
  color: #666;
}

.result-cell .outcome-label.away_win {
  background: rgba(227, 163, 68, 0.15);
  color: #b37e2d;
}

.surprise-cell {
  text-align: right;
  white-space: nowrap;
}

.surprise-cell .bits-value {
  font-size: 1.1rem;
  font-weight: 700;
  color: #28346E;
}

.surprise-cell .bits-unit {
  font-size: 0.75rem;
  color: #999;
  margin-left: 2px;
}

.surprise-cell .raw-prob {
  display: block;
  font-size: 0.75rem;
  color: #999;
}

.bet-cell {
  text-align: right;
  white-space: nowrap;
}

.bet-cell .bet-return {
  font-size: 1.1rem;
  font-weight: 700;
  color: #2e7d32;
}

.bet-cell .bet-bookie {
  display: block;
  font-size: 0.7rem;
  color: #666;
}

.bet-cell .bet-odds {
  font-size: 0.7rem;
  color: #999;
}

.bet-cell .bet-na {
  color: #ccc;
}

/* Grid layout for calibration + team perf */
.predictions-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 24px;
  margin-top: 8px;
  margin-bottom: 32px;
}

@media (max-width: 900px) {
  .predictions-grid {
    grid-template-columns: 1fr;
  }
}

.calibration-chart-container {
  background: white;
  border: 1px solid #E4E4E6;
  border-radius: 8px;
  padding: 16px;
  height: 300px;
}

.team-perf-tables {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.team-perf-section {
  background: white;
  border: 1px solid #E4E4E6;
  border-radius: 8px;
  padding: 12px 16px;
}

.perf-heading {
  font-size: 0.9rem;
  margin: 0 0 8px;
}

.perf-heading.overperforming {
  color: #2e7d32;
}

.perf-heading.underperforming {
  color: #c62828;
}

.perf-table {
  width: 100%;
  font-size: 0.8rem;
  border-collapse: collapse;
}

.perf-table thead th {
  font-weight: 600;
  text-align: left;
  padding: 4px 6px;
  border-bottom: 1px solid #eee;
  color: #666;
}

.perf-table tbody td {
  padding: 4px 6px;
  border-bottom: 1px solid #f5f5f5;
}

.perf-table .delta.overperforming {
  color: #2e7d32;
  font-weight: 600;
}

.perf-table .delta.underperforming {
  color: #c62828;
  font-weight: 600;
}

/* RPS Explainer */
.rps-explainer {
  background: white;
  border: 1px solid #E4E4E6;
  border-radius: 8px;
  margin: 24px 0;
}

.rps-explainer summary {
  padding: 12px 16px;
  cursor: pointer;
  font-weight: 600;
  color: #28346E;
  font-size: 0.9rem;
}

.rps-explainer .explainer-content {
  padding: 0 16px 16px;
  font-size: 0.85rem;
  color: #444;
  line-height: 1.6;
}

.rps-explainer h4 {
  color: #28346E;
  margin: 12px 0 4px;
}

.rps-explainer code {
  background: #f5f5f5;
  padding: 2px 6px;
  border-radius: 3px;
  font-size: 0.8rem;
}

/* ============================================
   METHODOLOGY PAGE STYLES
   ============================================ */

.methodology-container {
  max-width: 900px;
  margin: 0 auto;
}

.meth-hero {
  background: linear-gradient(135deg, #002D72 0%, #004494 100%);
  color: white;
  padding: 40px;
  border-radius: 8px;
  margin-bottom: 24px;
  text-align: center;
}

.meth-hero h1 {
  font-size: 32px;
  font-weight: 700;
  margin: 0 0 12px 0;
}

.meth-hero .subtitle {
  font-size: 16px;
  opacity: 0.9;
}

.meth-section {
  background: white;
  border-radius: 8px;
  padding: 28px;
  margin-bottom: 24px;
  border: 1px solid #e0e0e0;
}

.meth-section h2 {
  font-size: 22px;
  font-weight: 600;
  color: #002D72;
  margin: 0 0 16px 0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.meth-section h2 .icon {
  font-size: 24px;
}

.meth-section h3 {
  font-size: 16px;
  font-weight: 600;
  color: #2C3E50;
  margin: 20px 0 10px 0;
}

.meth-section p {
  line-height: 1.7;
  color: #333;
  margin-bottom: 14px;
}

.meth-section ul {
  margin: 12px 0;
  padding-left: 24px;
}

.meth-section li {
  margin-bottom: 8px;
  line-height: 1.6;
}

/* Data sources cards */
.data-sources {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 16px;
  margin: 20px 0;
}

@media (max-width: 700px) {
  .data-sources {
    grid-template-columns: 1fr;
  }
}

.data-source-card {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  text-align: center;
}

.data-source-card .icon {
  font-size: 32px;
  margin-bottom: 10px;
}

.data-source-card h4 {
  font-size: 14px;
  font-weight: 600;
  color: #002D72;
  margin: 0 0 8px 0;
}

.data-source-card p {
  font-size: 13px;
  color: #666;
  margin: 0;
}

/* Cascade flowchart */
.cascade-flow {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 20px;
  font-family: 'SF Mono', Monaco, 'Cascadia Code', monospace;
  font-size: 13px;
  line-height: 1.8;
  overflow-x: auto;
}

.cascade-step {
  display: flex;
  align-items: center;
  padding: 12px 16px;
  margin: 8px 0;
  border-radius: 6px;
}

.cascade-step.yes {
  background: #d4edda;
  border-left: 4px solid #28a745;
}

.cascade-step.no {
  background: #fff3cd;
  border-left: 4px solid #ffc107;
}

.cascade-step.fallback {
  background: #cce5ff;
  border-left: 4px solid #007bff;
}

.cascade-arrow {
  text-align: center;
  color: #666;
  font-size: 18px;
  margin: 4px 0;
}

/* Elo explainer box */
.elo-box {
  background: linear-gradient(135deg, #e8f4fd 0%, #f0f8ff 100%);
  border: 1px solid #b8daff;
  border-radius: 8px;
  padding: 20px 24px;
  margin: 20px 0;
}

.elo-box blockquote {
  font-style: italic;
  color: #0056b3;
  margin: 0 0 16px 0;
  padding: 0;
  border: none;
  line-height: 1.6;
}

.elo-facts {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
  margin-top: 16px;
}

@media (max-width: 600px) {
  .elo-facts {
    grid-template-columns: 1fr;
  }
}

.elo-fact {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
}

.elo-fact .bullet {
  color: #002D72;
  font-weight: bold;
}

/* Elo bar chart */
.elo-chart-container {
  margin: 24px 0;
  overflow-x: auto;
}

.elo-bar {
  display: flex;
  align-items: center;
  margin: 3px 0;
  font-size: 12px;
}

.elo-bar .team-name {
  width: 130px;
  text-align: right;
  padding-right: 10px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.elo-bar .bar {
  height: 16px;
  border-radius: 3px;
  min-width: 4px;
}

.elo-bar .rating {
  padding-left: 8px;
  color: #666;
  font-size: 11px;
}

/* Confederation colors */
.conf-uefa { background: #3498db; }
.conf-conmebol { background: #f1c40f; }
.conf-concacaf { background: #2ecc71; }
.conf-caf { background: #e74c3c; }
.conf-afc { background: #9b59b6; }
.conf-ofc { background: #1abc9c; }

/* Win probability calculator */
.prob-calculator {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 24px;
  margin: 20px 0;
}

.prob-calculator h4 {
  margin: 0 0 16px 0;
  font-size: 15px;
  color: #002D72;
}

.calc-inputs {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
  margin-bottom: 16px;
}

.calc-inputs select {
  padding: 8px 12px;
  font-size: 14px;
  border: 1px solid #ccc;
  border-radius: 4px;
  min-width: 140px;
}

.calc-inputs .vs {
  font-weight: 600;
  color: #666;
}

.calc-result {
  background: white;
  padding: 16px;
  border-radius: 6px;
  border: 1px solid #e0e0e0;
}

.calc-result .result-text {
  font-size: 15px;
  margin-bottom: 12px;
}

.calc-result .result-text strong {
  color: #002D72;
}

.calc-result .formula {
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 12px;
  color: #666;
  background: #f5f5f5;
  padding: 8px 12px;
  border-radius: 4px;
}

/* Tournament structure */
.tournament-structure {
  background: #f8f9fa;
  border-radius: 8px;
  padding: 24px;
  margin: 20px 0;
}

.stage-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #e0e0e0;
}

.stage-row:last-child {
  border-bottom: none;
}

.stage-name {
  width: 120px;
  font-weight: 600;
  color: #002D72;
}

.stage-desc {
  flex: 1;
  color: #666;
}

.stage-teams {
  background: #002D72;
  color: white;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 600;
}

/* Bracket advantage callout */
.bracket-callout {
  background: linear-gradient(135deg, #fff5e6 0%, #fff9f0 100%);
  border: 1px solid #ffcc80;
  border-radius: 8px;
  padding: 20px 24px;
  margin: 20px 0;
}

.bracket-callout h4 {
  color: #e65100;
  margin: 0 0 12px 0;
  display: flex;
  align-items: center;
  gap: 8px;
}

.bracket-callout p {
  margin: 8px 0;
  line-height: 1.6;
}

/* Comparison table */
.comparison-table {
  width: 100%;
  border-collapse: collapse;
  margin: 20px 0;
  font-size: 14px;
}

.comparison-table th {
  background: #002D72;
  color: white;
  padding: 12px;
  text-align: left;
  font-weight: 600;
}

.comparison-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #e0e0e0;
}

.comparison-table tr:nth-child(even) td {
  background: #f8f9fa;
}

.comparison-table .diff-positive {
  color: #28a745;
}

.comparison-table .diff-negative {
  color: #dc3545;
}

/* Technical details expander */
.tech-details {
  margin-top: 20px;
}

.tech-toggle {
  display: flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  color: #002D72;
  font-weight: 500;
  padding: 8px 0;
}

.tech-toggle:hover {
  text-decoration: underline;
}

.tech-content {
  display: none;
  background: #f5f5f5;
  border-radius: 6px;
  padding: 16px;
  margin-top: 12px;
  font-family: 'SF Mono', Monaco, monospace;
  font-size: 13px;
  line-height: 1.6;
}

.tech-content.visible {
  display: block;
}

.tech-content code {
  background: #e0e0e0;
  padding: 2px 6px;
  border-radius: 3px;
}

/* Footer link */
.meth-footer {
  text-align: center;
  padding: 20px;
  color: #666;
  font-size: 14px;
}

.meth-footer a {
  color: #002D72;
}

/* ============================================
   KNOCKOUT BRACKET STYLES
   ============================================ */

.bracket-container {
  padding: 24px;
  max-width: 100%;
  overflow-x: auto;
}

.bracket-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
  flex-wrap: wrap;
  gap: 12px;
}

.bracket-header h2 {
  font-size: 20px;
  color: #1a1a1a;
}

.bracket-controls {
  display: flex;
  align-items: center;
  gap: 12px;
}

.bracket-reset-btn {
  background: #f44336;
  color: white;
  border: none;
  padding: 8px 16px;
  border-radius: 6px;
  cursor: pointer;
  font-size: 13px;
  font-weight: 500;
}

.bracket-reset-btn:hover {
  background: #d32f2f;
}

.bracket-reset-btn:disabled {
  background: #ccc;
  cursor: not-allowed;
}

.bracket-scenario-count {
  font-size: 13px;
  color: #666;
  background: #f5f5f5;
  padding: 6px 12px;
  border-radius: 4px;
}

/* Round labels row */
.bracket-round-labels {
  display: grid;
  grid-template-columns: 160px 155px 155px 140px 100px 140px 155px 155px 160px;
  min-width: 1320px;
  text-align: center;
  margin-bottom: 4px;
}

.bracket-round-label {
  font-size: 10px;
  font-weight: 700;
  color: #666;
  text-transform: uppercase;
  letter-spacing: 0.5px;
  padding: 6px 0;
}

/* Main bracket grid */
.bracket-grid {
  display: grid;
  grid-template-columns: 160px 155px 155px 140px 100px 140px 155px 155px 160px;
  gap: 0;
  min-width: 1320px;
  min-height: 560px;
  align-items: stretch;
}

.bracket-round {
  display: flex;
  flex-direction: column;
  justify-content: space-around;
  padding: 0 6px;
  position: relative;
}

/* Match boxes */
.bracket-match {
  background: white;
  border: 1px solid #e0e0e0;
  border-radius: 4px;
  margin: 4px 0;
  cursor: pointer;
  transition: transform 0.12s, box-shadow 0.15s, border-color 0.15s;
  position: relative;
}

.bracket-match:hover {
  box-shadow: 0 2px 8px rgba(0,0,0,0.12);
  border-color: #002D72;
  transform: scale(1.03);
  z-index: 2;
  position: relative;
}

.bracket-match.locked {
  border-color: #002D72;
  border-width: 2px;
  box-shadow: 0 0 0 2px rgba(0,45,114,0.12);
}

.bracket-match.completed-match {
  border-color: #2e7d32;
  border-width: 2px;
  background: #f1f8e9;
  cursor: default;
}

.bracket-match.completed-match:hover {
  transform: none;
  box-shadow: none;
  border-color: #2e7d32;
}

.bracket-match.completed-match .bracket-match-team:hover {
  background: transparent;
}

.bracket-match.completed-match .bracket-match-team.completed-winner {
  background: #c8e6c9;
  font-weight: 600;
}

.bracket-match.completed-match .team-score {
  font-size: 11px;
  font-weight: 700;
  color: #333;
  flex-shrink: 0;
  min-width: 20px;
  text-align: right;
}

.bracket-match.completed-match .team-score .penalty-score {
  font-size: 9px;
  font-weight: 400;
  color: #666;
}

.bracket-match.ghosted {
  opacity: 0.5;
  border-style: dashed;
  border-color: #bbb;
}

.bracket-match.ghosted:hover {
  opacity: 0.85;
  border-style: solid;
}

.bracket-match-team {
  display: flex;
  align-items: center;
  padding: 5px 7px;
  gap: 5px;
  font-size: 11px;
  position: relative;
  border-bottom: 1px solid #f0f0f0;
  transition: background 0.1s;
}

.bracket-match-team:last-child {
  border-bottom: none;
}

.bracket-match-team:hover {
  background: #f8f9ff;
}

.bracket-match-team.winner {
  background: #e8f5e9;
  font-weight: 600;
}

.bracket-match-team.locked-winner {
  background: #e3f2fd;
  font-weight: 600;
}

.bracket-match-team .team-flag {
  font-size: 13px;
  flex-shrink: 0;
}

.bracket-match-team .team-name {
  flex: 1;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.bracket-match-team .team-prob {
  font-size: 10px;
  color: #888;
  font-weight: 600;
  flex-shrink: 0;
  min-width: 26px;
  text-align: right;
}

.bracket-match-team .team-badge-small {
  width: 14px;
  height: 14px;
  object-fit: contain;
  flex-shrink: 0;
}

/* Connector lines - horizontal stubs from matches */
.bracket-left .bracket-match::after {
  content: '';
  position: absolute;
  top: 50%;
  right: -7px;
  width: 7px;
  height: 0;
  border-top: 2px solid #999;
}

.bracket-right .bracket-match::after {
  content: '';
  position: absolute;
  top: 50%;
  left: -7px;
  width: 7px;
  height: 0;
  border-top: 2px solid #999;
}

.bracket-center .bracket-match::after {
  display: none;
}

/* Final / center column */
.bracket-center {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 8px 4px;
}

.bracket-trophy {
  font-size: 28px;
  margin: 8px 0 4px;
}

.bracket-winner-name {
  font-size: 13px;
  font-weight: 700;
  color: #002D72;
  text-align: center;
  display: flex;
  align-items: center;
  gap: 4px;
}

.bracket-winner-name img {
  width: 20px;
  height: 20px;
  object-fit: contain;
}

.bracket-winner-prob {
  font-size: 11px;
  color: #666;
  margin-top: 2px;
}

/* Legend */
.bracket-legend {
  display: flex;
  gap: 20px;
  margin-top: 16px;
  padding: 12px 16px;
  background: #f8f9fa;
  border-radius: 6px;
  font-size: 12px;
  flex-wrap: wrap;
}

.bracket-legend-item {
  display: flex;
  align-items: center;
  gap: 6px;
}

.bracket-legend-swatch {
  width: 12px;
  height: 12px;
  border-radius: 3px;
  border: 1px solid #ccc;
}

.bracket-legend-swatch.swatch-locked {
  background: #e3f2fd;
  border-color: #002D72;
  border-width: 2px;
}

.bracket-legend-swatch.swatch-probable {
  background: #e8f5e9;
}

.bracket-legend-swatch.swatch-ghosted {
  background: white;
  border-style: dashed;
  opacity: 0.5;
}
`;

writeFileSync(join(distDir, 'css', 'styles.css'), css);
console.log('✓ Generated styles.css');

// Generate JavaScript
console.log('\nGenerating JavaScript...');
const js = `// INRIX World Cup Sweepstake - Single Page App

let data = null;

// Player photo mapping (built at build time)
const playerPhotoMapping = ${JSON.stringify(playerPhotoMapping)};

// Player stats (height, club, bio, etc.)
const playerStats = ${JSON.stringify(playerStats)};

// Team metadata (built at build time)
const teamMetadata = ${JSON.stringify(teamMetadata)};

// Flag emojis
const flagEmojis = ${JSON.stringify({...FLAG_EMOJIS, 'Denmark': '🇩🇰', 'Italy': '🇮🇹', 'Kosovo': '🇽🇰', 'Poland': '🇵🇱'})};

function getFlag(teamName) {
  return flagEmojis[teamName] || '🏴';
}

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

function toggleAbout() {
  const text = document.getElementById('about-text');
  const toggle = document.querySelector('.team-about-toggle');
  if (text.classList.contains('expanded')) {
    text.classList.remove('expanded');
    toggle.textContent = 'Read more';
  } else {
    text.classList.add('expanded');
    toggle.textContent = 'Read less';
  }
}

function togglePlayerBio(playerId) {
  const bioRow = document.getElementById(playerId);
  if (bioRow) {
    bioRow.classList.toggle('expanded');
  }
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
        
        // Initialize if needed (use 'in' check — 0 points is falsy but valid)
        if (!(homeTeam in teamPoints)) { teamPoints[homeTeam] = 0; teamGames[homeTeam] = 0; }
        if (!(awayTeam in teamPoints)) { teamPoints[awayTeam] = 0; teamGames[awayTeam] = 0; }
        
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

    const teamSlug = team.name.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return \`<tr class="\${topClass} \${sectionBreak} clickable-row" onclick="window.location.hash='teams/\${teamSlug}'">
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
      \${renderCell(team.bookmaker_win_probability, true)}
    </tr>\`;
  }).join('');

  const date = new Date(data.timestamp);
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return \`
    <div class="card">
      <div class="card-header-row">
        <div>
          <div class="card-title">World Cup 2026 - Stage-by-Stage Probabilities</div>
          <div class="card-subtitle">Based on 10,000 Monte Carlo simulations • Updated \${dateStr}</div>
        </div>
        <a href="#methodology" class="how-it-works-link">How It Works →</a>
      </div>
      <table class="standings-table">
        <thead>
          <tr class="header-group">
            <th rowspan="2">Team</th>
            <th rowspan="2" class="center">Pts</th>
            <th rowspan="2" class="center">Group</th>
            <th colspan="2" class="center">Group Stage Finish</th>
            <th colspan="6" class="center">Knockout Stage Chances</th>
          </tr>
          <tr class="header-cols">
            <th class="center gs-col">1st Place</th>
            <th class="center gs-col">2nd Place</th>
            <th class="center ko-col">Make R16</th>
            <th class="center ko-col">Make Quarters</th>
            <th class="center ko-col">Make Semis</th>
            <th class="center ko-col">Make Final</th>
            <th class="center ko-col win-cup">Win Cup</th>
            <th class="center ko-col">Bookie</th>
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
    const homeSlug = match.home_team.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const awaySlug = match.away_team.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
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
            <a href="#teams/\${homeSlug}" class="team-name team-link">\${match.home_team}</a>
            <span class="team-flag">\${homeFlag}</span>
          </div>
          <div class="match-bar">
            <div class="result-bar \${barClass}">
              <span class="result-text">\${resultText}</span>
            </div>
          </div>
          <div class="match-away">
            <span class="team-flag">\${awayFlag}</span>
            <a href="#teams/\${awaySlug}" class="team-name team-link">\${match.away_team}</a>
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
          <a href="#teams/\${homeSlug}" class="team-name team-link \${homeFav ? 'favorite' : ''}">\${match.home_team}</a>
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
          <a href="#teams/\${awaySlug}" class="team-name team-link \${awayFav ? 'favorite' : ''}">\${match.away_team}</a>
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

function renderKnockoutMatches() {
  const knockout = data.knockout_matches || {};
  const rounds = [
    { key: 'round_of_32', label: 'Round of 32' },
    { key: 'round_of_16', label: 'Round of 16' },
    { key: 'quarter_finals', label: 'Quarter-Finals' },
    { key: 'semi_finals', label: 'Semi-Finals' },
    { key: 'third_place', label: 'Third-Place Play-off' },
    { key: 'final', label: 'Final' }
  ];

  const renderMatch = (match) => {
    const homeFlag = flagEmojis[match.home_team] || '🏴';
    const awayFlag = flagEmojis[match.away_team] || '🏴';
    const homeSlug = match.home_team.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    const awaySlug = match.away_team.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');

    const matchDate = new Date(match.commence_time);
    const dateStr = matchDate.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      timeZone: 'America/New_York'
    });

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
        <div class="match-row completed">
          <div class="match-home">
            <span class="owner">\${getFirstName(match.home_owner)}</span>
            <a href="#teams/\${homeSlug}" class="team-name team-link">\${match.home_team}</a>
            <span class="team-flag">\${homeFlag}</span>
          </div>
          <div class="match-bar">
            <div class="result-bar \${barClass}">
              <span class="result-text">\${resultText}</span>
            </div>
          </div>
          <div class="match-away">
            <span class="team-flag">\${awayFlag}</span>
            <a href="#teams/\${awaySlug}" class="team-name team-link">\${match.away_team}</a>
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
      <div class="match-row">
        <div class="match-home">
          <span class="owner">\${getFirstName(match.home_owner)}</span>
          <a href="#teams/\${homeSlug}" class="team-name team-link \${homeFav ? 'favorite' : ''}">\${match.home_team}</a>
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
          <a href="#teams/\${awaySlug}" class="team-name team-link \${awayFav ? 'favorite' : ''}">\${match.away_team}</a>
          <span class="owner">\${getFirstName(match.away_owner)}</span>
        </div>
        <span class="match-date">\${dateStr}</span>
      </div>
    \`;
  };

  const roundSections = rounds.map(round => {
    const matches = knockout[round.key] || [];
    if (matches.length === 0) {
      return \`
        <div class="knockout-round-section">
          <div class="group-title">\${round.label}</div>
          <div class="knockout-tbd">Matches to be determined</div>
        </div>
      \`;
    }

    // Split matches into two columns (first half left, second half right)
    const half = Math.ceil(matches.length / 2);
    const leftMatches = matches.slice(0, half);
    const rightMatches = matches.slice(half);

    return \`
      <div class="knockout-round-section">
        <div class="group-title">\${round.label}</div>
        <div class="matches-container">
          <div class="matches-column">\${leftMatches.map(renderMatch).join('')}</div>
          <div class="matches-column">\${rightMatches.map(renderMatch).join('')}</div>
        </div>
      </div>
    \`;
  }).join('');

  const date = new Date(data.timestamp);
  const dateStr = date.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

  return \`
    <div class="card">
      <div class="card-title">Upcoming Matches - Knockout</div>
      <div class="card-subtitle">Updated \${dateStr} • Match odds from bookmakers</div>
      <div class="legend">
        <div class="legend-item"><div class="legend-box home"></div> Left team win</div>
        <div class="legend-item"><div class="legend-box draw"></div> Draw</div>
        <div class="legend-item"><div class="legend-box away"></div> Right team win</div>
        <div class="legend-note">Bold name = favourite</div>
        <div class="legend-note">Odds reflect the result after 90 minutes (draw = extra time / penalties)</div>
      </div>
      \${roundSections}
    </div>
  \`;
}

function renderTimeline() {
  // Include anyone who at any point had >3% win probability
  const featuredNames = new Set();
  data.timeline.forEach(t => {
    Object.entries(t.participants).forEach(([name, prob]) => {
      if (prob > 0.03) featuredNames.add(name);
    });
  });
  // Sort by current probability descending
  const featured = data.leaderboard.filter(p => featuredNames.has(p.name));
  
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

  const xMin = new Date('2026-06-01T00:00:00Z');

  const datasets = featured.map((p, i) => ({
    label: p.name,
    data: data.timeline
      .filter(t => new Date(t.date) >= xMin)
      .map(t => ({
        x: new Date(t.date),
        y: (t.participants[p.name] || 0) * 100
      })),
    borderColor: allColors[i],
    backgroundColor: allColors[i],
    tension: 0.3,
    pointRadius: 0,
    pointHoverRadius: 3,
    pointHitRadius: 10,
    borderWidth: 2.5,
    hoverBorderWidth: 3.5
  }));

  // Determine x-axis end date based on tournament stage
  // Group stages end June 28; final is July 19
  const groupStageEnd = new Date('2026-06-29T00:00:00Z');
  const finalEnd = new Date('2026-07-20T00:00:00Z');
  const lastGroupMatch = new Date('2026-06-28T04:00:00Z');
  const now = new Date();
  const xMax = now > lastGroupMatch ? finalEnd : groupStageEnd;

  // Store current odds and teams for labels
  const currentOdds = {};
  const participantTeams = {};
  const teamFlags = ${JSON.stringify({...FLAG_EMOJIS, 'Chile': '🇨🇱', 'Poland': '🇵🇱', 'Serbia': '🇷🇸', 'Denmark': '🇩🇰', 'Italy': '🇮🇹', 'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Cameroon': '🇨🇲', 'Peru': '🇵🇪'})};
  featured.forEach(p => {
    currentOdds[p.name] = (p.total_probability * 100).toFixed(1);
    participantTeams[p.name] = [
      teamFlags[p.team1.name] || '🏴',
      teamFlags[p.team2.name] || '🏴'
    ];
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
              time: { unit: 'day' },
              min: xMin,
              max: xMax
            },
            y: {
              title: { display: true, text: 'Win Probability (%)' },
              min: 0
            }
          },
          plugins: {
            legend: { display: false },
            tooltip: { enabled: false },
            annotation: {
              annotations: {
                md1: {
                  type: 'line',
                  xMin: '2026-06-11',
                  xMax: '2026-06-11',
                  borderColor: 'rgba(100,100,100,0.4)',
                  borderWidth: 1,
                  borderDash: [4, 4],
                  label: { display: true, content: 'Matchday 1', position: 'start', font: { size: 10 }, color: '#666', backgroundColor: 'transparent' }
                },
                md2: {
                  type: 'line',
                  xMin: '2026-06-18',
                  xMax: '2026-06-18',
                  borderColor: 'rgba(100,100,100,0.4)',
                  borderWidth: 1,
                  borderDash: [4, 4],
                  label: { display: true, content: 'Matchday 2', position: 'start', font: { size: 10 }, color: '#666', backgroundColor: 'transparent' }
                },
                md3: {
                  type: 'line',
                  xMin: '2026-06-24',
                  xMax: '2026-06-24',
                  borderColor: 'rgba(100,100,100,0.4)',
                  borderWidth: 1,
                  borderDash: [4, 4],
                  label: { display: true, content: 'Matchday 3', position: 'start', font: { size: 10 }, color: '#666', backgroundColor: 'transparent' }
                },
                knockouts: {
                  type: 'line',
                  xMin: '2026-06-28',
                  xMax: '2026-06-28',
                  borderColor: 'rgba(100,100,100,0.6)',
                  borderWidth: 1.5,
                  borderDash: [4, 4],
                  label: { display: true, content: 'Knockouts', position: 'start', font: { size: 10 }, color: '#666', backgroundColor: 'transparent' }
                },
                final: {
                  type: 'line',
                  xMin: '2026-07-19',
                  xMax: '2026-07-19',
                  borderColor: 'rgba(100,100,100,0.6)',
                  borderWidth: 1.5,
                  borderDash: [4, 4],
                  label: { display: true, content: 'Final', position: 'start', font: { size: 10 }, color: '#666', backgroundColor: 'transparent' }
                }
              }
            }
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

      // Reset highlight when mouse leaves the chart
      ctx.addEventListener('mouseleave', () => {
        if (activeDatasetIndex !== null) {
          activeDatasetIndex = null;
          chart.data.datasets.forEach((ds, i) => {
            ds.borderColor = allColors[i];
            ds.backgroundColor = allColors[i];
            ds.borderWidth = 2.5;
          });
          chart.update('none');
          updateEndLabels(chart, null);
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

        const participant = featured[activeIndex];
        const meta = chart.getDatasetMeta(activeIndex);
        const lastPointMeta = meta.data[meta.data.length - 1];
        
        if (!lastPointMeta) return;
        
        const x = lastPointMeta.x;
        const y = lastPointMeta.y;
        const color = allColors[activeIndex];
        const odds = currentOdds[participant.name];
        const flags = participantTeams[participant.name] || ['🏴', '🏴'];
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
            <span style="font-size:20px;margin-left:4px;">\${flags[0]}</span>
            <span style="font-size:20px;">\${flags[1]}</span>
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

// ============================================================
// PREDICTIONS VS REALITY
// ============================================================

function renderPredictions() {
  const pvr = data.predictions_vs_results;
  
  if (!pvr || pvr.matches.length === 0) {
    return \`
      <div class="predictions-page">
        <div class="section-title">Predictions vs Reality</div>
        <p class="section-subtitle">No completed matches yet. Check back once games start!</p>
      </div>
    \`;
  }
  
  const { summary, matches, team_performance, calibration } = pvr;
  
  // Flag lookup
  const flagEmoji = ${JSON.stringify(FLAG_EMOJIS)};
  
  function outcomeLabel(outcome) {
    if (outcome === 'home_win') return 'Home Win';
    if (outcome === 'away_win') return 'Away Win';
    return 'Draw';
  }
  
  function ordinalDistance(predicted, actual) {
    const order = ['home_win', 'draw', 'away_win'];
    return Math.abs(order.indexOf(predicted) - order.indexOf(actual));
  }
  
  // Build upsets table rows
  const upsetsRows = matches.map((m, i) => {
    const homeFlag = flagEmoji[m.home_team] || '🏴';
    const awayFlag = flagEmoji[m.away_team] || '🏴';
    const distance = ordinalDistance(m.predicted_outcome, m.actual_outcome);
    const rowClass = distance === 0 ? 'correct' : distance === 1 ? 'adjacent-miss' : 'max-miss';
    
    const hPct = Math.round(m.pre_match_probs.home_win * 100);
    const dPct = Math.round(m.pre_match_probs.draw * 100);
    const aPct = Math.round(m.pre_match_probs.away_win * 100);
    
    // Mini bar showing which outcome occurred
    const actualMarkerPos = m.actual_outcome === 'home_win' ? (hPct / 2) :
                            m.actual_outcome === 'draw' ? (hPct + dPct / 2) :
                            (hPct + dPct + aPct / 2);
    
    const scoreText = \`\${m.actual_score.home}-\${m.actual_score.away}\`;
    
    return \`
      <tr class="\${rowClass}">
        <td class="rank-cell">\${i + 1}</td>
        <td class="match-cell">
          <span class="mini-flag">\${homeFlag}</span>
          <span class="team-short">\${m.home_team}</span>
          <span class="vs-text">vs</span>
          <span class="team-short">\${m.away_team}</span>
          <span class="mini-flag">\${awayFlag}</span>
        </td>
        <td class="bar-cell">
          <div class="mini-split-bar">
            <div class="mini-bar-section left-win" style="flex-basis: \${hPct}%;"></div>
            <div class="mini-bar-section draw" style="flex-basis: \${dPct}%;"></div>
            <div class="mini-bar-section right-win" style="flex-basis: \${aPct}%;"></div>
            <div class="actual-marker" style="left: \${actualMarkerPos}%;" title="Actual outcome"></div>
          </div>
        </td>
        <td class="result-cell">
          <span class="score">\${scoreText}</span>
          <span class="outcome-label \${m.actual_outcome}">\${outcomeLabel(m.actual_outcome)}</span>
        </td>
        <td class="surprise-cell">
          <span class="bits-value">\${m.surprise_bits.toFixed(2)}</span>
          <span class="bits-unit">bits</span>
          <span class="raw-prob">\${Math.round(m.raw_probability * 100)}%</span>
        </td>
        <td class="bet-cell">
          \${m.best_bet ? \`
            <span class="bet-return">£\${m.best_bet.return_10.toFixed(0)}</span>
            <span class="bet-bookie">\${m.best_bet.bookie}</span>
            <span class="bet-odds">\${m.best_bet.odds.toFixed(2)}×</span>
          \` : '<span class="bet-na">—</span>'}
        </td>
      </tr>
    \`;
  }).join('');
  
  // Team performance tables
  const overperformers = team_performance.filter(t => t.direction === 'overperforming').slice(0, 5);
  const underperformers = team_performance.filter(t => t.direction === 'underperforming').sort((a, b) => a.delta - b.delta).slice(0, 5);
  
  function teamPerfRow(t) {
    const flag = flagEmoji[t.team] || '🏴';
    return \`
      <tr>
        <td>\${flag} \${t.team}</td>
        <td>\${t.matches_played}</td>
        <td>\${t.expected_points.toFixed(1)}</td>
        <td>\${t.actual_points}</td>
        <td class="delta \${t.direction}">\${t.delta > 0 ? '+' : ''}\${t.delta.toFixed(1)}</td>
      </tr>
    \`;
  }
  
  // Render calibration chart after DOM update
  setTimeout(() => {
    const ctx = document.getElementById('calibration-canvas');
    if (!ctx || !window.Chart) return;
    
    const validBins = calibration.bins.filter(b => b.count > 0);
    
    new Chart(ctx, {
      type: 'scatter',
      data: {
        datasets: [
          {
            label: 'Bookie calibration',
            data: validBins.map(b => ({ x: b.avg_predicted * 100, y: b.actual_frequency * 100 })),
            backgroundColor: '#28346E',
            borderColor: '#28346E',
            clip: false,
            pointRadius: validBins.map(b => 6 + Math.min(b.count, 10)),
            pointHoverRadius: 8
          },
          {
            label: 'Perfect calibration',
            data: [{ x: 0, y: 0 }, { x: 100, y: 100 }],
            type: 'line',
            borderColor: '#ccc',
            borderDash: [5, 5],
            borderWidth: 1.5,
            pointRadius: 0,
            fill: false
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => {
                if (ctx.datasetIndex === 1) return '';
                const bin = validBins[ctx.dataIndex];
                return \`Predicted: \${(bin.avg_predicted * 100).toFixed(0)}% | Actual: \${(bin.actual_frequency * 100).toFixed(0)}% (n=\${bin.count})\`;
              }
            }
          }
        },
        scales: {
          x: {
            title: { display: true, text: 'Predicted Probability (%)', font: { size: 12 } },
            min: 0, max: 100,
            grid: { color: '#f0f0f0' }
          },
          y: {
            title: { display: true, text: 'Actual Frequency (%)', font: { size: 12 } },
            min: 0, max: 100,
            grid: { color: '#f0f0f0' }
          }
        }
      }
    });
  }, 100);
  
  return \`
    <div class="predictions-page">
      <div class="section-title">Predictions vs Reality</div>
      <p class="section-subtitle">How accurate are the bookmakers? • \${summary.matches_played} of \${summary.total_matches} matches played</p>
      
      <div class="progress-bar-container">
        <div class="progress-bar" style="width: \${(summary.matches_played / summary.total_matches * 100).toFixed(1)}%"></div>
      </div>
      
      <div class="stat-cards">
        <div class="stat-card">
          <div class="stat-value">\${summary.average_surprise_bits.toFixed(2)}</div>
          <div class="stat-label">Avg Surprise (bits)</div>
          <div class="stat-note">Lower = more predictable</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${summary.correct_pct}%</div>
          <div class="stat-label">Correct Predictions</div>
          <div class="stat-note">\${summary.correct_predictions} of \${summary.matches_played} matches</div>
        </div>
        <div class="stat-card">
          <div class="stat-value">\${summary.average_rps.toFixed(3)}</div>
          <div class="stat-label">Avg RPS</div>
          <div class="stat-note">0 = perfect, 1 = worst</div>
        </div>
      </div>
      
      <h2 class="subsection-title">Biggest Upsets</h2>
      <p class="subsection-subtitle">Matches ranked by information content — how surprising was the actual result?</p>
      
      <div class="upsets-table-wrapper">
        <table class="upsets-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Match</th>
              <th>Pre-Match Odds</th>
              <th>Result</th>
              <th>Surprise</th>
              <th>Best Bet (£10)</th>
            </tr>
          </thead>
          <tbody>
            \${upsetsRows}
          </tbody>
        </table>
      </div>
      
      <div class="predictions-grid">
        <div class="predictions-grid-left">
          <h2 class="subsection-title">Calibration</h2>
          <p class="subsection-subtitle">Are predicted probabilities accurate? Dots on the diagonal = perfectly calibrated.</p>
          <div class="calibration-chart-container">
            <canvas id="calibration-canvas"></canvas>
          </div>
        </div>
        
        <div class="predictions-grid-right">
          <h2 class="subsection-title">Team Performance</h2>
          <p class="subsection-subtitle">Expected points (from pre-match odds) vs actual points earned.</p>
          
          <div class="team-perf-tables">
            <div class="team-perf-section">
              <h3 class="perf-heading overperforming">🔥 Most Underestimated</h3>
              <table class="perf-table">
                <thead><tr><th>Team</th><th>GP</th><th>xPts</th><th>Pts</th><th>Δ</th></tr></thead>
                <tbody>\${overperformers.map(teamPerfRow).join('')}</tbody>
              </table>
            </div>
            <div class="team-perf-section">
              <h3 class="perf-heading underperforming">📉 Most Overestimated</h3>
              <table class="perf-table">
                <thead><tr><th>Team</th><th>GP</th><th>xPts</th><th>Pts</th><th>Δ</th></tr></thead>
                <tbody>\${underperformers.map(teamPerfRow).join('')}</tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
      
      <details class="rps-explainer">
        <summary>How is this calculated?</summary>
        <div class="explainer-content">
          <h4>Surprise (bits)</h4>
          <p>Information content: <code>-log₂(P)</code> where P is the pre-match probability of the actual outcome. A 50% outcome = 1 bit. A 10% outcome = 3.3 bits. Higher = more surprising.</p>
          
          <h4>Ranked Probability Score (RPS)</h4>
          <p>Measures prediction quality respecting the ordinal nature of outcomes (Home Win ↔ Draw ↔ Away Win). Penalizes a prediction more if the actual result is further away from what was predicted.</p>
          <p><code>RPS = ½ × Σ(CDF_predicted - CDF_actual)²</code></p>
          <p>Range: 0 (perfect) to 1 (worst). Predicting 80% home win when the away team wins scores worse than when it's a draw.</p>
          
          <h4>Expected Points (xPts)</h4>
          <p><code>xPts = P(win) × 3 + P(draw) × 1</code> per match. Teams above their expected points are overperforming relative to pre-match bookmaker odds.</p>
        </div>
      </details>
    </div>
  \`;
}

// Methodology Explainer Page
function renderMethodology() {
  // Elo ratings with confederation mapping for colors
  const eloRatings = {
    'Spain': { elo: 2165, conf: 'uefa' },
    'Argentina': { elo: 2113, conf: 'conmebol' },
    'France': { elo: 2081, conf: 'uefa' },
    'England': { elo: 2020, conf: 'uefa' },
    'Brazil': { elo: 1984, conf: 'conmebol' },
    'Portugal': { elo: 1976, conf: 'uefa' },
    'Netherlands': { elo: 1963, conf: 'uefa' },
    'Belgium': { elo: 1944, conf: 'uefa' },
    'Germany': { elo: 1935, conf: 'uefa' },
    'Colombia': { elo: 1920, conf: 'conmebol' },
    'Uruguay': { elo: 1905, conf: 'conmebol' },
    'Croatia': { elo: 1895, conf: 'uefa' },
    'Morocco': { elo: 1878, conf: 'caf' },
    'Japan': { elo: 1860, conf: 'afc' },
    'USA': { elo: 1845, conf: 'concacaf' },
    'Senegal': { elo: 1835, conf: 'caf' },
    'Switzerland': { elo: 1830, conf: 'uefa' },
    'Mexico': { elo: 1825, conf: 'concacaf' },
    'Norway': { elo: 1818, conf: 'uefa' },
    'Austria': { elo: 1810, conf: 'uefa' },
    'Turkey': { elo: 1805, conf: 'uefa' },
    'Ecuador': { elo: 1798, conf: 'conmebol' },
    'Ivory Coast': { elo: 1790, conf: 'caf' },
    'Sweden': { elo: 1785, conf: 'uefa' },
    'Algeria': { elo: 1775, conf: 'caf' },
    'Egypt': { elo: 1765, conf: 'caf' },
    'Paraguay': { elo: 1755, conf: 'conmebol' },
    'Scotland': { elo: 1745, conf: 'uefa' },
    'Australia': { elo: 1735, conf: 'afc' },
    'Iran': { elo: 1725, conf: 'afc' },
    'Ghana': { elo: 1715, conf: 'caf' },
    'Canada': { elo: 1710, conf: 'concacaf' },
    'South Korea': { elo: 1705, conf: 'afc' },
    'Tunisia': { elo: 1695, conf: 'caf' },
    'Czechia': { elo: 1685, conf: 'uefa' },
    'DR Congo': { elo: 1670, conf: 'caf' },
    'Bosnia and Herzegovina': { elo: 1665, conf: 'uefa' },
    'Panama': { elo: 1640, conf: 'concacaf' },
    'Saudi Arabia': { elo: 1625, conf: 'afc' },
    'Qatar': { elo: 1610, conf: 'afc' },
    'South Africa': { elo: 1600, conf: 'caf' },
    'Iraq': { elo: 1590, conf: 'afc' },
    'Uzbekistan': { elo: 1575, conf: 'afc' },
    'Jordan': { elo: 1560, conf: 'afc' },
    'New Zealand': { elo: 1545, conf: 'ofc' },
    'Cape Verde': { elo: 1520, conf: 'caf' },
    'Haiti': { elo: 1495, conf: 'concacaf' },
    'Curaçao': { elo: 1450, conf: 'concacaf' }
  };
  
  const maxElo = 2165;
  const minElo = 1400; // For scaling
  
  // Build Elo bar chart HTML
  const sortedTeams = Object.entries(eloRatings)
    .sort((a, b) => b[1].elo - a[1].elo);
  
  const eloChartHtml = sortedTeams.map(([team, data]) => {
    const width = ((data.elo - minElo) / (maxElo - minElo)) * 100;
    const flag = flagEmojis[team] || '🏴';
    return \`<div class="elo-bar">
      <span class="team-name">\${flag} \${team}</span>
      <div class="bar conf-\${data.conf}" style="width:\${width}%"></div>
      <span class="rating">\${data.elo}</span>
    </div>\`;
  }).join('');
  
  // Build team options for calculator
  const teamOptions = sortedTeams.map(([team, data]) => 
    \`<option value="\${data.elo}">\${team} (\${data.elo})</option>\`
  ).join('');
  
  // Build comparison table from actual data
  const top10Teams = sortedTeams.slice(0, 10);
  const comparisonRows = top10Teams.map(([team]) => {
    const simProb = (data.stage_probabilities[team]?.win_tournament || 0) * 100;
    const bookieProb = (data.teams.find(t => t.name === team)?.bookmaker_win_probability || 0) * 100;
    const diff = simProb - bookieProb;
    const diffClass = diff > 0 ? 'diff-positive' : 'diff-negative';
    const diffStr = (diff >= 0 ? '+' : '') + diff.toFixed(1) + '%';
    return \`<tr>
      <td>\${flagEmojis[team] || '🏴'} \${team}</td>
      <td>\${bookieProb.toFixed(1)}%</td>
      <td>\${simProb.toFixed(1)}%</td>
      <td class="\${diffClass}">\${diffStr}</td>
    </tr>\`;
  }).join('');
  
  // Setup calculator interactivity
  setTimeout(() => {
    const teamA = document.getElementById('calc-team-a');
    const teamB = document.getElementById('calc-team-b');
    const result = document.getElementById('calc-result');
    
    function updateCalc() {
      if (!teamA || !teamB || !result) return;
      const eloA = parseInt(teamA.value);
      const eloB = parseInt(teamB.value);
      const teamAName = teamA.options[teamA.selectedIndex].text.split(' (')[0];
      const teamBName = teamB.options[teamB.selectedIndex].text.split(' (')[0];
      
      const prob = 1 / (1 + Math.pow(10, (eloB - eloA) / 400));
      const probPct = (prob * 100).toFixed(1);
      const oppPct = ((1 - prob) * 100).toFixed(1);
      
      result.innerHTML = \`
        <div class="result-text">
          Based on Elo ratings, <strong>\${teamAName}</strong> has a <strong>\${probPct}%</strong> chance 
          of beating <strong>\${teamBName}</strong> (who has \${oppPct}%).
        </div>
        <div class="formula">
          P(\${teamAName}) = 1 / (1 + 10^((\${eloB} - \${eloA}) / 400)) = \${probPct}%
        </div>
      \`;
    }
    
    if (teamA && teamB) {
      teamA.addEventListener('change', updateCalc);
      teamB.addEventListener('change', updateCalc);
      // Set default selections
      teamA.value = '2165'; // Spain
      teamB.value = '2113'; // Argentina  
      updateCalc();
    }
    
    // Tech details toggle
    const techToggle = document.getElementById('tech-toggle');
    const techContent = document.getElementById('tech-content');
    if (techToggle && techContent) {
      techToggle.addEventListener('click', () => {
        techContent.classList.toggle('visible');
        const arrow = techToggle.querySelector('.arrow');
        if (arrow) arrow.textContent = techContent.classList.contains('visible') ? '▼' : '▶';
      });
    }
  }, 100);
  
  return \`
    <div class="methodology-container">
      <div class="meth-hero">
        <h1>How We Forecast the World Cup</h1>
        <p class="subtitle">10,000 simulations, real bookmaker odds, and the Elo rating system</p>
      </div>
      
      <div class="meth-section">
        <h2><span class="icon">🎯</span> The Big Picture</h2>
        <p>
          We simulate the entire 2026 World Cup <strong>10,000 times</strong>. Each simulation plays out 
          every match from the group stage through the final, using real bookmaker odds and team 
          strength ratings. After all simulations complete, we count how often each team reaches 
          each stage—that's their probability.
        </p>
        <p>
          <strong>Key insight:</strong> Your path through the bracket matters as much as your strength. 
          A strong team with an easy draw has better odds than an equally strong team facing 
          powerhouses in the early rounds.
        </p>
      </div>
      
      <div class="meth-section">
        <h2><span class="icon">📊</span> Our Data Sources</h2>
        <div class="data-sources">
          <div class="data-source-card">
            <div class="icon">🎰</div>
            <h4>Bookmaker Odds</h4>
            <p>Real-time match odds from UK bookmakers via The Odds API. Updated every 6 hours.</p>
          </div>
          <div class="data-source-card">
            <div class="icon">⚡</div>
            <h4>Elo Ratings</h4>
            <p>Team strength ratings from eloratings.net—a chess-inspired system for football.</p>
          </div>
          <div class="data-source-card">
            <div class="icon">⚽</div>
            <h4>Match Results</h4>
            <p>Actual scores from completed matches lock in with 100% certainty.</p>
          </div>
        </div>
      </div>
      
      <div class="meth-section">
        <h2><span class="icon">🔀</span> How We Simulate Each Match</h2>
        <p>For every match in every simulation, we follow this priority cascade:</p>
        
        <div class="cascade-flow">
          <div class="cascade-step yes">
            <strong>1.</strong>&nbsp; Has this match been played? → <strong>Use actual result (100% certain)</strong>
          </div>
          <div class="cascade-arrow">↓ No</div>
          <div class="cascade-step yes">
            <strong>2.</strong>&nbsp; Do we have bookmaker odds? → <strong>Use those probabilities</strong>
          </div>
          <div class="cascade-arrow">↓ No</div>
          <div class="cascade-step fallback">
            <strong>3.</strong>&nbsp; Fall back to <strong>Elo ratings</strong> → Calculate probability from team strengths
          </div>
        </div>
        
        <h3>Group Stage</h3>
        <p>
          Bookmaker odds give us win/draw/loss probabilities. We then generate realistic scorelines 
          using the <strong>Poisson distribution</strong>—a statistical model that captures how goals 
          are scored in football. This matters because goal difference affects third-place tiebreakers.
        </p>
        
        <h3>Knockout Stage</h3>
        <p>
          No draws—there must be a winner. If the match hasn't been scheduled yet (Round of 16 onwards), 
          we calculate win probability directly from Elo ratings.
        </p>
      </div>
      
      <div class="meth-section">
        <h2><span class="icon">📈</span> What is Elo?</h2>
        <div class="elo-box">
          <blockquote>
            Elo is a rating system invented in 1960 for chess and now used worldwide for football. 
            Each team has a number (higher = stronger). When teams play, the winner gains points 
            and the loser drops—more points change hands for upsets.
          </blockquote>
          <div class="elo-facts">
            <div class="elo-fact"><span class="bullet">•</span> Average team rating: ~1500</div>
            <div class="elo-fact"><span class="bullet">•</span> Spain (current #1): 2165</div>
            <div class="elo-fact"><span class="bullet">•</span> 400-point gap ≈ 91% win probability</div>
            <div class="elo-fact"><span class="bullet">•</span> Every match updates ratings</div>
          </div>
        </div>
        
        <h3>All 48 Teams by Elo Rating</h3>
        <div class="elo-chart-container">
          \${eloChartHtml}
        </div>
        <p style="font-size:12px;color:#666;margin-top:12px;">
          Colors: <span style="color:#3498db">■</span> UEFA&nbsp;&nbsp;
          <span style="color:#f1c40f">■</span> CONMEBOL&nbsp;&nbsp;
          <span style="color:#2ecc71">■</span> CONCACAF&nbsp;&nbsp;
          <span style="color:#e74c3c">■</span> CAF&nbsp;&nbsp;
          <span style="color:#9b59b6">■</span> AFC&nbsp;&nbsp;
          <span style="color:#1abc9c">■</span> OFC
        </p>
        
        <div class="prob-calculator">
          <h4>🧮 Win Probability Calculator</h4>
          <div class="calc-inputs">
            <select id="calc-team-a">\${teamOptions}</select>
            <span class="vs">vs</span>
            <select id="calc-team-b">\${teamOptions}</select>
          </div>
          <div class="calc-result" id="calc-result">
            Select two teams to see win probability
          </div>
        </div>
      </div>
      
      <div class="meth-section">
        <h2><span class="icon">🏆</span> The 2026 Tournament Format</h2>
        <div class="tournament-structure">
          <div class="stage-row">
            <span class="stage-name">Group Stage</span>
            <span class="stage-desc">12 groups of 4 teams, each plays 3 matches</span>
            <span class="stage-teams">48</span>
          </div>
          <div class="stage-row">
            <span class="stage-name">Qualify</span>
            <span class="stage-desc">Top 2 per group (24) + 8 best third-place teams</span>
            <span class="stage-teams">32</span>
          </div>
          <div class="stage-row">
            <span class="stage-name">Round of 32</span>
            <span class="stage-desc">16 matches (new stage for 2026!)</span>
            <span class="stage-teams">32 → 16</span>
          </div>
          <div class="stage-row">
            <span class="stage-name">Round of 16</span>
            <span class="stage-desc">8 matches</span>
            <span class="stage-teams">16 → 8</span>
          </div>
          <div class="stage-row">
            <span class="stage-name">Quarter-finals</span>
            <span class="stage-desc">4 matches</span>
            <span class="stage-teams">8 → 4</span>
          </div>
          <div class="stage-row">
            <span class="stage-name">Semi-finals</span>
            <span class="stage-desc">2 matches</span>
            <span class="stage-teams">4 → 2</span>
          </div>
          <div class="stage-row">
            <span class="stage-name">Final</span>
            <span class="stage-desc">The big one</span>
            <span class="stage-teams">2 → 1</span>
          </div>
        </div>
        <p style="margin-top:16px;font-size:14px;color:#666;">
          This is the first World Cup with 48 teams. Third-place teams are assigned to specific 
          bracket slots based on which groups they came from—our simulation handles all 495 possible combinations.
        </p>
      </div>
      
      <div class="meth-section">
        <h2><span class="icon">🎯</span> Why Our Numbers Differ from Bookmakers</h2>
        <div class="bracket-callout">
          <h4>⚠️ The Bracket Effect</h4>
          <p>
            Bookmakers give you "outright winner" odds—a single number for each team. But winning 
            the World Cup requires <strong>a specific path</strong> through the bracket. Our simulation 
            captures this crucial detail.
          </p>
          <p>
            <strong>Example:</strong> Spain and Argentina are both top contenders. But if both win 
            their groups, they meet in the Round of 16! The survivor then gets an easier path 
            (avoiding France/England until the Final). Our simulation accounts for these collision 
            courses; bookmaker odds average across all possible brackets.
          </p>
        </div>
        
        <h3>Validation: Simulated vs Bookmaker Odds</h3>
        <table class="comparison-table">
          <thead>
            <tr>
              <th>Team</th>
              <th>Bookmaker</th>
              <th>Simulated</th>
              <th>Difference</th>
            </tr>
          </thead>
          <tbody>
            \${comparisonRows}
          </tbody>
        </table>
        <p style="font-size:13px;color:#666;margin-top:12px;">
          Large positive differences typically indicate favorable bracket positions. The simulation 
          isn't wrong—it's capturing information the flat odds don't show.
        </p>
      </div>
      
      <div class="meth-section">
        <h2><span class="icon">🛠️</span> Technical Details</h2>
        <p>For the curious, here's what's under the hood:</p>
        
        <div class="tech-details">
          <div class="tech-toggle" id="tech-toggle">
            <span class="arrow">▶</span> Show technical implementation
          </div>
          <div class="tech-content" id="tech-content">
            <p><strong>Monte Carlo Simulation:</strong> 10,000 iterations per data refresh</p>
            <p><strong>Elo Win Probability:</strong><br>
              <code>P(A) = 1 / (1 + 10^((eloB - eloA) / 400))</code>
            </p>
            <p><strong>Poisson Scoreline:</strong><br>
              <code>Expected goals = 1.15 ± (eloDiff / 800)</code><br>
              Where 1.15 is the historical World Cup average per team.
            </p>
            <p><strong>Third-place Assignment:</strong><br>
              Uses backtracking algorithm to assign 8 best third-place teams to correct R32 slots 
              based on FIFA rules (495 possible group combinations).
            </p>
            <p><strong>Data Refresh:</strong> Every 6 hours via GitHub Actions</p>
            <p><strong>Source Code:</strong> <a href="https://github.com/jhkidd/world-cup-2026-sweepstake" target="_blank">GitHub Repository</a></p>
          </div>
        </div>
      </div>
      
      <div class="meth-footer">
        <a href="#standings">← Back to Standings</a>
      </div>
    </div>
  \`;
}

// Teams List Page - alphabetical grid of all 48 teams
function renderTeamsList() {
  const teams = data.teams.slice().sort((a, b) => a.name.localeCompare(b.name));
  
  const teamCards = teams.map(team => {
    const slug = team.name.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return \`
      <a href="#teams/\${slug}" class="team-card" onclick="event.preventDefault(); window.location.hash='#teams/\${slug}';">
        <span class="team-card-flag">\${getFlag(team.name)}</span>
        <span class="team-card-name">\${team.name}</span>
      </a>
    \`;
  }).join('');
  
  return \`
    <div class="teams-list-container">
      <h2 class="section-title">All Teams</h2>
      <p class="section-subtitle">Click a team to view details</p>
      <div class="teams-grid">
        \${teamCards}
      </div>
    </div>
  \`;
}

// Team Detail Page
function renderTeamDetail(slug) {
  // Find team by slug
  const team = data.teams.find(t => {
    const teamSlug = t.name.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    return teamSlug === slug;
  });
  
  if (!team) {
    return \`
      <div class="team-not-found">
        <h2>Team not found</h2>
        <p>Could not find team: \${slug}</p>
        <a href="#teams">← Back to all teams</a>
      </div>
    \`;
  }
  
  // Get team details from team_details if available
  const details = data.team_details?.[team.name] || {};
  
  // Get stage probabilities for this team (Monte Carlo results)
  const stageProbs = data.stage_probabilities?.[team.name] || {};
  
  // Find team's matches across all matchdays
  const teamMatches = [];
  const matchdays = data.matchdays || {};
  [matchdays.matchday1, matchdays.matchday2, matchdays.matchday3].forEach((matchday, idx) => {
    if (!matchday) return;
    matchday.forEach(match => {
      if (match.home_team === team.name || match.away_team === team.name) {
        teamMatches.push({ ...match, matchday: idx + 1 });
      }
    });
  });
  
  // Build group standings for this team's group
  const groupTeams = data.teams.filter(t => t.group === team.group)
    .sort((a, b) => (b.win_probability || 0) - (a.win_probability || 0));
  
  // Calculate points for group standings
  const pointsMap = {};
  const gamesPlayedMap = {};
  const winsMap = {};
  const drawsMap = {};
  const lossesMap = {};
  const goalsScoredMap = {};
  const goalsConcededMap = {};
  
  groupTeams.forEach(t => {
    pointsMap[t.name] = 0;
    gamesPlayedMap[t.name] = 0;
    winsMap[t.name] = 0;
    drawsMap[t.name] = 0;
    lossesMap[t.name] = 0;
    goalsScoredMap[t.name] = 0;
    goalsConcededMap[t.name] = 0;
  });
  
  [matchdays.matchday1, matchdays.matchday2, matchdays.matchday3].forEach(matchday => {
    if (!matchday) return;
    matchday.forEach(match => {
      if (match.actual_result && match.group === team.group) {
        const homeTeam = match.home_team;
        const awayTeam = match.away_team;
        const homeGoals = match.actual_result.home_score;
        const awayGoals = match.actual_result.away_score;
        
        gamesPlayedMap[homeTeam] = (gamesPlayedMap[homeTeam] || 0) + 1;
        gamesPlayedMap[awayTeam] = (gamesPlayedMap[awayTeam] || 0) + 1;
        goalsScoredMap[homeTeam] = (goalsScoredMap[homeTeam] || 0) + homeGoals;
        goalsScoredMap[awayTeam] = (goalsScoredMap[awayTeam] || 0) + awayGoals;
        goalsConcededMap[homeTeam] = (goalsConcededMap[homeTeam] || 0) + awayGoals;
        goalsConcededMap[awayTeam] = (goalsConcededMap[awayTeam] || 0) + homeGoals;
        
        if (homeGoals > awayGoals) {
          pointsMap[homeTeam] = (pointsMap[homeTeam] || 0) + 3;
          winsMap[homeTeam] = (winsMap[homeTeam] || 0) + 1;
          lossesMap[awayTeam] = (lossesMap[awayTeam] || 0) + 1;
        } else if (awayGoals > homeGoals) {
          pointsMap[awayTeam] = (pointsMap[awayTeam] || 0) + 3;
          winsMap[awayTeam] = (winsMap[awayTeam] || 0) + 1;
          lossesMap[homeTeam] = (lossesMap[homeTeam] || 0) + 1;
        } else {
          pointsMap[homeTeam] = (pointsMap[homeTeam] || 0) + 1;
          pointsMap[awayTeam] = (pointsMap[awayTeam] || 0) + 1;
          drawsMap[homeTeam] = (drawsMap[homeTeam] || 0) + 1;
          drawsMap[awayTeam] = (drawsMap[awayTeam] || 0) + 1;
        }
      }
    });
  });
  
  // Sort group by points, then goal difference
  const sortedGroupTeams = groupTeams.sort((a, b) => {
    const ptsA = pointsMap[a.name] || 0;
    const ptsB = pointsMap[b.name] || 0;
    if (ptsB !== ptsA) return ptsB - ptsA;
    const gdA = (goalsScoredMap[a.name] || 0) - (goalsConcededMap[a.name] || 0);
    const gdB = (goalsScoredMap[b.name] || 0) - (goalsConcededMap[b.name] || 0);
    return gdB - gdA;
  });
  
  // Render group standings table
  const groupStandingsRows = sortedGroupTeams.map((t, idx) => {
    const isCurrentTeam = t.name === team.name;
    const pts = pointsMap[t.name] || 0;
    const p = gamesPlayedMap[t.name] || 0;
    const w = winsMap[t.name] || 0;
    const d = drawsMap[t.name] || 0;
    const l = lossesMap[t.name] || 0;
    const gf = goalsScoredMap[t.name] || 0;
    const ga = goalsConcededMap[t.name] || 0;
    const gd = gf - ga;
    const gdStr = gd > 0 ? '+' + gd : gd.toString();
    const slug = t.name.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    return \`
      <tr class="\${isCurrentTeam ? 'current-team' : ''}" onclick="window.location.hash='#teams/\${slug}'" style="cursor:pointer;">
        <td>\${idx + 1}</td>
        <td class="team-cell">\${getFlag(t.name)} \${t.name}</td>
        <td class="center">\${p}</td>
        <td class="center">\${w}</td>
        <td class="center">\${d}</td>
        <td class="center">\${l}</td>
        <td class="center">\${gdStr}</td>
        <td class="center" style="font-weight:700;">\${pts}</td>
      </tr>
    \`;
  }).join('');
  
  // Render matches using same structure as Matches page
  const matchesHtml = teamMatches.map(match => {
    const homeFlag = getFlag(match.home_team);
    const awayFlag = getFlag(match.away_team);
    const isHome = match.home_team === team.name;
    const opponent = isHome ? match.away_team : match.home_team;
    const opponentSlug = opponent.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '');
    
    if (match.actual_result) {
      // Completed match
      const homeScore = match.actual_result.home_score || match.actual_result.home || 0;
      const awayScore = match.actual_result.away_score || match.actual_result.away || 0;
      let barClass, resultText;
      
      if (homeScore > awayScore) {
        barClass = 'home-win';
        resultText = \`\${match.home_team} won \${homeScore}-\${awayScore}\`;
      } else if (awayScore > homeScore) {
        barClass = 'away-win';
        resultText = \`\${match.away_team} won \${awayScore}-\${homeScore}\`;
      } else {
        barClass = 'draw-result';
        resultText = \`Draw \${homeScore}-\${awayScore}\`;
      }
      
      return \`
        <div class="match-row completed">
          <div class="match-home">
            <span class="matchday-label">MD\${match.matchday}</span>
            <a href="#teams/\${match.home_team.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')}" class="team-name team-link">\${match.home_team}</a>
            <span class="team-flag">\${homeFlag}</span>
          </div>
          <div class="match-bar">
            <div class="result-bar \${barClass}">
              <span class="result-text">\${resultText}</span>
            </div>
          </div>
          <div class="match-away">
            <span class="team-flag">\${awayFlag}</span>
            <a href="#teams/\${match.away_team.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')}" class="team-name team-link">\${match.away_team}</a>
          </div>
        </div>
      \`;
    } else {
      // Upcoming match - show odds (same as Matches page)
      const homeWin = ((match.home_win_prob || 0) * 100).toFixed(0);
      const draw = ((match.draw_prob || 0) * 100).toFixed(0);
      const awayWin = ((match.away_win_prob || 0) * 100).toFixed(0);
      
      return \`
        <div class="match-row">
          <div class="match-home">
            <span class="matchday-label">MD\${match.matchday}</span>
            <a href="#teams/\${match.home_team.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')}" class="team-name team-link">\${match.home_team}</a>
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
            <a href="#teams/\${match.away_team.toLowerCase().replace(/\\s+/g, '-').replace(/[^a-z0-9-]/g, '')}" class="team-name team-link">\${match.away_team}</a>
          </div>
        </div>
      \`;
    }
  }).join('');
  
  // Squad section (placeholder until we have API data)
  // Helper to calculate age from DOB
  const calculateAge = (dob) => {
    if (!dob) return '-';
    const birthDate = new Date(dob);
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  };

  // Nationality to flag emoji mapping (extends shared flags with non-WC nations for player nationalities)
  const nationalityFlags = ${JSON.stringify({
    ...FLAG_EMOJIS,
    'Italy': '🇮🇹', 'Cameroon': '🇨🇲', 'Nigeria': '🇳🇬', 'Poland': '🇵🇱', 'Denmark': '🇩🇰',
    'Wales': '🏴󠁧󠁢󠁷󠁬󠁳󠁿', 'Ireland': '🇮🇪', 'Serbia': '🇷🇸', 'Czech Republic': '🇨🇿',
    'Greece': '🇬🇷', 'Russia': '🇷🇺', 'Ukraine': '🇺🇦', 'Romania': '🇷🇴', 'Hungary': '🇭🇺',
    'Slovakia': '🇸🇰', 'Slovenia': '🇸🇮', 'Montenegro': '🇲🇪',
    'North Macedonia': '🇲🇰', 'Albania': '🇦🇱', 'Kosovo': '🇽🇰', 'Finland': '🇫🇮', 'Iceland': '🇮🇸',
    'Chile': '🇨🇱', 'Peru': '🇵🇪', 'Venezuela': '🇻🇪',
    'Bolivia': '🇧🇴', 'Costa Rica': '🇨🇷', 'Honduras': '🇭🇳',
    'Jamaica': '🇯🇲', 'Trinidad and Tobago': '🇹🇹',
    'United Arab Emirates': '🇦🇪', 'China': '🇨🇳', 'Thailand': '🇹🇭',
    'Vietnam': '🇻🇳', 'Indonesia': '🇮🇩', 'Malaysia': '🇲🇾',
    'Mali': '🇲🇱', 'Burkina Faso': '🇧🇫', 'Guinea': '🇬🇳', 'Gabon': '🇬🇦',
    'Congo': '🇨🇬', 'Angola': '🇦🇴', 'Zambia': '🇿🇲', 'Zimbabwe': '🇿🇼'
  })};
  const getNationalityFlag = (nat) => nationalityFlags[nat] || '🌍';

  const squadHtml = details.squad && details.squad.length > 0 ? \`
    <div class="team-section squad-section">
      <h3 class="section-header">Squad</h3>
      <table class="squad-table">
        <thead>
          <tr>
            <th class="photo-col"></th>
            <th>Player</th>
            <th>Position</th>
            <th>Club</th>
            <th class="center">Height</th>
            <th class="center">Weight</th>
            <th class="center">Foot</th>
            <th>Birthplace</th>
            <th class="center">Age</th>
          </tr>
        </thead>
        <tbody>
          \${details.squad.map((player, idx) => {
            const photoFile = playerPhotoMapping[player.name];
            const stats = playerStats[player.name] || {};
            const photoContent = photoFile 
              ? \`<img src="player_photos/\${photoFile}" alt="\${player.name}">\`
              : \`<span class="player-initials">\${player.name.split(' ').map(n => n[0]).join('').slice(0,2)}</span>\`;
            const hasBio = stats.bio && stats.bio.length > 0;
            const playerId = \`player-\${idx}\`;
            const foot = stats.preferredFoot ? stats.preferredFoot.charAt(0).toUpperCase() : '-';
            return \`
            <tr class="player-row\${hasBio ? ' has-bio' : ''}" \${hasBio ? \`onclick="togglePlayerBio('\${playerId}')"\` : ''}>
              <td class="player-photo-cell">
                <div class="player-photo">
                  \${photoContent}
                </div>
              </td>
              <td class="player-name-cell">
                \${player.name}
                \${hasBio ? '<span class="bio-indicator">ℹ️</span>' : ''}
              </td>
              <td class="position-cell">\${player.position || '-'}</td>
              <td class="club-cell">\${stats.club || '-'}</td>
              <td class="center">\${stats.height ? stats.height.split(' ')[0] : '-'}</td>
              <td class="center">\${stats.weight ? stats.weight.replace(' lbs', '').replace(' kg', '') : '-'}</td>
              <td class="center">\${foot}</td>
              <td class="birthplace-cell">\${stats.birthLocation || '-'}</td>
              <td class="center">\${calculateAge(player.date_of_birth)}</td>
            </tr>
            \${hasBio ? \`<tr class="player-bio-row" id="\${playerId}">
              <td colspan="9">
                <div class="player-bio-content">
                  <p>\${stats.bio.replace(/\\r\\n/g, '</p><p>')}</p>
                </div>
              </td>
            </tr>\` : ''}
          \`;}).join('')}
        </tbody>
      </table>
    </div>
  \` : \`
    <div class="team-section">
      <h3 class="section-header">Squad</h3>
      <p class="placeholder-text">Squad information will be available once team data is fetched.</p>
    </div>
  \`;
  
  // Use Monte Carlo win_tournament probability (same as standings page)
  const winProbPct = ((stageProbs.win_tournament || 0) * 100).toFixed(1);
  
  // Get team metadata
  const meta = teamMetadata[team.name] || {};
  const badgeHtml = meta.badge 
    ? \`<img src="team_badges/\${meta.badge}" alt="\${team.name}" class="team-hero-badge">\`
    : \`<span class="team-hero-flag">\${getFlag(team.name)}</span>\`;
  const nicknameHtml = meta.nickname 
    ? \`<div class="team-hero-nickname">"\${meta.nickname}"</div>\`
    : '';
  const kitHtml = meta.kit
    ? \`<img src="team_kits/\${meta.kit}" alt="\${team.name} kit" class="team-hero-kit">\`
    : '';
  const aboutHtml = meta.description
    ? \`<div class="team-about">
        <div class="team-about-title">About \${team.name}</div>
        <div class="team-about-text" id="about-text">\${meta.description}</div>
        <span class="team-about-toggle" onclick="toggleAbout()">Read more</span>
      </div>\`
    : '';
  
  return \`
    <div class="team-detail-container">
      <a href="#teams" class="back-link">← All Teams</a>
      
      <div class="team-hero">
        <div class="team-hero-main">
          \${badgeHtml}
          <div class="team-hero-info">
            <h1 class="team-hero-name">\${team.name}</h1>
            \${nicknameHtml}
            <div class="team-hero-meta">Group \${team.group} • \${team.confederation}</div>
          </div>
          <div class="team-hero-stats">
            <div class="hero-stat">
              <div class="hero-stat-value">\${winProbPct}%</div>
              <div class="hero-stat-label">Win Probability</div>
            </div>
          </div>
        </div>
        \${kitHtml}
        <div class="team-hero-owner">
          \${team.owner ? \`
            <span class="owner-label">Owned by</span>
            <span class="owner-name">\${team.owner}</span>
          \` : \`
            <span class="owner-label">Unowned</span>
          \`}
        </div>
      </div>
      
      \${aboutHtml}
      <div class="team-content-grid">
        <div class="team-section">
          <h3 class="section-header">Group \${team.group} Standings</h3>
          <table class="group-standings-table">
            <thead>
              <tr>
                <th></th>
                <th>Team</th>
                <th class="center">P</th>
                <th class="center">W</th>
                <th class="center">D</th>
                <th class="center">L</th>
                <th class="center">GD</th>
                <th class="center">Pts</th>
              </tr>
            </thead>
            <tbody>
              \${groupStandingsRows}
            </tbody>
          </table>
        </div>
        
        <div class="team-section">
          <h3 class="section-header">Matches</h3>
          <div class="team-matches">
            \${matchesHtml || '<p class="placeholder-text">No matches scheduled yet.</p>'}
          </div>
        </div>
      </div>
      
      \${squadHtml}
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
    } else if (view === 'teams') {
      a.classList.toggle('active', href === '#teams');
    } else {
      a.classList.toggle('active', href === '#' + view);
    }
  });
  
  // Update secondary nav active states
  document.querySelectorAll('.nav-secondary .nav-tabs a').forEach(a => {
    const href = a.getAttribute('href');
    const matchday = param || 'knockout';
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
      if (param === 'knockout') {
        main.innerHTML = renderKnockoutMatches();
      } else {
        main.innerHTML = renderMatches(parseInt(param) || 1);
      }
      break;
    case 'knockout':
      main.innerHTML = '<div class="loading">Loading bracket data...</div>';
      loadAndRenderBracket();
      break;
    case 'teams':
      if (param) {
        main.innerHTML = renderTeamDetail(param);
      } else {
        main.innerHTML = renderTeamsList();
      }
      break;
    case 'timeline':
      main.innerHTML = renderTimeline();
      break;
    case 'predictions':
      main.innerHTML = renderPredictions();
      break;
    case 'methodology':
      main.innerHTML = renderMethodology();
      break;
    default:
      window.location.hash = '#standings';
  }
}

// ============================================================
// KNOCKOUT BRACKET
// ============================================================

let bracketData = null;
let lockedResults = {}; // { matchId: winnerTeamIndex }

async function loadAndRenderBracket() {
  const main = document.querySelector('.main');
  
  if (!bracketData) {
    try {
      const resp = await fetch('data/bracket.json', { cache: 'no-store' });
      bracketData = await resp.json();
      // Pre-populate locked results from actual completed matches
      if (bracketData.actualResults) {
        for (const [matchId, result] of Object.entries(bracketData.actualResults)) {
          lockedResults[matchId] = result.winnerIdx;
        }
      }
    } catch (e) {
      main.innerHTML = '<div class="card"><div class="card-title">Bracket data not available</div><p>Run npm run process to generate bracket data.</p></div>';
      return;
    }
  }
  
  main.innerHTML = renderBracket();
  attachBracketListeners();
}

function getFilteredRuns() {
  if (!bracketData) return [];
  if (Object.keys(lockedResults).length === 0) return bracketData.runs;
  
  return bracketData.runs.filter(run => {
    for (const [matchId, winnerIdx] of Object.entries(lockedResults)) {
      const pos = getWinnerPosition(matchId);
      if (pos === -1) continue;
      if (run[pos] !== winnerIdx) return false;
    }
    return true;
  });
}

// Map match ID to position in the 63-element run array
function getWinnerPosition(matchId) {
  const r32Order = ['R32-1','R32-2','R32-3','R32-4','R32-5','R32-6','R32-7','R32-8',
                    'R32-9','R32-10','R32-11','R32-12','R32-13','R32-14','R32-15','R32-16'];
  const r16Order = ['R16-1','R16-2','R16-3','R16-4','R16-5','R16-6','R16-7','R16-8'];
  const qfOrder = ['QF-1','QF-2','QF-3','QF-4'];
  const sfOrder = ['SF-1','SF-2'];
  
  let idx = r32Order.indexOf(matchId);
  if (idx !== -1) return 32 + idx;
  
  idx = r16Order.indexOf(matchId);
  if (idx !== -1) return 48 + idx;
  
  idx = qfOrder.indexOf(matchId);
  if (idx !== -1) return 56 + idx;
  
  idx = sfOrder.indexOf(matchId);
  if (idx !== -1) return 60 + idx;
  
  if (matchId === 'F') return 62;
  return -1;
}

// Get the two participant positions for a match
function getParticipantPositions(matchId) {
  const r32Order = ['R32-1','R32-2','R32-3','R32-4','R32-5','R32-6','R32-7','R32-8',
                    'R32-9','R32-10','R32-11','R32-12','R32-13','R32-14','R32-15','R32-16'];
  const idx = r32Order.indexOf(matchId);
  if (idx !== -1) return [idx * 2, idx * 2 + 1];
  
  const topology = bracketData.bracketTopology;
  
  const r16Match = topology.r16.find(m => m.id === matchId);
  if (r16Match) return r16Match.feeds.map(f => getWinnerPosition(f));
  
  const qfMatch = topology.qf.find(m => m.id === matchId);
  if (qfMatch) return qfMatch.feeds.map(f => getWinnerPosition(f));
  
  const sfMatch = topology.sf.find(m => m.id === matchId);
  if (sfMatch) return sfMatch.feeds.map(f => getWinnerPosition(f));
  
  const finalMatch = topology.final.find(m => m.id === matchId);
  if (finalMatch) return finalMatch.feeds.map(f => getWinnerPosition(f));
  
  return [-1, -1];
}

function computeBracketProbabilities(runs) {
  if (!runs.length) return {};
  const probs = {};
  const total = runs.length;
  
  const allMatchIds = [
    ...['R32-1','R32-2','R32-3','R32-4','R32-5','R32-6','R32-7','R32-8',
        'R32-9','R32-10','R32-11','R32-12','R32-13','R32-14','R32-15','R32-16'],
    ...['R16-1','R16-2','R16-3','R16-4','R16-5','R16-6','R16-7','R16-8'],
    ...['QF-1','QF-2','QF-3','QF-4'],
    ...['SF-1','SF-2'],
    'F'
  ];
  
  for (const matchId of allMatchIds) {
    const winPos = getWinnerPosition(matchId);
    const [p1Pos, p2Pos] = getParticipantPositions(matchId);
    
    const teamCounts = {};
    const winnerCounts = {};
    const matchupCounts = {};
    
    for (const run of runs) {
      const t1 = run[p1Pos];
      const t2 = run[p2Pos];
      const winner = run[winPos];
      
      if (t1 >= 0) teamCounts[t1] = (teamCounts[t1] || 0) + 1;
      if (t2 >= 0) teamCounts[t2] = (teamCounts[t2] || 0) + 1;
      if (winner >= 0) winnerCounts[winner] = (winnerCounts[winner] || 0) + 1;
      if (t1 >= 0 && t2 >= 0) {
        const key = Math.min(t1,t2) + '-' + Math.max(t1,t2);
        matchupCounts[key] = (matchupCounts[key] || 0) + 1;
      }
    }
    
    let mostCommonMatchup = null;
    let maxMatchupCount = 0;
    for (const [key, count] of Object.entries(matchupCounts)) {
      if (count > maxMatchupCount) {
        maxMatchupCount = count;
        mostCommonMatchup = key.split('-').map(Number);
      }
    }
    
    let mostLikelyWinner = null;
    let maxWinCount = 0;
    for (const [team, count] of Object.entries(winnerCounts)) {
      if (count > maxWinCount) {
        maxWinCount = count;
        mostLikelyWinner = parseInt(team);
      }
    }
    
    // For normalized probabilities: count runs where each team in the most common 
    // matchup actually participates, so we can show conditional win probability
    let matchupRunCount = maxMatchupCount; // runs where the most common matchup occurs
    
    probs[matchId] = {
      teamCounts,
      winnerCounts,
      total,
      mostCommonMatchup,
      matchupFreq: maxMatchupCount / total,
      matchupRunCount,
      mostLikelyWinner,
      winnerProb: maxWinCount / total
    };
  }
  
  return probs;
}

function getTeamName(idx) {
  return bracketData.indexToTeam[idx] || 'TBD';
}

function getShortTeamName(idx) {
  const name = getTeamName(idx);
  const shortNames = {
    'Bosnia and Herzegovina': 'Bosnia',
    'Netherlands': 'Netherlands',
    'South Korea': 'S. Korea',
    'Ivory Coast': 'Ivory Coast',
    'New Zealand': 'New Zealand',
    'Saudi Arabia': 'Saudi Arabia',
    'South Africa': 'S. Africa',
    'DR Congo': 'DR Congo'
  };
  return shortNames[name] || name;
}

function getTeamBadgeHtml(teamIdx) {
  if (teamIdx < 0) return '<span class="team-flag">❓</span>';
  const name = getTeamName(teamIdx);
  const meta = teamMetadata[name] || {};
  if (meta.badge) {
    return \`<img src="team_badges/\${meta.badge}" alt="\${name}" class="team-badge-small">\`;
  }
  return \`<span class="team-flag">\${getFlag(name)}</span>\`;
}

function renderBracketMatch(matchId, probs, isLeft, filteredRuns) {
  const matchProb = probs[matchId];
  if (!matchProb) return '<div class="bracket-match ghosted"><div class="bracket-match-team"><span class="team-name">TBD</span></div><div class="bracket-match-team"><span class="team-name">TBD</span></div></div>';
  
  const { mostLikelyWinner, winnerCounts, matchupRunCount, total, teamCounts } = matchProb;
  const isLocked = lockedResults[matchId] !== undefined;
  const lockedWinner = lockedResults[matchId];
  
  const r32Order = ['R32-1','R32-2','R32-3','R32-4','R32-5','R32-6','R32-7','R32-8',
                    'R32-9','R32-10','R32-11','R32-12','R32-13','R32-14','R32-15','R32-16'];
  const isR32 = r32Order.includes(matchId);
  
  // Determine displayed teams by finding the most common team in each POSITION independently
  const [p1Pos, p2Pos] = getParticipantPositions(matchId);
  let team1Idx = -1;
  let team2Idx = -1;
  
  if (isR32) {
    const p1Counts = {};
    const p2Counts = {};
    for (const run of filteredRuns) {
      const t1 = run[p1Pos];
      const t2 = run[p2Pos];
      if (t1 >= 0) p1Counts[t1] = (p1Counts[t1] || 0) + 1;
      if (t2 >= 0) p2Counts[t2] = (p2Counts[t2] || 0) + 1;
    }
    team1Idx = Object.entries(p1Counts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? -1;
    team2Idx = Object.entries(p2Counts).sort((a,b) => b[1]-a[1])[0]?.[0] ?? -1;
    team1Idx = parseInt(team1Idx);
    team2Idx = parseInt(team2Idx);
  } else {
    const topology = bracketData.bracketTopology;
    let feeds = null;
    for (const round of [topology.r16, topology.qf, topology.sf, topology.final]) {
      const m = round.find(x => x.id === matchId);
      if (m) { feeds = m.feeds; break; }
    }
    
    if (feeds) {
      const feed1Locked = lockedResults[feeds[0]];
      const feed2Locked = lockedResults[feeds[1]];
      
      if (feed1Locked !== undefined) {
        team1Idx = feed1Locked;
      } else {
        const pos = getWinnerPosition(feeds[0]);
        const counts = {};
        for (const run of filteredRuns) {
          const t = run[pos];
          if (t >= 0) counts[t] = (counts[t] || 0) + 1;
        }
        const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
        team1Idx = top ? parseInt(top[0]) : -1;
      }
      
      if (feed2Locked !== undefined) {
        team2Idx = feed2Locked;
      } else {
        const pos = getWinnerPosition(feeds[1]);
        const counts = {};
        for (const run of filteredRuns) {
          const t = run[pos];
          if (t >= 0) counts[t] = (counts[t] || 0) + 1;
        }
        const top = Object.entries(counts).sort((a,b) => b[1]-a[1])[0];
        team2Idx = top ? parseInt(top[0]) : -1;
      }
    }
  }
  
  // Check if this match has an actual result
  const actualResult = bracketData.actualResults?.[matchId];
  if (actualResult) {
    // Completed match — show score, non-interactive
    const team1IsHome = team1Idx === actualResult.homeIdx;
    const t1Score = team1IsHome ? actualResult.homeScore : actualResult.awayScore;
    const t2Score = team1IsHome ? actualResult.awayScore : actualResult.homeScore;
    const t1Pens = team1IsHome ? actualResult.homePenalties : actualResult.awayPenalties;
    const t2Pens = team1IsHome ? actualResult.awayPenalties : actualResult.homePenalties;
    const t1IsWinner = actualResult.winnerIdx === team1Idx;
    const t2IsWinner = actualResult.winnerIdx === team2Idx;
    const penText1 = t1Pens !== null ? \` <span class="penalty-score">(\${t1Pens})</span>\` : '';
    const penText2 = t2Pens !== null ? \` <span class="penalty-score">(\${t2Pens})</span>\` : '';

    return \`<div class="bracket-match completed-match" data-match-id="\${matchId}" data-team1="\${team1Idx}" data-team2="\${team2Idx}" data-completed="true">
      <div class="bracket-match-team \${t1IsWinner ? 'completed-winner' : ''}" data-team-idx="\${team1Idx}">
        \${getTeamBadgeHtml(team1Idx)}
        <span class="team-name">\${team1Idx >= 0 ? getShortTeamName(team1Idx) : 'TBD'}</span>
        <span class="team-score">\${t1Score}\${penText1}</span>
      </div>
      <div class="bracket-match-team \${t2IsWinner ? 'completed-winner' : ''}" data-team-idx="\${team2Idx}">
        \${getTeamBadgeHtml(team2Idx)}
        <span class="team-name">\${team2Idx >= 0 ? getShortTeamName(team2Idx) : 'TBD'}</span>
        <span class="team-score">\${t2Score}\${penText2}</span>
      </div>
    </div>\`;
  }

  // Normalize probabilities: wins of each displayed team / total wins of both
  const team1Wins = team1Idx >= 0 && winnerCounts[team1Idx] ? winnerCounts[team1Idx] : 0;
  const team2Wins = team2Idx >= 0 && winnerCounts[team2Idx] ? winnerCounts[team2Idx] : 0;
  const matchTotal = team1Wins + team2Wins;
  const team1WinProb = matchTotal > 0 ? team1Wins / matchTotal : 0;
  const team2WinProb = matchTotal > 0 ? team2Wins / matchTotal : 0;
  
  const ghosted = !isLocked && !isR32 ? 'ghosted' : '';
  const locked = isLocked ? 'locked' : '';
  
  // Winner highlight
  const team1IsWinner = isLocked ? lockedWinner === team1Idx : (mostLikelyWinner === team1Idx);
  const team2IsWinner = isLocked ? lockedWinner === team2Idx : (mostLikelyWinner === team2Idx);
  
  const team1Class = isLocked && team1IsWinner ? 'locked-winner' : (team1IsWinner ? 'winner' : '');
  const team2Class = isLocked && team2IsWinner ? 'locked-winner' : (team2IsWinner ? 'winner' : '');
  
  return \`<div class="bracket-match \${ghosted} \${locked}" data-match-id="\${matchId}" data-team1="\${team1Idx}" data-team2="\${team2Idx}">
    <div class="bracket-match-team \${team1Class}" data-team-idx="\${team1Idx}">
      \${getTeamBadgeHtml(team1Idx)}
      <span class="team-name">\${team1Idx >= 0 ? getShortTeamName(team1Idx) : 'TBD'}</span>
      <span class="team-prob">\${team1Idx >= 0 && matchTotal > 0 ? Math.round(team1WinProb * 100) + '%' : ''}</span>
    </div>
    <div class="bracket-match-team \${team2Class}" data-team-idx="\${team2Idx}">
      \${getTeamBadgeHtml(team2Idx)}
      <span class="team-name">\${team2Idx >= 0 ? getShortTeamName(team2Idx) : 'TBD'}</span>
      <span class="team-prob">\${team2Idx >= 0 && matchTotal > 0 ? Math.round(team2WinProb * 100) + '%' : ''}</span>
    </div>
  </div>\`;
}

function renderBracket() {
  const filteredRuns = getFilteredRuns();
  const probs = computeBracketProbabilities(filteredRuns);
  const lockedCount = Object.keys(lockedResults).length;
  
  const leftR32 = ['R32-2','R32-5','R32-1','R32-3','R32-11','R32-12','R32-9','R32-10'];
  const rightR32 = ['R32-4','R32-6','R32-7','R32-8','R32-14','R32-16','R32-13','R32-15'];
  const leftR16 = ['R16-1','R16-2','R16-5','R16-6'];
  const rightR16 = ['R16-3','R16-4','R16-7','R16-8'];
  const leftQF = ['QF-1','QF-3'];
  const rightQF = ['QF-2','QF-4'];
  const leftSF = ['SF-1'];
  const rightSF = ['SF-2'];
  
  const finalProb = probs['F'];
  const winnerIdx = finalProb?.mostLikelyWinner ?? -1;
  const winnerName = winnerIdx >= 0 ? getTeamName(winnerIdx) : 'TBD';
  const winnerProbPct = finalProb ? Math.round(finalProb.winnerProb * 100) : 0;
  
  return \`
    <div class="bracket-container">
      <div class="bracket-header">
        <h2>🏆 Knockout Bracket</h2>
        <div class="bracket-controls">
          <span class="bracket-scenario-count">\${filteredRuns.length.toLocaleString()} / \${bracketData.runs.length.toLocaleString()} scenarios</span>
          <button class="bracket-reset-btn" onclick="resetBracket()" \${lockedCount === 0 ? 'disabled' : ''}>Reset (\${lockedCount})</button>
        </div>
      </div>
      
      <div class="bracket-round-labels">
        <div class="bracket-round-label">Round of 32</div>
        <div class="bracket-round-label">Round of 16</div>
        <div class="bracket-round-label">Quarter-Finals</div>
        <div class="bracket-round-label">Semi-Finals</div>
        <div class="bracket-round-label">Final</div>
        <div class="bracket-round-label">Semi-Finals</div>
        <div class="bracket-round-label">Quarter-Finals</div>
        <div class="bracket-round-label">Round of 16</div>
        <div class="bracket-round-label">Round of 32</div>
      </div>
      
      <div class="bracket-grid">
        <div class="bracket-round bracket-left">
          \${leftR32.map(id => renderBracketMatch(id, probs, true, filteredRuns)).join('')}
        </div>
        <div class="bracket-round bracket-left">
          \${leftR16.map(id => renderBracketMatch(id, probs, true, filteredRuns)).join('')}
        </div>
        <div class="bracket-round bracket-left">
          \${leftQF.map(id => renderBracketMatch(id, probs, true, filteredRuns)).join('')}
        </div>
        <div class="bracket-round bracket-left">
          \${leftSF.map(id => renderBracketMatch(id, probs, true, filteredRuns)).join('')}
        </div>
        <div class="bracket-round bracket-center">
          \${renderBracketMatch('F', probs, false, filteredRuns)}
          <div class="bracket-trophy">🏆</div>
          <div class="bracket-winner-name">\${winnerIdx >= 0 ? getTeamBadgeHtml(winnerIdx) + ' ' + winnerName : 'TBD'}</div>
          <div class="bracket-winner-prob">\${winnerProbPct}% to win tournament (across all scenarios)</div>
        </div>
        <div class="bracket-round bracket-right">
          \${rightSF.map(id => renderBracketMatch(id, probs, false, filteredRuns)).join('')}
        </div>
        <div class="bracket-round bracket-right">
          \${rightQF.map(id => renderBracketMatch(id, probs, false, filteredRuns)).join('')}
        </div>
        <div class="bracket-round bracket-right">
          \${rightR16.map(id => renderBracketMatch(id, probs, false, filteredRuns)).join('')}
        </div>
        <div class="bracket-round bracket-right">
          \${rightR32.map(id => renderBracketMatch(id, probs, false, filteredRuns)).join('')}
        </div>
      </div>
      
      <div class="bracket-legend">
        <div class="bracket-legend-item">
          <div class="bracket-legend-swatch swatch-locked"></div>
          <span>Locked in (your pick)</span>
        </div>
        <div class="bracket-legend-item">
          <div class="bracket-legend-swatch swatch-probable"></div>
          <span>Most probable winner</span>
        </div>
        <div class="bracket-legend-item">
          <div class="bracket-legend-swatch swatch-ghosted"></div>
          <span>Probabilistic (click to pick)</span>
        </div>
      </div>
    </div>
  \`;
}

function attachBracketListeners() {
  document.querySelectorAll('.bracket-match').forEach(el => {
    el.addEventListener('click', (e) => {
      if (el.dataset.completed === 'true') return; // Skip completed matches
      const matchId = el.dataset.matchId;
      const team1 = parseInt(el.dataset.team1);
      const team2 = parseInt(el.dataset.team2);
      
      if (team1 < 0 || team2 < 0) return;
      
      const teamEl = e.target.closest('.bracket-match-team');
      if (!teamEl) return;
      
      const clickedIdx = parseInt(teamEl.dataset.teamIdx);
      if (clickedIdx < 0) return;
      
      // Toggle: if already locked to this team, unlock
      if (lockedResults[matchId] === clickedIdx) {
        delete lockedResults[matchId];
      } else {
        lockedResults[matchId] = clickedIdx;
      }
      
      // Re-render
      const main = document.querySelector('.main');
      main.innerHTML = renderBracket();
      attachBracketListeners();
    });
  });
}

function resetBracket() {
  // Reset to only actual results (preserve completed matches)
  lockedResults = {};
  if (bracketData?.actualResults) {
    for (const [matchId, result] of Object.entries(bracketData.actualResults)) {
      lockedResults[matchId] = result.winnerIdx;
    }
  }
  const main = document.querySelector('.main');
  main.innerHTML = renderBracket();
  attachBracketListeners();
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
  <script src="https://cdn.jsdelivr.net/npm/chartjs-plugin-annotation@3.0.1/dist/chartjs-plugin-annotation.min.js"></script>
</head>
<body>
  <header class="header">
    <h1><img src="INRIX_Logo.webp" alt="INRIX" class="header-logo"> Football World Cup 2026 - Sweepstakes</h1>
  </header>
  
  <nav class="nav">
    <ul class="nav-tabs">
      <li><a href="#standings">Standings</a></li>
      <li><a href="#matches/knockout">Matches</a></li>
      <li><a href="#knockout">Knockout</a></li>
      <li><a href="#teams">Teams</a></li>
      <li><a href="#predictions">Bookie Accuracy</a></li>
      <li><a href="#timeline">Timeline</a></li>
    </ul>
  </nav>
  
  <nav class="nav-secondary">
    <ul class="nav-tabs">
      <li><a href="#matches/1">Matchday 1</a></li>
      <li><a href="#matches/2">Matchday 2</a></li>
      <li><a href="#matches/3">Matchday 3</a></li>
      <li><a href="#matches/knockout">Knockout</a></li>
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
