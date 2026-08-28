#!/usr/bin/env python3
# Copyright 2026 Google LLC
"""Profile CSV datasets and output data/profile.json safely.

Usage:
    python3 profile_data.py --workspace ./workspace
"""

import argparse
import glob
import json
import os
import sys
from datetime import datetime
import numpy as np
import pandas as pd


def sanitize_for_json(obj):
    """Recursively convert NaN/Infinity and non-standard types to JSON-safe primitives."""
    if obj is None:
        return None
    if isinstance(obj, (float, np.floating)):
        val = float(obj)
        return None if (pd.isna(val) or np.isinf(val)) else val
    if isinstance(obj, (int, np.integer)):
        return int(obj)
    if isinstance(obj, (bool, np.bool_)):
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


def profile_table(filepath):
    filename = os.path.basename(filepath)
    name = os.path.splitext(filename)[0]

    try:
        df = pd.read_csv(filepath, sep=None, engine="python", on_bad_lines="skip")
    except Exception:
        try:
            df = pd.read_csv(filepath, on_bad_lines="skip")
        except Exception as e:
            print(f"Warning: Could not parse {filepath}: {e}")
            return None

    # Strip column names
    df.columns = df.columns.astype(str).str.strip()

    row_count = len(df)
    col_count = len(df.columns)
    dup_rows = int(df.duplicated().sum()) if row_count > 0 else 0

    cols_profile = []
    for col in df.columns:
        series = df[col]
        missing = int(series.isna().sum())
        missing_pct = float(missing / row_count) if row_count > 0 else 0.0
        distinct = int(series.nunique(dropna=True))

        inferred = "text"
        stats = {}

        if pd.api.types.is_numeric_dtype(series):
            inferred = "numeric"
            valid = pd.to_numeric(series.dropna(), errors="coerce").dropna()
            if len(valid) > 0:
                stats = {
                    "min": float(valid.min()),
                    "max": float(valid.max()),
                    "mean": round(float(valid.mean()), 2),
                    "median": round(float(valid.median()), 2),
                    "std": round(float(valid.std()), 2) if len(valid) > 1 else 0.0,
                }
        elif pd.api.types.is_bool_dtype(series):
            inferred = "boolean"
        else:
            str_series = series.astype(str).str.strip()
            # Test datetime
            try:
                dt_s = pd.to_datetime(str_series, errors="coerce")
                if dt_s.notna().sum() > 0.7 * len(series) and not str_series.str.isnumeric().all():
                    inferred = "datetime"
                    valid_dt = dt_s.dropna()
                    if len(valid_dt) > 0:
                        stats = {
                            "min_date": str(valid_dt.min()),
                            "max_date": str(valid_dt.max()),
                        }
            except Exception:
                pass

            if inferred == "text":
                # Try numeric coercion
                clean_num_str = str_series.str.replace(r"[,$£€%\s]", "", regex=True)
                num_s = pd.to_numeric(clean_num_str, errors="coerce")
                if num_s.notna().sum() > 0.8 * len(series):
                    inferred = "numeric"
                    valid = num_s.dropna()
                    if len(valid) > 0:
                        stats = {
                            "min": float(valid.min()),
                            "max": float(valid.max()),
                            "mean": round(float(valid.mean()), 2),
                            "median": round(float(valid.median()), 2),
                            "std": round(float(valid.std()), 2) if len(valid) > 1 else 0.0,
                        }
                elif distinct < 30 or (row_count > 0 and distinct / row_count < 0.2):
                    inferred = "categorical"
                    top_vals = series.value_counts(dropna=True).head(5).to_dict()
                    stats = {"top_values": {str(k): int(v) for k, v in top_vals.items()}}
                else:
                    inferred = "text"

        col_meta = {
            "name": col,
            "inferred_type": inferred,
            "dtype": str(series.dtype),
            "missing": missing,
            "missing_pct": round(missing_pct, 4),
            "distinct": distinct,
            "stats": sanitize_for_json(stats),
        }
        cols_profile.append(col_meta)

    # Clean head rows for preview
    head_df = df.head(3).copy()
    head_sample = []
    for record in head_df.to_dict(orient="records"):
        head_sample.append({str(k): sanitize_for_json(v) for k, v in record.items()})

    return {
        "name": name,
        "file": filename,
        "row_count": row_count,
        "column_count": col_count,
        "duplicate_rows": dup_rows,
        "columns": cols_profile,
        "join_keys": [],
        "head": head_sample,
        "recommendations": [f"Table has {row_count} rows and {col_count} columns."],
    }


def find_join_keys(tables):
    if len(tables) < 2:
        return
    # Map col name -> tables that contain it
    col_map = {}
    for t in tables:
        for c in t["columns"]:
            c_name = c["name"].lower()
            if "id" in c_name or "key" in c_name or "code" in c_name or c["distinct"] > 5:
                col_map.setdefault(c["name"], []).append(t["name"])

    for col_name, t_names in col_map.items():
        if len(t_names) > 1:
            for t in tables:
                if t["name"] in t_names and col_name not in t["join_keys"]:
                    t["join_keys"].append(col_name)


def main():
    parser = argparse.ArgumentParser(description="Profile CSV datasets into profile.json")
    parser.add_argument("--workspace", default="./workspace", help="Path to workspace root")
    args = parser.parse_args()

    data_dir = os.path.join(args.workspace, "data")
    if not os.path.isdir(data_dir):
        print(f"ERROR: Data directory not found at {data_dir}")
        sys.exit(1)

    csv_files = [f for f in sorted(glob.glob(os.path.join(data_dir, "*.csv"))) if not f.startswith(os.path.join(data_dir, "analysis"))]

    if not csv_files:
        print("No CSV files found to profile.")
        sys.exit(0)

    tables = []
    total_rows = 0
    total_cols = 0
    primary_columns = []

    for filepath in csv_files:
        tbl = profile_table(filepath)
        if tbl:
            tables.append(tbl)
            if tbl["row_count"] >= total_rows:
                total_rows = tbl["row_count"]
                total_cols = tbl["column_count"]
                primary_columns = tbl["columns"]

    find_join_keys(tables)

    profile = {
        "table_count": len(tables),
        "table_names": [t["name"] for t in tables],
        "row_count": total_rows,
        "column_count": total_cols,
        "columns": primary_columns,
        "tables": tables,
    }

    clean_profile = sanitize_for_json(profile)
    out_path = os.path.join(data_dir, "profile.json")
    with open(out_path, "w") as f:
        json.dump(clean_profile, f, indent=2)

    print(f"Profile written successfully to {out_path}")
    print(f"Profiled {len(tables)} table(s), max rows: {total_rows}, cols: {total_cols}")


if __name__ == "__main__":
    main()
