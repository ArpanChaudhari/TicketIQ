from __future__ import annotations

import json
from typing import Any

import pandas as pd
import streamlit as st

from app.anomaly_detector import detect_anomalies
from app.data_loader import get_dataframe


st.set_page_config(
    page_title="TicketIQ | AI Support Analyzer",
    page_icon="TQ",
    layout="wide",
    initial_sidebar_state="expanded",
)


EXAMPLE_QUESTIONS = [
    "Show me all Critical tickets not resolved within 12 hours.",
    "How many tickets are currently Open?",
    "Show me all High-priority tickets.",
    "Which category has the most support tickets?",
    "Show me tickets with customer ratings below 3.",
    "Which agents have the highest number of unresolved tickets?",
]


def inject_styles() -> None:
    st.markdown(
        """
        <style>
        :root {
          --primary: #2563eb;
          --primary-hover: #1d4ed8;
          --primary-soft: #eaf2ff;
          --background: #f5f7fb;
          --surface: #ffffff;
          --surface-soft: #f8fafc;
          --text: #172033;
          --muted: #64748b;
          --border: #dbe3ef;
          --border-strong: #c7d3e3;
          --sidebar: #edf2fa;
          --shadow-sm: 0 1px 2px rgba(15, 23, 42, 0.04);
          --shadow-md: 0 8px 28px rgba(15, 23, 42, 0.07);
          --radius: 12px;
        }

        .stApp {
          background: var(--background);
          color: var(--text);
        }

        div[data-testid="stDecoration"],
        #MainMenu,
        footer {
          display: none !important;
        }

        div[data-testid="stToolbar"] {
          display: flex !important;
          position: fixed !important;
          top: 14px !important;
          left: 14px !important;
          width: 42px !important;
          height: 42px !important;
          background: transparent !important;
          pointer-events: none !important;
          z-index: 999999 !important;
        }

        div[data-testid="stToolbarActions"],
        div[data-testid="stAppDeployButton"],
        span[data-testid="stMainMenu"],
        div[data-testid="stToolbar"] button:not([data-testid="stExpandSidebarButton"]) {
          display: none !important;
        }

        header[data-testid="stHeader"] {
          background: transparent !important;
          height: 0 !important;
          pointer-events: none;
        }

        header[data-testid="stHeader"] [data-testid="collapsedControl"],
        button[data-testid="stExpandSidebarButton"] {
          display: flex !important;
          position: fixed !important;
          top: 14px !important;
          left: 14px !important;
          width: 42px !important;
          height: 42px !important;
          z-index: 999999 !important;
          pointer-events: auto !important;
        }

        [data-testid="collapsedControl"] button,
        button[data-testid="stExpandSidebarButton"] {
          width: 42px !important;
          height: 42px !important;
          border: 1px solid var(--border-strong) !important;
          border-radius: 9px !important;
          background: #ffffff !important;
          color: var(--text) !important;
          box-shadow: var(--shadow-sm) !important;
        }

        button[data-testid="stExpandSidebarButton"] span,
        [data-testid="collapsedControl"] button span {
          color: var(--text) !important;
          fill: var(--text) !important;
          opacity: 1 !important;
        }

        section.main > div {
          padding-top: 0 !important;
        }

        [data-testid="stSidebar"] {
          background: var(--sidebar);
          border-right: 1px solid var(--border-strong);
        }

        [data-testid="stSidebar"] > div:first-child {
          padding-top: 24px;
        }

        .block-container {
          padding-top: 36px;
          padding-bottom: 56px;
          max-width: 1400px;
        }

        h1, h2, h3 {
          color: #111827;
          letter-spacing: 0;
        }

        h1 {
          font-size: 42px !important;
          line-height: 1.12 !important;
          margin-bottom: 8px !important;
        }

        h2 {
          font-size: 21px !important;
        }

        .brand {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 4px 4px 22px;
          margin-bottom: 22px;
          border-bottom: 1px solid var(--border-strong);
        }

        .brand-fallback {
          width: 46px;
          height: 46px;
          display: grid;
          place-items: center;
          border-radius: 10px;
          background: var(--primary);
          color: #fff;
          font-weight: 800;
          font-size: 18px;
        }

        .brand-name {
          font-size: 20px;
          font-weight: 800;
          line-height: 1.15;
          color: var(--text);
        }

        .brand-sub {
          font-size: 11px;
          color: #5b6b82;
          margin-top: 4px;
        }

        .sidebar-label {
          font-size: 10px;
          letter-spacing: 0.1em;
          text-transform: uppercase;
          font-weight: 800;
          color: var(--muted);
          margin: 8px 0 10px;
        }

        [data-testid="stSidebar"] p,
        [data-testid="stSidebar"] span,
        [data-testid="stSidebar"] label,
        [data-testid="stSidebar"] div {
          color: #475569;
        }

        [data-testid="stSidebar"] [role="radiogroup"] label {
          border-radius: 9px;
          padding: 6px 8px;
          margin-bottom: 3px;
        }

        [data-testid="stSidebar"] [role="radiogroup"] label:hover {
          background: rgba(255, 255, 255, 0.55);
        }

        [data-testid="stSidebar"] [role="radiogroup"] label p {
          color: #334155 !important;
          font-weight: 650;
        }

        [data-testid="stSidebar"] [role="radiogroup"] svg {
          color: #ef4444;
          fill: currentColor;
        }

        [data-testid="stSidebar"] .brand-name,
        [data-testid="stSidebar"] .brand-fallback {
          color: #ffffff !important;
        }

        [data-testid="stSidebar"] .brand-name {
          color: var(--text) !important;
        }

        [data-testid="stSidebar"] .sidebar-label {
          color: var(--muted) !important;
        }

        .sidebar-footer {
          margin-top: 28px;
          padding: 22px 4px 0;
          border-top: 1px solid var(--border-strong);
          font-size: 12px;
          font-weight: 700;
          color: #475569;
        }

        .sidebar-footer span {
          display: block;
          font-weight: 400;
          color: var(--muted);
          margin-top: 4px;
        }

        .eyebrow {
          font-size: 11px;
          color: var(--primary);
          font-weight: 800;
          letter-spacing: 0.1em;
          margin-bottom: 9px;
        }

        .page-copy {
          max-width: 760px;
          color: var(--muted);
          font-size: 15px;
          line-height: 1.65;
          margin: 0 0 24px;
        }

        .panel {
          background: var(--surface);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 24px;
          box-shadow: var(--shadow-sm);
          margin-bottom: 22px;
        }

        .section-copy {
          color: var(--muted);
          font-size: 13px;
          line-height: 1.55;
          margin: 7px 0 18px;
        }

        .metric-card {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 20px 22px;
          min-height: 118px;
          box-shadow: var(--shadow-sm);
        }

        .metric-kicker {
          color: var(--primary);
          font-size: 10px;
          font-weight: 800;
          text-transform: uppercase;
          letter-spacing: 0.08em;
          margin-bottom: 12px;
        }

        .metric-label {
          color: var(--muted);
          font-size: 12px;
          font-weight: 650;
        }

        .metric-value {
          font-size: 32px;
          font-weight: 800;
          margin-top: 12px;
          line-height: 1.1;
        }

        .count-card {
          background: #fff;
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 20px;
          min-height: 125px;
          box-shadow: var(--shadow-sm);
          overflow-wrap: anywhere;
        }

        .count-card:hover {
          border-color: #9bb9f1;
          box-shadow: var(--shadow-md);
        }

        .card-kicker {
          font-size: 10px;
          color: var(--primary);
          font-weight: 800;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 14px;
        }

        .card-label {
          font-size: 13px;
          color: var(--muted);
          font-weight: 650;
          min-height: 36px;
        }

        .card-count {
          font-size: 29px;
          font-weight: 800;
          margin-top: 9px;
        }

        .answer-box {
          background: var(--primary-soft);
          border-left: 3px solid var(--primary);
          border-radius: 0 9px 9px 0;
          padding: 16px 18px;
          line-height: 1.7;
          white-space: pre-wrap;
          overflow-wrap: anywhere;
          margin-top: 8px;
        }

        .small-muted {
          color: var(--muted);
          font-size: 11px;
          line-height: 1.5;
        }

        .stButton > button,
        .stDownloadButton > button {
          min-height: 42px;
          border: 1px solid var(--border-strong);
          border-radius: 9px;
          background: #fff;
          color: #334155;
          font-size: 13px;
          font-weight: 650;
          box-shadow: var(--shadow-sm);
          transition: 0.15s;
        }

        .stButton > button:hover,
        .stDownloadButton > button:hover {
          border-color: var(--primary);
          background: var(--primary-soft);
          color: var(--primary-hover);
        }

        .stButton > button[kind="primary"] {
          background: var(--primary);
          border-color: var(--primary);
          color: #fff;
        }

        .stButton > button[kind="primary"]:hover {
          background: var(--primary-hover);
          color: #fff;
        }

        div[data-testid="stTextAreaRootElement"],
        div[data-testid="stTextAreaRootElement"] > div,
        div[data-testid="stTextAreaRootElement"] textarea,
        div[data-testid="stTextArea"] textarea,
        div[data-testid="stSelectbox"] div[data-baseweb="select"] {
          border-radius: 10px;
          background: #ffffff !important;
          color: var(--text) !important;
          border-color: var(--border-strong) !important;
        }

        div[data-testid="stTextArea"] textarea::placeholder {
          color: #8290a5 !important;
        }

        div[data-testid="stTextArea"] label,
        div[data-testid="stSelectbox"] label {
          color: #475569 !important;
        }

        [data-testid="stDataFrame"] {
          border: 1px solid var(--border);
          border-radius: 10px;
          overflow: hidden;
          box-shadow: var(--shadow-sm);
        }

        @media (max-width: 760px) {
          .block-container {
            padding-left: 16px;
            padding-right: 16px;
          }

          h1 {
            font-size: 31px !important;
          }
        }
        </style>
        """,
        unsafe_allow_html=True,
    )


