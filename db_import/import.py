import json
import sqlite3
from datetime import datetime

# Path to the JSON file
JSON_FILE_PATH = 'htw-abc.json'

# Connect to SQLite database (creates a new database if it doesn't exist)
conn = sqlite3.connect('../hochschuhl-abc.db')
cursor = conn.cursor()

# Create the hochschuhl_abc table if it doesn't exist
cursor.execute('''
    CREATE TABLE IF NOT EXISTS hochschuhl_abc (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        headline TEXT NOT NULL,
        text TEXT NOT NULL,
        editor TEXT,
        lastUpdated DATETIME DEFAULT CURRENT_TIMESTAMP,
        active BOOLEAN DEFAULT TRUE,
        archived DATETIME
    )
''')

# Read the JSON file
try:
    with open(JSON_FILE_PATH, 'r', encoding='utf-8') as file:
        data = json.load(file)
except FileNotFoundError:
    print(f"Error: The file {JSON_FILE_PATH} was not found.")
    conn.close()
    exit(1)
except json.JSONDecodeError:
    print(f"Error: The file {JSON_FILE_PATH} contains invalid JSON.")
    conn.close()
    exit(1)

# Insert data into the table
for entry in data:
    headline = entry.get('headline', '')
    text = entry.get('text', '')
    editor = 'Grok'
    active = True
    archived = None

    cursor.execute('''
        INSERT INTO hochschuhl_abc (headline, text, editor, active, archived)
        VALUES (?, ?, ?, ?, ?)
    ''', (headline, text, editor, active, archived))

# Commit the transaction and close the connection
conn.commit()
print(f"Successfully imported {len(data)} entries into the hochschuhl_abc table.")
conn.close()
