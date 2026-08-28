import type { ReportInsight } from '../types';

export type TrendDirection = 'growth' | 'decline' | 'shift';
export type TrendMagnitude = 'major' | 'moderate'; // Major >= 25%, Moderate >= 10%

export interface DetectedTrend {
  isSignificant: boolean;
  percentage: number;
  direction: TrendDirection;
  magnitude: TrendMagnitude;
  badgeLabel: string;
  sourceText: string;
  metricName: string;
}

/**
 * Regex patterns to detect percentages and directional shifts
 */
const PERCENT_REGEX = /([+-]?\s*\d+(?:\.\d+)?)\s*%/g;

const GROWTH_KEYWORDS = [
  'growth',
  'grow',
  'grew',
  'increase',
  'increased',
  'increasing',
  'rise',
  'rose',
  'rising',
  'surge',
  'surged',
  'jump',
  'jumped',
  'gain',
  'gained',
  'up',
  'higher',
  'boost',
  'boosted',
  'expansion',
  'outperformed',
  'peak',
  'spike',
  'spiked',
];

const DECLINE_KEYWORDS = [
  'decline',
  'declined',
  'declining',
  'decrease',
  'decreased',
  'decreasing',
  'drop',
  'dropped',
  'dropping',
  'fall',
  'fell',
  'falling',
  'down',
  'lower',
  'loss',
  'lost',
  'reduction',
  'reduced',
  'slump',
  'slumped',
  'dip',
  'dipped',
  'contraction',
  'underperformed',
  'plunge',
  'plunged',
];

/**
 * Analyzes a single ReportInsight to detect significant shifts (>10% growth/decline/shift).
 */
export function analyzeInsightTrend(
  insight: ReportInsight,
  thresholdPercent = 10
): DetectedTrend | null {
  if (!insight) return null;

  const title = insight.title || '';
  const detail = insight.detail || '';
  const valueStr = insight.value || '';
  const metric = insight.metric || '';

  const combinedText = `${valueStr} ${title} ${detail} ${metric}`;

  // 1. Scan for percentage numbers across text
  const matches = Array.from(combinedText.matchAll(PERCENT_REGEX));

  let candidatePercent: number | null = null;
  let candidateDirection: TrendDirection | null = null;
  let matchedSnippet = '';

  for (const match of matches) {
    const rawNumStr = match[1].replace(/\s+/g, '');
    const num = parseFloat(rawNumStr);

    if (!isNaN(num) && Math.abs(num) >= thresholdPercent) {
      // Prioritize explicit sign
      if (rawNumStr.startsWith('+')) {
        candidateDirection = 'growth';
        candidatePercent = Math.abs(num);
        matchedSnippet = match[0];
        break;
      } else if (rawNumStr.startsWith('-')) {
        candidateDirection = 'decline';
        candidatePercent = Math.abs(num);
        matchedSnippet = match[0];
        break;
      } else if (candidatePercent === null || Math.abs(num) > candidatePercent) {
        candidatePercent = Math.abs(num);
        matchedSnippet = match[0];
      }
    }
  }

  // 2. If no percentage found, check for multiplier like "2x growth" or "1.5x increase"
  if (candidatePercent === null) {
    const multMatch = combinedText.match(/(\d+(?:\.\d+)?)\s*x\s*(growth|increase|surge|jump|gain|rise|boost)/i);
    if (multMatch) {
      const multiplier = parseFloat(multMatch[1]);
      if (!isNaN(multiplier) && multiplier >= 1.1) {
        candidatePercent = Math.round((multiplier - 1) * 100);
        candidateDirection = 'growth';
        matchedSnippet = multMatch[0];
      }
    }
  }

  // If no significant numerical shift found, return null
  if (candidatePercent === null || candidatePercent < thresholdPercent) {
    return null;
  }

  // 3. Determine direction if not already set by + / -
  if (!candidateDirection) {
    const lowerCombined = combinedText.toLowerCase();
    const hasGrowth = GROWTH_KEYWORDS.some((kw) => lowerCombined.includes(kw));
    const hasDecline = DECLINE_KEYWORDS.some((kw) => lowerCombined.includes(kw));

    if (hasGrowth && !hasDecline) {
      candidateDirection = 'growth';
    } else if (hasDecline && !hasGrowth) {
      candidateDirection = 'decline';
    } else {
      candidateDirection = 'shift';
    }
  }

  const magnitude: TrendMagnitude = candidatePercent >= 25 ? 'major' : 'moderate';

  // Build formatted badge label
  let sign = '';
  if (candidateDirection === 'growth') sign = '+';
  else if (candidateDirection === 'decline') sign = '-';

  const badgeLabel = `${sign}${candidatePercent.toFixed(candidatePercent % 1 === 0 ? 0 : 1)}% ${
    candidateDirection === 'growth' ? 'Shift' : candidateDirection === 'decline' ? 'Decline' : 'Variance'
  }`;

  return {
    isSignificant: true,
    percentage: candidatePercent,
    direction: candidateDirection,
    magnitude,
    badgeLabel,
    sourceText: matchedSnippet,
    metricName: metric || title,
  };
}

/**
 * Scans all insights in a report and returns a list of insights that have significant shifts.
 */
export function scanReportTrends(
  insights: ReportInsight[] | undefined,
  thresholdPercent = 10
): Array<{ insight: ReportInsight; trend: DetectedTrend; originalIndex: number }> {
  if (!insights || !Array.isArray(insights)) return [];

  const results: Array<{ insight: ReportInsight; trend: DetectedTrend; originalIndex: number }> = [];

  insights.forEach((insight, idx) => {
    const trend = analyzeInsightTrend(insight, thresholdPercent);
    if (trend) {
      results.push({
        insight,
        trend,
        originalIndex: idx,
      });
    }
  });

  // Sort by highest percentage shift descending
  return results.sort((a, b) => b.trend.percentage - a.trend.percentage);
}