@st.cache_data(show_spinner=False)
def load_tickets() -> pd.DataFrame:
    return get_dataframe()


@st.cache_data(show_spinner=False)
def load_anomalies() -> pd.DataFrame:
    return pd.DataFrame(detect_anomalies())


def clear_cached_data() -> None:
    load_tickets.clear()
    load_anomalies.clear()


def page_heading(eyebrow: str, title: str, copy: str) -> None:
    st.markdown(
        f"""
        <div class="eyebrow">{eyebrow}</div>
        <h1>{title}</h1>
        <p class="page-copy">{copy}</p>
        """,
        unsafe_allow_html=True,
    )


def metric_card(kicker: str, label: str, value: Any) -> str:
    return f"""
    <div class="metric-card">
      <div class="metric-kicker">{kicker}</div>
      <div class="metric-label">{label}</div>
      <div class="metric-value">{value}</div>
    </div>
    """


def count_card(label: str, count: int, kicker: str = "Signal group") -> str:
    return f"""
    <div class="count-card">
      <div class="card-kicker">{kicker}</div>
      <div class="card-label">{label}</div>
      <div class="card-count">{count:,}</div>
    </div>
    """


def dataframe_download(dataframe: pd.DataFrame, label: str, filename: str) -> None:
    csv = dataframe.to_csv(index=False).encode("utf-8")
    st.download_button(
        label,
        data=csv,
        file_name=filename,
        mime="text/csv",
        width="content",
    )


