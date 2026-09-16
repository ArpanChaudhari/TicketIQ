import pandas as pd

def get_dataframe():
    # 1. Define path for CSV file
    file_path = "data/support_tickets.csv"

    # 2. Read the CSV using pandas
    # df = pd.read_csv(file_path, parse_dates=['created_at'])
    
    df = pd.read_csv(file_path, parse_dates=['created_at']) # Convert created_at into datetime for time-based calculations

    # 3. Return the dataframe
    return df

