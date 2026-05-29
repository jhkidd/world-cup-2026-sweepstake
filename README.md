# 2026 World Cup Sweepstake Visualizations

Professional-grade FiveThirtyEight-style visualizations for tracking an office World Cup sweepstake. Combines live betting odds, Monte Carlo simulations, and clean data visualization to show who's winning the office competition.

## ✨ Features

### Three Core Visualizations

1. **Stage Probabilities** (`stage-probabilities.png`)
   - 48 teams ranked by tournament winner probability
   - Heat map showing chances to reach each knockout stage
   - Profile pictures for sweepstake participants
   - Top 3 teams highlighted

2. **Upcoming Matches** (`upcoming-matches.png`)
   - Matchday 1 group stage fixtures with win/draw odds
   - Mirror-symmetrical layout with proportional split bars
   - Favorites highlighted in bold
   - Organized by group in two-column layout

3. **Sweepstake Race** (`timeline.png`)
   - Historical probability evolution over time
   - Top 8 participants with distinct company colors
   - Profile pictures at line endpoints with collision avoidance
   - Tournament phase background shading

### Technical Highlights

- **Monte Carlo Simulation**: 10,000 iterations for statistical accuracy
- **Live Odds Integration**: Fetches from 20+ UK bookmakers via the-odds-api.com
- **Completed Match Support**: Automatically locks in actual results as 100% probability
- **Smart Team Matching**: Handles name variations (Turkey/Türkiye, Czech Republic/Czechia, etc.)
- **Responsive Design**: Clean, professional aesthetic matching FiveThirtyEight style

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ (for ES modules)
- API key from [the-odds-api.com](https://the-odds-api.com) (500 free calls/month)

### Installation

```bash
# Clone the repository
git clone <repository-url>
cd 2026-world-cup-visualisations

# Install dependencies
npm install

# Create .env file with your API key
echo "ODDS_API_KEY=your_api_key_here" > .env
```

### Usage

```bash
# Complete pipeline: fetch odds → process data → generate visualizations
npm run generate

# Or run individual steps
npm run fetch      # Fetch latest odds (uses 2 API calls)
npm run process    # Run Monte Carlo simulation
npm run visualize  # Generate PNG files from templates
```

All visualizations are saved to the `output/` directory.

## 📁 Project Structure

```
2026-world-cup-visualisations/
├── src/
│   ├── fetch-odds.js           # Fetch odds from API
│   ├── process-data.js         # Calculate probabilities
│   ├── monte-carlo.js          # Simulation engine
│   └── generate-visualizations.js  # Render HTML to PNG
├── templates/
│   ├── stage-probabilities.html
│   ├── upcoming-matches-two-column.html
│   └── timeline.html
├── data/
│   ├── sweepstake.json         # Participant-team assignments
│   ├── tournament.json         # World Cup structure & fixtures
│   ├── completed-matches.json  # Historical results
│   ├── profiles/               # Profile pictures (JPG)
│   ├── odds/                   # Archived API responses
│   └── processed/
│       └── latest.json         # Calculated probabilities
├── output/
│   ├── stage-probabilities.png
│   ├── upcoming-matches.png
│   └── timeline.png
└── .env                        # API key (create this)
```

## 📊 Data Pipeline

### 1. Fetch Odds (`npm run fetch`)

Retrieves betting odds from the-odds-api.com:
- **Match odds**: Head-to-head outcomes (home/draw/away) for upcoming fixtures
- **Tournament winner odds**: Outright winner probabilities for all 48 teams

API calls: 2 per run (costs 1 token each)

Saves timestamped JSON files to `data/odds/` for historical tracking.

### 2. Process Data (`npm run process`)

**Odds Processing:**
- Averages odds across 20+ bookmakers
- Converts decimal odds to implied probabilities
- Normalizes probabilities to sum to 100%

**Monte Carlo Simulation:**
- Runs 10,000 tournament simulations
- Group stage: Uses bookmaker h2h odds when available
- Knockout stage: Uses Bradley-Terry model based on winner odds
- Tracks advancement probabilities for each stage

**Completed Match Handling:**
- Reads `data/completed-matches.json` for actual results
- Overrides simulated outcomes with 100% probability for winners
- Updates goal difference for accurate group standings

**Output:**
- Participant rankings with total win probability
- Stage-by-stage advancement probabilities for all 48 teams
- Upcoming matches with owner information
- Historical timeline for probability tracking

### 3. Generate Visualizations (`npm run visualize`)

Uses Puppeteer to render HTML templates as PNG images:
1. Loads HTML template
2. Injects processed data via placeholder replacement
3. Embeds profile pictures as base64
4. Waits for render-complete signal
5. Captures full-page screenshot

## 🔧 Configuration

### Adding Participants

Edit `data/sweepstake.json`:

```json
{
  "participants": [
    {
      "name": "Your Name",
      "teams": ["Team 1", "Team 2"]
    }
  ]
}
```

### Adding Profile Pictures

1. Save JPG files to `data/profiles/`
2. Use lowercase filename with spaces: `your name.jpg`
3. Recommended size: 100x100px or larger
4. Falls back to colored initials if image missing

### Recording Match Results

Edit `data/completed-matches.json`:

```json
{
  "completed_matches": [
    {
      "home_team": "Mexico",
      "away_team": "South Africa",
      "home_score": 2,
      "away_score": 0,
      "date": "2026-06-11"
    }
  ]
}
```

## 🎨 Design System

### Color Palette

**Stage Probabilities:**
- Gradient from #6DACA8 (100%) → #FFFFFE (0%)
- Win Cup column: 16px, 2px border for emphasis
- Top 3 teams: yellow background highlighting

**Upcoming Matches:**
- Company colors: #28346E (left win), #E4E4E6 (draw), #E3A344 (right win)
- Split bars show proportional probability
- Favorites: font-weight 800, 14px

**Timeline:**
- 8-color company palette assigned by rank
- Profile pictures: 20px circles at line endpoints
- Tournament phases: alternating subtle gray/white backgrounds

### Typography

- Titles: 28px, font-weight 700
- Subtitles: 13px, color #7F8C8D
- Body text: 13px, font-weight 500
- Bold favorites: font-weight 800, 14px

## 📖 API Reference

### the-odds-api.com Endpoints

**Sports List:**
```
GET https://api.the-odds-api.com/v4/sports/?apiKey={key}&all=true
```

**Match Odds (H2H):**
```
GET https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds
  ?apiKey={key}
  &regions=uk
  &markets=h2h
  &oddsFormat=decimal
```
*Uses 1 API call*

**Tournament Winner Odds (Outrights):**
```
GET https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup_winner/odds
  ?apiKey={key}
  &regions=uk
  &markets=outrights
  &oddsFormat=decimal
```
*Uses 1 API call*

### API Limits

- **Free tier**: 500 calls/month, resets on 1st
- **Current usage**: Tracked in console output
- **Per run**: 2 calls (match odds + winner odds)
- **Estimated runs**: ~250 per month

## 🔍 Technical Details

### Monte Carlo Simulation

**Group Stage:**
- Each match simulated using bookmaker h2h odds
- Completed matches override with actual score
- Group standings calculated: wins (3pts), draws (1pt), goal difference
- Top 2 + best 8 third-place teams advance

**Knockout Stage:**
- Bradley-Terry model: P(A beats B) = strength_A / (strength_A + strength_B)
- Team strength = 1 / tournament_winner_odds
- Single elimination from Round of 32 → Final

**Probability Tracking:**
- Each simulation records which teams reach each stage
- Probabilities = (count reaching stage) / 10,000 simulations
- Validation: Make Final sums to 200% (2 finalists expected)

### Team Name Normalization

Handles variations between tournament data and betting odds:
- Turkey ↔ Türkiye
- Czech Republic ↔ Czechia
- Curaçao ↔ Curacao
- Bosnia & Herzegovina ↔ Bosnia and Herzegovina

Applied during odds matching and Monte Carlo simulation.

### Profile Picture System

**Loading:**
1. Attempts to load from `data/profiles/{name}.jpg`
2. Encodes as base64 data URL during visualization generation
3. Falls back to colored initials circle if image missing

**Collision Avoidance (Timeline):**
- Sequential downward offset algorithm
- Minimum 40px spacing between bubbles (2× radius)
- Dotted connector lines when bubbles repositioned

## 🐛 Troubleshooting

### "API call failed"
- Check `.env` file contains valid `ODDS_API_KEY`
- Verify you haven't exceeded 500 calls/month
- Check internet connection

### "Team not found in odds"
- Team name mismatch between tournament structure and odds API
- Add normalization rule in `normalizeTeamName()` functions
- Check console for actual team name from API

### "Profile picture not loading"
- Ensure filename is lowercase with spaces: `first last.jpg`
- Check file exists in `data/profiles/`
- JPG format only (not PNG or other formats)

### "Probabilities don't sum to 100%"
- Expected behavior: Make Final = 200% (2 finalists), Make Semis = 400%, etc.
- Win Cup should always sum to 100%
- Check console warnings for validation errors

### "Timeline shows no data"
- Need at least 2 data points in timeline
- Run `npm run generate` multiple times over several days
- Historical data stored in `data/processed/latest.json` timeline array

## 🚧 Ideas for Future Improvements

Some of these ideas require an interactive dashboard rather than static images.

### Static Visualizations

**Sweepstake Leaderboard**
Rank each participant by their team's current "Win Cup" probability. Show movement since last update with up/down arrows. This is the homepage — the thing people refresh obsessively.

**Odds Treemap**
Each team is a rectangle sized by their Win Cup probability. Colour by confederation. Instantly shows how top-heavy the tournament is — Spain's box dwarfs Haiti's. More intuitive than a sorted table.

**Group Stage Heat Map**
Show each group as a 4×4 matrix of head-to-head win probabilities. Instantly reveals dominant teams and tight rivalries within a group. One glance tells you who qualifies.

**Tournament Path to Glory**
For each remaining team, trace the most likely sequence of opponents to reach the final. Show the cumulative probability at each stage. Helps participants understand why their team's odds shifted after a result.

**Upset Tracker**
Every time an underdog wins, log it. Rank upsets by how improbable they were (pre-match odds). A running "shock of the tournament" leaderboard — great for engagement between games.

**Expected vs Actual Points**
For each team, compare actual group stage points against their pre-tournament expected points. Teams above the line are overperforming — teams below are underachieving. Identifies who is riding their luck.

**Probabilistic Bracket**
Once we're out of the group stages, a knockout bracket where each box shows not just who's playing, but each team's probability of winning that match and advancing. The single most-clicked view during any tournament — every ESPN and FiveThirtyEight major event publishes one.

### Interactive Dashboard Features

**Head-to-Head Simulator**
Pick any two teams and show the three-way match odds as an interactive split bar. Let participants war-game a potential final before it happens. Extremely shareable in a group chat.

## 📝 License

ISC

## 🙏 Acknowledgments

- Odds data provided by [the-odds-api.com](https://the-odds-api.com)
- Design inspired by [FiveThirtyEight](https://fivethirtyeight.com)
- Tournament structure from official FIFA sources

---

**Last Updated:** May 2026  
**World Cup Dates:** June 11 – July 19, 2026  
**Current Leader:** Ian Whelan (17.52% – Spain + Qatar)

---

## API Response Examples

For reference, here are sample API responses:

**Match Odds Response:**
```
```json
[
  {"id":"80d82d1113934bfbea4ce8daf37a2433",
   "sport_key":"soccer_fifa_world_cup",
   "sport_title":"FIFA World Cup",
   "commence_time":"2026-06-11T19:00:00Z",
   "home_team":"Mexico",
   "away_team":"South Africa",
   "bookmakers":[
     {"key":"paddypower",
      "title":"Paddy Power",
      "last_update":"2026-05-26T14:21:41Z",
      "markets":[
        {"key":"h2h",
         "last_update":"2026-05-26T14:21:41Z",
         "outcomes":[
           {"name":"Mexico","price":1.44},
           {"name":"South Africa","price":7.0},
           {"name":"Draw","price":4.2}
         ]
        }
      ]
     },
     {"key":"skybet",
      "title":"Sky Bet",
      "last_update":"2026-05-26T14:22:46Z",
      "markets":[
        {"key":"h2h",
         "last_update":"2026-05-26T14:22:46Z",
         "outcomes":[
           {"name":"Mexico","price":1.44},
           {"name":"South Africa","price":7.0},
           {"name":"Draw","price":4.2}
         ]
        }
      ]
     },
     {"key":"grosvenor",
      "title":"Grosvenor",
      "last_update":"2026-05-26T14:22:58Z",
      "markets":[
        {"key":"h2h",
         "last_update":"2026-05-26T14:22:58Z",
         "outcomes":[
           {"name":"Mexico","price":1.47},
           {"name":"South Africa","price":7.0},
           {"name":"Draw","price":4.1}
         ]
        }
      ]
     },
     {"key":"betfair_ex_uk",
      "title":"Betfair",
      "last_update":"2026-05-26T14:23:39Z",
      "markets":[
        {"key":"h2h",
         "last_update":"2026-05-26T14:23:39Z",
         "outcomes":[
           {"name":"Mexico","price":1.51},
           {"name":"South Africa","price":7.8},
           {"name":"Draw","price":4.5}
         ]
        },
        {"key":"h2h_lay",
         "last_update":"2026-05-26T14:23:39Z",
         "outcomes":[
           {"name":"Mexico","price":1.53},
           {"name":"South Africa","price":8.2},
           {"name":"Draw","price":4.8}
         ]
        }
      ]
     },
     {"key":"smarkets",
      "title":"Smarkets",
      "last_update":"2026-05-26T14:23:59Z",
      "markets":[
        {"key":"h2h",
         "last_update":"2026-05-26T14:23:58Z",
         "outcomes":[
           {"name":"Mexico","price":1.49},
           {"name":"South Africa","price":7.8},
           {"name":"Draw","price":4.4}
         ]
        },
        {"key":"h2h_lay",
         "last_update":"2026-05-26T14:23:58Z",
         "outcomes":[
           {"name":"Mexico","price":1.53},
           {"name":"South Africa","price":8.2},
           {"name":"Draw","price":4.8}
         ]
        }
      ]
     },
     {"key":"casumo",
      "title":"Casumo",
      "last_update":"2026-05-26T14:23:58Z",
      "markets":[
        {"key":"h2h",
         "last_update":"2026-05-26T14:23:57Z",
         "outcomes":[
           {"name":"Mexico","price":1.47},
           {"name":"South Africa","price":7.0},
           {"name":"Draw","price":4.1}
         ]
        }
      ]
     },
     {"key":"coral",
      "title":"Coral",
      "last_update":"2026-05-26T14:22:58Z",
      "markets":[
        {"key":"h2h",
         "last_update":"2026-05-26T14:22:58Z",
         "outcomes":[
           {"name":"Mexico","price":1.5},
           {"name":"South Africa","price":6.5},
           {"name":"Draw","price":4.2}
         ]
        }
      ]
     },
     {"key":"ladbrokes_uk",
      "title":"Ladbrokes",
      "last_update":"2026-05-26T14:23:37Z",
      "markets":[
        {"key":"h2h",
         "last_update":"2026-05-26T14:23:37Z",
         "outcomes":[
           {"name":"Mexico","price":1.5},
           {"name":"South Africa","price":6.5},
           {"name":"Draw","price":4.2}
         ]
        }
      ]
     },
     {"key":"betway",
      "title":"Betway",
      "last_update":"2026-05-26T14:23:19Z",
      "markets":[
        {"key":"h2h",
         "last_update":"2026-05-26T14:23:19Z",
         "outcomes":[
           {"name":"Mexico","price":1.5},
           {"name":"South Africa","price":5.75},
           {"name":"Draw","price":4.2}
         ]
        }
      ]
     },
     {"key":"sport888",
      "title":"888sport",
      "last_update":"2026-05-26T14:23:36Z",
      "markets":[
        {"key":"h2h",
         "last_update":"2026-05-26T14:23:36Z",
         "outcomes":[
           {"name":"Mexico","price":1.44},
           {"name":"South Africa","price":6.5},
           {"name":"Draw","price":4.0}
         ]
        }
      ]
     },
     {"key":"williamhill","title":"William Hill","last_update":"2026-05-26T14:22:58Z","markets":[{"key":"h2h","last_update":"2026-05-26T14:22:58Z","outcomes":[{"name":"Mexico","price":1.44},{"name":"South Africa","price":6.5},{"name":"Draw","price":4.0}]}]},
     {"key":"unibet_uk","title":"Unibet (UK)","last_update":"2026-05-26T14:23:20Z","markets":[{"key":"h2h","last_update":"2026-05-26T14:23:19Z","outcomes":[{"name":"Mexico","price":1.45},{"name":"South Africa","price":6.5},{"name":"Draw","price":4.0}]}]},
     {"key":"livescorebet","title":"LiveScore Bet","last_update":"2026-05-26T14:23:38Z","markets":[{"key":"h2h","last_update":"2026-05-26T14:23:37Z","outcomes":[{"name":"Mexico","price":1.47},{"name":"South Africa","price":7.0},{"name":"Draw","price":4.1}]}]},
     {"key":"leovegas","title":"LeoVegas","last_update":"2026-05-26T14:23:58Z","markets":[{"key":"h2h","last_update":"2026-05-26T14:23:57Z","outcomes":[{"name":"Mexico","price":1.47},{"name":"South Africa","price":7.0},{"name":"Draw","price":4.1}]}]},
     {"key":"virginbet","title":"Virgin Bet","last_update":"2026-05-26T14:23:57Z","markets":[{"key":"h2h","last_update":"2026-05-26T14:23:57Z","outcomes":[{"name":"Mexico","price":1.47},{"name":"South Africa","price":7.0},{"name":"Draw","price":4.1}]}]},
     {"key":"boylesports","title":"BoyleSports","last_update":"2026-05-26T14:23:59Z","markets":[{"key":"h2h","last_update":"2026-05-26T14:23:58Z","outcomes":[{"name":"Mexico","price":1.44},{"name":"South Africa","price":7.0},{"name":"Draw","price":4.0}]}]},
     {"key":"betfred_uk","title":"Betfred (UK)","last_update":"2026-05-26T14:23:56Z","markets":[{"key":"h2h","last_update":"2026-05-26T14:23:56Z","outcomes":[{"name":"Mexico","price":1.5},{"name":"South Africa","price":7.5},{"name":"Draw","price":4.0}]}]},
     {"key":"betvictor","title":"Bet Victor","last_update":"2026-05-26T14:23:51Z","markets":[{"key":"h2h","last_update":"2026-05-26T14:23:51Z","outcomes":[{"name":"Mexico","price":1.44},{"name":"South Africa","price":7.0},{"name":"Draw","price":3.9}]}]},
     {"key":"matchbook","title":"Matchbook","last_update":"2026-05-26T14:23:37Z","markets":[{"key":"h2h","last_update":"2026-05-26T14:23:37Z","outcomes":[{"name":"Mexico","price":1.5},{"name":"South Africa","price":7.8},{"name":"Draw","price":4.5}]},{"key":"h2h_lay","last_update":"2026-05-26T14:23:37Z","outcomes":[{"name":"Mexico","price":1.54},{"name":"South Africa","price":8.4},{"name":"Draw","price":4.8}]}]}
   ]
  },
  ...
]
```

**Tournament Winner Odds Response (truncated):**
```json
[{
  "id": "94d798388a4dab6d081114ad5e83db38",
  "sport_key": "soccer_fifa_world_cup_winner",
  "bookmakers": [{
    "key": "betfair_ex_uk",
    "title": "Betfair",
    "markets": [{
      "key": "outrights",
      "outcomes": [
        {"name": "Spain", "price": 6.0},
        {"name": "France", "price": 6.4},
        {"name": "England", "price": 8.2},
        ...
      ]
    }]
  }]
}]
```