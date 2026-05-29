# Design: Static Site for World Cup Sweepstake

**Date:** 2026-05-29  
**Status:** Approved

## Overview

Convert the PNG-based visualization project into a live website hosted on GitHub Pages. The site displays sweepstake standings, upcoming matches, and probability timelines with automatic daily updates.

## Visual Design

### Header & Navigation

- **Header bar:** INRIX blue (#002D72) background with white text
- **Title:** "INRIX 2026 Football World Cup Sweepstakes"
- **Main navigation:** Minimal underline tabs below header
  - Standings (default/landing)
  - Matches
  - Timeline
- **Active tab indicator:** 2px underline in INRIX blue (#002D72)

### Matchday Selector

When on the Matches view, a secondary tab row appears:
- Background: Light gray (#f8f9fa)
- Tabs: Matchday 1, Matchday 2, Matchday 3
- Same underline style as main nav

### Data Visualizations

Existing styles preserved:
- **Heat map:** Green gradient (FiveThirtyEight style) — high contrast, proven readability
- **Split bars:** INRIX blue (#002D72) / gold (#E3A344) — already brand-consistent
- **Profile pictures:** Circular with fallback to colored initials

## Architecture

### Single-Page Application

One `index.html` serves all views. Hash-based routing controls which view renders:

| URL Hash | View |
|----------|------|
| `#standings` | Stage Probabilities table |
| `#matches/1` | Matchday 1 fixtures |
| `#matches/2` | Matchday 2 fixtures |
| `#matches/3` | Matchday 3 fixtures |
| `#timeline` | Probability race chart |

Default: Landing with no hash redirects to `#standings`.

### Data Flow

```
Page load
    ↓
fetch('/data/latest.json')
    ↓
Store in memory
    ↓
Hash change event
    ↓
Render appropriate view using cached data
```

Single data fetch on page load. All views share the cached data — instant tab switching with no additional network requests.

## File Structure

```
dist/                           # Deployed to GitHub Pages
├── index.html                  # SPA shell with navigation
├── css/
│   └── styles.css              # Combined styles from all templates
├── js/
│   └── app.js                  # Routing, data loading, view rendering
├── data/
│   └── latest.json             # Processed data (updated by CI)
└── profiles/                   # Profile pictures as files
    ├── allan chan.jpg
    └── ...

src/                            # Source files
├── fetch-odds.js               # (existing)
├── process-data.js             # (existing, extended for matchdays 2-3)
├── monte-carlo.js              # (existing)
├── generate-visualizations.js  # (existing, still generates PNGs)
└── build-site.js               # NEW: builds dist/ folder
```

### Profile Pictures

Changed from base64-embedded to regular image files:
- Smaller initial page weight
- Browser caching works properly
- Fallback: `onerror` handler shows initials circle

## View Rendering

Each view is a render function extracted from existing templates:

```javascript
const views = {
  standings: (data) => renderStandingsTable(data),
  matches:   (data, matchday) => renderMatchesGrid(data, matchday),
  timeline:  (data) => renderTimelineChart(data)
};
```

### Standings View
- Source: `stage-probabilities.html` template logic
- 48 teams ranked by win probability
- Heat map cells with green gradient
- Profile pictures for team owners

### Matches View
- Source: `upcoming-matches-two-column.html` template logic
- Two-column grid of fixtures
- Split bars showing win/draw probabilities
- Filtered by matchday parameter

### Timeline View
- Source: `timeline.html` template logic
- Chart.js line chart
- Historical probability evolution
- Profile pictures at line endpoints

## Build Process

### New npm script: `build-site`

```bash
npm run build-site
```

Steps:
1. Create/clean `dist/` directory
2. Copy `data/processed/latest.json` → `dist/data/latest.json`
3. Copy `data/profiles/*.jpg` → `dist/profiles/`
4. Generate `dist/index.html` (app shell with embedded nav)
5. Generate `dist/css/styles.css` (combined from templates)
6. Generate `dist/js/app.js` (routing + view rendering)

### Existing scripts unchanged

- `npm run fetch` — fetch odds from API
- `npm run process` — run Monte Carlo simulation
- `npm run visualize` — generate PNG images (for Slack sharing)
- `npm run generate` — full pipeline (fetch + process + visualize)

## Deployment

### GitHub Actions Workflow

File: `.github/workflows/deploy.yml`

**Triggers:**
- Schedule: 4x daily (8am, 12pm, 6pm, 10pm UTC)
- Manual: `workflow_dispatch` for on-demand updates

**Steps:**
```yaml
1. Checkout repository
2. Setup Node.js 20
3. npm ci
4. npm run fetch (with ODDS_API_KEY secret)
5. npm run process
6. npm run build-site
7. Deploy dist/ to GitHub Pages
```

### GitHub Pages Configuration

- Source: GitHub Actions (not branch-based)
- Custom domain: None (uses `jhkidd.github.io/2026-world-cup`)
- HTTPS: Enabled by default

### Repository Setup

1. Push to `jhkidd` GitHub account
2. Enable Pages in repository settings
3. Add `ODDS_API_KEY` as repository secret

## Changes to Existing Files

### `src/process-data.js`

Extend to include matchday 2 and 3 fixtures:

```javascript
// Current: only matchday 1
upcoming_matches: getMatchday1Fixtures()

// New: all three matchdays
upcoming_matches: {
  matchday1: getMatchdayFixtures(1),
  matchday2: getMatchdayFixtures(2),
  matchday3: getMatchdayFixtures(3)
}
```

### `package.json`

Add new script:

```json
{
  "scripts": {
    "build-site": "node src/build-site.js"
  }
}
```

## New Files to Create

| File | Purpose |
|------|---------|
| `src/build-site.js` | Build script for dist/ folder |
| `dist/index.html` | SPA shell with navigation |
| `dist/css/styles.css` | Combined styles |
| `dist/js/app.js` | Routing and view rendering |
| `.github/workflows/deploy.yml` | GitHub Actions deployment |

## Out of Scope

The following are explicitly not part of this implementation:

- Real-time updates during matches
- Email/Slack notifications
- Additional visualizations (bracket, upset tracker, etc.)
- Mobile-optimized responsive design
- Custom domain setup

These can be added in future iterations.

## Success Criteria

1. Site loads at `jhkidd.github.io/2026-world-cup`
2. All three views render correctly (Standings, Matches, Timeline)
3. Matchday tabs switch between MD1/MD2/MD3
4. Data updates automatically 4x daily
5. Existing PNG generation still works
