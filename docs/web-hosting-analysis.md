# Web Hosting Analysis: From Static PNGs to a Live Dashboard

## Current State

The project generates three static PNG visualizations via Puppeteer rendering HTML templates. This works well for sharing in Slack/Teams but has limitations:
- No interactivity
- Manual regeneration required
- Can't drill down into data
- Mobile experience is "zoom and pan on an image"

## What We'd Need to Build

### Architecture Options

**Option A: Static Site with Pre-rendered HTML**
- Convert current templates from "render to PNG" to "serve directly as HTML"
- Data baked into HTML files at build time
- Regenerate and redeploy when odds update
- Simplest approach, works with GitHub Pages

**Option B: Static Site with Client-Side Data Loading**
- HTML templates load JSON data files at runtime
- Update data files without rebuilding HTML
- Still no server required
- Works with GitHub Pages

**Option C: Dynamic Server**
- Express/Fastify backend serving live data
- Real-time odds fetching
- WebSocket updates during matches
- Requires hosting (AWS, Render, etc.)

### Recommended Approach

**Option B** is the sweet spot. Here's why:
- Templates already exist as working HTML
- Minimal changes needed (swap `DATA_PLACEHOLDER` injection for `fetch()`)
- Can update data independently of code
- GitHub Pages compatible
- Progressive enhancement path to Option C later

## Site Structure & Layout

Based on the README's planned visualizations, here's a proposed information architecture:

```
/                           → Sweepstake Leaderboard (homepage)
/probabilities              → Stage Probabilities table (current stage-probabilities)
/matches                    → Upcoming Matches (current upcoming-matches)
/timeline                   → Probability Race chart (current timeline)
/bracket                    → Probabilistic Bracket (knockout stage only)
/groups                     → Group Stage Heat Maps
/upsets                     → Upset Tracker
/simulator                  → Head-to-Head Simulator (interactive)
```

### Homepage: Sweepstake Leaderboard
The "refresh obsessively" view. Ranked list of participants with:
- Current win probability
- Movement arrows (↑↓) since last update
- Mini sparkline of recent probability trend
- Expandable row showing their two teams

### Navigation
Simple top nav bar with tournament phase indicator:
```
[🏆 Leaderboard] [📊 Probabilities] [⚽ Matches] [📈 Timeline] [🎯 Bracket]
                        ──────── Group Stage ────────
```

## Hosting Options

### GitHub Pages (Recommended for MVP)

**Pros:**
- Free
- Simple deployment (push to `gh-pages` branch)
- Custom domain support
- HTTPS included
- No infrastructure to manage

**Cons:**
- Static only (no server-side logic)
- Must commit data files to trigger rebuild
- Rate limited (soft limit ~100GB bandwidth/month)
- Public by default

**Implementation:**
```yaml
# .github/workflows/deploy.yml
name: Deploy to GitHub Pages
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 */6 * * *'  # Rebuild every 6 hours

jobs:
  build-deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm run fetch
      - run: npm run process
      - run: npm run build-site  # New script to generate HTML
      - uses: peaceiris/actions-gh-pages@v3
        with:
          github_token: ${{ secrets.GITHUB_TOKEN }}
          publish_dir: ./dist
```

**Access Control:**
- GitHub Pages on public repos = public site
- GitHub Pages on private repos requires GitHub Pro/Team ($4-21/user/month)
- Alternative: Use GitHub Actions to deploy to S3/CloudFront with IP restrictions

### AWS S3 + CloudFront (Company Hosting)

**Pros:**
- Private access via VPN/IP allowlist
- Custom domain with company SSL cert
- Can integrate with existing AWS infrastructure
- Pay only for what you use (~$1-5/month for this traffic)

**Cons:**
- Requires AWS account access
- More setup complexity
- Need to manage deployment pipeline

**Implementation:**
```
S3 bucket (static hosting) → CloudFront distribution → VPN IP allowlist
                                    ↓
                          company-sweepstake.inrix.com
```

### Comparison Matrix

| Factor | GitHub Pages | AWS S3/CloudFront |
|--------|--------------|-------------------|
| Cost | Free | ~$2/month |
| Setup time | 30 minutes | 2-3 hours |
| Access control | Public or paid private | IP allowlist via VPN |
| Custom domain | Yes | Yes |
| Auto-deploy | GitHub Actions | GitHub Actions → S3 |
| Maintenance | None | Minimal |

