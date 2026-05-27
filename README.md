# 2026 World Cup Sweepstake Visualizations

Professional-grade visualizations for tracking office World Cup sweepstakes, inspired by FiveThirtyEight's data journalism aesthetic.

## Features

- **Leaderboard**: Participant rankings with win probabilities and weekly changes
- **Team Rankings**: All 48 teams sorted by tournament winner probability
- **Upcoming Matches**: Next 7 days of fixtures with win/draw odds
- **Probability Timeline**: Track how each participant's chances evolve over time
- **Automated Data Pipeline**: Fetch odds → process → generate visualizations

## Quick Start

```bash
# Install dependencies
npm install

# Run complete pipeline (fetch odds + process + generate images)
npm run generate

# Or run individual steps
npm run fetch      # Fetch latest odds (2 API calls)
npm run process    # Calculate probabilities
npm run visualize  # Generate PNG images
```

## Output

All visualizations are saved to the `output/` directory as PNG images:
- `leaderboard.png` - Current sweepstake standings
- `team-rankings.png` - All 48 teams ranked by win probability
- `upcoming-matches.png` - Next week's fixtures with odds
- `timeline.png` - Historical probability evolution

## Data Files

- `data/sweepstake.json` - Participant assignments (edit to add late entries)
- `data/tournament.json` - World Cup structure (fixtures, groups, venues)
- `data/odds/` - Archived API responses with timestamps
- `data/processed/latest.json` - Calculated probabilities and rankings

## API Usage

