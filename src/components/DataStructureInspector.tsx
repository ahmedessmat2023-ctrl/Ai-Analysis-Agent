import React, { useState } from 'react';
import {
  TrendingUp,
  PieChart as PieIcon,
  BarChart3,
  ScatterChart,
  Sparkles,
  Layers,
  Calendar,
  Hash,
  Tag,
  Key,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ArrowRight,
  Info,
  Sliders,
  Table as TableIcon,
} from 'lucide-react';
import type { DataStructureAnalysis, ProposedVisualization, ColumnProfile } from '../utils/dataStructureAnalyzer';

interface DataStructureInspectorProps {
  analysis: DataStructureAnalysis | null;
  selectedVisualizationId?: string | null;
  onSelectVisualization?: (proposal: ProposedVisualization) => void;
  onApplyQuestion?: (suggestedQuestion: string) => void;
  currentQuestion?: string;
  isAnalyzingDataset?: boolean;
}

export const DataStructureInspector: React.FC<DataStructureInspectorProps> = ({
  analysis,
  selectedVisualizationId,
  onSelectVisualization,
  onApplyQuestion,
  currentQuestion = '',
  isAnalyzingDataset = false,
}) => {
  const [showColumnSchema, setShowColumnSchema] = useState(false);
  const [activeTab, setActiveTab] = useState<'proposals' | 'columns'>('proposals');

  if (isAnalyzingDataset) {
    return (
      <div className="rounded-2xl border border-blue-200 bg-blue-50/40 p-5 shadow-xs animate-pulse flex items-center gap-3">
        <div className="h-5 w-5 rounded-full border-2 border-io-blue border-t-transparent animate-spin shrink-0" />
        <div className="space-y-1">
          <p className="text-sm font-semibold text-neutral-800">Analyzing Data Structure...</p>
          <p className="text-xs text-neutral-500">
            Profiling columns (numeric vs. categorical), detecting time-series dimensions, and evaluating optimal visualization types.
          </p>
        </div>
      </div>
    );
  }

  if (!analysis || analysis.columnCount === 0) {
    return null;
  }

  const {
    rowCount,
    columnCount,
    columns,
    numericColumns,
    categoricalColumns,
    temporalColumns,
    proposedVisualizations,
    topRecommendation,
  } = analysis;

  const getVisualIcon = (iconType: string) => {
    switch (iconType) {
      case 'line':
        return <TrendingUp className="h-4 w-4 text-emerald-600" />;
      case 'pie':
        return <PieIcon className="h-4 w-4 text-purple-600" />;
      case 'scatter':
        return <ScatterChart className="h-4 w-4 text-amber-600" />;
      case 'heatmap':
        return <Sliders className="h-4 w-4 text-rose-600" />;
      case 'kpi':
        return <TableIcon className="h-4 w-4 text-sky-600" />;
      case 'bar':
      default:
        return <BarChart3 className="h-4 w-4 text-io-blue" />;
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'numeric':
        return <Hash className="h-3 w-3 text-io-blue" />;
      case 'temporal':
        return <Calendar className="h-3 w-3 text-emerald-600" />;
      case 'identifier':
        return <Key className="h-3 w-3 text-neutral-400" />;
      case 'categorical':
      default:
        return <Tag className="h-3 w-3 text-purple-600" />;
    }
  };

  return (
    <section className="rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm space-y-4">
      {/* Header with Title and Quick Schema Summary */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-neutral-100 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex h-5 w-5 items-center justify-center rounded-full bg-io-blue text-[11px] text-white font-bold">
              <Sparkles className="h-3 w-3" />
            </span>
            <h3 className="font-bold text-sm sm:text-base text-neutral-900">
              Data Structure & Recommended Visualizations
            </h3>
          </div>
          <p className="text-xs text-neutral-500">
            Automatically profiled dataset dimensions to propose the most suitable chart types before analysis runs.
          </p>
        </div>

        {/* Structure Badges */}
        <div className="flex flex-wrap items-center gap-1.5 self-start sm:self-center">
          <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold bg-neutral-100 text-neutral-700 border border-neutral-200/80">
            <Layers className="h-3 w-3 text-neutral-500" />
            {rowCount.toLocaleString()} rows · {columnCount} cols
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-blue-50 text-blue-700 border border-blue-200/60">
            <Hash className="h-3 w-3 text-io-blue" />
            {numericColumns.length} Numeric
          </span>
          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-purple-50 text-purple-700 border border-purple-200/60">
            <Tag className="h-3 w-3 text-purple-600" />
            {categoricalColumns.length} Categorical
          </span>
          {temporalColumns.length > 0 && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200/60">
              <Calendar className="h-3 w-3 text-emerald-600" />
              {temporalColumns.length} Time Series
            </span>
          )}
        </div>
      </div>

      {/* Tabs / Switcher */}
      <div className="flex items-center justify-between gap-2 pt-1">
        <div className="flex items-center gap-1 bg-neutral-100/80 p-1 rounded-xl border border-neutral-200/70 text-xs font-semibold">
          <button
            type="button"
            onClick={() => setActiveTab('proposals')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
              activeTab === 'proposals'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Proposed Visualizations ({proposedVisualizations.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('columns')}
            className={`px-3 py-1 rounded-lg transition cursor-pointer ${
              activeTab === 'columns'
                ? 'bg-white text-neutral-900 shadow-2xs'
                : 'text-neutral-500 hover:text-neutral-900'
            }`}
          >
            Column Schema & Types ({columns.length})
          </button>
        </div>

        {topRecommendation && activeTab === 'proposals' && (
          <span className="hidden md:inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200/60">
            <CheckCircle2 className="h-3 w-3" />
            Top Match: {topRecommendation.title} ({topRecommendation.suitabilityScore}%)
          </span>
        )}
      </div>

      {/* TAB 1: PROPOSED VISUALIZATIONS */}
      {activeTab === 'proposals' && (
        <div className="space-y-3 pt-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {proposedVisualizations.map((proposal) => {
              const isSelected = selectedVisualizationId === proposal.id;
              const isApplied = currentQuestion.trim() === proposal.suggestedQuestion.trim();

              return (
                <div
                  key={proposal.id}
                  onClick={() => onSelectVisualization?.(proposal)}
                  className={`relative flex flex-col justify-between rounded-xl border p-4 transition-all text-left shadow-2xs ${
                    isSelected
                      ? 'border-blue-500 bg-blue-50/20 ring-2 ring-blue-500/20'
                      : 'border-neutral-200 bg-white hover:border-neutral-300 hover:bg-neutral-50/30'
                  }`}
                >
                  <div className="space-y-2">
                    {/* Top Row: Type, Badge & Suitability */}
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="p-1.5 rounded-lg bg-neutral-100 border border-neutral-200/60">
                          {getVisualIcon(proposal.iconType)}
                        </span>
                        <div>
                          <h4 className="font-bold text-xs sm:text-sm text-neutral-900 leading-tight">
                            {proposal.title}
                          </h4>
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-neutral-400">
                            {proposal.badge}
                          </span>
                        </div>
                      </div>

                      <span
                        className={`text-[11px] font-bold px-2 py-0.5 rounded-md shrink-0 ${
                          proposal.suitabilityScore >= 90
                            ? 'bg-emerald-100 text-emerald-800'
                            : proposal.suitabilityScore >= 80
                            ? 'bg-blue-100 text-blue-800'
                            : 'bg-neutral-100 text-neutral-700'
                        }`}
                      >
                        {proposal.suitabilityScore}% Match
                      </span>
                    </div>

                    {/* Rationale */}
                    <p className="text-xs text-neutral-600 leading-relaxed pt-0.5">
                      {proposal.rationale}
                    </p>

                    {/* Column Mappings Chips */}
                    <div className="flex flex-wrap items-center gap-1.5 pt-1">
                      {proposal.columnMappings.xAxis && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 font-mono text-neutral-700">
                          <strong className="font-semibold text-neutral-900">X:</strong> {proposal.columnMappings.xAxis}
                        </span>
                      )}
                      {proposal.columnMappings.yAxis && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-neutral-100 border border-neutral-200 font-mono text-neutral-700">
                          <strong className="font-semibold text-neutral-900">Y:</strong>{' '}
                          {Array.isArray(proposal.columnMappings.yAxis)
                            ? proposal.columnMappings.yAxis.join(', ')
                            : proposal.columnMappings.yAxis}
                        </span>
                      )}
                      {proposal.columnMappings.dimension && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-purple-50 border border-purple-200 font-mono text-purple-800">
                          <strong className="font-semibold text-purple-900">Category:</strong> {proposal.columnMappings.dimension}
                        </span>
                      )}
                      {proposal.columnMappings.metric && (
                        <span className="text-[10px] px-2 py-0.5 rounded-md bg-blue-50 border border-blue-200 font-mono text-blue-800">
                          <strong className="font-semibold text-blue-900">Metric:</strong>{' '}
                          {Array.isArray(proposal.columnMappings.metric)
                            ? proposal.columnMappings.metric.join(', ')
                            : proposal.columnMappings.metric}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Action Bar */}
                  <div className="mt-3.5 pt-3 border-t border-neutral-100 flex items-center justify-between gap-2">
                    <span className="text-[11px] text-neutral-500 truncate italic">
                      "{proposal.suggestedQuestion}"
                    </span>

                    {onApplyQuestion && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onApplyQuestion(proposal.suggestedQuestion);
                        }}
                        className={`shrink-0 flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded-lg transition cursor-pointer shadow-2xs ${
                          isApplied
                            ? 'bg-emerald-600 text-white'
                            : 'bg-neutral-900 hover:bg-neutral-800 text-white'
                        }`}
                        title="Auto-fill this business question into Step 2"
                      >
                        {isApplied ? (
                          <>
                            <CheckCircle2 className="h-3 w-3" />
                            Applied
                          </>
                        ) : (
                          <>
                            <Sparkles className="h-3 w-3" />
                            Use Question
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* TAB 2: COLUMN SCHEMA & DATA TYPES */}
      {activeTab === 'columns' && (
        <div className="space-y-3 pt-1">
          <div className="overflow-x-auto rounded-xl border border-neutral-200 shadow-2xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="bg-neutral-100/90 text-neutral-800 font-semibold border-b border-neutral-200">
                <tr>
                  <th className="p-3">Column Name</th>
                  <th className="p-3">Inferred Type</th>
                  <th className="p-3">Unique Values</th>
                  <th className="p-3">Summary / Statistics</th>
                  <th className="p-3">Sample Values</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-100 bg-white">
                {columns.map((col) => (
                  <tr key={col.name} className="hover:bg-neutral-50/60 transition">
                    <td className="p-3 font-semibold text-neutral-900 font-mono text-xs">
                      {col.name}
                    </td>
                    <td className="p-3">
                      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-[11px] font-semibold border bg-neutral-50 border-neutral-200 text-neutral-700">
                        {getTypeIcon(col.type)}
                        {col.inferredTypeLabel}
                      </span>
                    </td>
                    <td className="p-3 text-neutral-700 font-medium">
                      {col.uniqueCount} distinct {col.uniqueCount === 1 ? 'value' : 'values'}
                    </td>
                    <td className="p-3 text-neutral-600">
                      {col.type === 'numeric' && col.min !== undefined && col.max !== undefined ? (
                        <div className="space-y-0.5 text-[11px] font-mono">
                          <div>Range: [{col.min.toLocaleString()} — {col.max.toLocaleString()}]</div>
                          <div className="text-neutral-500">Mean: {col.mean?.toFixed(2)} · Sum: {col.sum?.toLocaleString()}</div>
                        </div>
                      ) : col.topValues && col.topValues.length > 0 ? (
                        <div className="text-[11px] text-neutral-600 line-clamp-2">
                          Top: {col.topValues.slice(0, 3).map((v) => `${v.value} (${v.count})`).join(', ')}
                        </div>
                      ) : (
                        <span className="text-neutral-400">—</span>
                      )}
                    </td>
                    <td className="p-3 text-neutral-500 font-mono text-[11px] max-w-[200px] truncate">
                      {col.sampleValues.slice(0, 3).join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </section>
  );
};
