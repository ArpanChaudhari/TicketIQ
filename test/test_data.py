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

# 5. How many of each Priority
df['priority'].value_counts()

# 6. Average resolution time by category
df.groupby('category')['resolution_time_hrs'].mean()

# 7. Which agents handle the most tickets
df['agent_id'].value_counts()

# 8. What do null values look like
df[df['resolution_time_hrs'].isnull()].head()