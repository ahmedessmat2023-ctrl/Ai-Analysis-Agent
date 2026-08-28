/**
 * Utility for analyzing tabular data structure (numeric vs categorical columns,
 * temporal dimensions, distributions, cardinality, and statistics) and automatically
 * proposing the most suitable visualization types before the agent runs.
 */

export type ColumnDataType = 'numeric' | 'categorical' | 'temporal' | 'boolean' | 'identifier';

export interface ColumnProfile {
  name: string;
  type: ColumnDataType;
  inferredTypeLabel: string;
  nonNullCount: number;
  nullCount: number;
  uniqueCount: number;
  sampleValues: string[];
  // Numeric specific
  isInteger?: boolean;
  min?: number;
  max?: number;
  mean?: number;
  sum?: number;
  // Categorical specific
  topValues?: Array<{ value: string; count: number; percentage: number }>;
  isLowCardinality?: boolean; // 2-7 unique values (ideal for pie/donut)
  isMediumCardinality?: boolean; // 8-25 unique values (ideal for bar)
  // Temporal specific
  temporalFormat?: 'date' | 'timestamp' | 'year' | 'month' | 'quarter' | 'day';
}

export type ProposedChartType =
  | 'line'
  | 'bar'
  | 'horizontal_bar'
  | 'pie'
  | 'scatter'
  | 'grouped_bar'
  | 'area'
  | 'heatmap'
  | 'kpi';

export interface ProposedVisualization {
  id: string;
  type: ProposedChartType;
  title: string;
  badge: string; // e.g. "Time Series", "Distribution", "Comparison", "Correlation"
  suitabilityScore: number; // 0 - 100
  suitabilityLevel: 'High' | 'Strong' | 'Recommended' | 'Moderate';
  rationale: string;
  suggestedQuestion: string;
  suggestedPromptRefinement: string;
  columnMappings: {
    xAxis?: string;
    yAxis?: string | string[];
    dimension?: string;
    metric?: string | string[];
    secondaryDimension?: string;
  };
  keyFeatures: string[];
  iconType: 'line' | 'bar' | 'pie' | 'scatter' | 'heatmap' | 'kpi';
}

export interface DataStructureAnalysis {
  fileName: string;
  rowCount: number;
  columnCount: number;
  columns: ColumnProfile[];
  numericColumns: ColumnProfile[];
  categoricalColumns: ColumnProfile[];
  temporalColumns: ColumnProfile[];
  booleanColumns: ColumnProfile[];
  identifierColumns: ColumnProfile[];
  numericRatio: number; // numeric / total
  categoricalRatio: number; // categorical / total
  temporalRatio: number;
  hasTimeSeries: boolean;
  hasLowCardinalityCategory: boolean;
  hasMultiNumeric: boolean;
  summarySentence: string;
  proposedVisualizations: ProposedVisualization[];
  topRecommendation: ProposedVisualization | null;
}

