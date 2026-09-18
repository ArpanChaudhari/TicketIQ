# Import all dependency
import os
import pandas as pd
from dotenv import load_dotenv
from groq import Groq
from app.data_loader import get_dataframe
from app.anomaly_detector import detect_anomalies
import json
from typing import Any

# 1. Load environment variable from .env file
load_dotenv()

# 2. Initialize the Groq client
client = Groq(api_key=os.getenv("GROQ_API_KEY"))

# 3. Load our data
df = get_dataframe()

# Generate the anomalies list and convert it to a DataFrame
anomalies_list = detect_anomalies()
anomalies_df = pd.DataFrame(anomalies_list)


# 4. System Prompt - Tells the LLM what it can do and what data is available
System_Prompt = """
You are a Python assistant that helps analyze support ticket data.
You have access to TWO Pandas DataFrames: `df` and `anomalies_df`.

1. `df` (Raw Tickets):
- ticket_id: Unique ID of the ticket
- created_at: Date and time when the ticket was created (datetime)
- category: Billing, Technical, or General
- priority: Low, Medium, High, or Critical
- status: Open, Resolved, or Escalated
- response_time_hrs: Time taken to give the first response, in hours
- resolution_time_hrs: Time taken to resolve the ticket, in hours
- agent_id: ID of the assigned agent
- customer_rating: Customer rating from 1 to 5
- issue_summary: Short description of the problem

2. `anomalies_df` (Detected Anomalies):
- ticket_id: Matches ticket_id in `df`
- anomaly_type: Type of anomaly (e.g., "Outlier: Resolution Time")
- severity: "High", "Critical", "Medium"
- description: Text explanation of the anomaly

The user will ask questions about the ticket data.
Your job is to write Python code using pandas to find the answer.
If the question is about anomalies, use `anomalies_df` (you can merge it with `df` on 'ticket_id' if you need date/time context).

Important rules:
1. Store the final answer in a variable called `result`.
2. Do not use print().
3. Do not import pandas, it is already imported as `pd`.
4. Return ONLY valid Python code. No markdown formatting, no explanations, no text outside the code block.
5. If your result is a grouped DataFrame, you MUST use `.reset_index()` to flatten it before assigning it to `result`.
6. DO NOT convert the final result to a list or dictionary. Leave it as a Pandas DataFrame, Series, or primitive type (string/int).
"""


# 5. Ask Function - Takes the user's question and gets Python code from the LLM
def ask_question(user_question: str) -> Any:
    try:
        # Ask Groq to write the code
        response = client.chat.completions.create(
            model="openai/gpt-oss-120b",
            messages=[
                {"role": "system", "content": System_Prompt},
                {"role": "user", "content": user_question},
            ],
            temperature=0.0,  # highly analytical, deterministic, and strict (no creativity).
        )

        # Extract the text response
        generated_code = response.choices[0].message.content.strip()

        # Sometimes LLMs ignore instruction and wrap code in markdown anyway.
        if generated_code.startswith("```python"):
            generated_code = (
                generated_code.replace("```python", "").replace("```", "").strip()
            )
        elif generated_code.startswith("```"):
            generated_code = generated_code.replace("```", "").strip()

        # Execute  the code safely
        namespace = {
            "df": df,
            "anomalies_df": anomalies_df,
            "pd": pd,
        }  # We use namespace to store and access variables created during execution.

        exec(generated_code, namespace)

        # Return result
        if "result" in namespace:

            result = namespace["result"]

            # If result is a DataFrame, convert to JSON-compatible dict
            if isinstance(result, pd.DataFrame):
                json_str = result.fillna("N/A").to_json(orient="records", date_format="iso")
                return json.loads(json_str)

            # If result is a Series, convert to JSON-compatible dict
            elif isinstance(result, pd.Series):
                json_str = result.fillna("N/A").to_json(date_format="iso")
                return json.loads(json_str)

            elif isinstance(result, list) or isinstance(result, dict):
                try:
                    # Test if it's already JSON serializable (no Timestamps)
                    json.dumps(result) 
                    return result
                except TypeError:
                    # Fallback to string if it contains un-serializable objects
                    return str(result)

            else:
                return str(result)
        else:
            return "Error: No result was generated. Please try asking a different question."

    except Exception as e:
        return f"Error executing code: {e}"
