from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from datetime import datetime
from typing import Any

from app.llm_engine import ask_question
from app.anomaly_detector import detect_anomalies
from app.data_loader import get_dataframe

# Pydantic Models (request/response schemas)
class QueryRequest(BaseModel):
    question: str

class QueryResponse(BaseModel):
    question: str
    answer: Any
    success: bool

# Create the FastAPI app 
app = FastAPI(
    title="AI Support Ticket Analyzer",
    description="LLM-powered support ticket analysis with anomaly detection"
)

# CORS Middleware -> so Streamlit can talk to this API
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5500",
        "http://127.0.0.1:5500",
        ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 1: Health Check 
@app.get("/api/health")
def health_check():
    df = get_dataframe()
    return {
        "status": "healthy",
        "ticket_count": len(df),
        "timestamp": datetime.now().isoformat()
    }

# 2: Natural Language Query
@app.post("/api/query", response_model=QueryResponse)
def query_tickets(request: QueryRequest):
    answer = ask_question(request.question)
    success = True
    if isinstance(answer, str) and answer.startswith("Error"):
        success = False
    return QueryResponse(
        question=request.question,
        answer=answer,
        success=success
    )

# 3: Anomaly Detection
@app.get("/api/anomalies")
def get_anomalies():
    anomalies = detect_anomalies()
    return {
        "total_count": len(anomalies),
        "anomalies": anomalies
    }

# 4: Browse All Tickets
@app.get("/api/tickets")
def get_tickets(
    category: str = None,
    priority: str = None,
    status: str = None
):
    df = get_dataframe()

    # Apply filters
    if category:
        df = df[df["category"] == category]

    if priority:
        df = df[df["priority"] == priority]

    if status:
        df = df[df["status"] == status]

    # Replace NaN with None
    df = df.astype(object).where(df.notna(), None)

    # Convert DataFrame to records
    tickets = df.to_dict(orient="records")

    return {
        "total_count": len(tickets),
        "tickets": tickets
    }