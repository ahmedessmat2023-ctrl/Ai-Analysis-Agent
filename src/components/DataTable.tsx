import React, { useState, useMemo } from 'react';
import {
  Sparkles,
  Sliders,
  Filter,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Download,
  Info,
  TrendingUp,
  Flame,
  Palette,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronsUpDown,
  Copy,
  CheckCircle2,
  Maximize2,
  Minimize2,
  Hash,
  Type,
  Calendar,
  Layers,
} from 'lucide-react';
import type { ReportTable } from '../types';

export type HighlightMode = 'top10' | 'top20' | 'topBottom10' | 'aboveAvg' | 'heatmap' | 'off';
export type ColorPalette = 'amber' | 'emerald' | 'indigo' | 'rose';

interface ColumnStats {
  columnIndex: number;
  columnName: string;
  isNumeric: boolean;
  count: number;
  values: number[];
  sortedValues: number[];
  min: number;
  max: number;
  sum: number;
  mean: number;
  stdDev: number;
  p90: number; // 90th percentile (Top 10% threshold)
  p80: number; // 80th percentile (Top 20% threshold)
  p95: number; // 95th percentile (Top 5% threshold)
  p10: number; // 10th percentile (Bottom 10% threshold)
}

export interface DataTableProps {
  table: ReportTable;
  searchQuery?: string;
  defaultHighlightMode?: HighlightMode;
}

/**
 * Parses raw cell value into number if possible
 */
function parseNumericCell(val: string | number | null | undefined): number | null {
  if (val === null || val === undefined) return null;
  if (typeof val === 'number') return isNaN(val) ? null : val;
  const str = String(val).trim();
  if (!str || str === '—' || str === '-' || str === 'N/A' || str === 'null') return null;

  // Clean currency symbols, commas, percent signs
  const cleaned = str.replace(/[$€£¥₹,%]/g, '').trim();
  const num = Number(cleaned);
  return !isNaN(num) && isFinite(num) ? num : null;
}

function getPercentile(sorted: number[], p: number): number {
  if (sorted.length === 0) return 0;
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sorted.length) return sorted[lower];
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

