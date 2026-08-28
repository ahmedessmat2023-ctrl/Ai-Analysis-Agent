import { parseCsvFast } from './dataStructureAnalyzer';

export interface ColumnDescriptiveStats {
  columnName: string;
  dataType: 'numeric' | 'categorical' | 'temporal' | 'boolean' | 'identifier';
  totalCount: number;
  nonNullCount: number;
  nullCount: number;
  nullPercentage: number;
  uniqueCount: number;

  // Numeric Statistics
  isNumeric: boolean;
  mean?: number;
  median?: number;
  min?: number;
  max?: number;
  sum?: number;
  stdDev?: number;
  q1?: number; // 25th percentile
  q3?: number; // 75th percentile
  iqr?: number;

  // Categorical & General Statistics
  topValues?: Array<{ value: string; count: number; percentage: number }>;
  mode?: { value: string; count: number; percentage: number };

  // Sample values
  sampleValues: string[];
}

export interface DatasetQuickStats {
  fileName: string;
  totalRows: number;
  totalColumns: number;
  numericColumnCount: number;
  categoricalColumnCount: number;
  otherColumnCount: number;
  totalCells: number;
  totalMissingCells: number;
  missingCellsPercentage: number;
  headers: string[];
  rawRowsSample: string[][]; // First 25 rows for table preview
  columns: ColumnDescriptiveStats[];
}

/**
 * Calculates median and quartiles from a sorted numeric array.
 */
