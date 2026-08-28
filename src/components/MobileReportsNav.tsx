import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  FileText,
  BarChart3,
  Table,
  Lightbulb,
  Printer,
  Sparkles,
  PlusCircle,
  Clock,
  Download,
  ChevronRight,
  Database,
  Layers,
} from 'lucide-react';
import type { AnalysisReport, ChatMessage } from '../types';

export type DashboardTab = 'overview' | 'charts' | 'tables' | 'recommendations' | 'print';

export interface MobileReportsNavProps {
  isOpen: boolean;
  onClose: () => void;
  report: AnalysisReport | null;
  chatMessages: ChatMessage[];
  viewedMessageId: string | null;
  activeTab: DashboardTab;
  onSelectTab: (tab: DashboardTab) => void;
  onSelectMessage: (msgId: string) => void;
  onNewAnalysis?: () => void;
  onExportPDF?: () => void;
  onExportJSON?: () => void;
  datasetName?: string;
}

export const MobileReportsNav: React.FC<MobileReportsNavProps> = ({
  isOpen,
  onClose,
  report,
  chatMessages,
  viewedMessageId,
  activeTab,
  onSelectTab,
  onSelectMessage,
  onNewAnalysis,
  onExportPDF,
  onExportJSON,
  datasetName,
}) => {
  // Extract all assistant messages that have a valid report attached
  const reportThreads = React.useMemo(() => {
    return chatMessages
      .filter((m) => m.role === 'assistant' && m.report)
      .map((m, index) => ({
        id: m.id,
        index: index + 1,
        title: m.report?.title || `Report ${index + 1}`,
        question: m.report?.question || m.text || 'Analysis inquiry',
        generatedAt: m.report?.generated_at,
        chartsCount: m.report?.charts?.filter((c) => c.image)?.length || 0,
        tablesCount: m.report?.tables?.length || 0,
        isActive: viewedMessageId ? m.id === viewedMessageId : index === chatMessages.filter((x) => x.role === 'assistant' && x.report).length - 1,
      }));
  }, [chatMessages, viewedMessageId]);

  const validChartsCount = report?.charts?.filter((c) => c.image)?.length || 0;
  const tablesCount = report?.tables?.length || 0;
  const recommendationsCount = report?.recommendations?.length || 0;

  const handleTabClick = (tab: DashboardTab) => {
    onSelectTab(tab);
    onClose();
  };

  const handleReportClick = (msgId: string) => {
    onSelectMessage(msgId);
    onClose();
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop overlay */}
          <motion.div
            key="reports-nav-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-50 bg-neutral-950/50 backdrop-blur-xs lg:hidden"
            aria-hidden="true"
          />

          {/* Slide-out Sidebar Drawer */}
          <motion.aside
            key="reports-nav-drawer"
            initial={{ x: '-100%' }}
            animate={{ x: 0 }}
            exit={{ x: '-100%' }}
            transition={{ type: 'spring', damping: 28, stiffness: 280 }}
            className="fixed inset-y-0 left-0 z-50 w-[85%] max-w-sm bg-white shadow-2xl flex flex-col lg:hidden border-r border-neutral-200"
            role="dialog"
            aria-modal="true"
            aria-label="Reports & Dashboard Navigation"
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-neutral-100 bg-neutral-50/80">
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                  <Layers className="h-4 w-4 text-io-blue" />
                </div>
                <div>
                  <h2 className="text-sm font-bold text-neutral-900 leading-tight">Reports & Sections</h2>
                  <p className="text-xs text-neutral-500 font-mono truncate max-w-[170px]">
                    {datasetName || report?.dataset_name || 'Workspace'}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-neutral-500 hover:bg-neutral-200/70 hover:text-neutral-900 transition cursor-pointer"
                aria-label="Close navigation"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Scrollable Navigation Body */}
            <div className="flex-1 overflow-y-auto px-4 py-4 space-y-6">
              {/* Section 1: Active Report Navigation Links */}
              {report && (
                <div>
                  <div className="px-2 pb-2 text-[11px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                    Current Report Sections
                  </div>
                  <nav className="space-y-1" aria-label="Current report sections">
                    <button
                      type="button"
                      onClick={() => handleTabClick('overview')}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                        activeTab === 'overview'
                          ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <FileText className={`h-4 w-4 ${activeTab === 'overview' ? 'text-io-blue' : 'text-neutral-500'}`} />
                        <span>Overview & Summary</span>
                      </div>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-mono ${activeTab === 'overview' ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-600'}`}>
                        KPIs
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTabClick('charts')}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                        activeTab === 'charts'
                          ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <BarChart3 className={`h-4 w-4 ${activeTab === 'charts' ? 'text-io-blue' : 'text-neutral-500'}`} />
                        <span>Visualizations</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono font-bold ${activeTab === 'charts' ? 'bg-io-blue text-white' : 'bg-blue-50 text-io-blue'}`}>
                        {validChartsCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTabClick('tables')}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                        activeTab === 'tables'
                          ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Table className={`h-4 w-4 ${activeTab === 'tables' ? 'text-io-blue' : 'text-neutral-500'}`} />
                        <span>Data Tables</span>
                      </div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${activeTab === 'tables' ? 'bg-neutral-800 text-neutral-300' : 'bg-neutral-100 text-neutral-600'}`}>
                        {tablesCount}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTabClick('recommendations')}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                        activeTab === 'recommendations'
                          ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Lightbulb className={`h-4 w-4 ${activeTab === 'recommendations' ? 'text-amber-400' : 'text-neutral-500'}`} />
                        <span>Insights & Actions</span>
                      </div>
                      {recommendationsCount > 0 && (
                        <span className={`text-[10px] px-2 py-0.5 rounded-full font-mono ${activeTab === 'recommendations' ? 'bg-neutral-800 text-neutral-300' : 'bg-amber-50 text-amber-700'}`}>
                          {recommendationsCount}
                        </span>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleTabClick('print')}
                      className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl text-sm font-medium transition cursor-pointer ${
                        activeTab === 'print'
                          ? 'bg-neutral-900 text-white font-semibold shadow-xs'
                          : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Printer className={`h-4 w-4 ${activeTab === 'print' ? 'text-io-blue' : 'text-neutral-500'}`} />
                        <span>Print Preview</span>
                      </div>
                    </button>
                  </nav>
                </div>
              )}

              {/* Section 2: Session Generated Reports / Iterations */}
              <div>
                <div className="flex items-center justify-between px-2 pb-2">
                  <span className="text-[11px] font-bold uppercase tracking-wider text-neutral-400 font-mono">
                    Session Reports ({reportThreads.length || (report ? 1 : 0)})
                  </span>
                  {reportThreads.length > 1 && (
                    <span className="text-[10px] text-neutral-400 font-medium">Tap to switch</span>
                  )}
                </div>

                {reportThreads.length > 0 ? (
                  <div className="space-y-2">
                    {reportThreads.map((thread) => (
                      <button
                        key={thread.id}
                        type="button"
                        onClick={() => handleReportClick(thread.id)}
                        className={`w-full text-left p-3 rounded-xl border transition cursor-pointer flex flex-col gap-1 ${
                          thread.isActive
                            ? 'border-indigo-300 bg-indigo-50/70 text-neutral-900 shadow-2xs'
                            : 'border-neutral-200 bg-white text-neutral-700 hover:bg-neutral-50 hover:border-neutral-300'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className={`text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded ${
                            thread.isActive ? 'bg-indigo-600 text-white' : 'bg-neutral-100 text-neutral-600'
                          }`}>
                            Report #{thread.index}
                          </span>
                          {thread.chartsCount > 0 && (
                            <span className="text-[10px] text-neutral-500 flex items-center gap-1 font-mono">
                              <BarChart3 className="h-3 w-3 text-indigo-500" />
                              {thread.chartsCount} charts
                            </span>
                          )}
                        </div>
                        <p className="text-xs font-semibold text-neutral-900 line-clamp-2 mt-0.5">
                          {thread.title}
                        </p>
                        <p className="text-[11px] text-neutral-500 line-clamp-1 italic">
                          "{thread.question}"
                        </p>
                      </button>
                    ))}
                  </div>
                ) : (
                  <div className="p-4 rounded-xl border border-dashed border-neutral-200 text-center text-xs text-neutral-400">
                    <Database className="h-4 w-4 mx-auto mb-1 opacity-50" />
                    Reports generated during your session will be indexed here.
                  </div>
                )}
              </div>
            </div>

            {/* Sticky Actions Footer */}
            <div className="p-4 border-t border-neutral-200 bg-neutral-50 space-y-2">
              <div className="flex items-center gap-2">
                {onExportPDF && (
                  <button
                    type="button"
                    onClick={() => {
                      onExportPDF();
                      onClose();
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-800 hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                  >
                    <Download className="h-3.5 w-3.5 text-io-blue" />
                    <span>Download PDF</span>
                  </button>
                )}
                {onExportJSON && (
                  <button
                    type="button"
                    onClick={() => {
                      onExportJSON();
                      onClose();
                    }}
                    className="flex-1 flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl border border-neutral-200 bg-white text-xs font-semibold text-neutral-800 hover:bg-neutral-100 transition cursor-pointer shadow-2xs"
                  >
                    <span>Export JSON</span>
                  </button>
                )}
              </div>

              <button
                type="button"
                onClick={() => {
                  onNewAnalysis();
                  onClose();
                }}
                className="w-full flex items-center justify-center gap-2 py-2.5 px-3 rounded-xl bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition cursor-pointer shadow-xs"
              >
                <PlusCircle className="h-4 w-4" />
                <span>Start New Analysis</span>
              </button>
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
};