export const DataTable: React.FC<DataTableProps> = ({
  table,
  searchQuery = '',
  defaultHighlightMode = 'top10',
}) => {
  const [highlightMode, setHighlightMode] = useState<HighlightMode>(defaultHighlightMode);
  const [palette, setPalette] = useState<ColorPalette>('amber');
  const [sortColIndex, setSortColIndex] = useState<number | null>(null);
  const [sortAsc, setSortAsc] = useState(true);
  const [activeColumnFilter, setActiveColumnFilter] = useState<number | 'all'>('all');
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());
  const [copiedRowIndex, setCopiedRowIndex] = useState<number | null>(null);

  // Compute column statistics for all columns in the table
  const columnStats = useMemo<Record<number, ColumnStats>>(() => {
    const stats: Record<number, ColumnStats> = {};

    table.columns.forEach((colName, cIdx) => {
      const numericVals: number[] = [];

      table.rows.forEach((row) => {
        const parsed = parseNumericCell(row[cIdx]);
        if (parsed !== null) {
          numericVals.push(parsed);
        }
      });

      const totalRows = table.rows.length;
      const isNumeric = totalRows > 0 && numericVals.length / totalRows >= 0.5;

      if (isNumeric && numericVals.length > 0) {
        const sorted = [...numericVals].sort((a, b) => a - b);
        const sum = sorted.reduce((acc, curr) => acc + curr, 0);
        const mean = sum / sorted.length;
        const min = sorted[0];
        const max = sorted[sorted.length - 1];

        // Variance & Std Dev
        const variance =
          sorted.length > 1
            ? sorted.reduce((acc, curr) => acc + Math.pow(curr - mean, 2), 0) / (sorted.length - 1)
            : 0;
        const stdDev = Math.sqrt(variance);

        stats[cIdx] = {
          columnIndex: cIdx,
          columnName: colName,
          isNumeric: true,
          count: numericVals.length,
          values: numericVals,
          sortedValues: sorted,
          min,
          max,
          sum,
          mean,
          stdDev,
          p90: getPercentile(sorted, 0.9),
          p80: getPercentile(sorted, 0.8),
          p95: getPercentile(sorted, 0.95),
          p10: getPercentile(sorted, 0.1),
        };
      } else {
        stats[cIdx] = {
          columnIndex: cIdx,
          columnName: colName,
          isNumeric: false,
          count: 0,
          values: [],
          sortedValues: [],
          min: 0,
          max: 0,
          sum: 0,
          mean: 0,
          stdDev: 0,
          p90: 0,
          p80: 0,
          p95: 0,
          p10: 0,
        };
      }
    });

    return stats;
  }, [table]);

  const numericColumnsCount = useMemo(() => {
    return Object.values(columnStats).filter((s) => s.isNumeric).length;
  }, [columnStats]);

  // Filter and sort rows
  const processedRows = useMemo(() => {
    let result = [...table.rows];

    // Search query
    if (searchQuery.trim()) {
      const lower = searchQuery.toLowerCase();
      result = result.filter((row) =>
        row.some((cell) => cell !== null && String(cell).toLowerCase().includes(lower))
      );
    }

    // Sort column
    if (sortColIndex !== null && sortColIndex < table.columns.length) {
      const stat = columnStats[sortColIndex];
      result.sort((rowA, rowB) => {
        const cellA = rowA[sortColIndex];
        const cellB = rowB[sortColIndex];

        if (cellA === null || cellA === undefined) return 1;
        if (cellB === null || cellB === undefined) return -1;

        if (stat?.isNumeric) {
          const numA = parseNumericCell(cellA) ?? -Infinity;
          const numB = parseNumericCell(cellB) ?? -Infinity;
          return sortAsc ? numA - numB : numB - numA;
        }

        const strA = String(cellA).toLowerCase();
        const strB = String(cellB).toLowerCase();
        return sortAsc ? strA.localeCompare(strB) : strB.localeCompare(strA);
      });
    }

    return result;
  }, [table, searchQuery, sortColIndex, sortAsc, columnStats]);

  // Toggle single row expansion
  const toggleRowExpansion = (rowIdx: number, e?: React.MouseEvent) => {
    e?.stopPropagation();
    setExpandedRows((prev) => {
      const next = new Set(prev);
      if (next.has(rowIdx)) {
        next.delete(rowIdx);
      } else {
        next.add(rowIdx);
      }
      return next;
    });
  };

  // Expand all rows
  const handleExpandAll = () => {
    if (expandedRows.size === processedRows.length) {
      setExpandedRows(new Set());
    } else {
      setExpandedRows(new Set(processedRows.map((_, idx) => idx)));
    }
  };

  // Copy row content as formatted JSON
  const handleCopyRow = (row: (string | number | null)[], rowIdx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const rowObj: Record<string, any> = {};
    table.columns.forEach((col, idx) => {
      rowObj[col] = row[idx];
    });
    navigator.clipboard.writeText(JSON.stringify(rowObj, null, 2));
    setCopiedRowIndex(rowIdx);
    setTimeout(() => setCopiedRowIndex(null), 2000);
  };

  // Handle column header sort
  const handleSort = (cIdx: number) => {
    if (sortColIndex === cIdx) {
      if (sortAsc) {
        setSortAsc(false);
      } else {
        setSortColIndex(null);
        setSortAsc(true);
      }
    } else {
      setSortColIndex(cIdx);
      setSortAsc(true);
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    const headerRow = table.columns.map((c) => `"${c.replace(/"/g, '""')}"`).join(',');
    const bodyRows = processedRows
      .map((row) =>
        row
          .map((cell) =>
            cell === null || cell === undefined
              ? '""'
              : `"${String(cell).replace(/"/g, '""')}"`
          )
          .join(',')
      )
      .join('\n');

    const csvData = `${headerRow}\n${bodyRows}`;
    const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute(
      'download',
      `${(table.title || 'data_table').replace(/[^a-zA-Z0-9]/g, '_')}.csv`
    );
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  /**
   * Helper function to calculate background highlight style and metadata for a cell
   */
  const getCellHighlight = (
    val: string | number | null | undefined,
    colIdx: number
  ): {
    className: string;
    style?: React.CSSProperties;
    isHighlighted: boolean;
    badgeText?: string;
    tooltip?: string;
    varianceVsMean?: number;
    rangeRatio?: number;
  } => {
    if (highlightMode === 'off') {
      return { className: '', isHighlighted: false };
    }

    // Check if column is active
    if (activeColumnFilter !== 'all' && activeColumnFilter !== colIdx) {
      return { className: '', isHighlighted: false };
    }

    const stat = columnStats[colIdx];
    if (!stat || !stat.isNumeric || stat.count === 0) {
      return { className: '', isHighlighted: false };
    }

    const num = parseNumericCell(val);
    if (num === null) {
      return { className: '', isHighlighted: false };
    }

    const diffFromMean = stat.mean !== 0 ? ((num - stat.mean) / Math.abs(stat.mean)) * 100 : 0;
    const diffText = `${diffFromMean >= 0 ? '+' : ''}${diffFromMean.toFixed(1)}% vs avg`;
    const range = stat.max - stat.min;
    const ratio = range > 0 ? Math.max(0, Math.min(1, (num - stat.min) / range)) : 0.5;

    // 1. HEATMAP CONTINUOUS SCALE
    if (highlightMode === 'heatmap') {
      let bgColor = '';
      let textColor = 'text-neutral-900 font-medium';

      if (palette === 'amber') {
        bgColor = `rgba(245, 158, 11, ${0.08 + ratio * 0.45})`;
        if (ratio >= 0.8) textColor = 'text-amber-950 font-bold';
      } else if (palette === 'emerald') {
        bgColor = `rgba(16, 185, 129, ${0.08 + ratio * 0.45})`;
        if (ratio >= 0.8) textColor = 'text-emerald-950 font-bold';
      } else if (palette === 'indigo') {
        bgColor = `rgba(99, 102, 241, ${0.08 + ratio * 0.45})`;
        if (ratio >= 0.8) textColor = 'text-indigo-950 font-bold';
      } else {
        bgColor = `rgba(244, 63, 94, ${0.08 + ratio * 0.45})`;
        if (ratio >= 0.8) textColor = 'text-rose-950 font-bold';
      }

      return {
        className: `${textColor} transition-colors duration-150`,
        style: { backgroundColor: bgColor },
        isHighlighted: ratio >= 0.6,
        tooltip: `${num.toLocaleString()} • ${(ratio * 100).toFixed(0)}% of range (${diffText})`,
        varianceVsMean: diffFromMean,
        rangeRatio: ratio,
      };
    }

    // 2. TOP 10% OUTLIERS (Default mode)
    if (highlightMode === 'top10') {
      if (num >= stat.p95) {
        // Extreme top 5%
        const colorClasses =
          palette === 'amber'
            ? 'bg-amber-200/90 text-amber-950 font-bold ring-1 ring-amber-400/50'
            : palette === 'emerald'
            ? 'bg-emerald-200/90 text-emerald-950 font-bold ring-1 ring-emerald-400/50'
            : palette === 'indigo'
            ? 'bg-indigo-200/90 text-indigo-950 font-bold ring-1 ring-indigo-400/50'
            : 'bg-rose-200/90 text-rose-950 font-bold ring-1 ring-rose-400/50';

        return {
          className: `${colorClasses} rounded-sm`,
          isHighlighted: true,
          badgeText: 'Top 5%',
          tooltip: `Extreme Outlier (Top 5%): ${num.toLocaleString()} (${diffText})`,
          varianceVsMean: diffFromMean,
          rangeRatio: ratio,
        };
      } else if (num >= stat.p90) {
        // Top 10%
        const colorClasses =
          palette === 'amber'
            ? 'bg-amber-100/90 text-amber-900 font-semibold'
            : palette === 'emerald'
            ? 'bg-emerald-100/90 text-emerald-900 font-semibold'
            : palette === 'indigo'
            ? 'bg-indigo-100/90 text-indigo-900 font-semibold'
            : 'bg-rose-100/90 text-rose-900 font-semibold';

        return {
          className: `${colorClasses} rounded-sm`,
          isHighlighted: true,
          badgeText: 'Top 10%',
          tooltip: `Top 10% Outlier: ${num.toLocaleString()} (${diffText})`,
          varianceVsMean: diffFromMean,
          rangeRatio: ratio,
        };
      }
    }

    // 3. TOP 20%
    if (highlightMode === 'top20') {
      if (num >= stat.p90) {
        const colorClasses =
          palette === 'amber'
            ? 'bg-amber-200/90 text-amber-950 font-bold'
            : palette === 'emerald'
            ? 'bg-emerald-200/90 text-emerald-950 font-bold'
            : palette === 'indigo'
            ? 'bg-indigo-200/90 text-indigo-950 font-bold'
            : 'bg-rose-200/90 text-rose-950 font-bold';

        return {
          className: `${colorClasses} rounded-sm`,
          isHighlighted: true,
          badgeText: 'Top 10%',
          tooltip: `Top 10%: ${num.toLocaleString()} (${diffText})`,
          varianceVsMean: diffFromMean,
          rangeRatio: ratio,
        };
      } else if (num >= stat.p80) {
        const colorClasses =
          palette === 'amber'
            ? 'bg-amber-100/80 text-amber-900 font-medium'
            : palette === 'emerald'
            ? 'bg-emerald-100/80 text-emerald-900 font-medium'
            : palette === 'indigo'
            ? 'bg-indigo-100/80 text-indigo-900 font-medium'
            : 'bg-rose-100/80 text-rose-900 font-medium';

        return {
          className: `${colorClasses} rounded-sm`,
          isHighlighted: true,
          badgeText: 'Top 20%',
          tooltip: `Top 20%: ${num.toLocaleString()} (${diffText})`,
          varianceVsMean: diffFromMean,
          rangeRatio: ratio,
        };
      }
    }

    // 4. TOP & BOTTOM 10% EXTREMES
    if (highlightMode === 'topBottom10') {
      if (num >= stat.p90) {
        return {
          className: 'bg-amber-100/90 text-amber-950 font-bold rounded-sm ring-1 ring-amber-300/40',
          isHighlighted: true,
          badgeText: 'High',
          tooltip: `High Outlier (Top 10%): ${num.toLocaleString()} (${diffText})`,
          varianceVsMean: diffFromMean,
          rangeRatio: ratio,
        };
      } else if (num <= stat.p10) {
        return {
          className: 'bg-sky-100/90 text-sky-950 font-bold rounded-sm ring-1 ring-sky-300/40',
          isHighlighted: true,
          badgeText: 'Low',
          tooltip: `Low Outlier (Bottom 10%): ${num.toLocaleString()} (${diffText})`,
          varianceVsMean: diffFromMean,
          rangeRatio: ratio,
        };
      }
    }

    // 5. ABOVE AVERAGE (+1 StdDev)
    if (highlightMode === 'aboveAvg') {
      const threshold = stat.mean + stat.stdDev;
      if (num >= threshold) {
        const colorClasses =
          palette === 'amber'
            ? 'bg-amber-200/85 text-amber-950 font-bold'
            : palette === 'emerald'
            ? 'bg-emerald-200/85 text-emerald-950 font-bold'
            : palette === 'indigo'
            ? 'bg-indigo-200/85 text-indigo-950 font-bold'
            : 'bg-rose-200/85 text-rose-950 font-bold';

        return {
          className: `${colorClasses} rounded-sm`,
          isHighlighted: true,
          badgeText: '> +1σ',
          tooltip: `Above Avg (+1σ Outlier): ${num.toLocaleString()} (${diffText})`,
          varianceVsMean: diffFromMean,
          rangeRatio: ratio,
        };
      } else if (num > stat.mean) {
        const colorClasses =
          palette === 'amber'
            ? 'bg-amber-50 text-amber-900 font-medium'
            : palette === 'emerald'
            ? 'bg-emerald-50 text-emerald-900 font-medium'
            : palette === 'indigo'
            ? 'bg-indigo-50 text-indigo-900 font-medium'
            : 'bg-rose-50 text-rose-900 font-medium';

        return {
          className: colorClasses,
          isHighlighted: false,
          tooltip: `Above Mean: ${num.toLocaleString()} (${diffText})`,
          varianceVsMean: diffFromMean,
          rangeRatio: ratio,
        };
      }
    }

    return { className: '', isHighlighted: false, varianceVsMean: diffFromMean, rangeRatio: ratio };
  };

  // Count total highlighted cells currently in view
  const highlightedCellsCount = useMemo(() => {
    if (highlightMode === 'off') return 0;
    let count = 0;
    processedRows.forEach((row) => {
      row.forEach((cell, ci) => {
        const h = getCellHighlight(cell, ci);
        if (h.isHighlighted) count++;
      });
    });
    return count;
  }, [processedRows, highlightMode, palette, activeColumnFilter, columnStats]);

  return (
    <div className="overflow-hidden rounded-2xl border border-neutral-200 bg-white shadow-sm transition">
      {/* Table Header & Controls Bar */}
      <div className="border-b border-neutral-200 px-5 py-3.5 bg-neutral-50/80 flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <p className="text-sm font-bold text-neutral-900 truncate">{table.title}</p>
            {numericColumnsCount > 0 && (
              <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-blue-50 text-io-blue border border-blue-200/60 font-semibold">
                {numericColumnsCount} numeric {numericColumnsCount === 1 ? 'col' : 'cols'}
              </span>
            )}
            <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-neutral-200/70 text-neutral-600">
              Click row to expand
            </span>
          </div>
          {table.caption && <p className="mt-0.5 text-xs text-neutral-500 line-clamp-1">{table.caption}</p>}
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0 self-start md:self-auto">
          {/* Threshold & Outlier Highlighting Mode Selector */}
          <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-200 shadow-2xs">
            <span className="text-[11px] font-semibold text-neutral-500 pl-2 pr-1 flex items-center gap-1">
              <Sparkles className="h-3 w-3 text-amber-500" />
              <span className="hidden sm:inline">Highlight:</span>
            </span>

            {(
              [
                { id: 'top10', label: 'Top 10%', title: 'Highlight Top 10% Outliers (90th percentile)' },
                { id: 'top20', label: 'Top 20%', title: 'Highlight Top 20% Values (80th percentile)' },
                { id: 'topBottom10', label: 'Top/Bottom 10%', title: 'Highlight Top 10% & Bottom 10% Extremes' },
                { id: 'heatmap', label: 'Heatmap', title: 'Full Continuous Color Scale Heatmap' },
                { id: 'off', label: 'Off', title: 'Disable Cell Highlighting' },
              ] as const
            ).map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setHighlightMode(m.id)}
                title={m.title}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                  highlightMode === m.id
                    ? 'bg-neutral-900 text-white shadow-2xs'
                    : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100'
                }`}
              >
                {m.label}
              </button>
            ))}
          </div>

          {/* Color Palette Switcher (When highlight is active) */}
          {highlightMode !== 'off' && (
            <div className="flex items-center gap-1 bg-white p-1 rounded-xl border border-neutral-200 shadow-2xs">
              {(
                [
                  { id: 'amber', bg: 'bg-amber-400', label: 'Amber' },
                  { id: 'emerald', bg: 'bg-emerald-500', label: 'Emerald' },
                  { id: 'indigo', bg: 'bg-indigo-500', label: 'Indigo' },
                  { id: 'rose', bg: 'bg-rose-500', label: 'Rose' },
                ] as const
              ).map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setPalette(p.id)}
                  title={`${p.label} Color Scale`}
                  className={`h-5 w-5 rounded-full ${p.bg} transition transform cursor-pointer flex items-center justify-center ${
                    palette === p.id ? 'ring-2 ring-neutral-900 ring-offset-1 scale-110' : 'opacity-70 hover:opacity-100'
                  }`}
                >
                  {palette === p.id && <Check className="h-2.5 w-2.5 text-white" />}
                </button>
              ))}
            </div>
          )}

          {/* Expand/Collapse All Toggle */}
          <button
            type="button"
            onClick={handleExpandAll}
            className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition cursor-pointer shadow-2xs"
            title={expandedRows.size === processedRows.length ? 'Collapse all rows' : 'Expand all rows'}
          >
            {expandedRows.size === processedRows.length ? (
              <>
                <Minimize2 className="h-3.5 w-3.5 text-neutral-500" />
                <span className="hidden sm:inline">Collapse All</span>
              </>
            ) : (
              <>
                <Maximize2 className="h-3.5 w-3.5 text-neutral-500" />
                <span className="hidden sm:inline">Expand All</span>
              </>
            )}
          </button>

          {/* Export CSV Button */}
          <button
            type="button"
            onClick={handleExportCSV}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition cursor-pointer shadow-2xs"
            title="Export filtered data table as CSV"
          >
            <Download className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">CSV</span>
          </button>
        </div>
      </div>

      {/* Active Highlighting Legend & Stats Ribbon */}
      {highlightMode !== 'off' && (
        <div className="px-5 py-2 bg-neutral-100/60 border-b border-neutral-200 flex flex-wrap items-center justify-between gap-2 text-xs font-medium text-neutral-600">
          <div className="flex items-center gap-3 flex-wrap">
            <div className="flex items-center gap-1.5">
              <span className="font-semibold text-neutral-800">Color Scale:</span>
              {highlightMode === 'top10' && (
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="flex items-center gap-1">
                    <span
                      className={`inline-block h-3 w-3 rounded-xs ${
                        palette === 'amber'
                          ? 'bg-amber-300'
                          : palette === 'emerald'
                          ? 'bg-emerald-300'
                          : palette === 'indigo'
                          ? 'bg-indigo-300'
                          : 'bg-rose-300'
                      }`}
                    />
                    <span>Top 5% Extreme</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className={`inline-block h-3 w-3 rounded-xs ${
                        palette === 'amber'
                          ? 'bg-amber-100'
                          : palette === 'emerald'
                          ? 'bg-emerald-100'
                          : palette === 'indigo'
                          ? 'bg-indigo-100'
                          : 'bg-rose-100'
                      }`}
                    />
                    <span>Top 10% Outlier</span>
                  </span>
                </div>
              )}

              {highlightMode === 'top20' && (
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="flex items-center gap-1">
                    <span
                      className={`inline-block h-3 w-3 rounded-xs ${
                        palette === 'amber' ? 'bg-amber-300' : 'bg-emerald-300'
                      }`}
                    />
                    <span>Top 10%</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span
                      className={`inline-block h-3 w-3 rounded-xs ${
                        palette === 'amber' ? 'bg-amber-100' : 'bg-emerald-100'
                      }`}
                    />
                    <span>Top 20%</span>
                  </span>
                </div>
              )}

              {highlightMode === 'topBottom10' && (
                <div className="flex items-center gap-2 text-[11px] font-mono">
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-xs bg-amber-200" />
                    <span>Top 10% High</span>
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="inline-block h-3 w-3 rounded-xs bg-sky-200" />
                    <span>Bottom 10% Low</span>
                  </span>
                </div>
              )}

              {highlightMode === 'heatmap' && (
                <div className="flex items-center gap-1.5 text-[11px] font-mono">
                  <span>Min</span>
                  <div
                    className={`h-2.5 w-16 rounded-full ${
                      palette === 'amber'
                        ? 'bg-gradient-to-r from-amber-100 via-amber-300 to-amber-500'
                        : palette === 'emerald'
                        ? 'bg-gradient-to-r from-emerald-100 via-emerald-300 to-emerald-600'
                        : palette === 'indigo'
                        ? 'bg-gradient-to-r from-indigo-100 via-indigo-300 to-indigo-600'
                        : 'bg-gradient-to-r from-rose-100 via-rose-300 to-rose-600'
                    }`}
                  />
                  <span>Max</span>
                </div>
              )}
            </div>

            {/* Column Target Filter (if multiple numeric columns exist) */}
            {numericColumnsCount > 1 && (
              <div className="flex items-center gap-1.5">
                <span className="text-neutral-400">|</span>
                <span className="text-[11px] text-neutral-500">Apply to:</span>
                <select
                  value={activeColumnFilter}
                  onChange={(e) =>
                    setActiveColumnFilter(e.target.value === 'all' ? 'all' : Number(e.target.value))
                  }
                  className="bg-white border border-neutral-300 text-neutral-800 text-[11px] rounded-lg px-2 py-0.5 outline-none focus:border-io-blue font-semibold"
                >
                  <option value="all">All Numeric Columns ({numericColumnsCount})</option>
                  {table.columns.map((c, i) =>
                    columnStats[i]?.isNumeric ? (
                      <option key={i} value={i}>
                        {c}
                      </option>
                    ) : null
                  )}
                </select>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px] font-mono text-neutral-500">
            {highlightedCellsCount > 0 && (
              <span className="font-semibold text-neutral-800">
                {highlightedCellsCount} cells flagged
              </span>
            )}
            <span>
              Showing {processedRows.length} of {table.rows.length} rows
            </span>
          </div>
        </div>
      )}

      {/* Table Canvas */}
      <div className="overflow-x-auto max-h-[560px]">
        <table className="w-full text-xs sm:text-sm border-collapse">
          <thead className="sticky top-0 z-10 bg-neutral-100 border-b border-neutral-200 shadow-2xs">
            <tr className="text-left">
              {/* Row expand indicator header */}
              <th className="w-10 px-3 py-2.5 font-bold text-neutral-500 text-center select-none">
                <span className="sr-only">Expand</span>
              </th>

              {table.columns.map((colName, colIdx) => {
                const stat = columnStats[colIdx];
                const isSorted = sortColIndex === colIdx;

                return (
                  <th
                    key={colIdx}
                    onClick={() => handleSort(colIdx)}
                    className="px-4 py-2.5 font-bold text-neutral-700 whitespace-nowrap cursor-pointer hover:bg-neutral-200/70 select-none transition"
                    title={`Click to sort by ${colName}${
                      stat?.isNumeric
                        ? ` (Mean: ${stat.mean.toFixed(1)}, Top 10% > ${stat.p90.toFixed(1)})`
                        : ''
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5 min-w-0">
                        <span className="truncate">{colName}</span>
                        {stat?.isNumeric && (
                          <span className="text-[10px] font-mono font-normal text-neutral-500 bg-neutral-200/80 px-1.5 py-0.2 rounded">
                            123
                          </span>
                        )}
                      </div>
                      <div className="shrink-0 text-neutral-400">
                        {isSorted ? (
                          sortAsc ? (
                            <ArrowUp className="h-3.5 w-3.5 text-io-blue" />
                          ) : (
                            <ArrowDown className="h-3.5 w-3.5 text-io-blue" />
                          )
                        ) : (
                          <ArrowUpDown className="h-3 w-3 opacity-40 hover:opacity-100" />
                        )}
                      </div>
                    </div>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody className="divide-y divide-neutral-100 font-mono">
            {processedRows.map((row, rowIdx) => {
              const isExpanded = expandedRows.has(rowIdx);

              return (
                <React.Fragment key={rowIdx}>
                  {/* Primary Row */}
                  <tr
                    onClick={(e) => toggleRowExpansion(rowIdx, e)}
                    className={`transition cursor-pointer select-none ${
                      isExpanded
                        ? 'bg-blue-50/50 border-l-4 border-l-io-blue'
                        : 'hover:bg-neutral-50/90 border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* Expand/Collapse Chevron Icon */}
                    <td className="w-10 px-3 py-2.5 text-center text-neutral-400 hover:text-neutral-700">
                      <button
                        type="button"
                        onClick={(e) => toggleRowExpansion(rowIdx, e)}
                        className="p-1 rounded-md hover:bg-neutral-200/70 transition flex items-center justify-center mx-auto cursor-pointer"
                        title={isExpanded ? 'Collapse row details' : 'Expand row details'}
                      >
                        {isExpanded ? (
                          <ChevronDown className="h-4 w-4 text-io-blue" />
                        ) : (
                          <ChevronRight className="h-4 w-4 text-neutral-400 group-hover:text-neutral-600" />
                        )}
                      </button>
                    </td>

                    {/* Data Cells */}
                    {row.map((cell, colIdx) => {
                      const highlight = getCellHighlight(cell, colIdx);

                      return (
                        <td
                          key={colIdx}
                          className={`px-4 py-2.5 text-neutral-700 whitespace-nowrap transition-colors relative group ${highlight.className}`}
                          style={highlight.style}
                          title={highlight.tooltip}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span>
                              {cell === null || cell === undefined ? (
                                <span className="text-neutral-300 italic font-sans">—</span>
                              ) : (
                                String(cell)
                              )}
                            </span>

                            {highlight.badgeText && (
                              <span className="text-[9px] uppercase font-bold tracking-wider px-1 py-0.2 rounded bg-neutral-900/10 opacity-75 group-hover:opacity-100 shrink-0">
                                {highlight.badgeText}
                              </span>
                            )}
                          </div>
                        </td>
                      );
                    })}
                  </tr>

                  {/* Expanded Row: Vertical Detailed Layout */}
                  {isExpanded && (
                    <tr className="bg-neutral-50/95 border-y border-neutral-200">
                      <td colSpan={table.columns.length + 1} className="p-0">
                        <div className="p-4 sm:p-6 bg-gradient-to-b from-blue-50/40 to-neutral-50/90 border-l-4 border-l-io-blue space-y-4">
                          {/* Expanded Card Header */}
                          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b border-neutral-200">
                            <div className="flex items-center gap-2">
                              <span className="px-2 py-0.5 rounded-lg text-xs font-bold bg-neutral-900 text-white font-mono">
                                Row #{rowIdx + 1}
                              </span>
                              <h4 className="text-xs sm:text-sm font-bold text-neutral-800 font-sans">
                                Detailed Record View
                              </h4>
                              <span className="text-[11px] text-neutral-500 font-sans">
                                ({table.columns.length} columns)
                              </span>
                            </div>

                            <div className="flex items-center gap-2">
                              {/* Copy JSON Button */}
                              <button
                                type="button"
                                onClick={(e) => handleCopyRow(row, rowIdx, e)}
                                className="inline-flex items-center gap-1.5 px-3 py-1 text-xs font-semibold rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-700 transition cursor-pointer shadow-2xs"
                                title="Copy row values as formatted JSON"
                              >
                                {copiedRowIndex === rowIdx ? (
                                  <>
                                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
                                    <span className="text-emerald-700">Copied!</span>
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3.5 w-3.5 text-neutral-500" />
                                    <span>Copy JSON</span>
                                  </>
                                )}
                              </button>

                              {/* Collapse Button */}
                              <button
                                type="button"
                                onClick={(e) => toggleRowExpansion(rowIdx, e)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-neutral-200 hover:bg-neutral-100 text-neutral-600 transition cursor-pointer shadow-2xs"
                              >
                                <ChevronDown className="h-3.5 w-3.5 rotate-180" />
                                <span>Collapse</span>
                              </button>
                            </div>
                          </div>

                          {/* Vertical Column Value Cards Grid */}
                          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                            {table.columns.map((colName, cIdx) => {
                              const cellValue = row[cIdx];
                              const stat = columnStats[cIdx];
                              const highlight = getCellHighlight(cellValue, cIdx);
                              const parsedNum = parseNumericCell(cellValue);

                              return (
                                <div
                                  key={cIdx}
                                  className={`rounded-xl border p-3.5 bg-white shadow-2xs transition flex flex-col justify-between ${
                                    highlight.isHighlighted
                                      ? 'border-amber-300 ring-1 ring-amber-200 bg-amber-50/20'
                                      : 'border-neutral-200 hover:border-neutral-300'
                                  }`}
                                >
                                  <div>
                                    {/* Field Header */}
                                    <div className="flex items-center justify-between gap-2 mb-1.5">
                                      <div className="flex items-center gap-1.5 min-w-0">
                                        {stat?.isNumeric ? (
                                          <Hash className="h-3.5 w-3.5 text-io-blue shrink-0" />
                                        ) : (
                                          <Type className="h-3.5 w-3.5 text-purple-600 shrink-0" />
                                        )}
                                        <span className="text-xs font-bold text-neutral-700 truncate font-sans" title={colName}>
                                          {colName}
                                        </span>
                                      </div>

                                      <div className="flex items-center gap-1 shrink-0">
                                        {stat?.isNumeric && (
                                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-blue-50 text-io-blue font-semibold">
                                            num
                                          </span>
                                        )}
                                        {highlight.badgeText && (
                                          <span className="text-[10px] px-1.5 py-0.2 rounded font-mono bg-amber-100 text-amber-900 font-bold">
                                            {highlight.badgeText}
                                          </span>
                                        )}
                                      </div>
                                    </div>

                                    {/* Primary Value */}
                                    <div className="my-1">
                                      {cellValue === null || cellValue === undefined ? (
                                        <span className="text-neutral-400 italic text-sm font-sans">null / empty</span>
                                      ) : (
                                        <span className="text-sm sm:text-base font-extrabold text-neutral-900 font-mono break-all select-text">
                                          {String(cellValue)}
                                        </span>
                                      )}
                                    </div>
                                  </div>

                                  {/* Numeric Range & Benchmark Progress Bar */}
                                  {stat?.isNumeric && parsedNum !== null && (
                                    <div className="mt-3 pt-2.5 border-t border-neutral-100 space-y-1.5 font-sans">
                                      <div className="flex items-center justify-between text-[10px] text-neutral-500 font-mono">
                                        <span>Min: {stat.min.toLocaleString()}</span>
                                        {highlight.varianceVsMean !== undefined && (
                                          <span
                                            className={`font-semibold ${
                                              highlight.varianceVsMean >= 0
                                                ? 'text-emerald-600'
                                                : 'text-rose-600'
                                            }`}
                                          >
                                            {highlight.varianceVsMean >= 0 ? '+' : ''}
                                            {highlight.varianceVsMean.toFixed(1)}% vs avg ({stat.mean.toFixed(1)})
                                          </span>
                                        )}
                                        <span>Max: {stat.max.toLocaleString()}</span>
                                      </div>

                                      {/* Visual Range Position Bar */}
                                      <div className="relative h-2 w-full bg-neutral-100 rounded-full overflow-hidden">
                                        <div
                                          className={`h-full rounded-full transition-all ${
                                            highlight.isHighlighted
                                              ? 'bg-amber-500'
                                              : 'bg-io-blue'
                                          }`}
                                          style={{
                                            width: `${Math.max(
                                              4,
                                              Math.min(
                                                100,
                                                ((parsedNum - stat.min) /
                                                  Math.max(1, stat.max - stat.min)) *
                                                  100
                                              )
                                            )}%`,
                                          }}
                                        />
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })}

            {processedRows.length === 0 && (
              <tr>
                <td
                  colSpan={table.columns.length + 1}
                  className="px-4 py-12 text-center text-xs text-neutral-400 font-sans"
                >
                  No matching rows found for "{searchQuery}".
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};
export default DataTable;
