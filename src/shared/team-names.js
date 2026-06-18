/**
 * Canonical team name normalization.
 *
 * Every script that compares team names across data sources (odds APIs,
 * results APIs, tournament.json, sweepstake.json, Elo ratings) must use
 * this single function so mappings stay consistent.
 */

export function normalizeTeamName(name) {
  const normalized = name.trim();

  // Turkey / Türkiye
  if (normalized === 'Türkiye' || normalized === 'Turkey') return 'Turkey';

  // Curaçao
  if (normalized === 'Curaçao' || normalized === 'Curacao') return 'Curaçao';

  // Czechia
  if (normalized === 'Czech Republic' || normalized === 'Czechia') return 'Czechia';

  // Bosnia and Herzegovina
  if (
    normalized === 'Bosnia & Herzegovina' ||
    normalized === 'Bosnia and Herzegovina' ||
    normalized === 'Bosnia' ||
    normalized === 'Bosnia-Herzegovina'
  ) return 'Bosnia and Herzegovina';

  // Ivory Coast
  if (
    normalized === 'Côte d\'Ivoire' ||
    normalized === 'Cote d\'Ivoire' ||
    normalized === 'Cote D\'Ivoire' ||
    normalized === 'Ivory Coast'
  ) return 'Ivory Coast';

  // USA
  if (normalized === 'United States' || normalized === 'United States of America') return 'USA';

  // Cape Verde
  if (normalized === 'Cape Verde Islands' || normalized === 'Cape Verde') return 'Cape Verde';

  // DR Congo
  if (
    normalized === 'Democratic Republic of Congo' ||
    normalized === 'Democratic Republic of the Congo' ||
    normalized === 'Congo DR' ||
    normalized === 'DR Congo'
  ) return 'DR Congo';

  // South Korea
  if (
    normalized === 'Korea Republic' ||
    normalized === 'Republic of Korea' ||
    normalized === 'South Korea'
  ) return 'South Korea';

  return normalized;
}
