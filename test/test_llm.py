from app.llm_engine import ask_question

print("Question 1: How many tickets are currently open?")
print("Answer:", ask_question("How many tickets are currently open?"))
print("-" * 40)
print("Question 2: What is the average customer rating for Technical category tickets?")
print("Answer:", ask_question("What is the average customer rating for Technical category tickets?"))
print("-" * 40)
print("Question 2: Are there any anomalies in resolution times this week")
print("Answer:", ask_question("Show All anomalies in resolution times this week"))