function calculatePercentile(sortedArr: number[], p: number): number {
  if (sortedArr.length === 0) return 0;
  const index = (sortedArr.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  const weight = index - lower;
  if (upper >= sortedArr.length) return sortedArr[lower];
  return sortedArr[lower] * (1 - weight) + sortedArr[upper] * weight;
}

/**
 * Parses and computes descriptive statistics (mean, median, count, std dev, min, max, missing)
 * for a CSV dataset.
 */
export function computeDescriptiveStats(
  csvContent: string,
  fileName = 'dataset.csv'
): DatasetQuickStats | null {
  if (!csvContent || !csvContent.trim()) return null;

  const { headers, rows } = parseCsvFast(csvContent, 5000);
  const totalRows = rows.length;
  const totalColumns = headers.length;

  if (totalColumns === 0 || totalRows === 0) return null;

  const columnStats: ColumnDescriptiveStats[] = [];
  let totalMissingCells = 0;

  for (let colIdx = 0; colIdx < headers.length; colIdx++) {
    const colName = headers[colIdx] || `Column_${colIdx + 1}`;
    const rawValues = rows.map((r) => r[colIdx] ?? '').filter((v) => v !== undefined);

    const nonNullValues = rawValues.filter(
      (v) =>
        v.trim() !== '' &&
        v.trim() !== 'null' &&
        v.trim() !== 'NaN' &&
        v.trim() !== 'None' &&
        v.trim() !== 'N/A' &&
        v.trim() !== '-'
    );

    const nonNullCount = nonNullValues.length;
    const nullCount = totalRows - nonNullCount;
    totalMissingCells += nullCount;
    const nullPercentage = totalRows > 0 ? (nullCount / totalRows) * 100 : 0;

    // Frequency map
    const freqMap = new Map<string, number>();
    for (const v of nonNullValues) {
      freqMap.set(v, (freqMap.get(v) || 0) + 1);
    }
    const uniqueCount = freqMap.size;

    // Top frequency values
    const sortedFreq = Array.from(freqMap.entries())
      .sort((a, b) => b[1] - a[1]);

    const topValues = sortedFreq.slice(0, 5).map(([val, count]) => ({
      value: val,
      count,
      percentage: nonNullCount > 0 ? (count / nonNullCount) * 100 : 0,
    }));

    const mode = topValues[0] || undefined;

    // Parse numeric candidates
    const parsedNums: number[] = [];
    for (const v of nonNullValues) {
      const cleaned = v.replace(/[$€£¥₹,%]/g, '').trim();
      const num = Number(cleaned);
      if (!isNaN(num) && isFinite(num) && cleaned !== '') {
        parsedNums.push(num);
      }
    }

    const isNumeric = nonNullCount > 0 && parsedNums.length / nonNullCount >= 0.75;

    let mean: number | undefined;
    let median: number | undefined;
    let min: number | undefined;
    let max: number | undefined;
    let sum: number | undefined;
    let stdDev: number | undefined;
    let q1: number | undefined;
    let q3: number | undefined;
    let iqr: number | undefined;

    let dataType: 'numeric' | 'categorical' | 'temporal' | 'boolean' | 'identifier' = 'categorical';

    if (isNumeric && parsedNums.length > 0) {
      dataType = 'numeric';
      // Sort numeric array for median and quartile computation
      const sortedNums = [...parsedNums].sort((a, b) => a - b);
      sum = sortedNums.reduce((acc, curr) => acc + curr, 0);
      mean = sum / sortedNums.length;
      min = sortedNums[0];
      max = sortedNums[sortedNums.length - 1];

      // Median
      median = calculatePercentile(sortedNums, 0.5);
      q1 = calculatePercentile(sortedNums, 0.25);
      q3 = calculatePercentile(sortedNums, 0.75);
      iqr = q3 - q1;

      // Sample Standard Deviation
      if (sortedNums.length > 1 && mean !== undefined) {
        const variance =
          sortedNums.reduce((acc, curr) => acc + Math.pow(curr - mean!, 2), 0) /
          (sortedNums.length - 1);
        stdDev = Math.sqrt(variance);
      } else {
        stdDev = 0;
      }
    } else {
      // Check ID or boolean or categorical
      const lowerName = colName.toLowerCase();
      if (
        uniqueCount === totalRows &&
        totalRows > 10 &&
        (lowerName.includes('id') || lowerName.includes('key') || lowerName.includes('sku'))
      ) {
        dataType = 'identifier';
      } else if (
        /date|time|timestamp|year|month|quarter|day/i.test(lowerName) ||
        nonNullValues.some((v) => /^\d{4}[-/.]\d{1,2}/.test(v))
      ) {
        dataType = 'temporal';
      } else if (
        uniqueCount <= 2 &&
        nonNullValues.every((v) => ['true', 'false', '0', '1', 'yes', 'no'].includes(v.toLowerCase()))
      ) {
        dataType = 'boolean';
      } else {
        dataType = 'categorical';
      }
    }

    columnStats.push({
      columnName: colName,
      dataType,
      totalCount: totalRows,
      nonNullCount,
      nullCount,
      nullPercentage,
      uniqueCount,
      isNumeric,
      mean,
      median,
      min,
      max,
      sum,
      stdDev,
      q1,
      q3,
      iqr,
      topValues,
      mode,
      sampleValues: nonNullValues.slice(0, 6),
    });
  }

  const numericColumnCount = columnStats.filter((c) => c.isNumeric).length;
  const categoricalColumnCount = columnStats.filter(
    (c) => c.dataType === 'categorical' || c.dataType === 'boolean'
  ).length;
  const otherColumnCount = totalColumns - numericColumnCount - categoricalColumnCount;
  const totalCells = totalRows * totalColumns;
  const missingCellsPercentage = totalCells > 0 ? (totalMissingCells / totalCells) * 100 : 0;

  return {
    fileName,
    totalRows,
    totalColumns,
    numericColumnCount,
    categoricalColumnCount,
    otherColumnCount,
    totalCells,
    totalMissingCells,
    missingCellsPercentage,
    headers,
    rawRowsSample: rows.slice(0, 20),
    columns: columnStats,
  };
}

/**
 * Format numbers cleanly for UI display
 */
export function formatStatNumber(val: number | undefined | null, decimals = 2): string {
  if (val === undefined || val === null || isNaN(val)) return '—';
  if (Math.abs(val) >= 1_000_000) {
    return (val / 1_000_000).toLocaleString('en-US', { maximumFractionDigits: decimals }) + 'M';
  }
  if (Math.abs(val) >= 1_000) {
    return val.toLocaleString('en-US', { maximumFractionDigits: decimals });
  }
  if (Number.isInteger(val)) {
    return val.toString();
  }
  return val.toLocaleString('en-US', {
    minimumFractionDigits: 0,
    maximumFractionDigits: decimals,
  });
}
