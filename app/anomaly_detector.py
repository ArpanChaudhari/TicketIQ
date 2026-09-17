from app.data_loader import get_dataframe


def detect_anomalies() -> list[dict]:
    """Scan the ticket dataset and return a list of anomaly dicts."""
    df = get_dataframe()
    anomalies = []

    # Use latest ticket date as "now" since this is a historical dataset (Jan-Mar 2024)
    # In production, replace with datetime.now()
    mock_now = df["created_at"].max()

    # Rule 1: Escalated tickets are inherently anomalous
    escalated = df[df["status"] == "Escalated"]
    for _, row in escalated.iterrows():
        anomalies.append({
            "ticket_id": row["ticket_id"],
            "anomaly_type": "Escalated Ticket",
            "severity": "High",
            "description": "This ticket has been escalated.",
        })

    # Rule 2: Open High/Critical tickets sitting unresolved > 24 hours
    open_critical = df[
        (df["status"] == "Open") & (df["priority"].isin(["High", "Critical"]))
    ]
    for _, row in open_critical.iterrows():
        age_hours = (mock_now - row["created_at"]).total_seconds() / 3600
        if age_hours > 24.0:
            anomalies.append({
                "ticket_id": row["ticket_id"],
                "anomaly_type": f"Overdue {row['priority']}-Priority Ticket",
                "severity": "Critical",
                "description": f"{row['priority']} priority, open for {age_hours:.1f} hrs.",
            })

    # Rules 3 & 4: IQR-based statistical outliers
    def flag_iqr_outliers(col, label, severity):
        q1, q3 = df[col].quantile(0.25), df[col].quantile(0.75)
        upper = q3 + 1.5 * (q3 - q1)
        for _, row in df[df[col] > upper].iterrows():
            anomalies.append({
                "ticket_id": row["ticket_id"],
                "anomaly_type": f"Outlier: {label}",
                "severity": severity,
                "description": f"{label} is {row[col]:.1f} hrs (threshold: {upper:.1f})",
            })

    flag_iqr_outliers("resolution_time_hrs", "Resolution Time", "Medium")
    flag_iqr_outliers("response_time_hrs", "Response Time", "Medium")

    return anomalies