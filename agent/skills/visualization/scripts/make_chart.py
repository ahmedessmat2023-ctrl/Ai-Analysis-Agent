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

THEME_CONFIGS = {
    "light": {
        "bg_color": "#FFFFFF",
        "card_bg": "#FFFFFF",
        "text_primary": "#0F172A",
        "text_secondary": "#475569",
        "grid_color": "#E2E8F0",
        "spine_color": "#CBD5E1",
        "pie_edge": "#FFFFFF",
        "scatter_edge": "#FFFFFF",
        "heatmap_cmap": "viridis",
        "palette": [
            "#4338CA", "#0284C7", "#059669", "#D97706", "#DC2626",
            "#7C3AED", "#DB2777", "#0D9488", "#EA580C", "#2563EB",
        ],
    },
    "dark": {
        "bg_color": "#0F172A",
        "card_bg": "#1E293B",
        "text_primary": "#F8FAFC",
        "text_secondary": "#94A3B8",
        "grid_color": "#334155",
        "spine_color": "#475569",
        "pie_edge": "#0F172A",
        "scatter_edge": "#0F172A",
        "heatmap_cmap": "magma",
        "palette": [
            "#818CF8", "#38BDF8", "#34D399", "#FBBF24", "#F87171",
            "#C084FC", "#F472B6", "#2DD4BF", "#FB923C", "#60A5FA",
        ],
    },
}


def style_axes(ax, title, xlabel, ylabel, theme_cfg):
    text_primary = theme_cfg["text_primary"]
    text_secondary = theme_cfg["text_secondary"]
    grid_color = theme_cfg["grid_color"]
    spine_color = theme_cfg["spine_color"]

    ax.set_facecolor(theme_cfg["card_bg"])

    if title:
        ax.set_title(title, fontsize=14, fontweight="bold", pad=12, color=text_primary)
    if xlabel:
        ax.set_xlabel(xlabel, fontsize=11, fontweight="medium", color=text_secondary)
    if ylabel:
        ax.set_ylabel(ylabel, fontsize=11, fontweight="medium", color=text_secondary)

    ax.tick_params(colors=text_secondary, which="both", labelsize=9.5)
    for spine in ax.spines.values():
        spine.set_color(spine_color)
    ax.spines["top"].set_visible(False)
    ax.spines["right"].set_visible(False)
    ax.grid(axis="y", color=grid_color, alpha=0.6, linestyle="--", linewidth=0.8)