// Helper: Parse CSV text into header array and row matrix
export function parseCsvFast(csvText: string, maxRows = 2000): { headers: string[]; rows: string[][] } {
  if (!csvText || !csvText.trim()) {
    return { headers: [], rows: [] };
  }

  const lines = csvText.split(/\r?\n/);
  const rows: string[][] = [];
  let headers: string[] = [];

  for (let i = 0; i < lines.length && rows.length < maxRows; i++) {
    const line = lines[i];
    if (!line.trim()) continue;

    const row: string[] = [];
    let cur = '';
    let inQuotes = false;

    for (let j = 0; j < line.length; j++) {
      const char = line[j];
      if (char === '"') {
        if (inQuotes && line[j + 1] === '"') {
          cur += '"';
          j++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        row.push(cur.trim());
        cur = '';
      } else {
        cur += char;
      }
    }
    row.push(cur.trim());

    if (i === 0 || headers.length === 0) {
      headers = row.map((h) => h.replace(/^["']|["']$/g, '').trim());
    } else {
      if (row.some((cell) => cell !== '')) {
        rows.push(row);
      }
    }
  }

  return { headers, rows };
}

// Clean numeric string (handles currency, commas, percentages, exponential)
function parseNumericValue(val: string): number | null {
  if (!val) return null;
  const trimmed = val.trim();
  if (!trimmed || trimmed === '-' || trimmed === 'N/A' || trimmed === 'null' || trimmed === 'NaN' || trimmed === 'None') {
    return null;
  }
  // Strip currency symbols and percent signs
  const cleaned = trimmed.replace(/[$€£¥₹,%]/g, '').trim();
  const num = Number(cleaned);
  return !isNaN(num) && isFinite(num) ? num : null;
}

// Detect temporal dates, timestamps, quarters, months, years
function detectTemporal(val: string, colName: string): 'date' | 'timestamp' | 'year' | 'month' | 'quarter' | 'day' | null {
  if (!val) return null;
  const trimmed = val.trim();
  const lower = trimmed.toLowerCase();
  const colLower = colName.toLowerCase();

  // Year check (4 digits, e.g. 1980 - 2035)
  if (/^(19[5-9]\d|20[0-4]\d)$/.test(trimmed)) {
    return 'year';
  }

  // Quarter check (e.g., Q1, Q2 2024, 2024-Q1, 2024Q3)
  if (/^q[1-4](\s*[-/_]?\s*\d{2,4})?$/i.test(trimmed) || /^\d{4}\s*[-/_]?\s*q[1-4]$/i.test(trimmed)) {
    return 'quarter';
  }

  // Month names or month abbreviations
  const months = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december', 'jan', 'feb', 'mar', 'apr', 'jun', 'jul', 'aug', 'sep', 'sept', 'oct', 'nov', 'dec'];
  if (months.includes(lower)) {
    return 'month';
  }

  // Month-Year formats (e.g. 2023-01, 2024/05, Jan-23, Jan 2024)
  if (/^\d{4}[-/](0[1-9]|1[0-2])$/.test(trimmed) || /^[a-z]{3}[-\s]\d{2,4}$/i.test(trimmed)) {
    return 'month';
  }

  // ISO Timestamps (e.g. 2024-05-12T14:30:00Z)
  if (/^\d{4}-\d{2}-\d{2}[T\s]\d{2}:\d{2}(:\d{2})?/.test(trimmed)) {
    return 'timestamp';
  }

  // Standard dates (YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, etc.)
  if (/^\d{4}[-/.]\d{1,2}[-/.]\d{1,2}$/.test(trimmed) || /^\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}$/.test(trimmed)) {
    return 'date';
  }

  // Check JavaScript Date parsing if column header hints at time
  if (/date|time|timestamp|period|day|month|year|week|quarter|created|updated|trans_date|order_date/i.test(colLower)) {
    const timestamp = Date.parse(trimmed);
    if (!isNaN(timestamp) && trimmed.length >= 4 && !/^\d+$/.test(trimmed)) {
      return 'date';
    }
  }

  return null;
}

// Detect boolean values
function isBooleanValue(val: string): boolean {
  const lower = val.trim().toLowerCase();
  return ['true', 'false', 'yes', 'no', 't', 'f', 'y', 'n', '0', '1'].includes(lower);
}

// Detect identifier columns by name or uniqueness
function isLikelyId(colName: string, uniqueCount: number, totalRows: number): boolean {
  const lower = colName.toLowerCase();
  if (/^(id|_id|uuid|guid|user_id|cust_id|customer_id|order_id|trans_id|transaction_id|session_id|item_id|sku|url|uri|link|hash|key)$/i.test(lower)) {
    return true;
  }
  if (lower.endsWith('_id') || lower.endsWith('id') || lower.endsWith('_key') || lower.endsWith('_uuid')) {
    return true;
  }
  if (totalRows > 15 && uniqueCount === totalRows && !/year|amount|revenue|price|cost|score|count|total/i.test(lower)) {
    return true;
  }
  return false;
}

/**
 * Analyzes the columns, datatypes, and data distribution of a dataset.
 */
export function analyzeDataStructure(csvContent: string, fileName = 'dataset.csv'): DataStructureAnalysis {
  const { headers, rows } = parseCsvFast(csvContent);
  const rowCount = rows.length;
  const columnCount = headers.length;

  if (columnCount === 0 || rowCount === 0) {
    return {
      fileName,
      rowCount: 0,
      columnCount: 0,
      columns: [],
      numericColumns: [],
      categoricalColumns: [],
      temporalColumns: [],
      booleanColumns: [],
      identifierColumns: [],
      numericRatio: 0,
      categoricalRatio: 0,
      temporalRatio: 0,
      hasTimeSeries: false,
      hasLowCardinalityCategory: false,
      hasMultiNumeric: false,
      summarySentence: 'No data found in dataset.',
      proposedVisualizations: [],
      topRecommendation: null,
    };
  }

  const columnProfiles: ColumnProfile[] = [];

  // Analyze each column
  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const colName = headers[colIdx] || `Column_${colIdx + 1}`;
    const values = rows.map((r) => r[colIdx] ?? '').filter((v) => v !== undefined);
    const nonNullValues = values.filter((v) => v.trim() !== '' && v.trim() !== 'null' && v.trim() !== 'NaN' && v.trim() !== 'None');
    const nonNullCount = nonNullValues.length;
    const nullCount = rowCount - nonNullCount;

    // Value counts
    const valueFreqMap = new Map<string, number>();
    for (const v of nonNullValues) {
      valueFreqMap.set(v, (valueFreqMap.get(v) || 0) + 1);
    }
    const uniqueCount = valueFreqMap.size;

    // Top values
    const sortedFreq = Array.from(valueFreqMap.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 8);
    const topValues = sortedFreq.map(([val, count]) => ({
      value: val,
      count,
      percentage: nonNullCount > 0 ? (count / nonNullCount) * 100 : 0,
    }));

    // Test data types
    let numericHits = 0;
    let temporalHits = 0;
    let booleanHits = 0;
    const numericParsed: number[] = [];
    const temporalTypes: Array<'date' | 'timestamp' | 'year' | 'month' | 'quarter' | 'day'> = [];

    for (const v of nonNullValues) {
      const num = parseNumericValue(v);
      if (num !== null) {
        numericHits++;
        numericParsed.push(num);
      }

      const tempType = detectTemporal(v, colName);
      if (tempType) {
        temporalHits++;
        temporalTypes.push(tempType);
      }

      if (isBooleanValue(v)) {
        booleanHits++;
      }
    }

    const numericRatio = nonNullCount > 0 ? numericHits / nonNullCount : 0;
    const temporalRatio = nonNullCount > 0 ? temporalHits / nonNullCount : 0;
    const booleanRatio = nonNullCount > 0 ? booleanHits / nonNullCount : 0;

    let colType: ColumnDataType = 'categorical';
    let inferredLabel = 'Categorical';
    let temporalFormat: 'date' | 'timestamp' | 'year' | 'month' | 'quarter' | 'day' | undefined;

    // Check ID first
    if (isLikelyId(colName, uniqueCount, rowCount)) {
      colType = 'identifier';
      inferredLabel = 'Unique ID / Key';
    } else if (temporalRatio >= 0.7 || (/date|timestamp|time|day|month|quarter|period|year/i.test(colName) && (temporalRatio >= 0.4 || numericRatio >= 0.8))) {
      colType = 'temporal';
      // Pick most frequent temporal format
      const tempFreq = new Map<string, number>();
      for (const t of temporalTypes) tempFreq.set(t, (tempFreq.get(t) || 0) + 1);
      const topTemp = Array.from(tempFreq.entries()).sort((a, b) => b[1] - a[1])[0];
      temporalFormat = (topTemp?.[0] as any) || (colName.toLowerCase().includes('year') ? 'year' : 'date');
      inferredLabel = `Temporal (${temporalFormat.toUpperCase()})`;
    } else if (booleanRatio >= 0.9 && uniqueCount <= 3) {
      colType = 'boolean';
      inferredLabel = 'Boolean / Binary';
    } else if (numericRatio >= 0.75) {
      colType = 'numeric';
      const isAllInts = numericParsed.every((n) => Number.isInteger(n));
      inferredLabel = isAllInts ? 'Integer' : 'Numeric (Float)';
    } else {
      colType = 'categorical';
      inferredLabel = uniqueCount <= 7 ? 'Low-Cardinality Category' : 'Categorical';
    }

    // Numeric statistics
    let isInteger: boolean | undefined;
    let min: number | undefined;
    let max: number | undefined;
    let mean: number | undefined;
    let sum: number | undefined;

    if (colType === 'numeric' && numericParsed.length > 0) {
      isInteger = numericParsed.every((n) => Number.isInteger(n));
      min = Math.min(...numericParsed);
      max = Math.max(...numericParsed);
      sum = numericParsed.reduce((acc, curr) => acc + curr, 0);
      mean = sum / numericParsed.length;
    }

    columnProfiles.push({
      name: colName,
      type: colType,
      inferredTypeLabel: inferredLabel,
      nonNullCount,
      nullCount,
      uniqueCount,
      sampleValues: nonNullValues.slice(0, 5),
      isInteger,
      min,
      max,
      mean,
      sum,
      topValues,
      isLowCardinality: colType === 'categorical' && uniqueCount >= 2 && uniqueCount <= 7,
      isMediumCardinality: colType === 'categorical' && uniqueCount > 7 && uniqueCount <= 25,
      temporalFormat,
    });
  }

  // Filter groups
  const numericColumns = columnProfiles.filter((c) => c.type === 'numeric');
  const categoricalColumns = columnProfiles.filter((c) => c.type === 'categorical');
  const temporalColumns = columnProfiles.filter((c) => c.type === 'temporal');
  const booleanColumns = columnProfiles.filter((c) => c.type === 'boolean');
  const identifierColumns = columnProfiles.filter((c) => c.type === 'identifier');

  const numRatio = columnCount > 0 ? numericColumns.length / columnCount : 0;
  const catRatio = columnCount > 0 ? categoricalColumns.length / columnCount : 0;
  const tempRatio = columnCount > 0 ? temporalColumns.length / columnCount : 0;

  const hasTimeSeries = temporalColumns.length > 0;
  const hasLowCardinalityCategory = categoricalColumns.some((c) => c.isLowCardinality);
  const hasMultiNumeric = numericColumns.length >= 2;

  // Generate Propose Visualization Types
  const proposedVisualizations = generateProposedVisualizations({
    rowCount,
    columnCount,
    columnProfiles,
    numericColumns,
    categoricalColumns,
    temporalColumns,
    booleanColumns,
  });

  const topRecommendation = proposedVisualizations.length > 0 ? proposedVisualizations[0] : null;

  // Generate summary sentence
  const summaryParts: string[] = [];
  summaryParts.push(`${columnCount} columns (${numericColumns.length} Numeric, ${categoricalColumns.length} Categorical${temporalColumns.length ? `, ${temporalColumns.length} Time Series` : ''})`);
  summaryParts.push(`${rowCount.toLocaleString()} total rows`);

  const summarySentence = `Data Structure: ${summaryParts.join(' · ')}. Best suited for ${topRecommendation ? topRecommendation.title : 'comprehensive analytics'}.`;

  return {
    fileName,
    rowCount,
    columnCount,
    columns: columnProfiles,
    numericColumns,
    categoricalColumns,
    temporalColumns,
    booleanColumns,
    identifierColumns,
    numericRatio: numRatio,
    categoricalRatio: catRatio,
    temporalRatio: tempRatio,
    hasTimeSeries,
    hasLowCardinalityCategory,
    hasMultiNumeric,
    summarySentence,
    proposedVisualizations,
    topRecommendation,
  };
}

/**
 * Rules engine to propose optimal visualizations based on column type counts and distributions.
 */
function generateProposedVisualizations(context: {
  rowCount: number;
  columnCount: number;
  columnProfiles: ColumnProfile[];
  numericColumns: ColumnProfile[];
  categoricalColumns: ColumnProfile[];
  temporalColumns: ColumnProfile[];
  booleanColumns: ColumnProfile[];
}): ProposedVisualization[] {
  const { rowCount, numericColumns, categoricalColumns, temporalColumns } = context;
  const proposals: ProposedVisualization[] = [];

  const primaryNumeric = numericColumns[0];
  const secondaryNumeric = numericColumns[1];
  const tertiaryNumeric = numericColumns[2];

  const primaryTemporal = temporalColumns[0];
  const primaryCategorical = categoricalColumns[0];
  const lowCardCategorical = categoricalColumns.find((c) => c.isLowCardinality) || primaryCategorical;
  const medCardCategorical = categoricalColumns.find((c) => c.isMediumCardinality) || primaryCategorical;

  // ─────────────────────────────────────────────────────────────
  // 1. Line Chart / Area Chart (Time Series & Trends)
  // ─────────────────────────────────────────────────────────────
  if (primaryTemporal && primaryNumeric) {
    const yCols = numericColumns.slice(0, 3).map((c) => c.name);
    proposals.push({
      id: 'time-series-line',
      type: 'line',
      title: 'Time Series & Trend Line Chart',
      badge: 'Time Series',
      suitabilityScore: 98,
      suitabilityLevel: 'High',
      rationale: `Detected temporal column "${primaryTemporal.name}" (${primaryTemporal.temporalFormat || 'date'}) and ${numericColumns.length} numeric metric(s) (${yCols.join(', ')}). Line charts are the definitive standard for tracking trajectory, velocity, and seasonal peaks over time.`,
      suggestedQuestion: `What is the historical trend of ${yCols.join(' and ')} over ${primaryTemporal.name}, and are there notable cycles or shifts?`,
      suggestedPromptRefinement: `Analyze the time series trend of ${yCols.join(' and ')} indexed by ${primaryTemporal.name}. Highlight growth rates, seasonal patterns, and inflection points.`,
      columnMappings: {
        xAxis: primaryTemporal.name,
        yAxis: yCols.length === 1 ? yCols[0] : yCols,
        metric: yCols,
      },
      keyFeatures: ['Continuous temporal x-axis', 'Multi-metric line overlays', 'Inflection point tracking'],
      iconType: 'line',
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 2. Pie / Donut Chart (Distributions & Composition)
  // ─────────────────────────────────────────────────────────────
  if (lowCardCategorical && primaryNumeric && (!lowCardCategorical.min || lowCardCategorical.uniqueCount <= 7)) {
    const uniqueCount = lowCardCategorical.uniqueCount;
    const isUnder8 = uniqueCount >= 2 && uniqueCount <= 7;
    proposals.push({
      id: 'distribution-pie',
      type: 'pie',
      title: 'Distribution & Share Pie Chart',
      badge: 'Distribution',
      suitabilityScore: isUnder8 ? 94 : 76,
      suitabilityLevel: isUnder8 ? 'High' : 'Recommended',
      rationale: `Detected clean low-cardinality category "${lowCardCategorical.name}" with ${uniqueCount} distinct segments (${lowCardCategorical.sampleValues.slice(0, 3).join(', ')}). Pie/Donut charts represent relative composition, share of wallet, and category contribution with clarity.`,
      suggestedQuestion: `What is the proportional distribution and share of ${primaryNumeric.name} by ${lowCardCategorical.name}?`,
      suggestedPromptRefinement: `Show the percentage breakdown and distribution of ${primaryNumeric.name} across ${lowCardCategorical.name} categories. Identify dominant vs minor segments.`,
      columnMappings: {
        dimension: lowCardCategorical.name,
        metric: primaryNumeric.name,
      },
      keyFeatures: ['Percentage slice proportions', 'Clean 2–7 segment readability', 'Part-to-whole share analysis'],
      iconType: 'pie',
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 3. Vertical Column / Bar Chart (Discrete Categorical Comparison)
  // ─────────────────────────────────────────────────────────────
  if (primaryCategorical && primaryNumeric) {
    const yCols = numericColumns.slice(0, 2).map((c) => c.name);
    proposals.push({
      id: 'categorical-bar',
      type: 'bar',
      title: 'Categorical Comparison Bar Chart',
      badge: 'Comparison',
      suitabilityScore: 92,
      suitabilityLevel: 'High',
      rationale: `Found categorical column "${primaryCategorical.name}" (${primaryCategorical.uniqueCount} unique categories) paired with numeric metric "${primaryNumeric.name}". Column bar charts are ideal for direct side-by-side performance benchmarks.`,
      suggestedQuestion: `Which ${primaryCategorical.name} generates the highest ${primaryNumeric.name}, and how do the top categories rank against each other?`,
      suggestedPromptRefinement: `Compare ${primaryNumeric.name} across ${primaryCategorical.name} categories in a ranked bar chart. Highlight highest performers and variances.`,
      columnMappings: {
        xAxis: primaryCategorical.name,
        yAxis: yCols.length === 1 ? yCols[0] : yCols,
        dimension: primaryCategorical.name,
        metric: yCols,
      },
      keyFeatures: ['Side-by-side category comparisons', 'Variance & baseline ranking', 'Direct value contrast'],
      iconType: 'bar',
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 4. Horizontal Bar Chart (Rankings & Long Category Labels)
  // ─────────────────────────────────────────────────────────────
  if ((medCardCategorical || primaryCategorical) && primaryNumeric) {
    const targetCat = medCardCategorical || primaryCategorical;
    proposals.push({
      id: 'horizontal-ranking-bar',
      type: 'horizontal_bar',
      title: 'Top-N Leaderboard & Ranking Chart',
      badge: 'Ranking',
      suitabilityScore: targetCat.uniqueCount > 7 ? 90 : 80,
      suitabilityLevel: targetCat.uniqueCount > 7 ? 'High' : 'Recommended',
      rationale: `Category "${targetCat.name}" contains ${targetCat.uniqueCount} items. Horizontal bars prevent label truncation and make Top 10 / Bottom 10 leaderboards immediately legible.`,
      suggestedQuestion: `What are the Top 10 ${targetCat.name} groups ranked by total ${primaryNumeric.name}?`,
      suggestedPromptRefinement: `Rank the top and bottom ${targetCat.name} by ${primaryNumeric.name}. Provide a horizontal ranking leaderboard.`,
      columnMappings: {
        yAxis: targetCat.name,
        xAxis: primaryNumeric.name,
        dimension: targetCat.name,
        metric: primaryNumeric.name,
      },
      keyFeatures: ['Uncrowded horizontal text labels', 'Top-N sorting and filtering', 'Quick hierarchy identification'],
      iconType: 'bar',
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 5. Scatter Plot (Correlation & Multi-Numeric Analysis)
  // ─────────────────────────────────────────────────────────────
  if (primaryNumeric && secondaryNumeric && rowCount >= 6) {
    proposals.push({
      id: 'correlation-scatter',
      type: 'scatter',
      title: 'Correlation & Scatter Relationship',
      badge: 'Correlation',
      suitabilityScore: 89,
      suitabilityLevel: 'Strong',
      rationale: `Dataset features continuous numeric variables "${primaryNumeric.name}" and "${secondaryNumeric.name}". Scatter plots examine statistical correlation, cluster density, regression slope, and anomalies.`,
      suggestedQuestion: `Is there a correlation between ${primaryNumeric.name} and ${secondaryNumeric.name}, and are there notable outliers?`,
      suggestedPromptRefinement: `Analyze the correlation and bivariate relationship between ${primaryNumeric.name} and ${secondaryNumeric.name}. Identify clusters and outliers.`,
      columnMappings: {
        xAxis: primaryNumeric.name,
        yAxis: secondaryNumeric.name,
        metric: [primaryNumeric.name, secondaryNumeric.name],
      },
      keyFeatures: ['Bivariate regression & correlation', 'Outlier & cluster detection', 'Cross-metric elasticity'],
      iconType: 'scatter',
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 6. Grouped / Multi-Series Bar (Multi-Metric Comparison)
  // ─────────────────────────────────────────────────────────────
  if (primaryCategorical && primaryNumeric && secondaryNumeric) {
    proposals.push({
      id: 'grouped-metric-bar',
      type: 'grouped_bar',
      title: 'Multi-Metric Grouped Comparison',
      badge: 'Multi-Metric',
      suitabilityScore: 87,
      suitabilityLevel: 'Strong',
      rationale: `Found ${numericColumns.length} numeric columns (${primaryNumeric.name}, ${secondaryNumeric.name}${tertiaryNumeric ? `, ${tertiaryNumeric.name}` : ''}) that can be contrasted side-by-side across "${primaryCategorical.name}".`,
      suggestedQuestion: `How do ${primaryNumeric.name} and ${secondaryNumeric.name} compare across ${primaryCategorical.name}?`,
      suggestedPromptRefinement: `Compare both ${primaryNumeric.name} and ${secondaryNumeric.name} across ${primaryCategorical.name} in a multi-series grouped chart.`,
      columnMappings: {
        xAxis: primaryCategorical.name,
        yAxis: [primaryNumeric.name, secondaryNumeric.name],
        dimension: primaryCategorical.name,
        metric: [primaryNumeric.name, secondaryNumeric.name],
      },
      keyFeatures: ['Multi-metric direct comparison', 'Synchronized dual axes', 'Cross-metric ratios'],
      iconType: 'bar',
    });
  }

  // ─────────────────────────────────────────────────────────────
  // 7. Heatmap / Cross-Tabulation Matrix
  // ─────────────────────────────────────────────────────────────
  if (categoricalColumns.length >= 2 && primaryNumeric) {
    const dim1 = categoricalColumns[0];
    const dim2 = categoricalColumns[1];
    if (dim1.uniqueCount <= 25 && dim2.uniqueCount <= 25) {
      proposals.push({
        id: 'matrix-heatmap',
        type: 'heatmap',
        title: 'Cross-Tabulation Matrix & Heatmap',
        badge: 'Matrix Patterns',
        suitabilityScore: 83,
        suitabilityLevel: 'Recommended',
        rationale: `Cross-tabulating "${dim1.name}" (${dim1.uniqueCount} items) against "${dim2.name}" (${dim2.uniqueCount} items) with intensity metric "${primaryNumeric.name}" reveals multi-dimensional concentration peaks.`,
        suggestedQuestion: `Where are the highest concentrations of ${primaryNumeric.name} across ${dim1.name} and ${dim2.name}?`,
        suggestedPromptRefinement: `Construct a 2D cross-tabulation matrix of ${dim1.name} versus ${dim2.name} weighted by ${primaryNumeric.name}.`,
        columnMappings: {
          xAxis: dim1.name,
          secondaryDimension: dim2.name,
          metric: primaryNumeric.name,
        },
        keyFeatures: ['2D density matrix', 'High-concentration hot spots', 'Multi-dimensional interaction'],
        iconType: 'heatmap',
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // 8. Executive KPI Benchmarks & Summary Cards
  // ─────────────────────────────────────────────────────────────
  if (numericColumns.length >= 1) {
    const kpiMetrics = numericColumns.slice(0, 4).map((c) => c.name);
    proposals.push({
      id: 'kpi-summary-cards',
      type: 'kpi',
      title: 'Executive KPI & Benchmark Summary',
      badge: 'Summary KPIs',
      suitabilityScore: 81,
      suitabilityLevel: 'Moderate',
      rationale: `Provides immediate high-level rollup metrics (${kpiMetrics.join(', ')}), overall sums, averages, and statistical quartiles.`,
      suggestedQuestion: `What are the overall total, average, and statistical benchmarks for ${kpiMetrics.join(', ')}?`,
      suggestedPromptRefinement: `Summarize the overall business KPIs and statistical benchmarks for ${kpiMetrics.join(', ')}.`,
      columnMappings: {
        metric: kpiMetrics,
      },
      keyFeatures: ['Instant total & average rollups', 'Executive headline metrics', 'Statistical baselines'],
      iconType: 'kpi',
    });
  }

  // Sort proposals by suitability score descending
  return proposals.sort((a, b) => b.suitabilityScore - a.suitabilityScore);
}
