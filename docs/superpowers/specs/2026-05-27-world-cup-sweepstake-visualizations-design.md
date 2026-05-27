# 2026 World Cup Sweepstake Visualizations - Design Document

**Date**: 2026-05-27  
**Project**: World Cup Sweepstakes Visualization System  
**Purpose**: Generate professional FiveThirtyEight-style visualizations for office sweepstake tracking

## Overview

This system fetches betting odds and match results, calculates win probabilities for sweepstake participants based on their drawn teams, and generates clean PNG visualizations suitable for sharing with the office. The system tracks probability changes over time to show how each participant's chances evolve as the tournament progresses.

## Requirements Summary

### Core Requirements
- Fetch betting odds from the-odds-api.com (500 API calls/month free tier)
- Fetch match results from worldcup2026 API (free, open source)
- Calculate tournament winner probabilities by averaging bookmaker odds
- Calculate each participant's total win probability (sum of their two teams' probabilities)
- Generate 5 visualization types as PNG images
- Archive historical odds data with timestamps for trend analysis
- Support weekly updates (on-demand execution)

### Data Sources
- **Tournament structure**: Hardcoded JSON file (groups, matches, venues, schedule)
- **Sweepstake assignments**: Editable flat file mapping participants to teams
- **Betting odds**: the-odds-api.com (h2h match odds + tournament winner outrights)
- **Match results**: worldcup2026 GitHub API

### Constraints
- API budget: 2 calls per run (match odds + tournament winner odds), ~500/month available
- Execution model: On-demand via command (typically weekly, but flexible)
- Output format: PNG images at 1200px width
- No manual result entry - must be fully automated

## System Architecture

### Components

The system consists of three Node.js scripts that run sequentially:

#### 1. `fetch-odds.js`
**Purpose**: Fetch current odds and match results from APIs, archive with timestamp

**Inputs**:
- API key from environment or config
- the-odds-api.com endpoints:
  - `GET /v4/sports/soccer_fifa_world_cup/odds` (match odds)
  - `GET /v4/sports/soccer_fifa_world_cup_winner/odds` (tournament winner odds)
- worldcup2026 API endpoint for match results

**Outputs**:
- `data/odds/YYYY-MM-DD-HH-mm.json` - Archived odds and results with timestamp

**Error Handling**:
- Retry failed API calls once with exponential backoff (1s delay)
- If API unavailable after retry, exit with error message
- Log remaining API call count from response headers
- Warn if approaching monthly limit (< 50 calls remaining)

#### 2. `process-data.js`
**Purpose**: Calculate probabilities, rankings, and trends from raw data

**Inputs**:
- `data/tournament.json` - Tournament structure
- `data/sweepstake.json` - Participant assignments
- `data/odds/` directory - All archived odds (for trends)
- Latest odds file from previous step

**Processing Logic**:

1. **Convert odds to probabilities**:
   - For each team's tournament winner odds, calculate implied probability: `1 / decimal_odds`
   - Average probabilities across all available bookmakers
   - Example: Spain at 6.0 odds across 3 bookies → 1/6.0 = 16.67% probability

2. **Calculate participant rankings**:
   - For each participant, sum their two teams' tournament winner probabilities
   - Example: Nicholas Burgoyne (Argentina 9.5% + Panama 0.1% = 9.6% total)
   - Sort participants by total probability (descending)

3. **Match predictions**:
   - For h2h match odds, calculate win/draw probabilities for each outcome
   - Average across bookmakers, normalize to 100%
   - Identify upcoming matches (next 7 days from current date)

4. **Historical trends**:
   - Load all archived odds files
   - Extract tournament winner probabilities over time for each team
   - Calculate week-over-week changes for each participant
   - Build time series data for timeline visualization

5. **Tournament status**:
   - Compare current date with match schedule
   - Determine current tournament stage (group stage, knockouts, etc.)
   - Mark team statuses: Active, Qualified, Eliminated
   - Identify completed vs. upcoming matches

