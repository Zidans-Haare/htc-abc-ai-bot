import os
import sqlite3
import json
from datetime import datetime
from zoneinfo import ZoneInfo

# --- Configuration ---
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../hochschuhl-abc.db')
JSON_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), 'crawled_study_programs.json')
EDITOR_TAG = "Crawler_Importer_v1"
TIMEZONE = "Europe/Berlin"

def import_data_from_json():
    """
    Reads the JSON file and imports the data into the SQLite database.
    """
    try:
        print(f"Reading data from {JSON_PATH}")
        with open(JSON_PATH, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"Found {len(data)} articles to import.")
    except FileNotFoundError:
        print(f"Error: The file {JSON_PATH} was not found.")
        return
    except json.JSONDecodeError:
        print(f"Error: Could not decode JSON from {JSON_PATH}.")
        return
    except Exception as e:
        print(f"An unexpected error occurred while reading the JSON file: {e}")
        return

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        imported_count = 0
        updated_count = 0
        
        try:
            berlin_tz = ZoneInfo(TIMEZONE)
        except Exception as e:
            print(f"Could not find timezone {TIMEZONE}. Please ensure it's a valid IANA time zone. Error: {e}")
            berlin_tz = ZoneInfo("UTC")


        for article in data:
            headline = article.get('headline')
            text = article.get('text')

            if not headline or not text:
                print(f"Skipping article with missing headline or text: {article}")
                continue

            # Format timestamp in ISO 8601 with timezone info
            timestamp = datetime.now(berlin_tz).isoformat()
            source = f"json://{os.path.basename(JSON_PATH)}/{headline.replace(' ', '_')}"

            cursor.execute("SELECT id FROM articles WHERE headline = ?", (headline,))
            result = cursor.fetchone()

            if result:
                entry_id = result[0]
                print(f"Updating existing entry for '{headline}' (ID: {entry_id})")
                cursor.execute("""
                    UPDATE articles 
                    SET text = ?, lastUpdated = ?, editor = ?, source = ?, status = 'crawled'
                    WHERE id = ?
                """, (text, timestamp, EDITOR_TAG, source, entry_id))
                updated_count += 1
            else:
                print(f"Inserting new entry for '{headline}'")
                cursor.execute("""
                    INSERT INTO articles (headline, text, lastUpdated, editor, source, status)
                    VALUES (?, ?, ?, ?, ?, 'crawled')
                """, (headline, text, timestamp, EDITOR_TAG, source))
                imported_count += 1
        
        conn.commit()
        print(f"\n--- Import finished. ---")
        print(f"Successfully imported {imported_count} new articles.")
        print(f"Successfully updated {updated_count} existing articles.")

    except sqlite3.Error as e:
        print(f"Database error: {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

if __name__ == "__main__":
    import_data_from_json()