## Decisions

### Access & Audience
1. **Who needs access?** Office + anyone they share the link with
2. **Must it be private?** No — only data is team assignments; odds are public
3. **Mobile-first?** No — desktop is fine, people won't check during matches

### Data & Updates
4. **Update frequency?** 4x daily + manual triggers for key moments
5. **Historical data?** Yes — keep full timeline for tracking odds changes and identifying upsets (need pre-match odds preserved after results come in)
6. **API budget?** 4x daily = ~240 calls/month, well within 500 free limit

### Features & Scope
7. **MVP scope?** Three tabs:
   - **Stage Probabilities** (landing page) — current stage-probabilities view
   - **Upcoming Matches** — with subtabs for Matchday 1, 2, 3 (need to generate MD2/MD3)
   - **Timeline** — probability race over time
8. **Interactivity priority?** None for MVP; consider post-tournament
9. **Notifications?** No — no email/Slack alerts needed

### Technical
10. **Domain?** `jhkidd.github.io/2026-world-cup` (personal GitHub account)
11. **Existing infra?** None — recreational project, not company infrastructure
12. **Who maintains it?** Josh only

## Site Structure (MVP)

```
jhkidd.github.io/2026-world-cup/
│
├── index.html                    # Stage Probabilities (landing)
├── matches.html                  # Upcoming Matches container
│   ├── ?day=1                    # Matchday 1 (default)
│   ├── ?day=2                    # Matchday 2
│   └── ?day=3                    # Matchday 3
├── timeline.html                 # Probability Race
│
└── data/
    ├── latest.json               # Current processed data
    └── history/                  # Archived snapshots for timeline
```

### Navigation Bar
```
[🏆 Standings]  [⚽ Matches ▾]  [📈 Timeline]
                 ├─ Matchday 1
                 ├─ Matchday 2
                 └─ Matchday 3
```

## Implementation Plan

### Phase 1: GitHub Pages MVP
1. Push repo to `jhkidd` GitHub account
2. Enable GitHub Pages
3. Refactor templates for client-side data loading
4. Generate matchday 2 & 3 data
5. Create tabbed navigation
6. Set up GitHub Actions for auto-updates

### Phase 2: During Tournament
- Monitor and fix any issues
- Add upset tracking once matches complete
- Consider knockout bracket when groups finish

## Setting Up GitHub Pages (Step-by-Step)

### Step 1: Create Repository on Your Personal Account

