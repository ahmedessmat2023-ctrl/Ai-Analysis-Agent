#!/usr/bin/env python3
# Copyright 2026 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     https://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.
"""Build a structured report.json for the AI Data Analyst.

Reads the profile, analysis tables, and charts and deterministically writes a
valid report. This script intentionally performs no network or model calls so
report generation cannot hang after the analysis has completed.

Usage:
    python3 build_report.py --workspace ./workspace --question "..." --dataset-name "Northwind Orders"

Requires:
    pip install pandas

Output:
    {workspace}/data/report.json
"""

import argparse
import glob
import json
import os
from datetime import datetime

import numpy as np
import pandas as pd

MAX_TABLE_ROWS = 20


def sanitize_for_json(obj):
    """Recursively convert NaN/Infinity and non-standard types to JSON-safe primitives."""
    if obj is None:
        return None
    if isinstance(obj, float):
        if pd.isna(obj) or np.isinf(obj):
            return None
        return obj
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, (np.floating, float)):
        val = float(obj)
        return None if (pd.isna(val) or np.isinf(val)) else val
    if isinstance(obj, (np.bool_, bool)):
        return bool(obj)
    if isinstance(obj, (pd.Timestamp, datetime)):
        return obj.isoformat()
    if isinstance(obj, dict):
        return {str(k): sanitize_for_json(v) for k, v in obj.items()}
    if isinstance(obj, (list, tuple, np.ndarray, pd.Series)):
        return [sanitize_for_json(x) for x in obj]
    if pd.isna(obj):
        return None
    return obj


def load_profile(workspace):
    path = os.path.join(workspace, "data", "profile.json")
    if os.path.exists(path):
        try:
            with open(path) as f:
                return json.load(f)
        except Exception as e:
            print(f"Warning: could not read profile.json: {e}")
    return {}


def load_analysis_tables(workspace):
    """Return {name: DataFrame} for every CSV in data/analysis/."""
    tables = {}
    analysis_dir = os.path.join(workspace, "data", "analysis")
    if not os.path.isdir(analysis_dir):
        return tables
    for path in sorted(glob.glob(os.path.join(analysis_dir, "*.csv"))):
        name = os.path.splitext(os.path.basename(path))[0]
        try:
            df = pd.read_csv(path)
            # Strip whitespace from column names for robust processing
            df.columns = df.columns.astype(str).str.strip()
            tables[name] = df.reset_index(drop=True)
        except Exception as e:  # noqa: BLE001
            print(f"Warning: could not read {path}: {e}")
    return tables


def list_charts(workspace, charts_arg):
    """Return list of {file, title} for charts/*.png."""
    charts = []
    if charts_arg:
        for pair in charts_arg.split(","):
            if ":" in pair:
                file, title = pair.split(":", 1)
            else:
                file, title = pair, ""
            charts.append({"file": file.strip(), "title": title.strip()})
        return charts
    charts_dir = os.path.join(workspace, "charts")
    if os.path.isdir(charts_dir):
        for path in sorted(glob.glob(os.path.join(charts_dir, "*.png"))):
            base = os.path.basename(path)
            title = os.path.splitext(base)[0].replace("_", " ").title()
            charts.append({"file": f"charts/{base}", "title": title})
    return charts


def build_display_tables(tables):
    out = []
    for name, df in tables.items():
        preview = df.head(MAX_TABLE_ROWS).reset_index(drop=True)
        # Convert values safely row by row
        raw_rows = preview.values.tolist()
        clean_rows = sanitize_for_json(raw_rows)
        out.append({
            "title": name.replace("_", " ").title(),
            "columns": [str(c) for c in preview.columns],
            "rows": clean_rows,
            "caption": "",
        })
    return out


def format_value(value):
    """Format a scalar for a concise dashboard metric."""
    if isinstance(value, (pd.Series, list, tuple, np.ndarray)):
        if len(value) > 0:
            value = value[0]
        else:
            return "N/A"
    if pd.isna(value) or value is None:
        return "N/A"
    if isinstance(value, (float, np.floating)):
        if np.isinf(value):
            return "N/A"
        return f"{value:,.2f}".rstrip("0").rstrip(".")
    if isinstance(value, (int, np.integer)):
        return f"{value:,}"
    return str(value)


