# Knockout Bracket "What If?" Feature

## Section 1 — Q&A

**Q1: For the "What if?" snapshot, should the Monte Carlo simulation be re-run at build time using the pre-knockout odds (June 27 snapshot), producing a separate `bracket-pre-knockout.json`?**
A: Yes, pre-compute a separate `bracket-pre-knockout.json`, however this only needs to be calculated once. As it's a snapshot we do not need to rebuild it.

**Q2: In the "What if?" view, should the user still be able to interact with the bracket (click to lock in teams), or should it be read-only?**
A: Fully interactive — same click-to-lock behaviour as the current bracket.

**Q3: Where should the "What if?" button be placed?**
A: A toggle button near the existing Reset button in the bracket controls bar.

**Q4: What should the button label say?**
A: "What If?" / "Back to Reality" toggle labels.

**Q5: When the user toggles to "What if?" mode, should there be a visual indicator beyond the button label?**
A: Change the title from "Knockout Bracket" to "Knockout Bracket - Circa June 27th" when in What If mode.

**Q6: Should locked picks be preserved separately for each mode?**
A: No — reset locked picks when toggling between modes.

**Q7: Should the pre-knockout snapshot have zero completed matches?**
A: Yes — no actual results. The group stages should be finished so it should already be decided which teams appear where in the knockout bracket.

**Q8: Should positions 0-31 (the 32 knockout entrants) reflect actual group stage results?**
A: Yes, the pre-knockout bracket.json should reflect the actual group stage results that determined seeding.

**Q9: Which data source should drive the knockout match probabilities?**
A: Use the June 27 bookmaker odds + Elo ratings for knockout match probabilities.

**Q10: How many Monte Carlo simulation runs?**
A: Same 50,000 runs as the current bracket.

**Q11: Is this prototyping or production code?**
A: Production code with full testing.

**Q12: How should `bracket-pre-knockout.json` be generated?**
A: A separate npm script (`npm run generate-pre-knockout`). It imports existing Monte Carlo functions, loads June 27 odds + Elo ratings, determines actual group stage qualifiers from results.json, runs 50k MC simulations for the knockout, and saves to `data/processed/bracket-pre-knockout.json`.

---

## Section 2 — Step-by-Step Implementation Plan

### Phase 1: Generate the pre-knockout bracket data

- [ ] **1. Create `src/generate-pre-knockout.js`**
  - New script that:
    - Loads `data/odds/2026-06-27_18-33-08.json` (last odds file before knockout)
    - Loads `data/elo_ratings_pre_tournament.json` for Elo ratings
    - Loads `data/tournament.json` for tournament structure
    - Loads `data/results.json` for actual group stage outcomes
    - Determines the 32 knockout qualifiers and their bracket positions from actual group results
    - Imports `simulateTournament`, `eloWinProbability`, `deriveTeamStrengths` etc. from `src/monte-carlo.js`
    - Runs 50,000 Monte Carlo simulations of the knockout stage only
    - Outputs `data/processed/bracket-pre-knockout.json` with same schema as `bracket.json` but with:
      - `actualResults: {}` (empty — no knockout matches completed)
      - `runs`: 50k knockout-only simulation paths
      - `bracketTopology`, `teamIndex`, `indexToTeam`: same as current bracket.json
  - Expected output: `data/processed/bracket-pre-knockout.json` (similar size to `bracket.json`)

- [ ] **2. Add npm script to `package.json`**
  - Add `"generate-pre-knockout": "node src/generate-pre-knockout.js"` to the `scripts` section

- [ ] **3. Run the script and commit the generated file**
  - Execute `npm run generate-pre-knockout`
  - Verify the output file is valid (correct schema, 50k runs, empty actualResults, correct team placements at positions 0-31)
  - Commit `bracket-pre-knockout.json` to the repo (it will never need regenerating)

### Phase 2: Update build pipeline to include the new file