**Outputs**:
- `data/processed/latest.json` - Structured data for visualizations:
```json
{
  "timestamp": "2026-06-15T10:30:00Z",
  "tournament_stage": "Group Stage - Matchday 2",
  "leaderboard": [
    {
      "rank": 1,
      "name": "Ian Whelan",
      "team1": { "name": "Spain", "probability": 0.167 },
      "team2": { "name": "Qatar", "probability": 0.001 },
      "total_probability": 0.168,
      "change_from_last_week": 0.015
    }
  ],
  "teams": [
    {
      "name": "Spain",
      "group": "H",
      "win_probability": 0.167,
      "status": "active",
      "owner": "Ian Whelan"
    }
  ],
  "upcoming_matches": [
    {
      "id": "H3",
      "date": "2026-06-21T17:00:00Z",
      "home": "Spain",
      "away": "Saudi Arabia",
      "home_win_prob": 0.89,
      "draw_prob": 0.08,
      "away_win_prob": 0.03
    }
  ],
  "timeline": [
    {
      "date": "2026-06-08",
      "participants": {
        "Ian Whelan": 0.153,
        "Nicholas Burgoyne": 0.142
      }
    }
  ],
  "bracket": {
    "group_stage_results": [...],
    "knockout_matches": [...]
  }
}
```

**Validation**:
- Verify all teams in sweepstake.json exist in tournament.json
- Warn if odds data missing for any team
- Skip trend calculation if fewer than 2 historical data points

#### 3. `generate-visualizations.js`
**Purpose**: Render HTML templates with Puppeteer, save as PNG images

**Inputs**:
- `data/processed/latest.json`
- HTML templates in `templates/` directory

**Template System**:
Each visualization has an HTML template with embedded styling and JavaScript for data injection. Templates use handlebars-style placeholders for dynamic data.

**Rendering Process**:
1. Load template HTML
2. Inject data from latest.json
3. Launch Puppeteer (headless Chrome)
4. Navigate to data URL with rendered HTML
5. Wait for "render-complete" signal (set by template JS)
6. Take screenshot with `{viewport: {width: 1200}, fullPage: true}`
7. Save to `output/[visualization-name].png`

**Outputs**:
- `output/leaderboard.png`
- `output/bracket.png`
- `output/upcoming-matches.png`
- `output/team-rankings.png`
- `output/timeline.png`

**Error Handling**:
- If processed data missing, exit with clear error
- If template fails to render, log error and skip that visualization
- Continue generating other visualizations if one fails

### Data Files Structure

```
project/
├── data/
│   ├── tournament.json          # Hardcoded World Cup structure
│   ├── sweepstake.json          # Participant assignments (editable)
│   ├── odds/                    # Archived API responses
│   │   ├── 2026-06-08-10-30.json
│   │   ├── 2026-06-15-09-15.json
│   │   └── ...
│   └── processed/
│       └── latest.json          # Current calculated data
├── templates/
│   ├── leaderboard.html
│   ├── bracket.html
│   ├── upcoming-matches.html
│   ├── team-rankings.html
│   └── timeline.html
├── output/
│   ├── leaderboard.png
│   ├── bracket.png
│   ├── upcoming-matches.png
│   ├── team-rankings.png
│   └── timeline.png
└── src/
    ├── fetch-odds.js
    ├── process-data.js
    └── generate-visualizations.js
```

## Visualizations Design

