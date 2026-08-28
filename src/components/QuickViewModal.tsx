import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Table as TableIcon,
  BarChart2,
  Hash,
  Tag,
  Calendar,
  Key,
  CheckCircle2,
  Search,
  Filter,
  ArrowUpDown,
  Download,
  Sparkles,
  Info,
  Layers,
  Percent,
  TrendingUp,
  Sliders,
} from 'lucide-react';
import {
  computeDescriptiveStats,
  formatStatNumber,
  type DatasetQuickStats,
  type ColumnDescriptiveStats,
} from '../utils/descriptiveStats';

export interface QuickViewModalProps {
  isOpen: boolean;
  onClose: () => void;
  csvContent?: string;
  fileName?: string;
  onProceedToAnalysis?: () => void;
}

export const QuickViewModal: React.FC<QuickViewModalProps> = ({
  isOpen,
  onClose,
  csvContent = '',
  fileName = 'dataset.csv',
  onProceedToAnalysis,
}) => {
  const [activeTab, setActiveTab] = useState<'stats' | 'preview' | 'cards'>('stats');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | 'numeric' | 'categorical' | 'temporal'>('all');
  const [sortField, setSortField] = useState<keyof ColumnDescriptiveStats>('columnName');
  const [sortAsc, setSortAsc] = useState(true);

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Compute stats memoized
  const stats = useMemo<DatasetQuickStats | null>(() => {
    if (!isOpen || !csvContent) return null;
    return computeDescriptiveStats(csvContent, fileName);
  }, [isOpen, csvContent, fileName]);

  // Filter and sort columns
  const filteredColumns = useMemo(() => {
    if (!stats) return [];
    return stats.columns
      .filter((col) => {
        // Type filter
        if (typeFilter === 'numeric' && !col.isNumeric) return false;
        if (typeFilter === 'categorical' && (col.isNumeric || col.dataType === 'temporal')) return false;
        if (typeFilter === 'temporal' && col.dataType !== 'temporal') return false;

        // Search query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return (
            col.columnName.toLowerCase().includes(q) ||
            col.dataType.toLowerCase().includes(q)
          );
        }
        return true;
      })
      .sort((a, b) => {
        let valA = a[sortField];
        let valB = b[sortField];

        if (valA === undefined) return 1;
        if (valB === undefined) return -1;

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortAsc ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        return sortAsc
          ? (valA as number) - (valB as number)
          : (valB as number) - (valA as number);
      });
  }, [stats, typeFilter, searchQuery, sortField, sortAsc]);

  if (!isOpen) return null;

  const getTypeIcon = (type: string, isNumeric: boolean) => {
    if (isNumeric) return <Hash className="h-3.5 w-3.5 text-io-blue shrink-0" />;
    switch (type) {
      case 'temporal':
        return <Calendar className="h-3.5 w-3.5 text-emerald-600 shrink-0" />;
      case 'identifier':
        return <Key className="h-3.5 w-3.5 text-neutral-400 shrink-0" />;
      case 'categorical':
      default:
        return <Tag className="h-3.5 w-3.5 text-purple-600 shrink-0" />;
    }
  };

  const handleSort = (field: keyof ColumnDescriptiveStats) => {
    if (sortField === field) {
      setSortAsc(!sortAsc);
    } else {
      setSortField(field);
      setSortAsc(true);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-neutral-900/60 backdrop-blur-xs transition-opacity duration-200">
      <div
        className="relative w-full max-w-5xl max-h-[90vh] bg-white rounded-2xl shadow-2xl border border-neutral-200 flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-200"
        role="dialog"
        aria-modal="true"
        aria-labelledby="quick-view-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-neutral-200 bg-neutral-50/80 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-io-blue/10 text-io-blue flex items-center justify-center shrink-0">
              <BarChart2 className="h-5 w-5" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 id="quick-view-modal-title" className="text-base sm:text-lg font-bold text-neutral-900 truncate">
                  Quick View: {fileName}
                </h2>
                <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-blue-100 text-io-blue font-mono">
                  Descriptive Stats
                </span>
              </div>
              <p className="text-xs text-neutral-500 truncate mt-0.5">
                Instant distribution and summary statistics before running agent analysis
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="rounded-xl p-2 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-200/60 transition cursor-pointer shrink-0"
            aria-label="Close modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content Body */}
        {!stats ? (
          <div className="p-12 text-center text-neutral-500">
            <p className="text-sm font-medium">No valid CSV data available to inspect.</p>
          </div>
        ) : (
          <div className="flex-1 flex flex-col overflow-hidden">
            {/* Top KPI Bento Summary Row */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 p-4 sm:p-5 border-b border-neutral-100 bg-white shrink-0">
              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Total Records
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-neutral-900 font-mono mt-1">
                  {stats.totalRows.toLocaleString()}
                </span>
                <span className="text-[10px] text-neutral-400 mt-0.5">Rows in dataset</span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Columns
                </span>
                <div className="flex items-baseline gap-1.5 mt-1">
                  <span className="text-xl sm:text-2xl font-extrabold text-neutral-900 font-mono">
                    {stats.totalColumns}
                  </span>
                  <span className="text-[11px] text-neutral-500 font-mono">
                    ({stats.numericColumnCount} num)
                  </span>
                </div>
                <span className="text-[10px] text-neutral-400 mt-0.5">
                  {stats.categoricalColumnCount} categorical
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Completeness
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-emerald-600 font-mono mt-1">
                  {(100 - stats.missingCellsPercentage).toFixed(1)}%
                </span>
                <span className="text-[10px] text-neutral-400 mt-0.5">
                  {stats.totalMissingCells} missing cells
                </span>
              </div>

              <div className="p-3 rounded-xl bg-neutral-50 border border-neutral-200/80 flex flex-col justify-between">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
                  Numeric Ratio
                </span>
                <span className="text-xl sm:text-2xl font-extrabold text-io-blue font-mono mt-1">
                  {((stats.numericColumnCount / stats.totalColumns) * 100).toFixed(0)}%
                </span>
                <span className="text-[10px] text-neutral-400 mt-0.5">Quantitative metrics</span>
              </div>
            </div>

            {/* Navigation & Filter Bar */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 border-b border-neutral-200 bg-neutral-50/50 shrink-0">
              {/* Tab selector */}
              <div className="flex items-center gap-1.5 bg-neutral-200/60 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('stats')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'stats'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Stats Table
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('cards')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'cards'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Column Cards
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('preview')}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    activeTab === 'preview'
                      ? 'bg-white text-neutral-900 shadow-2xs'
                      : 'text-neutral-600 hover:text-neutral-900'
                  }`}
                >
                  Data Sample ({stats.rawRowsSample.length} rows)
                </button>
              </div>

              {/* Search and filters */}
              {activeTab !== 'preview' && (
                <div className="flex items-center gap-2">
                  <div className="relative min-w-[160px] sm:min-w-[200px]">
                    <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-neutral-400" />
                    <input
                      type="text"
                      placeholder="Filter columns..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-neutral-300 bg-white focus:outline-none focus:border-io-blue"
                    />
                  </div>

                  <div className="flex items-center gap-1">
                    {(['all', 'numeric', 'categorical'] as const).map((t) => (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTypeFilter(t)}
                        className={`px-2.5 py-1 rounded-lg text-[11px] font-medium capitalize transition cursor-pointer border ${
                          typeFilter === t
                            ? 'bg-neutral-900 text-white border-neutral-900'
                            : 'bg-white text-neutral-600 border-neutral-200 hover:bg-neutral-100'
                        }`}
                      >
                        {t}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Scrollable View Area */}
            <div className="flex-1 overflow-auto p-4 sm:p-5">
              {/* TAB 1: Descriptive Stats Table */}
              {activeTab === 'stats' && (
                <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="bg-neutral-100/80 border-b border-neutral-200 text-neutral-700 font-semibold uppercase tracking-wider text-[11px]">
                          <th className="py-2.5 px-3">
                            <button
                              type="button"
                              onClick={() => handleSort('columnName')}
                              className="flex items-center gap-1 hover:text-neutral-900 cursor-pointer"
                            >
                              <span>Column</span>
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                          </th>
                          <th className="py-2.5 px-3">Type</th>
                          <th className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleSort('nonNullCount')}
                              className="flex items-center gap-1 justify-end ml-auto hover:text-neutral-900 cursor-pointer"
                            >
                              <span>Count</span>
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                          </th>
                          <th className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleSort('mean')}
                              className="flex items-center gap-1 justify-end ml-auto hover:text-neutral-900 cursor-pointer"
                            >
                              <span>Mean (Avg)</span>
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                          </th>
                          <th className="py-2.5 px-3 text-right">
                            <button
                              type="button"
                              onClick={() => handleSort('median')}
                              className="flex items-center gap-1 justify-end ml-auto hover:text-neutral-900 cursor-pointer"
                            >
                              <span>Median (50%)</span>
                              <ArrowUpDown className="h-3 w-3" />
                            </button>
                          </th>
                          <th className="py-2.5 px-3 text-right">Std Dev</th>
                          <th className="py-2.5 px-3 text-right">Min</th>
                          <th className="py-2.5 px-3 text-right">Max</th>
                          <th className="py-2.5 px-3 text-right">Q1 (25%)</th>
                          <th className="py-2.5 px-3 text-right">Q3 (75%)</th>
                          <th className="py-2.5 px-3 text-right">Missing</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {filteredColumns.map((col) => (
                          <tr key={col.columnName} className="hover:bg-neutral-50/80 transition">
                            <td className="py-2.5 px-3 font-semibold text-neutral-900 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                {getTypeIcon(col.dataType, col.isNumeric)}
                                <span>{col.columnName}</span>
                              </div>
                            </td>
                            <td className="py-2.5 px-3 whitespace-nowrap">
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-medium ${
                                  col.isNumeric
                                    ? 'bg-blue-50 text-io-blue'
                                    : col.dataType === 'temporal'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-purple-50 text-purple-700'
                                }`}
                              >
                                {col.isNumeric ? 'numeric' : col.dataType}
                              </span>
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-neutral-700">
                              {col.nonNullCount.toLocaleString()}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-neutral-900">
                              {col.isNumeric ? formatStatNumber(col.mean) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono font-semibold text-indigo-600">
                              {col.isNumeric ? formatStatNumber(col.median) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-neutral-600">
                              {col.isNumeric ? formatStatNumber(col.stdDev) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-neutral-600">
                              {col.isNumeric ? formatStatNumber(col.min) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-neutral-600">
                              {col.isNumeric ? formatStatNumber(col.max) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-neutral-500">
                              {col.isNumeric ? formatStatNumber(col.q1) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right font-mono text-neutral-500">
                              {col.isNumeric ? formatStatNumber(col.q3) : '—'}
                            </td>
                            <td className="py-2.5 px-3 text-right whitespace-nowrap font-mono">
                              {col.nullCount > 0 ? (
                                <span className="text-amber-600 font-semibold">
                                  {col.nullPercentage.toFixed(1)}% ({col.nullCount})
                                </span>
                              ) : (
                                <span className="text-neutral-400">0%</span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* TAB 2: Column Cards Breakdown */}
              {activeTab === 'cards' && (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {filteredColumns.map((col) => (
                    <div
                      key={col.columnName}
                      className="rounded-xl border border-neutral-200 bg-white p-4 shadow-2xs hover:border-io-blue/50 transition flex flex-col justify-between"
                    >
                      <div>
                        <div className="flex items-start justify-between gap-2 mb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {getTypeIcon(col.dataType, col.isNumeric)}
                            <h4 className="font-bold text-neutral-900 text-sm truncate" title={col.columnName}>
                              {col.columnName}
                            </h4>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-600 font-mono shrink-0">
                            {col.dataType}
                          </span>
                        </div>

                        {/* Numeric Stats Grid */}
                        {col.isNumeric ? (
                          <div className="grid grid-cols-2 gap-2 mt-3 p-2.5 rounded-lg bg-neutral-50 border border-neutral-100 text-xs font-mono">
                            <div>
                              <span className="text-[10px] text-neutral-400 block">MEAN</span>
                              <span className="font-bold text-neutral-900">{formatStatNumber(col.mean)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-neutral-400 block">MEDIAN</span>
                              <span className="font-bold text-indigo-600">{formatStatNumber(col.median)}</span>
                            </div>
                            <div>
                              <span className="text-[10px] text-neutral-400 block">MIN - MAX</span>
                              <span className="text-neutral-700">
                                {formatStatNumber(col.min)} - {formatStatNumber(col.max)}
                              </span>
                            </div>
                            <div>
                              <span className="text-[10px] text-neutral-400 block">STD DEV</span>
                              <span className="text-neutral-700">{formatStatNumber(col.stdDev)}</span>
                            </div>
                          </div>
                        ) : (
                          /* Categorical Top Values */
                          <div className="mt-3 space-y-1.5">
                            <span className="text-[10px] font-semibold text-neutral-400 uppercase tracking-wider block">
                              Top Values ({col.uniqueCount} unique)
                            </span>
                            {col.topValues && col.topValues.length > 0 ? (
                              <div className="space-y-1">
                                {col.topValues.slice(0, 3).map((tv, idx) => (
                                  <div key={idx} className="flex items-center justify-between text-xs">
                                    <span className="text-neutral-700 truncate max-w-[70%] font-medium">
                                      {tv.value || '(empty)'}
                                    </span>
                                    <span className="text-neutral-500 font-mono text-[11px]">
                                      {tv.percentage.toFixed(1)}%
                                    </span>
                                  </div>
                                ))}
                              </div>
                            ) : (
                              <span className="text-xs text-neutral-400">No category frequencies</span>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Sample values preview */}
                      <div className="mt-3 pt-2.5 border-t border-neutral-100">
                        <span className="text-[10px] text-neutral-400 block mb-1">SAMPLE DATA</span>
                        <div className="flex flex-wrap gap-1">
                          {col.sampleValues.slice(0, 4).map((s, idx) => (
                            <span
                              key={idx}
                              className="px-1.5 py-0.5 rounded bg-neutral-100 text-neutral-700 text-[10px] font-mono truncate max-w-[120px]"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 3: Raw Data Sample */}
              {activeTab === 'preview' && (
                <div className="border border-neutral-200 rounded-xl overflow-hidden bg-white shadow-2xs">
                  <div className="overflow-x-auto max-h-[450px]">
                    <table className="w-full text-left text-xs border-collapse font-mono">
                      <thead className="sticky top-0 bg-neutral-100 border-b border-neutral-200 z-10">
                        <tr>
                          <th className="py-2 px-3 text-neutral-400 text-[10px] border-r border-neutral-200">#</th>
                          {stats.headers.map((h, i) => (
                            <th key={i} className="py-2.5 px-3 font-semibold text-neutral-800 whitespace-nowrap">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-100">
                        {stats.rawRowsSample.map((row, rowIdx) => (
                          <tr key={rowIdx} className="hover:bg-neutral-50">
                            <td className="py-2 px-3 text-neutral-400 text-[10px] border-r border-neutral-100 bg-neutral-50/50">
                              {rowIdx + 1}
                            </td>
                            {row.map((cell, cellIdx) => (
                              <td key={cellIdx} className="py-2 px-3 text-neutral-700 whitespace-nowrap">
                                {cell || <span className="text-neutral-300 italic">null</span>}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-5 sm:px-6 py-3.5 border-t border-neutral-200 bg-neutral-50/90 shrink-0">
          <span className="text-xs text-neutral-500">
            Press <kbd className="px-1.5 py-0.5 bg-neutral-200 rounded text-[10px] font-mono">ESC</kbd> to close
          </span>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-semibold rounded-xl border border-neutral-200 bg-white hover:bg-neutral-100 text-neutral-700 transition cursor-pointer"
            >
              Close
            </button>
            {onProceedToAnalysis && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onProceedToAnalysis();
                }}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-neutral-900 hover:bg-neutral-800 text-white transition cursor-pointer flex items-center gap-1.5 shadow-2xs"
              >
                <Sparkles className="h-3.5 w-3.5 text-blue-400" />
                <span>Run Full Agent Analysis</span>
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
