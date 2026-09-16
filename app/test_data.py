from app.data_loader import get_dataframe

# 1. Load the data 
df = get_dataframe()

# 2. Print basic information 
print("Data Info")
print(df.info())

# 3. See what columns have missing data (Nulls)
print("\nMissing Data")
print(df.isnull().sum())

# 4. See how many tickets are in each status
print("\nTicket Status Count")
print(df['status'].value_counts())