All visualizations follow FiveThirtyEight aesthetic principles:
- **Color palette**: Teal/green gradients for probability bars (#4DB8A8 to #A8E6CF), neutral grays (#F5F5F5, #E0E0E0)
- **Typography**: Sans-serif (system fonts), bold headers, numeric emphasis
- **Layout**: Clean tables with alternating rows, generous padding
- **Data density**: Information-rich but scannable

### 1. Sweepstake Leaderboard (`leaderboard.png`)

**Purpose**: Show current standings with each participant's total win probability

**Layout**:
- Header: "2026 World Cup Sweepstake Standings" + current date
- Table columns:
  - Rank (#1, #2, etc.)
  - Participant name
  - Team 1 (with flag emoji or small flag image)
  - Team 1 win probability
  - Team 2 (with flag emoji or small flag image)
  - Team 2 win probability
  - Total probability (bold, with colored bar background)
  - Change from last week (↑/↓ with color: green for up, red for down)
- Top 3 rows highlighted with subtle gold/silver/bronze tint
- Probability bars scaled by magnitude (highest = full width)

**Example Row**:
```
1  Ian Whelan    🇪🇸 Spain 16.7%    🇶🇦 Qatar 0.1%    [████████ 16.8%]  ↑ 1.5%
```

### 2. Tournament Bracket (`bracket.png`)

**Purpose**: Visual representation of knockout stage with predictions

**Layout**:
- Group stage summary at top (12 groups, show top 2 + notable 3rd place teams)
- Bracket tree: Round of 32 → R16 → QF → SF → Final
- Completed matches: Show actual scores
- Upcoming matches: Show predicted winner probability
- Team names color-coded if they belong to sweepstake participants (with participant name in small text)
- Current tournament stage highlighted

**Design Notes**:
- Use connecting lines between rounds
- Match boxes show: Team names, scores/probabilities, date
- Grey out eliminated teams
- Highlight path to final for top-ranked participant's teams

### 3. Upcoming Matches (`upcoming-matches.png`)

**Purpose**: Next 7 days of matches with win probabilities

**Layout**:
- Header: "Upcoming Matches (Next 7 Days)"
- Each match as a row:
  - Date & time (local timezone, e.g., "Jun 21, 5:00 PM BST")
  - Home team | Away team
  - Venue (city, country)
  - Win probability bars (home / draw / away)
  - Small indicator if match involves sweepstake teams
- Matches sorted chronologically

**Example Row**:
```
Jun 21, 5:00 PM BST
Spain vs Saudi Arabia
Atlanta, USA
[██████████████████ 89%] | [███ 8%] | [█ 3%]
⭐ Ian Whelan's team
```

### 4. Team Rankings (`team-rankings.png`)

**Purpose**: All 48 teams ranked by tournament winner probability

**Layout**:
- Table columns:
  - Rank
  - Team (with flag)
  - Group
  - Confederation badge
  - Tournament win probability (with bar)
  - Status (Active / Qualified / Eliminated)
  - Sweepstake owner (if applicable)
- Color-code by confederation for visual grouping
- Separate sections or dividers for:
  - Favorites (>10% probability)
  - Contenders (1-10%)
  - Underdogs (<1%)

### 5. Probability Timeline (`timeline.png`)

**Purpose**: Show how each participant's win probability evolved over time

**Layout**:
- Line chart with:
  - X-axis: Dates (weekly snapshots)
  - Y-axis: Total win probability (0-20%)
  - One line per participant (color-coded, labeled)
- Key events annotated (e.g., "Group stage ends", "Spain eliminated")
- Legend showing current ranking
- Grid lines for readability

**Interactions** (in future HTML version):
- Hover to see exact values
- Toggle participants on/off

**Fallback**:
- If fewer than 2 data points, show message: "Timeline will appear after multiple data collections"

## Technology Stack

**Runtime**: Node.js 18+

**Key Dependencies**:
- `puppeteer` - Headless Chrome for rendering
- `axios` - HTTP client for API calls
- `date-fns` - Date manipulation and formatting

**Development**:
- ESM modules (modern JavaScript)
- No build step required
- Environment variables for API key (`.env` file)

## Configuration

**Environment Variables** (`.env`):
```
THE_ODDS_API_KEY=ed7e6908eb6aae33fcf0f22140a2e47f
TIMEZONE=Europe/London
```

**Package.json Scripts**:
```json
{
  "scripts": {
    "fetch": "node src/fetch-odds.js",
    "process": "node src/process-data.js",
    "visualize": "node src/generate-visualizations.js",
    "generate": "npm run fetch && npm run process && npm run visualize"
  }
}
```

## Data Formats

### `sweepstake.json`
```json
{
  "participants": [
    {
      "name": "Nicholas Burgoyne",
      "teams": ["Argentina", "Panama"]
    },
    {
      "name": "Dave Mosely",
      "teams": ["Ecuador", "Ivory Coast"]
    }
  ]
}
```

### `tournament.json`
Use the provided worldcup2026.json structure with:
- Tournament metadata
- Venues
- Teams with groups
- Match schedule (group stage + knockout placeholders)

## Error Handling & Edge Cases

### API Failures
- **Scenario**: the-odds-api.com returns 429 (rate limit) or 500 (server error)
- **Handling**: Retry once after 1 second, then fail with clear message
- **Future enhancement**: Use most recent cached odds with watermark "Using cached data from [date]"

### Missing Data
- **Scenario**: Odds missing for some teams in tournament winner market
- **Handling**: Log warning, exclude from calculations, note in leaderboard
- **Example**: "⚠️ Some odds unavailable, rankings may be incomplete"

### Invalid Sweepstake Assignments
- **Scenario**: Team in sweepstake.json doesn't exist in tournament.json
- **Handling**: Validation error at process start, list invalid teams, exit

### Historical Data Gaps
- **Scenario**: Archived odds files deleted or missing
- **Handling**: Skip timeline visualization, generate others normally

### Timezone Handling
- **Scenario**: Match times displayed in different timezones
- **Handling**: Store all times in UTC, convert to configured timezone for display

### Bookmaker Variations
- **Scenario**: Different bookmakers have different team name spellings
- **Handling**: Normalize team names (trim, case-insensitive match) when averaging odds

## Testing Strategy

### Manual Testing Checklist
- [ ] Run fetch script, verify API calls succeed and data saved
- [ ] Run process script, verify calculations correct for sample data
- [ ] Generate all 5 visualizations, verify output images
- [ ] Test with missing odds data (exclude a team from API response)
- [ ] Test timeline with 1, 2, and 5+ historical data points
- [ ] Verify participant ranking changes correctly when odds change
- [ ] Check all dates/times display in correct timezone

### Sample Data
Create `data/odds/sample.json` with known odds for validation:
- Spain at 6.0 → 16.67%
- France at 6.4 → 15.63%
- Verify participant with Spain + Qatar (1000 odds) = 16.77% total

## Future Enhancements

**Not in scope for initial implementation**, but noted for later:

1. **Interactive HTML Dashboard**: Extend to live webpage with hover states, filtering
2. **Automated Scheduling**: Cron job to run daily during tournament
3. **Notifications**: Slack/email alerts when rankings change significantly
4. **Match Simulation**: Monte Carlo simulation to predict knockout bracket outcomes
5. **Head-to-Head Tracking**: Show which participant is ahead based on current group standings
6. **Mobile-Responsive**: Optimize visualizations for phone viewing

## Implementation Phases

### Phase 1: Data Pipeline (fetch + process)
- Implement fetch-odds.js with API integration
- Implement process-data.js with probability calculations
- Validate data flow with sample inputs

### Phase 2: Core Visualizations (leaderboard + team rankings)
- Build HTML templates for leaderboard and team rankings
- Implement Puppeteer rendering pipeline
- Verify FiveThirtyEight styling

### Phase 3: Advanced Visualizations (bracket, upcoming, timeline)
- Implement bracket with completed/predicted matches
- Implement upcoming matches with next 7 days
- Implement timeline with historical trends

### Phase 4: Polish & Testing
- Refine styling to match FiveThirtyEight aesthetic
- Error handling and edge cases
- Documentation and README

## Success Criteria

The system is successful if:
- ✅ Generates all 5 visualizations in under 30 seconds
- ✅ Visualizations are clear, professional, and shareable
- ✅ Probability calculations are accurate (verified against manual calculations)
- ✅ System handles missing/incomplete data gracefully
- ✅ Easy to run weekly with single command
- ✅ Stays well within API rate limits (2 calls per run, ~8/month = 16 total)

## Appendix: API Endpoints

### the-odds-api.com

**Match Odds**:
```
GET https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds
Params: 
  - apiKey: ed7e6908eb6aae33fcf0f22140a2e47f
  - regions: uk
  - markets: h2h
  - oddsFormat: decimal
Cost: 1 API call
```

**Tournament Winner Odds**:
```
GET https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup_winner/odds
Params:
  - apiKey: ed7e6908eb6aae33fcf0f22140a2e47f
  - regions: uk
  - markets: outrights
  - oddsFormat: decimal
Cost: 1 API call
```

### worldcup2026 API

**Match Results**:
```
GET https://worldcup2026.api.endpoint/matches
(Exact endpoint TBD - confirm from GitHub repo documentation)
Returns: Match results with scores for completed games
Cost: Free, no rate limit
```

---

**End of Design Document**
