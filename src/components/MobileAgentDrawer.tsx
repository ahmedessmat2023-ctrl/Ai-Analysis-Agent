import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Bot,
  Terminal,
  X,
  ChevronDown,
  ChevronUp,
  Send,
  Sparkles,
  Play,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Maximize2,
} from 'lucide-react';
import type { ActivityLog, AnalysisReport, ChatMessage, Status } from '../types';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

function sanitizeAgentText(text: string): string {
  if (!text) return text;
  let sanitized = text;
  sanitized = sanitized.replace(/call:default_api:[a-zA-Z0-9_!:#-]+(?:\s*\{[\s\S]*?\})?/g, '');
  sanitized = sanitized.replace(/call:default_api:[^\s]+/g, '');
  sanitized = sanitized.replace(/\n{3,}/g, '\n\n');
  return sanitized.trim();
}

const FormattedMarkdown: React.FC<{ content: string; className?: string }> = ({ content, className = '' }) => {
  const cleaned = sanitizeAgentText(content);
  return (
    <div className={`prose prose-sm max-w-none text-neutral-800 ${className}`}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          p({ children }) {
            return <p className="mb-2 last:mb-0 leading-relaxed text-neutral-800">{children}</p>;
          },
          h1({ children }) {
            return <h1 className="text-sm font-bold mt-2.5 mb-1 text-neutral-900 border-b border-neutral-200 pb-0.5">{children}</h1>;
          },
          h2({ children }) {
            return <h2 className="text-xs font-bold mt-2 mb-1 text-neutral-900">{children}</h2>;
          },
          strong({ children }) {
            return <strong className="font-semibold text-neutral-900">{children}</strong>;
          },
          ul({ children }) {
            return <ul className="list-disc list-outside ml-4 my-1.5 space-y-0.5 text-neutral-800">{children}</ul>;
          },
          ol({ children }) {
            return <ol className="list-decimal list-outside ml-4 my-1.5 space-y-0.5 text-neutral-800">{children}</ol>;
          },
          li({ children }) {
            return <li className="leading-relaxed pl-0.5 text-xs">{children}</li>;
          },
          code({ inline, className, children, ...props }: any) {
            return inline ? (
              <code className="bg-neutral-100 text-neutral-800 px-1 py-0.5 rounded text-[11px] font-mono" {...props}>
                {children}
              </code>
            ) : (
              <pre className="bg-neutral-900 text-neutral-100 p-2.5 rounded-lg text-[10px] font-mono overflow-x-auto my-2">
                <code {...props}>{children}</code>
              </pre>
            );
          },
        }}
      >
        {cleaned}
      </ReactMarkdown>
    </div>
  );
};

const DrawerActivityRow: React.FC<{ log: ActivityLog }> = ({ log }) => {
  const [open, setOpen] = useState(false);

  if (log.type === 'thinking' || log.type === 'text') {
    const isThinking = log.type === 'thinking';
    return (
      <div className="flex gap-2 text-xs">
        <span className="mt-0.5 shrink-0 text-neutral-400 font-bold">•</span>
        <div className={`flex-1 min-w-0 ${isThinking ? 'italic text-neutral-500' : 'text-neutral-700'}`}>
          <FormattedMarkdown content={log.content} />
        </div>
      </div>
    );
  }

  if (log.type === 'tool_call') {
    const args = (log.args || {}) as Record<string, any>;
    let cmd = args.command || args.code || args.content;
    let pathVal = args.path || args.file || args.TargetFile;

    if (!cmd && args.arguments && typeof args.arguments === 'object') {
      const subArgs = args.arguments as Record<string, any>;
      cmd = subArgs.command || subArgs.code || subArgs.content;
      pathVal = pathVal || subArgs.path || subArgs.file || subArgs.TargetFile;
    }

    cmd = cmd ? String(cmd) : '';
    const displayPath = pathVal ? String(pathVal) : '';
    const hasDetails = Boolean(cmd || Object.keys(args).length > 0);

    return (
      <div className="rounded-lg border border-neutral-200 bg-neutral-50 text-xs">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className={`flex w-full items-center gap-2 px-2.5 py-1.5 text-left ${!hasDetails ? 'pointer-events-none' : 'cursor-pointer'}`}
        >
          <Terminal className="h-3.5 w-3.5 text-neutral-500 shrink-0" />
          <span className="font-mono text-[11px] text-neutral-700 truncate">
            {log.name || 'tool'} {displayPath ? <span className="text-neutral-400"> {displayPath}</span> : ''}
          </span>
          {hasDetails && (
            <span className="ml-auto text-[10px] text-neutral-400 font-bold transition">
              {open ? '▲' : '▼'}
            </span>
          )}
        </button>
        {open && hasDetails && (
          <pre className="overflow-x-auto max-h-48 border-t border-neutral-200 p-2 font-mono text-[10px] leading-relaxed text-neutral-700 bg-white">
            {cmd || JSON.stringify(args, null, 2)}
          </pre>
        )}
      </div>
    );
  }

  if (log.type === 'tool_result') {
    return (
      <div className="rounded-lg border border-neutral-200 text-xs">
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="flex w-full items-center gap-2 px-2.5 py-1.5 text-left cursor-pointer bg-neutral-50/50"
        >
          <span className="text-[11px] text-neutral-500 font-medium">Output{log.name ? ` · ${log.name}` : ''}</span>
          <span className="ml-auto text-[10px] text-neutral-400 font-bold transition">{open ? '▲' : '▼'}</span>
        </button>
        {open && (
          <pre className="max-h-48 overflow-auto border-t border-neutral-200 p-2 font-mono text-[10px] leading-relaxed text-neutral-600 bg-white">
            {log.result}
          </pre>
        )}
      </div>
    );
  }

  if (log.type === 'error') {
    return (
      <div className="flex gap-2 text-xs text-io-red font-medium p-2 rounded-lg bg-red-50 border border-red-100">
        <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
        <span>{log.content}</span>
      </div>
    );
  }

  return (
    <div className="flex gap-2 text-xs text-neutral-500">
      <span className="mt-0.5 shrink-0">·</span>
      <div className="flex-1 min-w-0">
        <FormattedMarkdown content={log.content} />
      </div>
    </div>
  );
};