def render_answer(answer: Any) -> None:
    if isinstance(answer, list):
        result_df = pd.DataFrame(answer)
        st.caption(f"{len(result_df):,} rows")
        st.dataframe(result_df, width="stretch", hide_index=True)
        if not result_df.empty:
            dataframe_download(result_df, "Download query results", "ticketiq_query_results.csv")
        return

    if isinstance(answer, dict):
        nested_table = None
        for key in ["tickets", "data", "results", "records", "rows"]:
            if isinstance(answer.get(key), list):
                nested_table = pd.DataFrame(answer[key])
                break

        if nested_table is not None:
            st.caption(f"{len(nested_table):,} rows")
            st.dataframe(nested_table, width="stretch", hide_index=True)
            if not nested_table.empty:
                dataframe_download(nested_table, "Download query results", "ticketiq_query_results.csv")
        else:
            st.json(answer)
        return

    st.markdown(
        f'<div class="answer-box">{str(answer)}</div>',
        unsafe_allow_html=True,
    )


def render_sidebar(ticket_count: int) -> str:
    with st.sidebar:
        st.markdown(
            """
            <div class="brand">
              <div class="brand-fallback">TQ</div>
              <div>
                <div class="brand-name">TicketIQ</div>
                <div class="brand-sub">AI Support Ticket Analyzer</div>
              </div>
            </div>
            """,
            unsafe_allow_html=True,
        )

        st.markdown('<div class="sidebar-label">Workspace</div>', unsafe_allow_html=True)
        page = st.radio(
            "Workspace",
            ["Ask TicketIQ", "Anomaly Dashboard", "Data Explorer"],
            label_visibility="collapsed",
        )

        st.markdown('<div class="sidebar-label">API connection</div>', unsafe_allow_html=True)
        if st.button("Refresh connection & data", width="stretch"):
            clear_cached_data()
            st.success("Data refreshed.")

        st.markdown(
            f"""
            <div class="small-muted">
              <strong style="color:#15803d;">Connected</strong><br>
              {ticket_count:,} tickets available
            </div>
            <div class="sidebar-footer">
              TicketIQ <span>Support intelligence</span>
            </div>
            """,
            unsafe_allow_html=True,
        )

    return page


