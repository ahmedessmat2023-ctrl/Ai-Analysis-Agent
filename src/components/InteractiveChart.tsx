import React, { useMemo, useState } from 'react';
import {
  ResponsiveContainer,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  AreaChart,
  Area,
  ComposedChart,
} from 'recharts';
import {
  Maximize2,
  Hash,
  Eye,
  EyeOff,
  RotateCcw,
  BarChart3,
  LineChart as LineChartIcon,
  PieChart as PieChartIcon,
  Image as ImageIcon,
  Check,
  TrendingUp,
  TrendingDown,
  Layers,
  Sparkles,
  Award,
  Calendar,
  Percent,
} from 'lucide-react';
import type { ReportChart, ReportTable } from '../types';

export const CHART_COLORS = [
  '#3B82F6', // Blue
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#EC4899', // Pink
  '#8B5CF6', // Purple
  '#06B6D4', // Cyan
  '#F97316', // Orange
  '#14B8A6', // Teal
  '#6366F1', // Indigo
  '#84CC16', // Lime
  '#E11D48', // Rose
  '#0EA5E9', // Sky
];

export interface ChartSeriesItem {
  id: string;
  label: string;
  color: string;
}

export interface ExtractedChartData {
  data: Array<Record<string, unknown>>;
  xKey: string;
  yKeys: string[];
  series: ChartSeriesItem[];
  type: 'bar' | 'line' | 'pie' | 'area';
  isCategorical: boolean;
}

export interface TrendlineStats {
  seriesId: string;
  seriesLabel: string;
  color: string;
  slope: number;
  intercept: number;
  r2: number;
  direction: 'up' | 'down' | 'flat';
  percentChange: number;
  equation: string;
}

/**
 * Calculates a least-squares linear regression trendline for a given series
 */
export function calculateLinearRegression(
  data: Array<Record<string, unknown>>,
  yKey: string,
  seriesLabel: string = yKey,
  color: string = '#3B82F6'
): { trendValues: (number | null)[]; stats: TrendlineStats } | null {
  if (!data || data.length < 2) return null;

  const validPoints: { x: number; y: number; index: number }[] = [];
  data.forEach((row, idx) => {
    const raw = row[yKey];
    const num = parseNumeric(raw);
    if (num !== null && !Number.isNaN(num)) {
      validPoints.push({ x: idx, y: num, index: idx });
    }
  });

  const n = validPoints.length;
  if (n < 2) return null;

  let sumX = 0;
  let sumY = 0;
  let sumXY = 0;
  let sumXX = 0;
  let sumYY = 0;

  for (const p of validPoints) {
    sumX += p.x;
    sumY += p.y;
    sumXY += p.x * p.y;
    sumXX += p.x * p.x;
    sumYY += p.y * p.y;
  }

  const meanX = sumX / n;
  const meanY = sumY / n;

  const denominator = sumXX - sumX * meanX;
  if (Math.abs(denominator) < 1e-12) return null;

  const slope = (sumXY - sumX * meanY) / denominator;
  const intercept = meanY - slope * meanX;

  // Pearson correlation r & r2 calculation
  const numerator = sumXY - (sumX * sumY) / n;
  const denX = sumXX - (sumX * sumX) / n;
  const denY = sumYY - (sumY * sumY) / n;
  let r2 = 0;
  if (denX > 0 && denY > 0) {
    const r = numerator / Math.sqrt(denX * denY);
    r2 = Math.min(1, Math.max(0, r * r));
  }

  const startEst = slope * 0 + intercept;
  const endEst = slope * (data.length - 1) + intercept;
  const percentChange =
    Math.abs(startEst) > 1e-6
      ? ((endEst - startEst) / Math.abs(startEst)) * 100
      : slope !== 0
      ? 100
      : 0;

  const direction: 'up' | 'down' | 'flat' =
    Math.abs(slope) < 1e-5 ? 'flat' : slope > 0 ? 'up' : 'down';

  const sign = intercept >= 0 ? '+' : '-';
  const equation = `y = ${slope >= 0 ? slope.toFixed(2) : slope.toFixed(2)}x ${sign} ${Math.abs(intercept).toFixed(2)}`;

  const trendValues: (number | null)[] = data.map((_, idx) => {
    const yVal = slope * idx + intercept;
    return Number.isFinite(yVal) ? Math.round(yVal * 100) / 100 : null;
  });

  return {
    trendValues,
    stats: {
      seriesId: yKey,
      seriesLabel,
      color,
      slope,
      intercept,
      r2: Math.round(r2 * 1000) / 1000,
      direction,
      percentChange: Math.round(percentChange * 10) / 10,
      equation,
    },
  };
}

/**
 * Format numbers for tooltips and value labels
 */
export function formatValue(val: unknown): string {
  if (typeof val === 'number') {
    const abs = Math.abs(val);
    if (abs >= 1_000_000_000) return `${(val / 1_000_000_000).toFixed(1)}B`;
    if (abs >= 1_000_000) return `${(val / 1_000_000).toFixed(1)}M`;
    if (abs >= 10_000) return `${(val / 1_000).toFixed(1)}k`;
    if (Number.isInteger(val)) return val.toLocaleString();
    return val.toLocaleString(undefined, { maximumFractionDigits: 2 });
  }
  return String(val ?? '');
}

/**
 * Parse string to clean number if numeric
 */
function parseNumeric(val: unknown): number | null {
  if (typeof val === 'number') return Number.isNaN(val) ? null : val;
  if (typeof val === 'string') {
    const cleaned = val.replace(/[$,€£¥%\s]/g, '').trim();
    if (!cleaned) return null;
    const num = Number(cleaned);
    return Number.isNaN(num) ? null : num;
  }
  return null;
}

/**
 * Intelligently extracts structured chart records and series from matching report tables
 */