def build_insights(tables):
    """Derive grounded highlights from the analysis tables."""
    insights = []
    def table_priority(item):
        name = item[0].lower()
        if "correlation" in name:
            return 99
        if "segment" in name and ("overview" in name or "summary" in name):
            return 0
        if "overview" in name or "summary" in name or "result" in name:
            return 1
        if "segment" in name:
            return 2
        return 3

    def metric_priority(column):
        name = str(column).lower()
        if name.startswith("total_") or "total" in name:
            return 0
        if any(token in name for token in ("value", "revenue", "sales", "profit", "distance", "achievement", "rate")):
            return 1
        if name.startswith("avg_") or "average" in name or "mean" in name:
            return 2
        if "count" in name:
            return 3
        return 4

    for name, df in sorted(tables.items(), key=table_priority):
        if len(insights) >= 6 or df.empty:
            break
        if "correlation" in name.lower():
            continue
        # Ensure fresh clean copy with unique index
        df_clean = df.reset_index(drop=True)
        numeric_cols = list(df_clean.select_dtypes(include="number").columns)
        if not numeric_cols:
            continue
        label_col = df_clean.columns[0]
        metric_cols = [column for column in numeric_cols if column != label_col]
        ranked_metrics = sorted(metric_cols or numeric_cols, key=metric_priority)
        for value_col in ranked_metrics[:2]:
            if len(insights) >= 6:
                break
            valid_mask = df_clean[value_col].notna()
            if not valid_mask.any():
                continue
            max_idx = df_clean.loc[valid_mask, value_col].idxmax()
            row = df_clean.loc[max_idx]
            raw_label = row[label_col] if label_col != value_col else name.replace("_", " ")
            label = format_value(raw_label)
            value = format_value(row[value_col])
            readable_metric = str(value_col).replace("_", " ")
            insights.append({
                "title": f"Highest {readable_metric}",
                "detail": (
                    f"{label} has the highest {readable_metric} "
                    f"in {name.replace('_', ' ')} at {value}."
                ),
                "metric": readable_metric.title(),
                "value": value,
            })
    return insights


def infer_chart_type(chart):
    text = f"{chart.get('file', '')} {chart.get('title', '')}".lower()
    if any(token in text for token in ("trend", "progress", "timeline", "over time", "yearly", "monthly")):
        return "line"
    if any(token in text for token in ("share", "distribution", "composition", "mix")):
        return "pie"
    return "bar"


def extract_limitation(tables):
    """Return a structured limitation when a turn cannot answer the question."""
    for name, df in tables.items():
        if "limitation" not in name.lower() or df.empty:
            continue
        row = df.iloc[0]
        limitation = str(row.get(
            "limitation",
            "The question could not be answered from the available dataset.",
        ))
        detail = str(row.get("detail", "")).strip()
        required_data = str(row.get("required_data", "")).strip()
        return {
            "limitation": limitation,
            "detail": detail,
            "required_data": required_data,
        }
    return None


def build_report(question, dataset_name, profile, tables, charts):
    print("Building deterministic report from analysis outputs...", flush=True)
    limitation = extract_limitation(tables)
    insights = build_insights(tables) if not limitation else [{
        "title": "Data limitation",
        "detail": limitation["detail"] or limitation["limitation"],
        "metric": "Status",
        "value": "Insufficient data",
    }]
    table_count = len(tables)
    chart_count = len(charts)
    if limitation:
        executive_summary = limitation["limitation"]
        if limitation["detail"] and limitation["detail"] != limitation["limitation"]:
            executive_summary += f" {limitation['detail']}"
    elif insights:
        lead = insights[0]
        executive_summary = (
            f"The analysis completed successfully. {lead['detail']} "
            f"The dashboard includes {table_count} supporting table(s) and "
            f"{chart_count} chart(s) for further review."
        )
    else:
        executive_summary = (
            "The dataset was processed successfully, but no numeric analysis "
            "table was available from which to derive a ranked metric. Review "
            "the supporting tables and charts for the available findings."
        )
    return {
        "dataset_name": dataset_name,
        "question": question,
        "title": f"Analysis: {dataset_name}",
        "executive_summary": executive_summary,
        "insights": insights,
        "charts": [
            {
                "title": c["title"],
                "file": c["file"],
                "caption": "",
                "type": infer_chart_type(c),
            }
            for c in charts
        ],
        "tables": build_display_tables(tables),
        "methodology": (
            f"Profiled {profile.get('row_count', 'N/A')} rows across "
            f"{profile.get('column_count', 'N/A')} columns, then aggregated with Pandas."
        ),
        "recommendations": (
            [f"Provide the following data: {limitation['required_data']}"]
            if limitation and limitation["required_data"]
            else [
                "Validate the leading metrics against business context before acting.",
                "Review the supporting trends and segments for material changes or anomalies.",
            ]
        ),
        "generated_at": datetime.now().strftime("%Y-%m-%d"),
    }


def main():
    parser = argparse.ArgumentParser(description="Build the final analysis report.json")
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--question", required=True)
    parser.add_argument("--dataset-name", default="Dataset")
    parser.add_argument("--charts", default="", help="Comma-separated file:title pairs")
    args = parser.parse_args()

    print("=== AI Data Analyst: Report Synthesis ===\n")
    profile = load_profile(args.workspace)
    tables = load_analysis_tables(args.workspace)
    charts = list_charts(args.workspace, args.charts)
    print(f"Loaded profile ({profile.get('row_count', '?')} rows), "
          f"{len(tables)} analysis table(s), {len(charts)} chart(s).")

    output_path = os.path.join(args.workspace, "data", "report.json")
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    report = build_report(args.question, args.dataset_name, profile, tables, charts)
    clean_report = sanitize_for_json(report)

    with open(output_path, "w") as f:
        json.dump(clean_report, f, indent=2, default=str)
    print(f"\nReport saved to {output_path}", flush=True)
    print(f"  Insights: {len(report.get('insights', []))}, "
          f"Charts: {len(report.get('charts', []))}, "
          f"Tables: {len(report.get('tables', []))}")


if __name__ == "__main__":
    main()
