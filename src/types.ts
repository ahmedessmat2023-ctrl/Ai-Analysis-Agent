export interface ReportInsight {
  title: string;
  detail: string;
  metric?: string;
  value?: string;
}

export interface ReportChart {
  title: string;
  file: string;
  caption?: string;
  type?: string;
  /** Base64 data URL or relative URL injected by the server after extracting the PNG from the sandbox. */
  image?: string;
  series?: string[];
  data?: Array<Record<string, unknown>>;
  xKey?: string;
  yKeys?: string[];
}

export interface ReportTable {
  title: string;
  columns: string[];
  rows: Array<Array<string | number | null>>;
  caption?: string;
}

export interface AnalysisReport {
  dataset_name: string;
  question: string;
  title: string;
  executive_summary: string;
  insights: ReportInsight[];
  charts: ReportChart[];
  tables: ReportTable[];
  methodology?: string;
  recommendations?: string[];
  generated_at?: string;
}

export type ActivityType =
  | 'info'
  | 'thinking'
  | 'text'
  | 'tool_call'
  | 'tool_result'
  | 'error';

export interface ActivityLog {
  id: string;
  timestamp: string;
  type: ActivityType;
  content?: string;
  name?: string;
  args?: Record<string, unknown>;
  result?: string;
}

export type Status = 'idle' | 'uploading' | 'running' | 'done' | 'error';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  status?: Status;
  logs?: ActivityLog[];
  report?: AnalysisReport | null;
  stage?: string;
  question?: string;
}

export interface UploadedFile {
  name: string;
  content?: string;
  gsUri?: string;
  localPath?: string;
  isLocal?: boolean;
  isGcsUri?: boolean;
  size?: number;
  driveId?: string;
  mimeType?: string;
}

declare global {
  interface Window {
    gapi: any;
    google?: any;
  }
  const google: any;
}
