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
"""Render a chart (PNG) from a CSV result table for the AI Data Analyst agent.

Usage:
    python3 make_chart.py --workspace ./workspace \
        --data data/analysis/revenue_by_category.csv \
        --type bar --x category --y revenue \
        --title "Revenue by Category" \
        --output charts/revenue_by_category.png

Requires:
    pip install pandas matplotlib
"""

import argparse
import os
import sys

import matplotlib

matplotlib.use("Agg")
import matplotlib.pyplot as plt  # noqa: E402
import pandas as pd  # noqa: E402

PALETTE = [
    "#4F46E5", "#06B6D4", "#10B981", "#F59E0B", "#EF4444",
    "#8B5CF6", "#EC4899", "#14B8A6", "#F97316", "#3B82F6",
]


def style_axes(ax, title, xlabel, ylabel):
    if title:
        ax.set_title(title, fontsize=14, fontweight="bold", pad=12)
    if xlabel:
        ax.set_xlabel(xlabel, fontsize=11)
    if ylabel:
        ax.set_ylabel(ylabel, fontsize=11)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", alpha=0.3, linestyle="--")


def main():
    parser = argparse.ArgumentParser(description="Render a chart from a CSV")
    parser.add_argument("--workspace", required=True)
    parser.add_argument("--data", required=True, help="CSV path relative to workspace")
    parser.add_argument(
        "--type",
        required=True,
        choices=["bar", "barh", "line", "scatter", "pie", "heatmap"],
    )
    parser.add_argument("--x", default=None, help="X-axis column")
    parser.add_argument("--y", default=None, help="Y-axis column(s), comma-separated")
    parser.add_argument("--title", default="")
    parser.add_argument("--xlabel", default=None)
    parser.add_argument("--ylabel", default=None)
    parser.add_argument("--top", type=int, default=None, help="Keep top N rows by --y")
    parser.add_argument("--output", required=True, help="Output PNG relative to workspace")
    args = parser.parse_args()

    data_path = os.path.join(args.workspace, args.data)
    if not os.path.exists(data_path):
        print(f"ERROR: Data file not found at {data_path}")
        sys.exit(1)

    df = pd.read_csv(data_path)
    df.columns = df.columns.astype(str).str.strip()
    x_col = args.x.strip() if args.x else None
    y_cols = [c.strip() for c in args.y.split(",")] if args.y else []

    # Clean numeric columns
    for col in y_cols:
        if col in df.columns and df[col].dtype == object:
            df[col] = pd.to_numeric(
                df[col].astype(str).str.replace(r"[,$£€%\s]", "", regex=True),
                errors="coerce"
            )

    if args.top and y_cols and y_cols[0] in df.columns:
        df = df.sort_values(y_cols[0], ascending=False).head(args.top)

    out_path = os.path.join(args.workspace, args.output)
    os.makedirs(os.path.dirname(out_path), exist_ok=True)

    plt.rcParams.update({"figure.autolayout": True, "font.size": 11})
    fig, ax = plt.subplots(figsize=(9, 5.2), dpi=130)

    try:
        if args.type == "bar":
            x_series = df[x_col].astype(str) if x_col and x_col in df.columns else df.iloc[:, 0].astype(str)
            y_series = df[y_cols[0]].fillna(0) if y_cols and y_cols[0] in df.columns else df.iloc[:, 1].fillna(0)
            ax.bar(x_series, y_series, color=PALETTE[0])
            plt.xticks(rotation=45, ha="right")
            style_axes(ax, args.title, args.xlabel or x_col or "Category", args.ylabel or (y_cols[0] if y_cols else "Value"))

        elif args.type == "barh":
            df_plot = df.iloc[::-1]  # largest on top
            x_series = df_plot[x_col].astype(str) if x_col and x_col in df_plot.columns else df_plot.iloc[:, 0].astype(str)
            y_series = df_plot[y_cols[0]].fillna(0) if y_cols and y_cols[0] in df_plot.columns else df_plot.iloc[:, 1].fillna(0)
            ax.barh(x_series, y_series, color=PALETTE[1])
            style_axes(ax, args.title, args.xlabel or (y_cols[0] if y_cols else "Value"), args.ylabel or x_col or "Category")
            ax.grid(axis="x", alpha=0.3, linestyle="--")

        elif args.type == "line":
            x_series = df[x_col] if x_col and x_col in df.columns else df.iloc[:, 0]
            valid_y_cols = [c for c in y_cols if c in df.columns]
            if not valid_y_cols and len(df.columns) > 1:
                valid_y_cols = [df.columns[1]]
            for i, col in enumerate(valid_y_cols):
                ax.plot(
                    x_series, df[col].fillna(0), marker="o", markersize=4,
                    linewidth=2, color=PALETTE[i % len(PALETTE)], label=col,
                )
            plt.xticks(rotation=45, ha="right")
            style_axes(ax, args.title, args.xlabel or x_col or "Index", args.ylabel or (valid_y_cols[0] if len(valid_y_cols) == 1 else "Value"))
            if len(valid_y_cols) > 1:
                ax.legend(frameon=False)

        elif args.type == "scatter":
            x_series = pd.to_numeric(df[x_col], errors="coerce").fillna(0) if x_col and x_col in df.columns else df.iloc[:, 0]
            y_series = df[y_cols[0]].fillna(0) if y_cols and y_cols[0] in df.columns else df.iloc[:, 1].fillna(0)
            ax.scatter(x_series, y_series, color=PALETTE[5], alpha=0.6, edgecolors="white")
            style_axes(ax, args.title, args.xlabel or x_col or "X", args.ylabel or (y_cols[0] if y_cols else "Y"))

        elif args.type == "pie":
            labels = df[x_col].astype(str) if x_col and x_col in df.columns else df.iloc[:, 0].astype(str)
            values = df[y_cols[0]].fillna(0) if y_cols and y_cols[0] in df.columns else df.iloc[:, 1].fillna(0)
            # Filter positive values
            positive_mask = values > 0
            if positive_mask.any():
                labels = labels[positive_mask]
                values = values[positive_mask]
            ax.pie(
                values, labels=labels, autopct="%1.1f%%", startangle=90,
                colors=PALETTE, wedgeprops={"edgecolor": "white"},
            )
            ax.axis("equal")
            if args.title:
                ax.set_title(args.title, fontsize=14, fontweight="bold", pad=12)

        elif args.type == "heatmap":
            matrix = df.set_index(df.columns[0])
            matrix = matrix.apply(pd.to_numeric, errors="coerce").fillna(0)
            im = ax.imshow(matrix.values, cmap="viridis", aspect="auto")
            ax.set_xticks(range(len(matrix.columns)))
            ax.set_xticklabels(matrix.columns, rotation=45, ha="right")
            ax.set_yticks(range(len(matrix.index)))
            ax.set_yticklabels(matrix.index)
            fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
            if args.title:
                ax.set_title(args.title, fontsize=14, fontweight="bold", pad=12)

        fig.savefig(out_path, bbox_inches="tight", facecolor="white")
        plt.close(fig)
        print(f"Chart saved to {out_path}")
    except Exception as e:  # noqa: BLE001
        plt.close(fig)
        print(f"ERROR: Failed to render chart: {e}")
        # Return 0 so chart failures do not crash analysis pipelines
        sys.exit(0)


if __name__ == "__main__":
    main()
