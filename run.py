import os
import subprocess
import sys
import time

# Streamlit will call this FastAPI URL.
os.environ["TICKETIQ_API_BASE_URL"] = "http://127.0.0.1:8000"


print("Starting FastAPI backend...")
api = subprocess.Popen(
    [
        sys.executable,
        "-m",
        "uvicorn",
        "app.api:app",
        "--host",
        "127.0.0.1",
        "--port",
        "8000",
    ]
)

time.sleep(2)

print("Starting Streamlit UI...")
ui = subprocess.Popen(
    [
        sys.executable,
        "-m",
        "streamlit",
        "run",
        "streamlit_app.py",
        "--server.port",
        "8501",
    ]
)

print("FastAPI docs: http://127.0.0.1:8000/docs")
print("Streamlit UI: http://localhost:8501")
print("\nPress Ctrl+C to stop both services.\n")

try:
    api.wait()
    ui.wait()
except KeyboardInterrupt:
    print("\nStopping TicketIQ...")
    api.terminate()
    ui.terminate()