Uses [the-odds-api.com](https://the-odds-api.com) with 500 free calls/month:
- 2 calls per run (match odds + tournament winner odds)
- 494 calls remaining this month
- Automatically tracks usage and warns at <50 remaining

## Current Standings

**Last updated**: 27 May 2026

1. **Ian Whelan** - 17.52% (Spain + Qatar)
2. **Tina Buckley** - 13.51% (England + Egypt)  
3. **Caitlin Kilcoyne** - 10.42% (Brazil + Saudi Arabia)

## How It Works

1. **Fetch**: Downloads betting odds from multiple bookmakers
2. **Process**: Converts decimal odds to probabilities, averages across bookmakers, calculates participant totals
3. **Visualize**: Renders HTML templates with Puppeteer, captures as PNG images

---

## API Details

Aim of this project is to create professional grade visualisations for our companies 2026 World cup sweepstake. 

We will need code to pull odds from the internet, and then further code to process the odds, upcoming matchups and meta information (like who has drawn which team) to build a compelling visualisation of the world cup tournament, everyone's various odds of individual game wins, making it out of the group stages, getting to the finals/semi-finals, and also since everyone has drawn two teams, which individual currently has the best odds of winning it all.

We have a free tier account which allows for 500 api calls, reseting on the 1st of each month.
the-odds-api.com API KEY: ed7e6908eb6aae33fcf0f22140a2e47f

`GET https://api.the-odds-api.com/v4/sports/?apiKey=ed7e6908eb6aae33fcf0f22140a2e47f&all=true` return multiple values, notably:
{"key":"soccer_fifa_club_world_cup","group":"Soccer","title":"FIFA Club World Cup","description":"FIFA Club World Cup","active":false,"has_outrights":false},
{"key":"soccer_fifa_world_cup","group":"Soccer","title":"FIFA World Cup","description":"FIFA World Cup 2026","active":true,"has_outrights":false},
{"key":"soccer_fifa_world_cup_qualifiers_europe","group":"Soccer","title":"FIFA World Cup Qualifiers - Europe","description":"FIFA World Cup Qualifiers - UEFA","active":false,"has_outrights":false},
{"key":"soccer_fifa_world_cup_qualifiers_south_america","group":"Soccer","title":"FIFA World Cup Qualifiers - South America","description":"FIFA World Cup Qualifiers - CONMEBOL","active":false,"has_outrights":false},
{"key":"soccer_fifa_world_cup_winner","group":"Soccer","title":"FIFA World Cup Winner","description":"FIFA World Cup Winner 2026","active":true,"has_outrights":true},

The following costs 1 token, and pulls odds for various matchups, giving price for either team winnind, or a draw, across a lot of bookmakers.
`GET https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup/odds?apiKey=ed7e6908eb6aae33fcf0f22140a2e47f&regions=uk&markets=h2h&oddsFormat=decimal` returns:
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

For the odds of winning everything instead of upcoming head to heads:

`GET https://api.the-odds-api.com/v4/sports/soccer_fifa_world_cup_winner/odds?apiKey=ed7e6908eb6aae33fcf0f22140a2e47f&regions=uk&markets=outrights&oddsFormat=decimal`

```
[{"id":"94d798388a4dab6d081114ad5e83db38","has_outrights":true,"sport_key":"soccer_fifa_world_cup_winner","sport_title":"FIFA World Cup Winner","commence_time":"2026-07-19T19:00:00Z","home_team":null,"away_team":null,"bookmakers":[{"key":"betfair_ex_uk","title":"Betfair","last_update":"2026-05-27T10:49:55Z","markets":[{"key":"outrights","last_update":"2026-05-27T10:49:55Z","outcomes":[{"name":"Spain","price":6.0},{"name":"France","price":6.4},{"name":"England","price":8.2},{"name":"Brazil","price":10.5},{"name":"Argentina","price":10.5},{"name":"Portugal","price":12.0},{"name":"Germany","price":17.5},{"name":"Netherlands","price":28.0},{"name":"Norway","price":38.0},{"name":"Belgium","price":48.0},{"name":"Colombia","price":50.0},{"name":"Japan","price":60.0},{"name":"Morocco","price":70.0},{"name":"USA","price":85.0},{"name":"Mexico","price":95.0},{"name":"Uruguay","price":100.0},{"name":"Ecuador","price":100.0},{"name":"Switzerland","price":100.0},{"name":"Turkey","price":120.0},{"name":"Croatia","price":150.0},{"name":"Senegal","price":150.0},{"name":"Sweden","price":180.0},{"name":"Austria","price":180.0},{"name":"Italy","price":210.0},{"name":"Scotland","price":270.0},{"name":"Canada","price":360.0},{"name":"Ivory Coast","price":360.0},{"name":"Paraguay","price":400.0},{"name":"Czech Republic","price":440.0},{"name":"Egypt","price":480.0},{"name":"South Korea","price":500.0},{"name":"Algeria","price":560.0},{"name":"Bosnia & Herzegovina","price":590.0},{"name":"Ghana","price":640.0},{"name":"Australia","price":720.0},{"name":"Tunisia","price":1000.0},{"name":"Denmark","price":1000.0},{"name":"Iran","price":1000.0},{"name":"Jordan","price":1000.0},{"name":"Uzbekistan","price":1000.0},{"name":"New Zealand","price":1000.0},{"name":"Poland","price":1000.0},{"name":"Qatar","price":1000.0},{"name":"Saudi Arabia","price":1000.0},{"name":"Cape Verde","price":1000.0},{"name":"South Africa","price":1000.0},{"name":"Bolivia","price":1000.0},{"name":"Cura\u00e7ao","price":1000.0},{"name":"DR Congo","price":1000.0},{"name":"Haiti","price":1000.0},{"name":"Iraq","price":1000.0},{"name":"Jamaica","price":1000.0},{"name":"Kosovo","price":1000.0},{"name":"Panama","price":1000.0}]},{"key":"outrights_lay","last_update":"2026-05-27T10:49:55Z","outcomes":[{"name":"Spain","price":6.2},{"name":"France","price":6.6},{"name":"England","price":8.4},{"name":"Brazil","price":11.0},{"name":"Argentina","price":11.0},{"name":"Portugal","price":12.5},{"name":"Germany","price":18.0},{"name":"Netherlands","price":29.0},{"name":"Norway","price":40.0},{"name":"Belgium","price":50.0},{"name":"Colombia","price":55.0},{"name":"Japan","price":65.0},{"name":"Morocco","price":75.0},{"name":"USA","price":90.0},{"name":"Mexico","price":100.0},{"name":"Uruguay","price":110.0},{"name":"Ecuador","price":110.0},{"name":"Switzerland","price":110.0},{"name":"Turkey","price":140.0},{"name":"Croatia","price":160.0},{"name":"Senegal","price":160.0},{"name":"Sweden","price":190.0},{"name":"Austria","price":190.0},{"name":"Scotland","price":280.0},{"name":"Ivory Coast","price":380.0},{"name":"Canada","price":390.0},{"name":"Paraguay","price":420.0},{"name":"South Korea","price":550.0},{"name":"Algeria","price":600.0},{"name":"Czech Republic","price":620.0},{"name":"Bosnia & Herzegovina","price":620.0},{"name":"Ghana","price":680.0},{"name":"Australia","price":730.0},{"name":"Egypt","price":750.0},{"name":"Italy","price":1000.0}]}]},{"key":"williamhill","title":"William Hill","last_update":"2026-05-27T10:52:30Z","markets":[{"key":"outrights","last_update":"2026-05-27T10:52:30Z","outcomes":[{"name":"Spain","price":5.5},{"name":"France","price":5.5},{"name":"England","price":7.0},{"name":"Brazil","price":9.0},{"name":"Argentina","price":10.0},{"name":"Portugal","price":12.0},{"name":"Germany","price":15.0},{"name":"Netherlands","price":21.0},{"name":"Norway","price":29.0},{"name":"Belgium","price":34.0},{"name":"Colombia","price":34.0},{"name":"USA","price":51.0},{"name":"Japan","price":51.0},{"name":"Switzerland","price":51.0},{"name":"Uruguay","price":67.0},{"name":"Morocco","price":67.0},{"name":"Mexico","price":67.0},{"name":"Sweden","price":67.0},{"name":"Croatia","price":81.0},{"name":"Ivory Coast","price":81.0},{"name":"Turkey","price":81.0},{"name":"Ecuador","price":101.0},{"name":"Senegal","price":101.0},{"name":"Austria","price":101.0},{"name":"Canada","price":151.0},{"name":"Paraguay","price":151.0},{"name":"Scotland","price":151.0},{"name":"Czech Republic","price":201.0},{"name":"Bosnia & Herzegovina","price":201.0},{"name":"Ghana","price":251.0},{"name":"Egypt","price":301.0},{"name":"South Korea","price":301.0},{"name":"Algeria","price":301.0},{"name":"South Africa","price":501.0},{"name":"Australia","price":501.0},{"name":"Tunisia","price":501.0},{"name":"Iran","price":501.0},{"name":"DR Congo","price":751.0},{"name":"Qatar","price":1001.0},{"name":"New Zealand","price":1001.0},{"name":"Saudi Arabia","price":1001.0},{"name":"Iraq","price":1001.0},{"name":"Cape Verde","price":1001.0},{"name":"Panama","price":1001.0},{"name":"Uzbekistan","price":1501.0},{"name":"Haiti","price":2001.0},{"name":"Cura\u00e7ao","price":2001.0},{"name":"Jordan","price":2001.0}]}]}]}]
```