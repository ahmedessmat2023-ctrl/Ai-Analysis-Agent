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
 * Custom Tooltip for Recharts
 */
const CustomChartTooltip: React.FC<{
  active?: boolean;
  payload?: any[];
  label?: string;
  theme?: 'light' | 'dark';
}> = ({ active, payload, label, theme = 'light' }) => {
  if (!active || !payload || payload.length === 0) return null;

  return (
    <div
      className={`rounded-xl px-3.5 py-2.5 shadow-xl text-xs border backdrop-blur-md transition ${
        theme === 'dark'
          ? 'bg-slate-900/95 border-slate-700 text-slate-100'
          : 'bg-white/95 border-neutral-200 text-neutral-900'
      }`}
    >
      {label && <p className="font-bold mb-1.5 pb-1 border-b border-neutral-100 dark:border-slate-800">{label}</p>}
      <div className="space-y-1">
        {payload.map((entry, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-1.5">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color || entry.fill }} />
              <span className={theme === 'dark' ? 'text-slate-300' : 'text-neutral-600'}>
                {entry.name}:
              </span>
            </div>
            <span className="font-semibold font-mono">{formatValue(entry.value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

/**
 * Renders the Interactive Recharts view with dynamic series toggle & data values
 */
export const InteractiveChartRenderer: React.FC<{
  chart: ReportChart;
  chartData: ExtractedChartData;
  hiddenSeries: Set<string>;
  onToggleSeries: (seriesId: string) => void;
  theme?: 'light' | 'dark';
  showValues?: boolean;
  height?: number;
}> = ({
  chart,
  chartData,
  hiddenSeries,
  onToggleSeries,
  theme = 'light',
  showValues = true,
  height = 260,
}) => {
  const { data, xKey, yKeys, series, type, isCategorical } = chartData;

  const isDark = theme === 'dark';
  const axisColor = isDark ? '#94A3B8' : '#64748B';
  const gridColor = isDark ? '#334155' : '#E2E8F0';

  // Filter data or series based on hidden series
  if (type === 'pie') {
    const visibleData = isCategorical
      ? data.filter((d) => !hiddenSeries.has(String(d[xKey])))
      : data;

    return (
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Tooltip content={<CustomChartTooltip theme={theme} />} />
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
      <div style={{ width: '100%', height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
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
            <Tooltip content={<CustomChartTooltip theme={theme} />} />
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
          </LineChart>
        </ResponsiveContainer>
      </div>
    );
  }

  // Default Bar Chart
  const visibleData = isCategorical
    ? data.filter((d) => !hiddenSeries.has(String(d[xKey])))
    : data;

  const visibleYKeys = isCategorical
    ? yKeys
    : yKeys.filter((k) => !hiddenSeries.has(k));

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={visibleData} margin={{ top: 12, right: 16, left: 0, bottom: 24 }}>
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
          <Tooltip content={<CustomChartTooltip theme={theme} />} />
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
        </BarChart>
      </ResponsiveContainer>
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
 * Unified Interactive Chart Card supporting Legend click to show/hide series
 */
export const ChartCard: React.FC<{
  chart: ReportChart;
  tables?: ReportTable[];
  theme?: 'light' | 'dark';
  showValues?: boolean;
  onZoom?: () => void;
}> = ({ chart, tables, theme = 'light', showValues = true, onZoom }) => {
  const [hiddenSeries, setHiddenSeries] = useState<Set<string>>(new Set());
  const [viewMode, setViewMode] = useState<'interactive' | 'image'>('interactive');

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

  return (
    <figure
      className={`overflow-hidden rounded-2xl border shadow-sm flex flex-col group transition ${
        theme === 'dark'
          ? 'border-slate-800 bg-slate-900 hover:border-slate-700'
          : 'border-neutral-200 bg-white hover:border-neutral-300'
      }`}
    >
      {/* Top Header Controls: Interactive vs Static Switch & Zoom */}
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