Option A — **Transfer existing repo** (if it's already on GitHub elsewhere):
```
Source repo → Settings → General → Danger Zone → Transfer ownership → jhkidd
```

Option B — **Push fresh to your account** (if local only or on work account):
```bash
# In your project directory
git remote remove origin  # if exists
git remote add origin https://github.com/jhkidd/2026-world-cup.git

# Create the repo on GitHub first (github.com/new), then:
git push -u origin main
```

### Step 2: Enable GitHub Pages

1. Go to `github.com/jhkidd/2026-world-cup`
2. Click **Settings** (top menu)
3. Click **Pages** (left sidebar)
4. Under "Source", select:
   - **Deploy from a branch**
   - Branch: `main`
   - Folder: `/ (root)` (we'll change this to `/dist` later)
5. Click **Save**

Your site will be live at: `https://jhkidd.github.io/2026-world-cup/`

### Step 3: Add Repository Secrets (for API key)

1. Go to **Settings → Secrets and variables → Actions**
2. Click **New repository secret**
3. Name: `ODDS_API_KEY`
4. Value: *(your the-odds-api.com key)*
5. Click **Add secret**

### Step 4: Create GitHub Actions Workflow

Create `.github/workflows/update-odds.yml` (already documented above).

The workflow will:
- Run 4x daily automatically
- Fetch latest odds
- Run Monte Carlo simulation
- Commit updated data
- GitHub Pages auto-deploys on push

### Linking Local Repo to Your GitHub Account

If the repo is currently only on your work machine:

```powershell
# Check current remotes
git remote -v

# If pointing to work account, remove it
git remote remove origin

# Add your personal account as origin
git remote add origin https://github.com/jhkidd/2026-world-cup.git

# First, create empty repo at github.com/jhkidd (click "New repository")
# Name it: 2026-world-cup
# Don't initialize with README (you already have code)

# Push everything
git push -u origin main
```

You'll be prompted to authenticate. If using HTTPS, you'll need a Personal Access Token:
1. GitHub → Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Generate new token with `repo` scope
3. Use token as password when pushing

Alternatively, set up SSH keys for passwordless push (recommended for ongoing use).

---

## Data Update Flow (Option B)

With Option B (static site, client-side data loading), updating odds is simple: push new JSON, visitors get fresh data on next page load.

### The Pipeline

```
GitHub Actions (scheduled) 
    → npm run fetch (get odds from API)
    → npm run process (run Monte Carlo, generate latest.json)
    → Commit & push JSON to gh-pages branch
    → GitHub Pages serves updated file
    → Visitors' browsers fetch() fresh data on page load
```

### GitHub Actions Workflow

```yaml
# .github/workflows/update-odds.yml
name: Update Odds
on:
  schedule:
    # 4x daily: 8am, 12pm, 6pm, 10pm UTC
    - cron: '0 8,12,18,22 * * *'
  workflow_dispatch:  # Manual trigger button in GitHub UI

jobs:
  update:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      
      - name: Fetch latest odds
        run: npm run fetch
        env:
          ODDS_API_KEY: ${{ secrets.ODDS_API_KEY }}
      
      - name: Process data & run Monte Carlo
        run: npm run process
      
      - name: Commit and push if changed
        run: |
          git config user.name "github-actions[bot]"
          git config user.email "actions@github.com"
          git add data/
          git diff --staged --quiet || git commit -m "Update odds $(date -u +%Y-%m-%d-%H%M)"
          git push
```

### Update Frequency vs API Budget

| Schedule | Updates/Day | Monthly API Calls | Notes |
|----------|-------------|-------------------|-------|
| Every 6 hours | 4 | ~240 | Safe default, stays well under 500 limit |
| Every 3 hours | 8 | ~480 | Near limit, good for tournament runtime |
| Every hour | 24 | ~720 | Exceeds free tier, need paid plan |
| Manual only | varies | minimal | For pre-tournament testing |

**Recommended approach:**
- Pre-tournament: Manual triggers only (preserve API budget)
- Group stage: Every 6 hours (4x daily)
- Knockout stage: Every 3 hours (odds move faster)
- Match days: Manual trigger before kickoff + after final whistle

### What Visitors Experience

1. Page loads → browser fetches `/data/latest.json`
2. JavaScript renders visualizations with current data
3. Timestamp shown: "Updated 29 May 2026, 18:00 UTC"
4. Hard refresh always gets latest data (JSON not cached aggressively)

### Manual Trigger

The `workflow_dispatch` trigger adds a "Run workflow" button in GitHub:

```
Repository → Actions → Update Odds → Run workflow
```

Useful for:
- Refreshing right before a big match
- Testing the pipeline
- Recovering from a failed scheduled run

## Technical Changes Required

### Current → Web-Ready Templates

**Before (generate-visualizations.js):**
```javascript
html = html.replace('DATA_PLACEHOLDER', JSON.stringify(data));
```

**After (client-side loading):**
```html
<script>
  fetch('/data/latest.json')
    .then(r => r.json())
    .then(data => {
      // existing rendering logic
    });
</script>
```

### New Build Script

```javascript
// src/build-site.js
// 1. Copy templates to dist/
// 2. Copy data/processed/latest.json to dist/data/
// 3. Copy profile pictures to dist/profiles/
// 4. Generate index.html with navigation
```

### Profile Pictures

Currently embedded as base64 in PNGs. For web:
- Serve as actual image files
- Much smaller page weight
- Browser caching works properly

## Cost Summary

| Option | Monthly Cost | Notes |
|--------|--------------|-------|
| GitHub Pages (public) | $0 | Obscure URL only |
| GitHub Pages (private) | $4/user | Requires GitHub Team |
| AWS S3 + CloudFront | ~$2 | VPN-restricted access |
| Render/Vercel (static) | $0 | Alternative to GitHub Pages |

## My Recommendation

**Start with GitHub Pages (public)** for the MVP. The URL won't be indexed by Google unless you link to it publicly. Share via direct link in company Slack.

If privacy becomes a concern mid-tournament:
- Quick fix: Add HTTP Basic Auth via Cloudflare (free tier)
- Proper fix: Move to S3 + CloudFront with VPN allowlist

This gets you live in 1-2 days with zero ongoing cost, and the migration path to private hosting is straightforward if needed.

---

*Written: 29 May 2026*