export interface MobileAgentDrawerProps {
  isOpen: boolean;
  onOpen?: () => void;
  onClose: () => void;
  messages: ChatMessage[];
  logs: ActivityLog[];
  status: Status;
  stage: string;
  viewedMessageId: string | null;
  onSelectMessage: (id: string) => void;
  onSendFollowUp: (text: string) => void;
  report?: AnalysisReport | null;
  datasetName?: string;
}

export const MobileAgentDrawer: React.FC<MobileAgentDrawerProps> = ({
  isOpen,
  onOpen,
  onClose,
  messages,
  logs,
  status,
  stage,
  viewedMessageId,
  onSelectMessage,
  onSendFollowUp,
  report,
  datasetName,
}) => {
  const [inputText, setInputText] = useState('');
  const [activeTab, setActiveTab] = useState<'chat' | 'activity'>('chat');
  const activityScrollRef = useRef<HTMLDivElement | null>(null);
  const shouldAutoScrollRef = useRef(true);

  // Switch to activity tab while running
  useEffect(() => {
    if (status === 'running') {
      setActiveTab('activity');
    }
  }, [status]);

  useEffect(() => {
    const container = activityScrollRef.current;
    if (activeTab === 'activity' && container && shouldAutoScrollRef.current) {
      container.scrollTop = container.scrollHeight;
    }
  }, [logs, activeTab, isOpen]);

  const handleActivityScroll = () => {
    if (activeTab !== 'activity') return;
    const container = activityScrollRef.current;
    if (!container) return;
    const distanceFromBottom = container.scrollHeight - container.scrollTop - container.clientHeight;
    shouldAutoScrollRef.current = distanceFromBottom < 60;
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputText.trim() || status === 'running') return;
    onSendFollowUp(inputText.trim());
    setInputText('');
  };

  const followUpSuggestions = [
    'Predict next quarter trends',
    'Identify top outliers & anomalies',
    'What are the strongest correlations?',
    'Provide actionable recommendations',
  ];

  return (
    <>
      {/* ── Persistent Floating Bottom Dock / Pill (when drawer is closed) ── */}
      <div className="fixed bottom-3 inset-x-3 z-40 lg:hidden flex justify-center pointer-events-none">
        <motion.button
          type="button"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          onClick={onOpen}
          className={`pointer-events-auto flex items-center justify-between gap-3 px-4 py-3 rounded-2xl shadow-xl border backdrop-blur-md transition-all cursor-pointer w-full max-w-md ${
            status === 'running'
              ? 'bg-neutral-900 text-white border-neutral-700 shadow-blue-500/10'
              : 'bg-white/95 text-neutral-900 border-neutral-200/90 shadow-neutral-900/10'
          }`}
          aria-label="Toggle agent activity drawer"
        >
          <div className="flex items-center gap-2.5 min-w-0">
            {status === 'running' ? (
              <span className="relative flex h-3 w-3 shrink-0">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-io-blue opacity-75" />
                <span className="relative inline-flex rounded-full h-3 w-3 bg-io-blue" />
              </span>
            ) : status === 'error' ? (
              <span className="h-2.5 w-2.5 rounded-full bg-io-red shrink-0" />
            ) : (
              <span className="h-2.5 w-2.5 rounded-full bg-io-green shrink-0" />
            )}

            <div className="text-left min-w-0">
              <p className="text-xs font-bold leading-none truncate">
                {status === 'running' ? (stage || 'Agent Working...') : 'Agent Activity & Chat'}
              </p>
              <p className="text-[10px] text-neutral-400 mt-0.5 font-mono truncate">
                {status === 'running' ? 'Tap to view live streaming logs' : `${messages.length} messages · ${logs.length} events`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <span className="text-[11px] font-semibold px-2 py-0.5 rounded-lg bg-neutral-100 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200">
              Open
            </span>
            <ChevronUp className="h-4 w-4 text-neutral-400" />
          </div>
        </motion.button>
      </div>

      {/* ── Slide-up Bottom Drawer ── */}
      <AnimatePresence>
        {isOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              key="agent-drawer-backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={onClose}
              className="fixed inset-0 z-50 bg-neutral-950/60 backdrop-blur-xs lg:hidden"
              aria-hidden="true"
            />

            {/* Bottom Sheet Sheet */}
            <motion.div
              key="agent-drawer-panel"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 28, stiffness: 280 }}
              className="fixed inset-x-0 bottom-0 z-50 h-[85vh] max-h-[85vh] bg-white rounded-t-3xl shadow-2xl flex flex-col lg:hidden border-t border-neutral-200"
              role="dialog"
              aria-modal="true"
              aria-label="Agent Activity & Chat Drawer"
            >
              {/* Drag Handle Bar */}
              <div className="pt-2.5 pb-1 flex justify-center" onClick={onClose}>
                <div className="w-12 h-1.5 rounded-full bg-neutral-300 hover:bg-neutral-400 transition cursor-grab" />
              </div>

              {/* Drawer Top Header */}
              <div className="flex items-center justify-between px-5 py-2.5 border-b border-neutral-100">
                <div className="flex items-center gap-2">
                  <div className="h-7 w-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-2xs">
                    <Bot className="h-4 w-4 text-io-blue" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-neutral-900 leading-tight">Agent Activity & Chat</h2>
                    {status === 'running' && (
                      <p className="text-[11px] text-io-blue font-medium flex items-center gap-1">
                        <span className="inline-block h-1.5 w-1.5 rounded-full bg-io-blue animate-pulse" />
                        {stage || 'Executing analysis...'}
                      </p>
                    )}
                  </div>
                </div>

                <div className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition cursor-pointer"
                    aria-label="Minimize drawer"
                  >
                    <ChevronDown className="h-5 w-5" />
                  </button>
                  <button
                    type="button"
                    onClick={onClose}
                    className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-100 hover:text-neutral-900 transition cursor-pointer"
                    aria-label="Close drawer"
                  >
                    <X className="h-5 w-5" />
                  </button>
                </div>
              </div>

              {/* Segmented Tab Controls */}
              <div className="flex border-b border-neutral-200 bg-neutral-50/70 p-1.5 mx-4 mt-2 rounded-xl">
                <button
                  type="button"
                  onClick={() => setActiveTab('chat')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'chat'
                      ? 'bg-white text-neutral-900 shadow-2xs border border-neutral-200/60'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  <Bot className="h-3.5 w-3.5" />
                  <span>Chat & Drill-down</span>
                  {messages.length > 0 && (
                    <span className="bg-neutral-100 text-neutral-700 text-[10px] px-1.5 py-0.2 rounded-full font-bold">
                      {messages.filter((m) => m.role === 'assistant').length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab('activity')}
                  className={`flex-1 flex items-center justify-center gap-1.5 py-1.5 text-xs font-semibold rounded-lg transition-all cursor-pointer ${
                    activeTab === 'activity'
                      ? 'bg-white text-neutral-900 shadow-2xs border border-neutral-200/60'
                      : 'text-neutral-500 hover:text-neutral-800'
                  }`}
                >
                  <Terminal className="h-3.5 w-3.5" />
                  <span>Agent Stream & Logs</span>
                  {status === 'running' && (
                    <span className="h-2 w-2 rounded-full bg-io-blue animate-pulse" />
                  )}
                </button>
              </div>

              {/* Scrollable Tab Body */}
              <div
                ref={activityScrollRef}
                onScroll={handleActivityScroll}
                className="flex-1 overflow-y-auto p-4 space-y-3 flex flex-col"
              >
                {activeTab === 'chat' ? (
                  messages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-neutral-400 my-auto">
                      <Bot className="h-8 w-8 mb-2 opacity-40 text-io-blue" />
                      <p className="text-sm font-semibold text-neutral-700">Agent Interactive Session</p>
                      <p className="text-xs max-w-xs mt-1 text-neutral-500">
                        Ask questions about this dataset, request new metrics, or slice data differently.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {messages.map((m) => {
                        const isAssistant = m.role === 'assistant';
                        const isViewed = viewedMessageId ? m.id === viewedMessageId : false;

                        return (
                          <div
                            key={m.id}
                            className={`flex flex-col ${isAssistant ? 'items-start' : 'items-end'}`}
                          >
                            <div
                              className={`max-w-[88%] rounded-2xl p-3.5 text-xs leading-relaxed ${
                                isAssistant
                                  ? 'bg-neutral-100 text-neutral-900 border border-neutral-200/80 shadow-2xs'
                                  : 'bg-neutral-900 text-white shadow-2xs'
                              }`}
                            >
                              <div className="font-semibold text-[10px] mb-1 opacity-60 uppercase font-mono tracking-wider">
                                {isAssistant ? 'AI Data Analyst' : 'You'}
                              </div>
                              <FormattedMarkdown content={m.text} />
                            </div>

                            {/* If assistant created a report, show button to view it */}
                            {isAssistant && m.report && (
                              <button
                                type="button"
                                onClick={() => {
                                  onSelectMessage(m.id);
                                  onClose();
                                }}
                                className={`mt-1.5 text-[11px] font-semibold flex items-center gap-1.5 px-3 py-1 rounded-lg border transition cursor-pointer ${
                                  isViewed
                                    ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                                    : 'bg-white text-neutral-700 border-neutral-200 hover:bg-neutral-50'
                                }`}
                              >
                                <span>View Dashboard Report</span>
                                <CheckCircle2 className="h-3 w-3 text-io-green" />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  /* Activity Tab: Logs, Tool Calls, Streaming */
                  logs.length === 0 ? (
                    <div className="flex flex-col items-center justify-center h-full text-center p-6 text-neutral-400 my-auto">
                      <Terminal className="h-8 w-8 mb-2 opacity-40" />
                      <p className="text-sm font-semibold text-neutral-700">No Activity Logs</p>
                      <p className="text-xs max-w-xs mt-1 text-neutral-500">
                        Tool executions and agent thoughts will stream here in real time.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2.5">
                      {logs.map((log, index) => (
                        <DrawerActivityRow key={index} log={log} />
                      ))}
                      {status === 'running' && (
                        <div className="flex items-center gap-2 p-2 rounded-lg bg-blue-50/70 border border-blue-100 text-xs text-io-blue font-mono animate-pulse">
                          <RotateCw className="h-3 w-3 animate-spin" />
                          <span>{stage || 'Agent is executing workflow...'}</span>
                        </div>
                      )}
                    </div>
                  )
                )}
              </div>

              {/* Quick suggestion chips (Chat tab) */}
              {activeTab === 'chat' && (
                <div className="px-4 py-2 border-t border-neutral-100 bg-neutral-50/50 flex gap-1.5 overflow-x-auto no-scrollbar">
                  {followUpSuggestions.map((sug, i) => (
                    <button
                      key={i}
                      type="button"
                      disabled={status === 'running'}
                      onClick={() => onSendFollowUp(sug)}
                      className="shrink-0 text-[11px] px-2.5 py-1 rounded-full bg-white border border-neutral-200 text-neutral-700 hover:border-io-blue hover:text-io-blue transition cursor-pointer disabled:opacity-50"
                    >
                      {sug}
                    </button>
                  ))}
                </div>
              )}

              {/* Follow-up input form */}
              <form onSubmit={handleSubmit} className="p-3 border-t border-neutral-200 bg-white">
                <div className="relative flex items-center">
                  <input
                    type="text"
                    disabled={status === 'running'}
                    placeholder={status === 'running' ? 'AI is executing, please wait...' : 'Ask follow-up inquiry...'}
                    value={inputText}
                    onChange={(e) => setInputText(e.target.value)}
                    className="w-full pl-3.5 pr-14 py-2.5 text-xs rounded-xl border border-neutral-200 focus:border-io-blue outline-none transition bg-neutral-50 focus:bg-white disabled:bg-neutral-100"
                  />
                  <button
                    type="submit"
                    disabled={status === 'running' || !inputText.trim()}
                    className="absolute right-1.5 top-1 px-3 py-1.5 rounded-lg bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 transition disabled:bg-neutral-200 disabled:text-neutral-400 cursor-pointer flex items-center gap-1"
                  >
                    <Send className="h-3 w-3" />
                  </button>
                </div>
              </form>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </>
  );
};