- [ ] **4. Update `src/build-site.js` — copy `bracket-pre-knockout.json` to dist**
  - In the "Copy data files" section (near line 32-36), add a copy step for `bracket-pre-knockout.json` → `dist/data/bracket-pre-knockout.json`
  - Guard with `existsSync` check (same pattern as `bracket.json`)

### Phase 3: Add "What If?" toggle to the knockout bracket UI

- [ ] **5. Add state variables in `build-site.js` JavaScript section**
  - Add `let preKnockoutBracketData = null;` alongside existing `bracketData`
  - Add `let isWhatIfMode = false;` flag
  - Add `let savedLockedResults = {};` for preserving current-mode locks when toggling

- [ ] **6. Add `loadPreKnockoutBracket()` function**
  - Fetches `data/bracket-pre-knockout.json` (lazy-loaded on first toggle)
  - Stores in `preKnockoutBracketData`
  - Returns the loaded data

- [ ] **7. Add `toggleWhatIf()` function**
  - If switching TO "What if?" mode:
    - Save current `lockedResults` to `savedLockedResults`
    - Set `lockedResults = {}`
    - Set `isWhatIfMode = true`
    - Load pre-knockout data if not already loaded
    - Re-render bracket using `preKnockoutBracketData`
  - If switching BACK to "current" mode:
    - Set `lockedResults` to actual results from `bracketData.actualResults` (same as resetBracket)
    - Set `isWhatIfMode = false`
    - Re-render bracket using `bracketData`

- [ ] **8. Update `renderBracket()` to support What If mode**
  - Use `isWhatIfMode ? preKnockoutBracketData : bracketData` as the data source
  - Change heading: "🏆 Knockout Bracket" vs "🏆 Knockout Bracket - Circa June 27th"
  - Add "What If?" / "Back to Reality" button in the bracket controls div (next to Reset)
  - The scenario count should reflect the correct dataset's run count

- [ ] **9. Update `getFilteredRuns()` to use the active dataset**
  - When `isWhatIfMode` is true, filter against `preKnockoutBracketData.runs` instead of `bracketData.runs`

- [ ] **10. Update `resetBracket()` to respect What If mode**
  - In What If mode: reset to empty locks (no actual results)
  - In current mode: reset to actual results (existing behaviour)

- [ ] **11. Update helper functions that reference `bracketData` directly**
  - `getTeamName()`, `getTeamBadgeHtml()`, `renderBracketMatch()`, `computeBracketProbabilities()`, `getParticipantPositions()` — any function that accesses `bracketData.bracketTopology`, `bracketData.indexToTeam`, or `bracketData.actualResults` needs to use the active dataset
  - Introduce a helper like `getActiveBracketData()` that returns the correct dataset based on `isWhatIfMode`

### Phase 4: Styling

- [ ] **12. Style the "What If?" button**
  - Match existing button styling (similar to Reset button)
  - Optionally give it a distinct colour/icon to make it stand out as a toggle (e.g., a subtle highlight when active)

### Phase 5: Testing

- [ ] **13. Verify the generated `bracket-pre-knockout.json`**
  - Confirm it has 50,000 runs
  - Confirm `actualResults` is `{}`
  - Confirm positions 0-31 match the actual group stage qualifiers
  - Confirm the `bracketTopology`, `teamIndex`, `indexToTeam` match the current `bracket.json`

- [ ] **14. Manual integration testing**
  - Build the site (`npm run build`)
  - Verify the Knockout tab loads normally (current bracket)
  - Click "What If?" — verify title changes, all matches show as probabilistic (no scores), correct teams in R32
  - Click to lock picks in What If mode — verify scenario filtering works
  - Click "Back to Reality" — verify it returns to current bracket with actual results, picks reset
  - Click "Reset" in both modes — verify correct behaviour
  - Verify "What If?" button state is correct after multiple toggles

- [ ] **15. Write unit tests for the generation script**
  - Test that the script produces valid output schema
  - Test that group stage qualifiers are correctly determined
  - Test that the runs array has the expected length
