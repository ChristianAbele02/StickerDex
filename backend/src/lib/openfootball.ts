/**
 * Shared helpers for the openfootball World Cup 2026 text dataset (CC0).
 *
 * Used both by the build-time generator (`scripts/generate-matches.ts`) and the
 * runtime live-results feed (`services/resultsFeed.ts`) so the team mapping and
 * score parsing never drift between them.
 */

/** openfootball team name -> FIFA code + flag colors for the 48 qualified teams. */
export const OF_TEAMS: Record<string, { code: string; primary: string; secondary: string }> = {
  Mexico: { code: 'MEX', primary: '#006847', secondary: '#ce1126' },
  'South Africa': { code: 'RSA', primary: '#007749', secondary: '#ffb81c' },
  'South Korea': { code: 'KOR', primary: '#cd2e3a', secondary: '#0047a0' },
  'Czech Republic': { code: 'CZE', primary: '#11457e', secondary: '#d7141a' },
  Canada: { code: 'CAN', primary: '#d52b1e', secondary: '#ffffff' },
  'Bosnia & Herzegovina': { code: 'BIH', primary: '#002395', secondary: '#ffec00' },
  Qatar: { code: 'QAT', primary: '#8a1538', secondary: '#ffffff' },
  Switzerland: { code: 'SUI', primary: '#d52b1e', secondary: '#ffffff' },
  Brazil: { code: 'BRA', primary: '#ffdf00', secondary: '#009b3a' },
  Morocco: { code: 'MAR', primary: '#c1272d', secondary: '#006233' },
  Haiti: { code: 'HAI', primary: '#00209f', secondary: '#d21034' },
  Scotland: { code: 'SCO', primary: '#0065bf', secondary: '#ffffff' },
  USA: { code: 'USA', primary: '#0a3161', secondary: '#b31942' },
  Paraguay: { code: 'PAR', primary: '#d52b1e', secondary: '#0038a8' },
  Australia: { code: 'AUS', primary: '#00843d', secondary: '#ffcd00' },
  Turkey: { code: 'TUR', primary: '#e30a17', secondary: '#ffffff' },
  Germany: { code: 'GER', primary: '#000000', secondary: '#dd0000' },
  'Curaçao': { code: 'CUW', primary: '#002b7f', secondary: '#f9d616' },
  'Ivory Coast': { code: 'CIV', primary: '#f77f00', secondary: '#009e60' },
  Ecuador: { code: 'ECU', primary: '#ffd100', secondary: '#0072ce' },
  Netherlands: { code: 'NED', primary: '#ae1c28', secondary: '#21468b' },
  Japan: { code: 'JPN', primary: '#000091', secondary: '#bc002d' },
  Sweden: { code: 'SWE', primary: '#006aa7', secondary: '#fecc00' },
  Tunisia: { code: 'TUN', primary: '#e70013', secondary: '#ffffff' },
  Belgium: { code: 'BEL', primary: '#000000', secondary: '#fdda24' },
  Egypt: { code: 'EGY', primary: '#ce1126', secondary: '#000000' },
  Iran: { code: 'IRN', primary: '#239f40', secondary: '#da0000' },
  'New Zealand': { code: 'NZL', primary: '#000000', secondary: '#ffffff' },
  Spain: { code: 'ESP', primary: '#aa151b', secondary: '#f1bf00' },
  'Cape Verde': { code: 'CPV', primary: '#003893', secondary: '#cf2027' },
  'Saudi Arabia': { code: 'KSA', primary: '#006c35', secondary: '#ffffff' },
  Uruguay: { code: 'URU', primary: '#5cbfeb', secondary: '#001489' },
  France: { code: 'FRA', primary: '#0055a4', secondary: '#ef4135' },
  Senegal: { code: 'SEN', primary: '#00853f', secondary: '#fdef42' },
  Iraq: { code: 'IRQ', primary: '#007a3d', secondary: '#ce1126' },
  Norway: { code: 'NOR', primary: '#ba0c2f', secondary: '#00205b' },
  Argentina: { code: 'ARG', primary: '#75aadb', secondary: '#ffffff' },
  Algeria: { code: 'ALG', primary: '#006233', secondary: '#ffffff' },
  Austria: { code: 'AUT', primary: '#ed2939', secondary: '#ffffff' },
  Jordan: { code: 'JOR', primary: '#007a3d', secondary: '#ce1126' },
  Portugal: { code: 'POR', primary: '#006600', secondary: '#ff0000' },
  'DR Congo': { code: 'COD', primary: '#007fff', secondary: '#f7d618' },
  Uzbekistan: { code: 'UZB', primary: '#1eb53a', secondary: '#0099b5' },
  Colombia: { code: 'COL', primary: '#fcd116', secondary: '#003893' },
  England: { code: 'ENG', primary: '#ffffff', secondary: '#ce1124' },
  Croatia: { code: 'CRO', primary: '#ff0000', secondary: '#171796' },
  Ghana: { code: 'GHA', primary: '#006b3f', secondary: '#fcd116' },
  Panama: { code: 'PAN', primary: '#005293', secondary: '#d21034' },
};

/** Resolve an openfootball team label to its FIFA code (or null if unknown). */
export function codeForLabel(label: string): string | null {
  return OF_TEAMS[label.trim()]?.code ?? null;
}

export interface ParsedResult {
  homeCode: string;
  awayCode: string;
  homeScore: number;
  awayScore: number;
}

/**
 * Scan an openfootball cup/finals text file and return every *played* fixture
 * (a line carrying a score like `Mexico 2-0 (1-0) South Africa`) mapped to FIFA
 * codes. Unplayed (`Team v Team`) lines and unknown teams are skipped.
 */
export function parseResults(text: string): ParsedResult[] {
  const out: ParsedResult[] = [];
  for (const raw of text.split(/\r?\n/)) {
    // Strip an optional leading "(73)" match number.
    const line = raw.replace(/^\s*\(\d+\)\s*/, '');
    // Require a "HH:MM UTC±n" prefix so we only look at fixture lines.
    const head = line.match(/^\s*\d{1,2}:\d{2}\s+UTC[+-]\d+\s+(.+)$/);
    if (!head) continue;
    let body = head[1];
    const at = body.lastIndexOf('@');
    if (at !== -1) body = body.slice(0, at);
    // "Home  X-Y (h-h)  Away"
    const score = body.match(/^(.+?)\s+(\d+)-(\d+)(?:\s+\([\d-]+\))?\s+(.+?)\s*$/);
    if (!score) continue;
    const homeCode = codeForLabel(score[1]);
    const awayCode = codeForLabel(score[4]);
    if (!homeCode || !awayCode) continue;
    out.push({
      homeCode,
      awayCode,
      homeScore: Number(score[2]),
      awayScore: Number(score[3]),
    });
  }
  return out;
}