def ask_page() -> None:
    page_heading(
        "AI WORKSPACE",
        "Ask your tickets",
        "Explore support activity in plain language and turn questions into useful answers.",
    )

    st.markdown(
        """
        <div class="panel">
          <h2>What would you like to know?</h2>
          <p class="section-copy">Ask about priorities, response times, categories, ratings, or agent workloads.</p>
        </div>
        """,
        unsafe_allow_html=True,
    )

    if "pending_question" in st.session_state:
        st.session_state.question_input = st.session_state.pop("pending_question")

    question = st.text_area(
        "Your question",
        key="question_input",
        placeholder="Example: Show me unresolved critical tickets older than 12 hours...",
        height=150,
        label_visibility="collapsed",
    )

    left, right = st.columns([1, 0.24])
    with left:
        st.markdown(
            '<div class="small-muted">TicketIQ will analyze the latest data returned by your Python backend.</div>',
            unsafe_allow_html=True,
        )
    with right:
        ask_clicked = st.button("Ask TicketIQ", type="primary", width="stretch")

    if ask_clicked:
        if not question.strip():
            st.error("Enter a question before asking TicketIQ.")
        else:
            with st.spinner("Analyzing your tickets..."):
                from app.llm_engine import ask_question

                st.session_state.query_result = ask_question(question)
                st.session_state.query_question = question
            st.success("Analysis complete.")

    st.markdown("## Try an example")
    st.caption("Choose a prompt to place it in the question box.")
    example_cols = st.columns(2)
    for index, example in enumerate(EXAMPLE_QUESTIONS):
        with example_cols[index % 2]:
            if st.button(example, key=f"example_{index}", width="stretch"):
                st.session_state.pending_question = example
                st.rerun()

    if "query_result" in st.session_state:
        st.markdown("## TicketIQ answer")
        st.caption("Results from your latest question.")
        render_answer(st.session_state.query_result)


