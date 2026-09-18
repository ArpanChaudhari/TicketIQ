from collections import Counter
from app.anomaly_detector import detect_anomalies


# Get all the anomalies from the dataset
anomalies = detect_anomalies()

print(f"Total anomalies found: {len(anomalies)}")

print("-"*20)

# Show how many anomalies belong to each type
print("Anomalies by type:")
types = Counter(item["anomaly_type"] for item in anomalies)

for name, count in types.items():
    print(f"{name}: {count}")

print("-"*20)

# Show how many anomalies belong to each severity
print("Anomalies by severity:")
severities = Counter(item["severity"] for item in anomalies)

for name, count in severities.items():
    print(f"{name}: {count}")

print("-"*20)

# Print a few examples so we can check the results
print("Some examples:")

for item in anomalies[:3]:
    print(item)