# Team Detail Pages — Design Specification

**Date**: 2026-05-30  
**Status**: Draft  
**Author**: Joshua Kidd + Copilot

## Overview

Add a new "Teams" section to the World Cup sweepstake site that provides detailed information about each of the 48 participating teams. This includes squad rosters, player statistics, match history, group standings, and ownership information.

## Goals

1. Give users deep-dive information about any team in the tournament
2. Surface player-level statistics (goals, assists) during the tournament
3. Create navigation pathways from existing pages (Standings, Matches) to team details
4. Maintain the existing FiveThirtyEight-inspired visual style and INRIX branding

## User Flows

### Accessing Team Pages

1. **Via Teams Tab**: Click "Teams" in navigation → see alphabetical grid of 48 teams → click a team card
2. **Via Standings**: Click any row in the standings table → navigate to that team's page
3. **Via Matches**: Click a team name on any match → navigate to that team's page

### URL Structure

- Teams list: `#teams`
- Team detail: `#teams/{team-name}` (e.g., `#teams/france`, `#teams/saudi-arabia`)

## Page Designs

### Teams List Page (`#teams`)

**Layout**: Alphabetical grid of compact cards, 6-8 per row on desktop

**Card Contents**:
- Country flag (emoji)
- Country name
- Clickable → navigates to detail page

**Responsive**: 4 per row on tablet, 2-3 per row on mobile

### Team Detail Page (`#teams/{team-name}`)

**Layout**: Hero Banner at top, followed by content sections in responsive grid

#### Hero Banner

