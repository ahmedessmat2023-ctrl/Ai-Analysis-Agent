import React, { useState } from 'react';
import {
  TrendingUp,
  TrendingDown,
  Activity,
  Zap,
  ChevronRight,
  Sparkles,
  AlertCircle,
  ArrowUpRight,
  ArrowDownRight,
} from 'lucide-react';
import type { DetectedTrend } from '../utils/trendNotifier';
import type { ReportInsight } from '../types';

export interface TrendBadgeProps {
  trend: DetectedTrend;
  size?: 'sm' | 'md';
  pulse?: boolean;
}

export const TrendBadge: React.FC<TrendBadgeProps> = ({
  trend,
  size = 'sm',
  pulse = true,
}) => {
  const isGrowth = trend.direction === 'growth';
  const isDecline = trend.direction === 'decline';
  const isMajor = trend.magnitude === 'major';

  let colorClasses = 'bg-neutral-100 text-neutral-800 border-neutral-200';
  let pulseColor = 'bg-neutral-500';
  let Icon = Activity;

  if (isGrowth) {
    colorClasses = isMajor
      ? 'bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-500/20 font-semibold'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
    pulseColor = 'bg-emerald-500';
    Icon = TrendingUp;
  } else if (isDecline) {
    colorClasses = isMajor
      ? 'bg-rose-500/10 text-rose-700 dark:text-rose-400 border-rose-500/20 font-semibold'
      : 'bg-rose-50 text-rose-700 border-rose-200';
    pulseColor = 'bg-rose-500';
    Icon = TrendingDown;
  } else {
    colorClasses = 'bg-indigo-50 text-indigo-700 border-indigo-200';
    pulseColor = 'bg-indigo-500';
    Icon = Activity;
  }

  const paddingClasses = size === 'sm' ? 'px-2 py-0.5 text-[10px]' : 'px-2.5 py-1 text-xs';

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border ${paddingClasses} ${colorClasses} tracking-tight font-mono shadow-2xs`}
      title={`Significant ${trend.direction} of ${trend.percentage}% detected`}
    >
      {pulse && (
        <span className="relative flex h-2 w-2 shrink-0">
          <span
            className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${pulseColor}`}
          />
          <span className={`relative inline-flex rounded-full h-2 w-2 ${pulseColor}`} />
        </span>
      )}
      <Icon className="h-3 w-3 shrink-0" />
      <span>{trend.badgeLabel}</span>
    </span>
  );
};

export interface TrendNotifierBannerProps {
  trends: Array<{ insight: ReportInsight; trend: DetectedTrend; originalIndex: number }>;
  onSelectInsight?: (insight: ReportInsight) => void;
}

export const TrendNotifierBanner: React.FC<TrendNotifierBannerProps> = ({
  trends,
  onSelectInsight,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!trends || trends.length === 0) return null;

  const growths = trends.filter((t) => t.trend.direction === 'growth');
  const declines = trends.filter((t) => t.trend.direction === 'decline');
  const topTrend = trends[0];

  return (
    <div className="rounded-2xl border border-amber-200/80 bg-gradient-to-r from-amber-50/90 via-orange-50/50 to-white p-4 sm:p-5 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-start sm:items-center gap-3">
          <div className="h-9 w-9 rounded-xl bg-amber-500 text-white flex items-center justify-center shadow-xs shrink-0">
            <Zap className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-xs font-bold uppercase tracking-wider text-amber-900 font-mono">
                Trend Notifier
              </span>
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200/70 text-amber-900">
                <span className="relative flex h-1.5 w-1.5">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-amber-600 opacity-75" />
                  <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-amber-600" />
                </span>
                {trends.length} Significant Shift{trends.length > 1 ? 's' : ''} (&gt;10%)
              </span>
            </div>
            <p className="text-xs text-neutral-600 mt-0.5 leading-normal">
              {growths.length > 0 && declines.length > 0 ? (
                <>
                  Detected <strong className="text-emerald-700">{growths.length} surge{growths.length > 1 ? 's' : ''}</strong> and{' '}
                  <strong className="text-rose-700">{declines.length} decline{declines.length > 1 ? 's' : ''}</strong> across dataset metrics.
                </>
              ) : growths.length > 0 ? (
                <>
                  Detected <strong className="text-emerald-700">{growths.length} major growth trend{growths.length > 1 ? 's' : ''}</strong> in key metrics.
                </>
              ) : (
                <>
                  Detected <strong className="text-rose-700">{declines.length} significant decline{declines.length > 1 ? 's' : ''}</strong> requiring strategic attention.
                </>
              )}
            </p>
          </div>
        </div>

        {/* Quick actions / expand */}
        <div className="flex items-center gap-2 self-start sm:self-center shrink-0">
          <button
            type="button"
            onClick={() => setIsExpanded((e) => !e)}
            className="text-xs font-semibold px-3 py-1.5 rounded-xl border border-amber-200 bg-white hover:bg-amber-100/50 text-amber-900 transition cursor-pointer shadow-2xs flex items-center gap-1"
          >
            <span>{isExpanded ? 'Hide Details' : 'Inspect Shifts'}</span>
            <ChevronRight
              className={`h-3.5 w-3.5 transition-transform duration-200 ${isExpanded ? 'rotate-90' : ''}`}
            />
          </button>
        </div>
      </div>

      {/* Expanded list of detected significant shifts */}
      {isExpanded && (
        <div className="mt-4 pt-3 border-t border-amber-200/60 grid grid-cols-1 md:grid-cols-2 gap-3">
          {trends.map((item, idx) => {
            const isGrowth = item.trend.direction === 'growth';
            const isDecline = item.trend.direction === 'decline';

            return (
              <div
                key={idx}
                className={`p-3 rounded-xl border transition flex flex-col justify-between gap-2 ${
                  isGrowth
                    ? 'border-emerald-200 bg-white/90 hover:border-emerald-300'
                    : isDecline
                    ? 'border-rose-200 bg-white/90 hover:border-rose-300'
                    : 'border-neutral-200 bg-white/90'
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-xs font-bold text-neutral-900 truncate">
                        {item.insight.title}
                      </span>
                      {item.insight.metric && (
                        <span className="text-[10px] text-neutral-400 font-mono">
                          ({item.insight.metric})
                        </span>
                      )}
                    </div>
                  </div>
                  <TrendBadge trend={item.trend} size="sm" pulse />
                </div>

                <p className="text-xs text-neutral-600 line-clamp-2 leading-relaxed">
                  {item.insight.detail}
                </p>

                {item.insight.value && (
                  <div className="flex items-center justify-between pt-1 border-t border-neutral-100 text-[11px] text-neutral-500">
                    <span>Report Value:</span>
                    <span className="font-semibold text-neutral-800 font-mono">{item.insight.value}</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