def anomaly_page() -> None:
    page_heading(
        "OPERATIONS MONITOR",
        "Anomaly intelligence",
        "Spot unusual patterns and focus the team on tickets that need attention.",
    )

    if st.button("Refresh anomalies"):
        load_anomalies.clear()
        st.rerun()

    anomalies_df = load_anomalies()
    total_count = len(anomalies_df)
    critical_count = 0
    if not anomalies_df.empty and "severity" in anomalies_df:
        critical_count = int((anomalies_df["severity"] == "Critical").sum())

    col1, col2 = st.columns(2)
    with col1:
        st.markdown(metric_card("All signals", "Total anomalies", f"{total_count:,}"), unsafe_allow_html=True)
    with col2:
        st.markdown(metric_card("Needs attention", "Critical anomalies", f"{critical_count:,}"), unsafe_allow_html=True)

    if anomalies_df.empty:
        st.info("No anomalies were returned by the detector.")
        return

    st.markdown("## Anomalies by type")
    st.caption("A quick view of the most frequent signal groups.")
    type_counts = anomalies_df["anomaly_type"].value_counts()
    type_cols = st.columns(4)
    for index, (label, count) in enumerate(type_counts.items()):
        with type_cols[index % 4]:
            st.markdown(count_card(label, int(count)), unsafe_allow_html=True)

    with st.expander("View complete type breakdown"):
        st.dataframe(
            type_counts.rename_axis("anomaly_type").reset_index(name="count"),
            width="stretch",
            hide_index=True,
        )

    st.markdown("## Anomalies by severity")
    st.caption("Review how detected signals are distributed by urgency.")
    severity_counts = anomalies_df["severity"].value_counts()
    severity_cols = st.columns(4)
    for index, (label, count) in enumerate(severity_counts.items()):
        with severity_cols[index % 4]:
            st.markdown(count_card(label, int(count), "Urgency"), unsafe_allow_html=True)

    with st.expander("View complete severity breakdown"):
        st.dataframe(
            severity_counts.rename_axis("severity").reset_index(name="count"),
            width="stretch",
            hide_index=True,
        )

    st.markdown("## Explore anomalies")
    st.caption("Choose either filter to inspect matching records.")

    filter_col1, filter_col2 = st.columns(2)
    with filter_col1:
        anomaly_type = st.selectbox(
            "Anomaly type",
            ["All types"] + sorted(anomalies_df["anomaly_type"].dropna().unique().tolist()),
        )
    with filter_col2:
        severity = st.selectbox(
            "Severity",
            ["All severities"] + sorted(anomalies_df["severity"].dropna().unique().tolist()),
        )

    filtered_df = anomalies_df.copy()
    if anomaly_type != "All types":
        filtered_df = filtered_df[filtered_df["anomaly_type"] == anomaly_type]
    if severity != "All severities":
        filtered_df = filtered_df[filtered_df["severity"] == severity]

    if anomaly_type == "All types" and severity == "All severities":
        st.info("Choose an anomaly type or severity to display matching records.")
    else:
        st.caption(f"{len(filtered_df):,} matching anomalies")
        st.dataframe(filtered_df, width="stretch", hide_index=True)
        if not filtered_df.empty:
            dataframe_download(filtered_df, "Download filtered anomalies", "ticketiq_filtered_anomalies.csv")


def explorer_page(df: pd.DataFrame) -> None:
    page_heading(
        "DATA WORKSPACE",
        "Ticket explorer",
        "Browse, filter, and export the support ticket dataset returned by your data loader.",
    )

    if st.button("Refresh tickets"):
        load_tickets.clear()
        st.rerun()

    st.markdown(metric_card("Current dataset", "Total tickets", f"{len(df):,}"), unsafe_allow_html=True)

    st.markdown("## Filter tickets")
    st.caption("Narrow the dataset by category, priority, or status.")

    filter_col1, filter_col2, filter_col3 = st.columns(3)
    with filter_col1:
        category = st.selectbox("Category", ["All"] + sorted(df["category"].dropna().unique().tolist()))
    with filter_col2:
        priority = st.selectbox("Priority", ["All"] + sorted(df["priority"].dropna().unique().tolist()))
    with filter_col3:
        status = st.selectbox("Status", ["All"] + sorted(df["status"].dropna().unique().tolist()))

    filtered_df = df.copy()
    if category != "All":
        filtered_df = filtered_df[filtered_df["category"] == category]
    if priority != "All":
        filtered_df = filtered_df[filtered_df["priority"] == priority]
    if status != "All":
        filtered_df = filtered_df[filtered_df["status"] == status]

    st.markdown("## Tickets")
    st.caption(f"{len(filtered_df):,} shown")
    st.dataframe(filtered_df, width="stretch", hide_index=True)
    if not filtered_df.empty:
        dataframe_download(filtered_df, "Download filtered tickets", "ticketiq_filtered_tickets.csv")


def main() -> None:
    inject_styles()
    df = load_tickets()
    page = render_sidebar(len(df))

    if page == "Ask TicketIQ":
        ask_page()
    elif page == "Anomaly Dashboard":
        anomaly_page()
    else:
        explorer_page(df)


if __name__ == "__main__":
    main()