Full-width dark blue (#002D72) banner containing:
- Large country flag (48px emoji or image)
- Country name (24px, bold)
- Win probability percentage (prominent)
- Group letter
- Owner name with profile picture (or "Unowned" placeholder)

#### Content Sections (Grid Layout)

**1. Group Standings (Full Table)**
- Header: "Group {X} Standings"
- Columns: Position, Team (flag + name), P, W, D, L, GD, Pts
- Current team's row highlighted in green (#e8f5e9)
- Other teams clickable → their team pages
- Width: ~50% on desktop, full width on mobile

**2. Matches (Odds Bar Style)**
- Reuses existing odds bar visualization from Matches page
- Shows all group stage matches for this team
- Completed matches show result with solid color bar
- Upcoming matches show probability split
- Next match highlighted with border
- Width: ~50% on desktop, full width on mobile

**3. Squad (Compact Table)**
- Header: "Squad ({n} players)"
- Sortable columns: #, Player (photo + name), Position, Goals, Assists
- Player photos from TheSportsDB (circular, 24px)
- Fallback to initials circle if no photo
- Position abbreviated: GK, DEF, MID, FWD
- Full width, scrollable on mobile

**4. Coach/Manager Info**
- Small section showing coach name and photo (if available)
- Can be integrated into hero or as separate card

## Data Architecture

### API Sources

| Data | Source | Rate Limit | Refresh Frequency |
|------|--------|------------|-------------------|
| Team squads, coach | football-data.org | 10 req/min | Every 6 hours |
| Player tournament stats | API-Football | 100 req/day | Once daily (00:00 UTC) |
| Player photos, badges | TheSportsDB | Unlimited | Once daily |
| Match odds | the-odds-api | 500 req/month | Every 6 hours (existing) |

### Data Flow

```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│ football-data   │    │ API-Football    │    │ TheSportsDB     │
│ (squads, coach) │    │ (player stats)  │    │ (photos)        │
└────────┬────────┘    └────────┬────────┘    └────────┬────────┘
         │                      │                      │
         └──────────────────────┼──────────────────────┘
                                │
                    ┌───────────▼───────────┐
                    │  fetch-team-data.js   │
                    │  (new script)         │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  data/teams/*.json    │
                    │  (per-team files)     │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  process-data.js      │
                    │  (merge into latest)  │
                    └───────────┬───────────┘
                                │
                    ┌───────────▼───────────┐
                    │  latest.json          │
                    │  (+ teams section)    │
                    └───────────────────────┘
```

### New Data Structure in latest.json

```json
{
  "teams": [...],  // existing
  "team_details": {
    "france": {
      "name": "France",
      "code": "FRA",
      "flag": "🇫🇷",
      "group": "I",
      "owner": "Unowned",
      "win_probability": 0.172,
      "coach": {
        "name": "Didier Deschamps",
        "photo": "https://..."
      },
      "squad": [
        {
          "name": "Kylian Mbappé",
          "position": "Forward",
          "shirt_number": 10,
          "photo": "https://...",
          "goals": 3,
          "assists": 1
        }
      ],
      "group_standings": [
        { "position": 1, "team": "France", "p": 1, "w": 1, "d": 0, "l": 0, "gd": 3, "pts": 3 }
      ],
      "matches": [
        {
          "opponent": "Iraq",
          "date": "2026-06-12T19:00:00Z",
          "home": true,
          "result": { "home": 3, "away": 0 },
          "odds": null
        }
      ]
    }
  }
}
```

### Environment Variables (New)

```
FOOTBALL_DATA_API_KEY=<your-key>  # User has key
API_FOOTBALL_KEY=<to be obtained>
```

TheSportsDB requires no key for v1 API.

## GitHub Actions Workflow Changes

### Modified Schedule

```yaml
on:
  schedule:
    # Odds refresh: every 6 hours
    - cron: '0 */6 * * *'
    # Team data refresh: once daily at midnight UTC
    - cron: '0 0 * * *'
```

### New Job: fetch-team-data

Runs once daily to fetch:
1. Squad data from football-data.org
2. Player stats from API-Football
3. Player/team photos from TheSportsDB

Caches photos locally to avoid re-fetching unchanged images.

## Frontend Implementation

### New Files

- `src/build-site.js`: Add `renderTeamsList()` and `renderTeamDetail()` functions
- No new JS files needed (single-page app pattern continues)

### Navigation Changes

1. Add "Teams" tab to nav bar (4th tab)
2. Add click handlers to Standings table rows
3. Add click handlers to team names in Matches view

### Routing Addition

```javascript
function handleRoute() {
  const hash = window.location.hash;
  if (hash.startsWith('#teams/')) {
    const teamSlug = hash.replace('#teams/', '');
    renderTeamDetail(teamSlug);
  } else if (hash === '#teams') {
    renderTeamsList();
  }
  // ... existing routes
}
```

## Error Handling

### Missing Data

- If squad not yet fetched: show "Squad information loading..."
- If player photo unavailable: show initials circle (existing pattern)
- If API-Football stats unavailable: hide goals/assists columns
- If team not found: redirect to teams list with error message

### API Failures

- Log errors but don't fail build
- Use cached data if fresh fetch fails
- Display "Data as of {timestamp}" to indicate staleness

## Testing Plan

1. **Unit tests**: Team slug generation, data merging
2. **Visual testing**: Check all 48 teams render correctly
3. **Link testing**: Verify all navigation paths work
4. **Mobile testing**: Check responsive layout on narrow screens

## Implementation Phases

### Phase 1: Data Infrastructure
- [ ] Create `fetch-team-data.js` script
- [ ] Set up football-data.org API integration
- [ ] Add team_details structure to latest.json
- [ ] Update GitHub Actions workflow

### Phase 2: Teams List Page
- [ ] Add Teams tab to navigation
- [ ] Create alphabetical team grid
- [ ] Add routing for `#teams`

### Phase 3: Team Detail Page
- [ ] Create hero banner component
- [ ] Add group standings table
- [ ] Integrate matches display (reuse existing component)
- [ ] Add squad table

### Phase 4: Navigation Links
- [ ] Make Standings rows clickable
- [ ] Make Matches team names clickable

### Phase 5: Additional APIs
- [ ] Integrate API-Football for player stats
- [ ] Integrate TheSportsDB for photos
- [ ] Add separate daily refresh job

## Open Questions

1. **API-Football signup**: Need to obtain API key from api-sports.io
2. **Photo caching**: Store in repo or fetch fresh each build?
3. **Knockout stage**: How should team page change after group stage ends?

---

*Spec reviewed and approved for implementation planning.*