def format_data_label(val):
    """Format numeric data values cleanly for on-chart data labels."""
    if pd.isna(val):
        return ""
    try:
        num = float(val)
        abs_num = abs(num)
        if abs_num >= 1_000_000_000:
            return f"{num/1_000_000_000:.2f}B".rstrip("0").rstrip(".") + "B"
        if abs_num >= 1_000_000:
            return f"{num/1_000_000:.2f}M".rstrip("0").rstrip(".") + "M"
        if abs_num >= 10_000:
            return f"{num/1_000:.1f}k"
        if num == int(num):
            return f"{int(num):,}"
        return f"{num:,.2f}".rstrip("0").rstrip(".")
    except Exception:
        return str(val)


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
    parser.add_argument(
        "--show-values",
        "--show_values",
        dest="show_values",
        action="store_true",
        default=False,
        help="Display data values directly on the bars or lines for improved readability",
    )
    parser.add_argument(
        "--theme",
        default="light",
        choices=["light", "dark"],
        help="Visual theme ('light' or 'dark') for high-contrast presentation",
    )
    parser.add_argument("--output", required=True, help="Output PNG relative to workspace")
    args = parser.parse_args()

    theme_cfg = THEME_CONFIGS.get(args.theme, THEME_CONFIGS["light"])
    palette = theme_cfg["palette"]

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

    plt.rcParams.update({
        "figure.autolayout": True,
        "font.size": 11,
        "text.color": theme_cfg["text_primary"],
        "axes.labelcolor": theme_cfg["text_secondary"],
        "xtick.color": theme_cfg["text_secondary"],
        "ytick.color": theme_cfg["text_secondary"],
    })
    fig, ax = plt.subplots(figsize=(9, 5.2), dpi=130, facecolor=theme_cfg["bg_color"])

    try:
        if args.type == "bar":
            x_series = df[x_col].astype(str) if x_col and x_col in df.columns else df.iloc[:, 0].astype(str)
            y_series = df[y_cols[0]].fillna(0) if y_cols and y_cols[0] in df.columns else df.iloc[:, 1].fillna(0)
            bars = ax.bar(x_series, y_series, color=palette[0], edgecolor=theme_cfg["pie_edge"], linewidth=0.5)
            if args.show_values:
                labels = [format_data_label(v) for v in y_series]
                ax.bar_label(
                    bars,
                    labels=labels,
                    padding=3,
                    color=theme_cfg["text_primary"],
                    fontsize=8.5,
                    fontweight="bold",
                )
            plt.xticks(rotation=45, ha="right")
            style_axes(ax, args.title, args.xlabel or x_col or "Category", args.ylabel or (y_cols[0] if y_cols else "Value"), theme_cfg)

        elif args.type == "barh":
            df_plot = df.iloc[::-1]  # largest on top
            x_series = df_plot[x_col].astype(str) if x_col and x_col in df_plot.columns else df_plot.iloc[:, 0].astype(str)
            y_series = df_plot[y_cols[0]].fillna(0) if y_cols and y_cols[0] in df_plot.columns else df_plot.iloc[:, 1].fillna(0)
            bars = ax.barh(x_series, y_series, color=palette[1], edgecolor=theme_cfg["pie_edge"], linewidth=0.5)
            if args.show_values:
                labels = [format_data_label(v) for v in y_series]
                ax.bar_label(
                    bars,
                    labels=labels,
                    padding=4,
                    color=theme_cfg["text_primary"],
                    fontsize=8.5,
                    fontweight="bold",
                )
            style_axes(ax, args.title, args.xlabel or (y_cols[0] if y_cols else "Value"), args.ylabel or x_col or "Category", theme_cfg)
            ax.grid(axis="x", color=theme_cfg["grid_color"], alpha=0.6, linestyle="--", linewidth=0.8)

        elif args.type == "line":
            x_series = df[x_col] if x_col and x_col in df.columns else df.iloc[:, 0]
            valid_y_cols = [c for c in y_cols if c in df.columns]
            if not valid_y_cols and len(df.columns) > 1:
                valid_y_cols = [df.columns[1]]
            for i, col in enumerate(valid_y_cols):
                y_vals = df[col].fillna(0)
                ax.plot(
                    x_series, y_vals, marker="o", markersize=4.5,
                    linewidth=2.2, color=palette[i % len(palette)], label=col,
                )
                if args.show_values:
                    for x_idx, (x_val, y_val) in enumerate(zip(x_series, y_vals)):
                        lbl = format_data_label(y_val)
                        ax.annotate(
                            lbl,
                            (x_idx, y_val),
                            textcoords="offset points",
                            xytext=(0, 6),
                            ha="center",
                            va="bottom",
                            fontsize=8,
                            fontweight="bold",
                            color=theme_cfg["text_primary"],
                            bbox=dict(
                                boxstyle="round,pad=0.18",
                                facecolor=theme_cfg["card_bg"],
                                edgecolor=theme_cfg["spine_color"],
                                alpha=0.9,
                                linewidth=0.5,
                            ),
                        )
            plt.xticks(rotation=45, ha="right")
            style_axes(ax, args.title, args.xlabel or x_col or "Index", args.ylabel or (valid_y_cols[0] if len(valid_y_cols) == 1 else "Value"), theme_cfg)
            if len(valid_y_cols) > 1:
                leg = ax.legend(frameon=True, facecolor=theme_cfg["card_bg"], edgecolor=theme_cfg["spine_color"])
                for text in leg.get_texts():
                    text.set_color(theme_cfg["text_primary"])

        elif args.type == "scatter":
            x_series = pd.to_numeric(df[x_col], errors="coerce").fillna(0) if x_col and x_col in df.columns else df.iloc[:, 0]
            y_series = df[y_cols[0]].fillna(0) if y_cols and y_cols[0] in df.columns else df.iloc[:, 1].fillna(0)
            ax.scatter(x_series, y_series, color=palette[5], alpha=0.8, edgecolors=theme_cfg["scatter_edge"], s=45)
            if args.show_values:
                for x_val, y_val in zip(x_series, y_series):
                    ax.annotate(
                        format_data_label(y_val),
                        (x_val, y_val),
                        textcoords="offset points",
                        xytext=(0, 5),
                        ha="center",
                        va="bottom",
                        fontsize=7.5,
                        color=theme_cfg["text_primary"],
                    )
            style_axes(ax, args.title, args.xlabel or x_col or "X", args.ylabel or (y_cols[0] if y_cols else "Y"), theme_cfg)

        elif args.type == "pie":
            labels = df[x_col].astype(str) if x_col and x_col in df.columns else df.iloc[:, 0].astype(str)
            values = df[y_cols[0]].fillna(0) if y_cols and y_cols[0] in df.columns else df.iloc[:, 1].fillna(0)
            positive_mask = values > 0
            if positive_mask.any():
                labels = labels[positive_mask]
                values = values[positive_mask]
            wedges, texts, autotexts = ax.pie(
                values, labels=labels, autopct="%1.1f%%", startangle=90,
                colors=palette, wedgeprops={"edgecolor": theme_cfg["pie_edge"], "linewidth": 1.2},
            )
            for t in texts:
                t.set_color(theme_cfg["text_primary"])
                t.set_fontsize(10)
            for at in autotexts:
                at.set_color(theme_cfg["text_primary"] if args.theme == "dark" else "#FFFFFF")
                at.set_fontweight("bold")
                at.set_fontsize(9.5)
            ax.axis("equal")
            if args.title:
                ax.set_title(args.title, fontsize=14, fontweight="bold", pad=12, color=theme_cfg["text_primary"])

        elif args.type == "heatmap":
            matrix = df.set_index(df.columns[0])
            matrix = matrix.apply(pd.to_numeric, errors="coerce").fillna(0)
            im = ax.imshow(matrix.values, cmap=theme_cfg["heatmap_cmap"], aspect="auto")
            ax.set_xticks(range(len(matrix.columns)))
            ax.set_xticklabels(matrix.columns, rotation=45, ha="right", color=theme_cfg["text_secondary"])
            ax.set_yticks(range(len(matrix.index)))
            ax.set_yticklabels(matrix.index, color=theme_cfg["text_secondary"])
            cbar = fig.colorbar(im, ax=ax, fraction=0.046, pad=0.04)
            cbar.ax.tick_params(colors=theme_cfg["text_secondary"])
            cbar.outline.set_edgecolor(theme_cfg["spine_color"])
            if args.title:
                ax.set_title(args.title, fontsize=14, fontweight="bold", pad=12, color=theme_cfg["text_primary"])

        fig.savefig(out_path, bbox_inches="tight", facecolor=theme_cfg["bg_color"], edgecolor="none")
        plt.close(fig)
        print(f"Chart saved to {out_path} (theme: {args.theme})")
    except Exception as e:  # noqa: BLE001
        plt.close(fig)
        print(f"ERROR: Failed to render chart: {e}")
        sys.exit(0)


if __name__ == "__main__":
    main()