export function extractChartData(
  chart: ReportChart,
  tables?: ReportTable[]
): ExtractedChartData | null {
  if (!tables || tables.length === 0) return null;

  // 1. Find the best matching table
  const chartTitleLower = chart.title.toLowerCase();
  const chartFileLower = (chart.file || '').toLowerCase();

  let matchedTable = tables.find((t) => {
    const tTitle = t.title.toLowerCase();
    return (
      chartTitleLower.includes(tTitle) ||
      tTitle.includes(chartTitleLower) ||
      chartFileLower.includes(tTitle.replace(/\s+/g, '_'))
    );
  });

  if (!matchedTable && tables.length > 0) {
    matchedTable = tables[0];
  }

  if (!matchedTable || !matchedTable.columns || matchedTable.columns.length < 2) {
    return null;
  }

  const columns = matchedTable.columns;
  const rows = matchedTable.rows || [];
  if (rows.length === 0) return null;

  // 2. Identify numeric columns vs categorical column
  const numericColIndices: number[] = [];
  const categoricalColIndices: number[] = [];

  columns.forEach((col, idx) => {
    let numericCount = 0;
    rows.forEach((row) => {
      if (parseNumeric(row[idx]) !== null) numericCount++;
    });
    if (numericCount >= Math.min(rows.length * 0.6, 2)) {
      numericColIndices.push(idx);
    } else {
      categoricalColIndices.push(idx);
    }
  });

  const xIdx = categoricalColIndices.length > 0 ? categoricalColIndices[0] : 0;
  const xKey = columns[xIdx];

  const yIndices = numericColIndices.filter((idx) => idx !== xIdx);
  if (yIndices.length === 0) {
    const fallbackIdx = columns.length > 1 ? 1 : 0;
    yIndices.push(fallbackIdx);
  }

  const yKeys = yIndices.map((idx) => columns[idx]);

  // Determine chart type
  let chartType: 'bar' | 'line' | 'pie' | 'area' = 'bar';
  const typeStr = (chart.type || '').toLowerCase();
  if (typeStr.includes('line') || chartTitleLower.includes('trend') || chartTitleLower.includes('over time') || chartTitleLower.includes('monthly') || chartTitleLower.includes('history')) {
    chartType = 'line';
  } else if (typeStr.includes('pie') || chartTitleLower.includes('share') || chartTitleLower.includes('distribution') || chartTitleLower.includes('breakdown')) {
    chartType = 'pie';
  } else if (typeStr.includes('area')) {
    chartType = 'area';
  }

  // 3. Build data rows
  const data: Array<Record<string, unknown>> = [];
  rows.forEach((row) => {
    const item: Record<string, unknown> = {
      [xKey]: String(row[xIdx] ?? `Item ${data.length + 1}`),
    };
    yIndices.forEach((yIdx) => {
      const colName = columns[yIdx];
      const parsed = parseNumeric(row[yIdx]);
      item[colName] = parsed ?? 0;
    });
    data.push(item);
  });

  // 4. Build Series Definition
  let series: ChartSeriesItem[] = [];
  let isCategorical = false;

  if (yKeys.length > 1) {
    // Multi-metric series (e.g. Revenue, Cost, Profit)
    series = yKeys.map((key, i) => ({
      id: key,
      label: key,
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  } else if (chartType === 'pie' || data.length <= 12) {
    // Single metric across categories (e.g., categories as legend items)
    isCategorical = true;
    series = data.map((d, i) => ({
      id: String(d[xKey]),
      label: String(d[xKey]),
      color: CHART_COLORS[i % CHART_COLORS.length],
    }));
  } else {
    // Single metric
    series = [
      {
        id: yKeys[0],
        label: yKeys[0],
        color: CHART_COLORS[0],
      },
    ];
  }

  return {
    data,
    xKey,
    yKeys,
    series,
    type: chartType,
    isCategorical,
  };
}

/**
 * Interactive Legend Component that lets users click any legend item to toggle series
 */
export const InteractiveLegend: React.FC<{
  series: ChartSeriesItem[];
  hiddenSeries: Set<string>;
  onToggleSeries: (seriesId: string) => void;
  onReset?: () => void;
  theme?: 'light' | 'dark';
  compact?: boolean;
}> = ({
  series,
  hiddenSeries,
  onToggleSeries,
  onReset,
  theme = 'light',
  compact = false,
}) => {
  if (!series || series.length === 0) return null;

  const hasHidden = hiddenSeries.size > 0;

  return (
    <div
      className={`w-full flex flex-wrap items-center justify-between gap-2 px-3 py-2 rounded-xl transition border ${
        theme === 'dark'
          ? 'bg-slate-950/80 border-slate-800 text-slate-200'
          : 'bg-neutral-50/90 border-neutral-200/80 text-neutral-800'
      }`}
    >
      <div className="flex flex-wrap items-center gap-1.5 min-w-0">
        <span
          className={`text-[11px] font-semibold tracking-wide uppercase mr-1 select-none flex items-center gap-1 ${
            theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'
          }`}
        >
          <span>Legend:</span>
        </span>

        {series.map((s) => {
          const isHidden = hiddenSeries.has(s.id);
          return (
            <button
              key={s.id}
              type="button"
              onClick={() => onToggleSeries(s.id)}
              className={`group inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-medium transition cursor-pointer select-none border ${
                isHidden
                  ? theme === 'dark'
                    ? 'border-slate-800 bg-slate-900/50 text-slate-500 line-through opacity-50 hover:opacity-80'
                    : 'border-neutral-200 bg-neutral-100 text-neutral-400 line-through opacity-60 hover:opacity-90'
                  : theme === 'dark'
                  ? 'border-slate-700 bg-slate-900 text-slate-100 shadow-2xs hover:bg-slate-800 hover:border-slate-600'
                  : 'border-neutral-200 bg-white text-neutral-800 shadow-2xs hover:bg-neutral-50 hover:border-neutral-300'
              }`}
              title={
                isHidden
                  ? `Series "${s.label}" is currently hidden. Click to show.`
                  : `Series "${s.label}" is visible. Click to hide from chart.`
              }
            >
              {/* Color swatch */}
              <span
                className={`w-2.5 h-2.5 rounded-full shrink-0 transition-transform ${
                  isHidden ? 'grayscale opacity-30 scale-75' : 'scale-100'
                }`}
                style={{ backgroundColor: s.color }}
              />

              <span className="truncate max-w-[140px]">{s.label}</span>

              {/* Status indicator */}
              <span className="shrink-0 text-[10px] ml-0.5 opacity-60 group-hover:opacity-100">
                {isHidden ? (
                  <EyeOff className="h-3 w-3 text-neutral-400" />
                ) : (
                  <Eye className="h-3 w-3 text-neutral-400 group-hover:text-neutral-600 dark:group-hover:text-slate-200" />
                )}
              </span>
            </button>
          );
        })}
      </div>

      {/* Reset button when any series is toggled off */}
      {hasHidden && onReset && (
        <button
          type="button"
          onClick={onReset}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-semibold transition cursor-pointer shrink-0 border ${
            theme === 'dark'
              ? 'border-indigo-800/80 bg-indigo-950/60 text-indigo-300 hover:bg-indigo-900/80'
              : 'border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100'
          }`}
          title="Show all hidden series"
        >
          <RotateCcw className="h-3 w-3" />
          <span>Show All ({hiddenSeries.size} hidden)</span>
        </button>
      )}
    </div>
  );
};

/**
 * Enhanced Custom Tooltip for Recharts showing all series values, point aggregates, and proportional shares
 */
const CustomChartTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
  theme?: 'light' | 'dark';
  chartData?: ExtractedChartData;
  hiddenSeries?: Set<string>;
}> = ({ active, payload, label, theme = 'light', chartData, hiddenSeries = new Set() }) => {
  if (!active || !payload || payload.length === 0) return null;

  const isDark = theme === 'dark';

  // 1. Resolve Point Label / X-Axis Category
  const pointLabel =
    label !== undefined && label !== null && String(label).trim() !== ''
      ? String(label)
      : String(payload[0]?.payload?.[chartData?.xKey || ''] ?? payload[0]?.name ?? 'Data Point');

  // 2. Handle Categorical / Pie Chart Tooltip
  if (chartData?.type === 'pie' || (chartData?.isCategorical && payload.length === 1)) {
    const activeItem = payload[0];
    const rawVal = parseNumeric(activeItem.value) ?? 0;

    // Calculate dataset total across all visible slices
    const datasetTotal = (chartData?.data || []).reduce((acc, d) => {
      const id = String(d[chartData.xKey]);
      if (hiddenSeries.has(id)) return acc;
      const num = parseNumeric(d[chartData.yKeys[0]]);
      return acc + (num ?? 0);
    }, 0);

    const sharePercent = datasetTotal > 0 ? (rawVal / datasetTotal) * 100 : 0;
    const itemColor = activeItem.color || activeItem.fill || CHART_COLORS[0];

    // Other categories in dataset for quick context
    const allSlices = (chartData?.data || [])
      .map((d, idx) => {
        const name = String(d[chartData.xKey]);
        const val = parseNumeric(d[chartData.yKeys[0]]) ?? 0;
        const color = chartData.series.find((s) => s.id === name)?.color || CHART_COLORS[idx % CHART_COLORS.length];
        return { name, val, color, isCurrent: name === activeItem.name || name === pointLabel };
      })
      .filter((s) => !hiddenSeries.has(s.name))
      .sort((a, b) => b.val - a.val);

    return (
      <div
        className={`rounded-2xl p-4 shadow-2xl text-xs border backdrop-blur-xl transition min-w-[240px] max-w-[320px] ${
          isDark
            ? 'bg-slate-900/98 border-slate-700/80 text-slate-100 shadow-slate-950/80'
            : 'bg-white/98 border-neutral-200 text-neutral-900 shadow-neutral-900/15'
        }`}
      >
        {/* Tooltip Header */}
        <div className="pb-2.5 mb-2.5 border-b border-neutral-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5 min-w-0">
            <span className="w-3 h-3 rounded-full shrink-0 shadow-xs" style={{ backgroundColor: itemColor }} />
            <p className="font-bold text-sm truncate font-sans">{activeItem.name || pointLabel}</p>
          </div>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
              isDark ? 'bg-indigo-950/80 text-indigo-300 border border-indigo-800/60' : 'bg-indigo-50 text-indigo-700 border border-indigo-200/80'
            }`}
          >
            {sharePercent.toFixed(1)}% of total
          </span>
        </div>

        {/* Primary Value Highlight */}
        <div className="flex items-baseline justify-between mb-3 bg-neutral-50/80 dark:bg-slate-800/60 p-2.5 rounded-xl border border-neutral-100 dark:border-slate-700/50">
          <div>
            <span className={`text-[10px] uppercase font-semibold block ${isDark ? 'text-slate-400' : 'text-neutral-500'}`}>
              Value
            </span>
            <span className="text-base font-extrabold font-mono tracking-tight text-neutral-900 dark:text-white">
              {formatValue(rawVal)}
            </span>
          </div>
          {datasetTotal > 0 && (
            <div className="text-right">
              <span className={`text-[10px] uppercase font-semibold block ${isDark ? 'text-slate-400' : 'text-neutral-500'}`}>
                Dataset Sum
              </span>
              <span className={`text-xs font-mono font-semibold ${isDark ? 'text-slate-300' : 'text-neutral-700'}`}>
                {formatValue(datasetTotal)}
              </span>
            </div>
          )}
        </div>

        {/* Mini Proportional Breakdown of Slices */}
        {allSlices.length > 1 && (
          <div className="space-y-1.5 pt-1">
            <p className={`text-[10px] font-semibold uppercase tracking-wider ${isDark ? 'text-slate-400' : 'text-neutral-500'}`}>
              All Categories ({allSlices.length})
            </p>
            <div className="space-y-1 max-h-36 overflow-y-auto pr-1">
              {allSlices.map((s, idx) => {
                const sliceShare = datasetTotal > 0 ? (s.val / datasetTotal) * 100 : 0;
                return (
                  <div
                    key={idx}
                    className={`flex items-center justify-between gap-2 px-2 py-1 rounded-lg text-[11px] transition ${
                      s.isCurrent
                        ? isDark
                          ? 'bg-slate-800 border border-slate-700 font-bold text-white'
                          : 'bg-neutral-100 border border-neutral-200 font-bold text-neutral-900'
                        : isDark
                        ? 'text-slate-400 hover:text-slate-200'
                        : 'text-neutral-600 hover:text-neutral-900'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 min-w-0">
                      <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                      <span className="truncate max-w-[120px]">{s.name}</span>
                    </div>
                    <div className="flex items-center gap-2 shrink-0 font-mono">
                      <span>{formatValue(s.val)}</span>
                      <span className="text-[10px] opacity-75 font-normal">({sliceShare.toFixed(0)}%)</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // 3. Multi-Series Cartesian Point Breakdown (Line, Bar, Area Charts)
  const rowPayload = payload[0]?.payload || {};
  const activeSeriesList = chartData?.series && chartData.series.length > 0
    ? chartData.series.filter((s) => !hiddenSeries.has(s.id))
    : payload.map((p) => ({
        id: String(p.dataKey || p.name),
        label: String(p.name || p.dataKey),
        color: p.color || p.fill || CHART_COLORS[0],
      }));

  // Build items for all series at this specific data point
  const seriesItems = activeSeriesList.map((s) => {
    // Check in payload entries first, then row payload
    const matchingPayload = payload.find(
      (p) => p.dataKey === s.id || p.name === s.label || p.name === s.id
    );

    let rawVal: number | null = null;
    if (matchingPayload !== undefined && matchingPayload.value !== undefined) {
      rawVal = parseNumeric(matchingPayload.value);
    } else if (rowPayload[s.id] !== undefined) {
      rawVal = parseNumeric(rowPayload[s.id]);
    }

    const numVal = rawVal ?? 0;
    const color = matchingPayload?.color || matchingPayload?.fill || s.color || CHART_COLORS[0];

    // Check for calculated trendline value at this point
    const trendKey = `_trend_${s.id}`;
    const rawTrend = rowPayload[trendKey] !== undefined ? parseNumeric(rowPayload[trendKey]) : null;

    return {
      id: s.id,
      label: s.label,
      value: numVal,
      formatted: formatValue(numVal),
      color,
      isNumeric: rawVal !== null,
      trendVal: rawTrend,
      trendFormatted: rawTrend !== null ? formatValue(rawTrend) : null,
    };
  });

  // Calculate Aggregates for the hovered data point
  const totalPointSum = seriesItems.reduce((acc, curr) => acc + curr.value, 0);
  const avgPointVal = seriesItems.length > 0 ? totalPointSum / seriesItems.length : 0;
  const maxPointVal = Math.max(...seriesItems.map((s) => s.value), 0);

  return (
    <div
      className={`rounded-2xl p-4 shadow-2xl text-xs border backdrop-blur-xl transition min-w-[270px] max-w-[360px] pointer-events-none select-none ${
        isDark
          ? 'bg-slate-900/98 border-slate-700/80 text-slate-100 shadow-slate-950/80'
          : 'bg-white/98 border-neutral-200 text-neutral-900 shadow-neutral-900/15'
      }`}
    >
      {/* Tooltip Header: Data Point Label & Summary Chips */}
      <div className="pb-3 mb-3 border-b border-neutral-100 dark:border-slate-800">
        <div className="flex items-center justify-between gap-2 mb-1.5">
          <div className="flex items-center gap-1.5 min-w-0">
            <Calendar className={`h-3.5 w-3.5 shrink-0 ${isDark ? 'text-indigo-400' : 'text-io-blue'}`} />
            <h4 className="font-extrabold text-sm truncate font-sans text-neutral-900 dark:text-white" title={pointLabel}>
              {pointLabel}
            </h4>
          </div>
          <span
            className={`text-[10px] font-mono font-bold px-2 py-0.5 rounded-full shrink-0 ${
              isDark ? 'bg-slate-800 text-slate-300 border border-slate-700' : 'bg-neutral-100 text-neutral-700 border border-neutral-200'
            }`}
          >
            {seriesItems.length} {seriesItems.length === 1 ? 'Series' : 'Series'}
          </span>
        </div>

        {/* Aggregates Banner (When multiple series exist at this data point) */}
        {seriesItems.length > 1 && (
          <div className="flex items-center justify-between gap-2 pt-1 text-[11px] font-mono bg-neutral-50/90 dark:bg-slate-800/60 px-2.5 py-1.5 rounded-xl border border-neutral-100 dark:border-slate-700/50">
            <div className="flex items-center gap-1.5">
              <span className={`text-[10px] uppercase font-bold ${isDark ? 'text-slate-400' : 'text-neutral-500'}`}>
                Point Total:
              </span>
              <span className="font-extrabold text-neutral-900 dark:text-white">
                {formatValue(totalPointSum)}
              </span>
            </div>
            <div className="flex items-center gap-1 text-[10px] text-neutral-500 dark:text-slate-400">
              <span>Avg:</span>
              <span className="font-semibold text-neutral-700 dark:text-slate-300">
                {formatValue(avgPointVal)}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* All Series Values List with Visual Progress Bars and Trendline indicators */}
      <div className="space-y-2 max-h-56 overflow-y-auto pr-0.5">
        {seriesItems.map((item, idx) => {
          const sharePercent = totalPointSum > 0 ? (item.value / totalPointSum) * 100 : 0;
          const isTopContributor = seriesItems.length > 1 && item.value === maxPointVal && maxPointVal > 0;

          return (
            <div
              key={item.id || idx}
              className={`p-2 rounded-xl transition border ${
                isTopContributor
                  ? isDark
                    ? 'bg-slate-800/90 border-slate-700'
                    : 'bg-blue-50/40 border-blue-100/80'
                  : isDark
                  ? 'bg-slate-900/50 border-slate-800/60'
                  : 'bg-white border-neutral-100'
              }`}
            >
              {/* Row Header: Name, Swatch, and Value */}
              <div className="flex items-center justify-between gap-2 mb-1">
                <div className="flex items-center gap-2 min-w-0">
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0 ring-2 ring-offset-1 ring-offset-transparent shadow-xs"
                    style={{ backgroundColor: item.color, borderColor: item.color }}
                  />
                  <span
                    className={`font-semibold truncate text-xs font-sans ${
                      isDark ? 'text-slate-200' : 'text-neutral-800'
                    }`}
                    title={item.label}
                  >
                    {item.label}
                  </span>
                  {isTopContributor && (
                    <span className="text-[9px] font-bold uppercase tracking-wider px-1.5 py-0.2 rounded-full bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-300 shrink-0">
                      Top
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2 shrink-0 font-mono">
                  <span className="font-extrabold text-xs text-neutral-900 dark:text-white">
                    {item.formatted}
                  </span>
                  {seriesItems.length > 1 && (
                    <span
                      className={`text-[10px] font-bold px-1.5 py-0.2 rounded-md ${
                        isDark ? 'bg-slate-800 text-slate-300' : 'bg-neutral-100 text-neutral-600'
                      }`}
                    >
                      {sharePercent.toFixed(1)}%
                    </span>
                  )}
                </div>
              </div>

              {/* Trendline Sub-indicator at this point */}
              {item.trendFormatted !== null && (
                <div className="flex items-center justify-between gap-2 pt-1 mt-1 border-t border-neutral-100 dark:border-slate-800/80 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-neutral-500 dark:text-slate-400">
                    <TrendingUp className="h-2.5 w-2.5 text-indigo-500" />
                    <span>Trend Model:</span>
                  </span>
                  <span className="font-bold text-indigo-600 dark:text-indigo-400">
                    {item.trendFormatted}
                  </span>
                </div>
              )}

              {/* Visual Proportion Bar (Relative to Point Total or Max) */}
              {seriesItems.length > 1 && totalPointSum > 0 && (
                <div className="w-full bg-neutral-100 dark:bg-slate-800 h-1.5 rounded-full overflow-hidden mt-1.5">
                  <div
                    className="h-full rounded-full transition-all duration-300"
                    style={{
                      width: `${Math.max(3, Math.min(100, sharePercent))}%`,
                      backgroundColor: item.color,
                    }}
                  />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

/**
 * Renders the Interactive Recharts view with dynamic series toggle, detailed tooltips, data values, and regression trendlines
 */
export const InteractiveChartRenderer: React.FC<{
  chart: ReportChart;
  chartData: ExtractedChartData;
  hiddenSeries: Set<string>;
  onToggleSeries: (seriesId: string) => void;
  theme?: 'light' | 'dark';
  showValues?: boolean;
  showTrendline?: boolean;
  height?: number;
}> = ({
  chart,
  chartData,
  hiddenSeries,
  onToggleSeries,
  theme = 'light',
  showValues = true,
  showTrendline = false,
  height = 260,
}) => {
  const { data, xKey, yKeys, series, type, isCategorical } = chartData;

  const isDark = theme === 'dark';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const gridColor = isDark ? '#334155' : '#E2E8F0';

  // Compute Linear Regression Trendlines if requested
  const { augmentedData, trendStatsList } = useMemo(() => {
    if (!showTrendline || type === 'pie' || data.length < 2) {
      return { augmentedData: data, trendStatsList: [] };
    }

    const calculatedStats: TrendlineStats[] = [];
    const trendColumns: Record<string, (number | null)[]> = {};

    if (isCategorical) {
      // Single metric across categorical points
      const yKey = yKeys[0];
      const res = calculateLinearRegression(data, yKey, chart.title || yKey, CHART_COLORS[0]);
      if (res) {
        trendColumns[`_trend_${yKey}`] = res.trendValues;
        calculatedStats.push(res.stats);
      }
    } else {
      // Multi-series or standard Cartesian
      const visibleKeys = yKeys.filter((k) => !hiddenSeries.has(k));
      visibleKeys.forEach((key, idx) => {
        const itemSeries = series.find((s) => s.id === key);
        const color = itemSeries ? itemSeries.color : CHART_COLORS[idx % CHART_COLORS.length];
        const res = calculateLinearRegression(data, key, itemSeries?.label || key, color);
        if (res) {
          trendColumns[`_trend_${key}`] = res.trendValues;
          calculatedStats.push(res.stats);
        }
      });
    }

    const newAugmentedData = data.map((row, idx) => {
      const copy = { ...row };
      Object.entries(trendColumns).forEach(([trendKey, values]) => {
        copy[trendKey] = values[idx] ?? null;
      });
      return copy;
    });

    return { augmentedData: newAugmentedData, trendStatsList: calculatedStats };
  }, [showTrendline, type, data, yKeys, isCategorical, hiddenSeries, series, chart.title]);

  // Filter data or series based on hidden series for Pie Chart
  if (type === 'pie') {
    const visibleData = isCategorical
      ? data.filter((d) => !hiddenSeries.has(String(d[xKey])))
      : data;

    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip
              content={
                <CustomChartTooltip
                  theme={theme}
                  chartData={chartData}
                  hiddenSeries={hiddenSeries}
                />
              }
            />
            <Pie
              data={visibleData}
              dataKey={yKeys[0]}
              nameKey={xKey}
              cx="50%"
              cy="50%"
              outerRadius={height > 300 ? 110 : 80}
              innerRadius={height > 300 ? 50 : 35}
              paddingAngle={3}
              label={
                showValues
                  ? (entry: any) => `${entry[xKey]}: ${formatValue(entry[yKeys[0]])}`
                  : false
              }
              labelLine={showValues}
            >
              {visibleData.map((entry, index) => {
                const itemSeries = series.find((s) => s.id === String(entry[xKey]));
                const color = itemSeries ? itemSeries.color : CHART_COLORS[index % CHART_COLORS.length];
                return <Cell key={`cell-${index}`} fill={color} stroke={isDark ? '#0F172A' : '#FFFFFF'} strokeWidth={2} />;
              })}
            </Pie>
          </PieChart>
        </ResponsiveContainer>
      </div>
    );
  }

  if (type === 'line') {
    const visibleYKeys = isCategorical
      ? yKeys
      : yKeys.filter((k) => !hiddenSeries.has(k));

    return (
      <div className="w-full flex flex-col justify-between" style={{ height }}>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={augmentedData} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.6} />
              <XAxis
                dataKey={xKey}
                stroke={axisColor}
                tick={{ fontSize: 11, fill: axisColor }}
                angle={-25}
                textAnchor="end"
                interval={0}
                height={36}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 11, fill: axisColor }}
                tickFormatter={(v) => formatValue(v)}
              />
              <Tooltip
                shared={true}
                content={
                  <CustomChartTooltip
                    theme={theme}
                    chartData={chartData}
                    hiddenSeries={hiddenSeries}
                  />
                }
              />
              {visibleYKeys.map((yKeyName, idx) => {
                const itemSeries = series.find((s) => s.id === yKeyName);
                const color = itemSeries ? itemSeries.color : CHART_COLORS[idx % CHART_COLORS.length];
                return (
                  <Line
                    key={yKeyName}
                    type="monotone"
                    dataKey={yKeyName}
                    name={yKeyName}
                    stroke={color}
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: color, stroke: isDark ? '#0F172A' : '#FFFFFF', strokeWidth: 1.5 }}
                    activeDot={{ r: 6 }}
                  />
                );
              })}

              {/* Linear Regression Trendlines */}
              {showTrendline &&
                trendStatsList.map((stat) => (
                  <Line
                    key={`trend-${stat.seriesId}`}
                    type="linear"
                    dataKey={`_trend_${stat.seriesId}`}
                    name={`${stat.seriesLabel} Trendline`}
                    stroke={stat.color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4, stroke: stat.color, fill: isDark ? '#0F172A' : '#FFFFFF' }}
                    isAnimationActive={false}
                  />
                ))}
            </LineChart>
          </ResponsiveContainer>
        </div>

        {/* Trendline Stats Summary Strip */}
        {showTrendline && trendStatsList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 px-1 text-[11px] shrink-0 border-t border-dashed border-neutral-100 dark:border-slate-800">
            {trendStatsList.map((ts) => (
              <div
                key={ts.seriesId}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono ${
                  isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                }`}
                title={`Trend Formula: ${ts.equation} · Linear correlation coefficient R²=${ts.r2}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ts.color }} />
                <span className="font-semibold font-sans">{ts.seriesLabel}:</span>
                <span className="flex items-center gap-0.5">
                  {ts.direction === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : ts.direction === 'down' ? (
                    <TrendingDown className="h-3 w-3 text-rose-500 shrink-0" />
                  ) : (
                    <span className="text-neutral-400">→</span>
                  )}
                  <span className={ts.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ts.direction === 'down' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-neutral-600 font-bold'}>
                    {ts.percentChange >= 0 ? `+${ts.percentChange}%` : `${ts.percentChange}%`}
                  </span>
                </span>
                <span className="text-[10px] text-neutral-400 dark:text-slate-500">
                  (R²={ts.r2.toFixed(2)})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  if (type === 'area') {
    const visibleYKeys = isCategorical
      ? yKeys
      : yKeys.filter((k) => !hiddenSeries.has(k));

    return (
      <div className="w-full flex flex-col justify-between" style={{ height }}>
        <div className="flex-1 w-full min-h-0">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={augmentedData} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
              <defs>
                {visibleYKeys.map((yKeyName, idx) => {
                  const itemSeries = series.find((s) => s.id === yKeyName);
                  const color = itemSeries ? itemSeries.color : CHART_COLORS[idx % CHART_COLORS.length];
                  return (
                    <linearGradient key={`grad-${yKeyName}`} id={`grad-${yKeyName}`} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={color} stopOpacity={0.4} />
                      <stop offset="95%" stopColor={color} stopOpacity={0.05} />
                    </linearGradient>
                  );
                })}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.6} />
              <XAxis
                dataKey={xKey}
                stroke={axisColor}
                tick={{ fontSize: 11, fill: axisColor }}
                angle={-25}
                textAnchor="end"
                interval={0}
                height={36}
              />
              <YAxis
                stroke={axisColor}
                tick={{ fontSize: 11, fill: axisColor }}
                tickFormatter={(v) => formatValue(v)}
              />
              <Tooltip
                shared={true}
                content={
                  <CustomChartTooltip
                    theme={theme}
                    chartData={chartData}
                    hiddenSeries={hiddenSeries}
                  />
                }
              />
              {visibleYKeys.map((yKeyName, idx) => {
                const itemSeries = series.find((s) => s.id === yKeyName);
                const color = itemSeries ? itemSeries.color : CHART_COLORS[idx % CHART_COLORS.length];
                return (
                  <Area
                    key={yKeyName}
                    type="monotone"
                    dataKey={yKeyName}
                    name={yKeyName}
                    stroke={color}
                    strokeWidth={2.5}
                    fillOpacity={1}
                    fill={`url(#grad-${yKeyName})`}
                  />
                );
              })}

              {/* Linear Regression Trendlines */}
              {showTrendline &&
                trendStatsList.map((stat) => (
                  <Line
                    key={`trend-${stat.seriesId}`}
                    type="linear"
                    dataKey={`_trend_${stat.seriesId}`}
                    name={`${stat.seriesLabel} Trendline`}
                    stroke={stat.color}
                    strokeWidth={2}
                    strokeDasharray="5 5"
                    dot={false}
                    activeDot={{ r: 4, stroke: stat.color, fill: isDark ? '#0F172A' : '#FFFFFF' }}
                    isAnimationActive={false}
                  />
                ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Trendline Stats Summary Strip */}
        {showTrendline && trendStatsList.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 pt-2 px-1 text-[11px] shrink-0 border-t border-dashed border-neutral-100 dark:border-slate-800">
            {trendStatsList.map((ts) => (
              <div
                key={ts.seriesId}
                className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono ${
                  isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-neutral-50 border-neutral-200 text-neutral-700'
                }`}
                title={`Trend Formula: ${ts.equation} · Linear correlation coefficient R²=${ts.r2}`}
              >
                <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ts.color }} />
                <span className="font-semibold font-sans">{ts.seriesLabel}:</span>
                <span className="flex items-center gap-0.5">
                  {ts.direction === 'up' ? (
                    <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                  ) : ts.direction === 'down' ? (
                    <TrendingDown className="h-3 w-3 text-rose-500 shrink-0" />
                  ) : (
                    <span className="text-neutral-400">→</span>
                  )}
                  <span className={ts.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ts.direction === 'down' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-neutral-600 font-bold'}>
                    {ts.percentChange >= 0 ? `+${ts.percentChange}%` : `${ts.percentChange}%`}
                  </span>
                </span>
                <span className="text-[10px] text-neutral-400 dark:text-slate-500">
                  (R²={ts.r2.toFixed(2)})
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Default Bar / Composed Chart
  const visibleData = isCategorical
    ? augmentedData.filter((d) => !hiddenSeries.has(String(d[xKey])))
    : augmentedData;

  const visibleYKeys = isCategorical
    ? yKeys
    : yKeys.filter((k) => !hiddenSeries.has(k));

  return (
    <div className="w-full flex flex-col justify-between" style={{ height }}>
      <div className="flex-1 w-full min-h-0">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={visibleData} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
            <CartesianGrid strokeDasharray="3 3" stroke={gridColor} opacity={0.6} />
            <XAxis
              dataKey={xKey}
              stroke={axisColor}
              tick={{ fontSize: 11, fill: axisColor }}
              angle={-25}
              textAnchor="end"
              interval={0}
              height={36}
            />
            <YAxis
              stroke={axisColor}
              tick={{ fontSize: 11, fill: axisColor }}
              tickFormatter={(v) => formatValue(v)}
            />
            <Tooltip
              shared={true}
              content={
                <CustomChartTooltip
                  theme={theme}
                  chartData={chartData}
                  hiddenSeries={hiddenSeries}
                />
              }
            />
            {isCategorical ? (
              <Bar dataKey={yKeys[0]} name={yKeys[0]} radius={[6, 6, 0, 0]}>
                {visibleData.map((entry, index) => {
                  const itemSeries = series.find((s) => s.id === String(entry[xKey]));
                  const color = itemSeries ? itemSeries.color : CHART_COLORS[index % CHART_COLORS.length];
                  return <Cell key={`bar-cell-${index}`} fill={color} />;
                })}
              </Bar>
            ) : (
              visibleYKeys.map((yKeyName, idx) => {
                const itemSeries = series.find((s) => s.id === yKeyName);
                const color = itemSeries ? itemSeries.color : CHART_COLORS[idx % CHART_COLORS.length];
                return (
                  <Bar
                    key={yKeyName}
                    dataKey={yKeyName}
                    name={yKeyName}
                    fill={color}
                    radius={[6, 6, 0, 0]}
                  />
                );
              })
            )}

            {/* Linear Regression Trendlines */}
            {showTrendline &&
              trendStatsList.map((stat) => (
                <Line
                  key={`trend-${stat.seriesId}`}
                  type="linear"
                  dataKey={`_trend_${stat.seriesId}`}
                  name={`${stat.seriesLabel} Trendline`}
                  stroke={stat.color}
                  strokeWidth={2}
                  strokeDasharray="5 5"
                  dot={false}
                  activeDot={{ r: 4, stroke: stat.color, fill: isDark ? '#0F172A' : '#FFFFFF' }}
                  isAnimationActive={false}
                />
              ))}
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* Trendline Stats Summary Strip */}
      {showTrendline && trendStatsList.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 pt-2 px-1 text-[11px] shrink-0 border-t border-dashed border-neutral-100 dark:border-slate-800">
          {trendStatsList.map((ts) => (
            <div
              key={ts.seriesId}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg border font-mono ${
                isDark ? 'bg-slate-900/90 border-slate-800 text-slate-300' : 'bg-neutral-50 border-neutral-200 text-neutral-700'
              }`}
              title={`Trend Formula: ${ts.equation} · Linear correlation coefficient R²=${ts.r2}`}
            >
              <span className="w-2 h-2 rounded-full shrink-0" style={{ backgroundColor: ts.color }} />
              <span className="font-semibold font-sans">{ts.seriesLabel}:</span>
              <span className="flex items-center gap-0.5">
                {ts.direction === 'up' ? (
                  <TrendingUp className="h-3 w-3 text-emerald-500 shrink-0" />
                ) : ts.direction === 'down' ? (
                  <TrendingDown className="h-3 w-3 text-rose-500 shrink-0" />
                ) : (
                  <span className="text-neutral-400">→</span>
                )}
                <span className={ts.direction === 'up' ? 'text-emerald-600 dark:text-emerald-400 font-bold' : ts.direction === 'down' ? 'text-rose-600 dark:text-rose-400 font-bold' : 'text-neutral-600 font-bold'}>
                  {ts.percentChange >= 0 ? `+${ts.percentChange}%` : `${ts.percentChange}%`}
                </span>
              </span>
              <span className="text-[10px] text-neutral-400 dark:text-slate-500">
                (R²={ts.r2.toFixed(2)})
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

/**
 * Chart Image component with error boundary
 */
export const ChartImage: React.FC<{
  src?: string;
  alt: string;
  className?: string;
  theme?: 'light' | 'dark';
}> = ({ src, alt, className = '', theme = 'light' }) => {
  const [error, setError] = useState(false);
  if (!src || error) {
    return (
      <div
        className={`flex flex-col items-center justify-center p-6 rounded-xl border border-dashed text-xs text-center min-h-[160px] w-full transition ${
          theme === 'dark'
            ? 'bg-slate-900 border-slate-700 text-slate-400'
            : 'bg-neutral-50 border-neutral-300 text-neutral-400'
        } ${className}`}
      >
        <span>📈 Static chart view unavailable</span>
      </div>
    );
  }

  return (
    <div className="relative inline-flex items-center justify-center max-w-full">
      <img
        src={src}
        alt={alt}
        className={`${className} transition-all duration-200 rounded-lg ${
          theme === 'dark'
            ? 'brightness-[0.93] contrast-[1.12] invert-[0.92] hue-rotate-[180deg] shadow-inner'
            : 'brightness-100 contrast-100'
        }`}
        onError={() => setError(true)}
      />
    </div>
  );
};

/**
 * Unified Interactive Chart Card supporting Legend click to show/hide series and linear regression trendlines
 */
export const ChartCard: React.FC<{
  chart: ReportChart;
  tables?: ReportTable[];
  theme?: 'light' | 'dark';
  showValues?: boolean;
  showTrendline?: boolean;
  onZoom?: () => void;
}> = ({
  chart,
  tables,
  theme = 'light',
  showValues = true,
  showTrendline = false,
  onZoom,
}) => {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'interactive' | 'image'>('interactive');
  const [localTrendline, setLocalTrendline] = useState<boolean>(showTrendline);

  React.useEffect(() => {
    setLocalTrendline(showTrendline);
  }, [showTrendline]);

  const chartData = useMemo(() => {
    return extractChartData(chart, tables);
  }, [chart, tables]);

  const toggleSeries = (id: string) => {
    setHiddenSeries((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const resetSeries = () => {
    setHiddenSeries(new Set());
  };

  const hasInteractiveData = Boolean(chartData && chartData.data.length > 0);
  const activeSeries = chartData?.series || [];
  const isContinuous = chartData && chartData.type !== 'pie';

  return (
    <figure
      className={`overflow-hidden rounded-2xl border shadow-sm flex flex-col group transition ${
        theme === 'dark'
          ? 'border-slate-800 bg-slate-900 hover:border-slate-700'
          : 'border-neutral-200 bg-white hover:border-neutral-300'
      }`}
    >
      {/* Top Header Controls: Interactive vs Static Switch, Trendline toggle & Zoom */}
      <div
        className={`px-4 py-2.5 border-b flex items-center justify-between gap-2 transition ${
          theme === 'dark'
            ? 'border-slate-800 bg-slate-950/40 text-slate-300'
            : 'border-neutral-100 bg-neutral-50/60 text-neutral-700'
        }`}
      >
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-xs font-bold truncate">{chart.title}</span>
          {activeSeries.length > 1 && (
            <span
              className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-slate-300'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-600'
              }`}
            >
              {activeSeries.length} Series
            </span>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* Trendline toggle for Cartesian/Time-series charts */}
          {hasInteractiveData && isContinuous && viewMode === 'interactive' && (
            <button
              type="button"
              onClick={() => setLocalTrendline((v) => !v)}
              className={`px-2 py-1 rounded-lg text-xs font-semibold flex items-center gap-1 transition cursor-pointer border ${
                localTrendline
                  ? theme === 'dark'
                    ? 'bg-emerald-950/80 border-emerald-700 text-emerald-300 shadow-2xs'
                    : 'bg-emerald-50 border-emerald-200 text-emerald-700 shadow-2xs'
                  : theme === 'dark'
                  ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-slate-200'
                  : 'bg-neutral-100 border-neutral-200 text-neutral-600 hover:text-neutral-900'
              }`}
              title={`Linear Regression Trendline is ${localTrendline ? 'Enabled' : 'Disabled'}. Click to toggle.`}
            >
              <TrendingUp className={`h-3 w-3 ${localTrendline ? 'text-emerald-500' : 'text-neutral-400'}`} />
              <span className="hidden sm:inline">Trendline</span>
            </button>
          )}

          {hasInteractiveData && chart.image && (
            <div
              className={`flex items-center p-0.5 rounded-lg border text-[11px] font-semibold ${
                theme === 'dark'
                  ? 'bg-slate-800 border-slate-700'
                  : 'bg-neutral-200/80 border-neutral-300'
              }`}
            >
              <button
                type="button"
                onClick={() => setViewMode('interactive')}
                className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                  viewMode === 'interactive'
                    ? theme === 'dark'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
                title="Interactive Chart View"
              >
                Interactive
              </button>
              <button
                type="button"
                onClick={() => setViewMode('image')}
                className={`px-2 py-0.5 rounded-md transition cursor-pointer ${
                  viewMode === 'image'
                    ? theme === 'dark'
                      ? 'bg-slate-900 text-white shadow-2xs'
                      : 'bg-white text-neutral-900 shadow-2xs'
                    : 'text-neutral-500 hover:text-neutral-800'
                }`}
                title="High-Resolution Export View"
              >
                PNG
              </button>
            </div>
          )}

          {onZoom && (
            <button
              onClick={onZoom}
              className={`px-2 py-1 rounded-lg text-xs flex items-center gap-1 transition cursor-pointer border ${
                theme === 'dark'
                  ? 'border-slate-700 bg-slate-800 hover:bg-slate-700 text-slate-200'
                  : 'border-neutral-200 bg-white hover:bg-neutral-50 text-neutral-700'
              }`}
              title="Inspect Chart in High Resolution"
            >
              <Maximize2 className="h-3 w-3" />
              <span className="hidden sm:inline">Zoom</span>
            </button>
          )}
        </div>
      </div>

      {/* Interactive Legend Section */}
      {activeSeries.length > 0 && (
        <div className="px-3 pt-2.5">
          <InteractiveLegend
            series={activeSeries}
            hiddenSeries={hiddenSeries}
            onToggleSeries={toggleSeries}
            onReset={resetSeries}
            theme={theme}
          />
        </div>
      )}

      {/* Visualization Canvas */}
      <div
        className={`relative p-3 flex-1 flex flex-col items-center justify-center min-h-[240px] transition ${
          theme === 'dark' ? 'bg-slate-950/70' : 'bg-white'
        }`}
      >
        {viewMode === 'interactive' && hasInteractiveData && chartData ? (
          <InteractiveChartRenderer
            chart={chart}
            chartData={chartData}
            hiddenSeries={hiddenSeries}
            onToggleSeries={toggleSeries}
            theme={theme}
            showValues={showValues}
            showTrendline={localTrendline}
            height={260}
          />
        ) : (
          <ChartImage
            src={chart.image}
            alt={chart.title}
            theme={theme}
            className="w-full h-auto max-h-72 object-contain mx-auto"
          />
        )}
      </div>

      {/* Bottom Figcaption */}
      <figcaption
        className={`border-t px-4 py-3 transition flex items-start justify-between gap-2 ${
          theme === 'dark'
            ? 'border-slate-800/80 bg-slate-900/90 text-slate-100'
            : 'border-neutral-100 bg-neutral-50/50 text-neutral-800'
        }`}
      >
        <div className="min-w-0 flex-1">
          {chart.caption ? (
            <p
              className={`text-xs line-clamp-2 ${
                theme === 'dark' ? 'text-slate-400' : 'text-neutral-500'
              }`}
            >
              {chart.caption}
            </p>
          ) : (
            <p className="text-xs italic text-neutral-400">Click any legend item above to show or hide that series.</p>
          )}
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {localTrendline && isContinuous && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition ${
                theme === 'dark'
                  ? 'bg-emerald-950/70 border-emerald-800/70 text-emerald-300'
                  : 'bg-emerald-50 border-emerald-200 text-emerald-700'
              }`}
              title="Linear regression trendline active"
            >
              <TrendingUp className="h-2.5 w-2.5" />
              <span>Trendline</span>
            </span>
          )}

          {showValues && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border transition ${
                theme === 'dark'
                  ? 'bg-indigo-950/70 border-indigo-800/70 text-indigo-300'
                  : 'bg-indigo-50 border-indigo-200 text-indigo-700'
              }`}
              title="On-chart data values enabled"
            >
              <Hash className="h-2.5 w-2.5" />
              <span>Values On</span>
            </span>
          )}

          {hiddenSeries.size > 0 && (
            <span
              className={`inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-full border ${
                theme === 'dark'
                  ? 'bg-amber-950/70 border-amber-800/70 text-amber-300'
                  : 'bg-amber-50 border-amber-200 text-amber-700'
              }`}
            >
              <EyeOff className="h-2.5 w-2.5" />
              <span>{hiddenSeries.size} Hidden</span>
            </span>
          )}
        </div>
      </figcaption>
    </figure>
  );
};
