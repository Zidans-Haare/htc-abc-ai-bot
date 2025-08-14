import os
import sqlite3
from datetime import datetime
import re

# --- Configuration ---
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../hochschuhl-abc.db')
EDITOR_TAG = "Crawler_v6_Local_Fallback"
LOCAL_HTML_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'htw-dresden.html')

def get_study_program_lines():
    """
    Reads the local HTML file to get all study program lines.
    """
    try:
        print(f"Reading local HTML file: {LOCAL_HTML_FILE}")
        with open(LOCAL_HTML_FILE, 'r', encoding='utf-8') as f:
            content = f.read()
        
        program_lines = re.findall(r'^\s*\*\s(Bachelor.*|Master.*|Diplom.*)', content, re.MULTILINE)
        print(f"Found {len(program_lines)} study program lines in the local file.")
        return program_lines
    except FileNotFoundError:
        print(f"Error: The file {LOCAL_HTML_FILE} was not found.")
        return []
    except Exception as e:
        print(f"An error occurred while reading the file: {e}")
        return []

def parse_program_details_from_line(program_line):
    """
    Parses program details from a single line of text, creating placeholder content.
    """
    headline = program_line.strip()
    # Create a simple, unique placeholder URL
    url_slug = re.sub(r'[^a-z0-9-]', '', headline.lower().replace(' ', '-'))
    
    details = {
        'headline': headline,
        'url': f"#{url_slug}", 
        'text_body': f"Dies ist ein automatisch generierter Eintrag für '{headline}'. Der Inhalt muss noch manuell ergänzt werden.",
        'source': 'Lokale Datei: htw-dresden.html'
    }
    return details

def format_entry_text(details):
    """Formats the details into a single markdown text block."""
    return details.get('text_body', '')

def update_database(program_data):
    """
    Inserts or updates a program in the database.
    """
    if not program_data or not program_data.get('headline'):
        print("Skipping entry with no headline.")
        return

    conn = None
    try:
        conn = sqlite3.connect(DB_PATH)
        cursor = conn.cursor()

        headline = program_data['headline']
        url = program_data['url']
        text = format_entry_text(program_data)
        timestamp = datetime.now().strftime('%Y-%m-%d %H:%M:%S')

        cursor.execute("SELECT id FROM articles WHERE headline = ?", (headline,))
        result = cursor.fetchone()

        if result:
            entry_id = result[0]
            print(f"Updating existing entry for '{headline}' (ID: {entry_id})")
            cursor.execute("""
                UPDATE articles 
                SET text = ?, lastUpdated = ?, editor = ?, source = ?, status = 'crawled'
                WHERE id = ?
            """, (text, timestamp, EDITOR_TAG, url, entry_id))
        else:
            print(f"Inserting new entry for '{headline}'")
            cursor.execute("""
                INSERT INTO articles (headline, text, lastUpdated, editor, source, status)
                VALUES (?, ?, ?, ?, ?, 'crawled')
            """, (headline, text, timestamp, EDITOR_TAG, url))
        
        conn.commit()
        print(f"Successfully saved '{headline}' to the database.")

    except sqlite3.Error as e:
        print(f"Database error for '{headline}': {e}")
        if conn:
            conn.rollback()
    finally:
        if conn:
            conn.close()

def main():
    """
    Main function to run the crawler and update the database from the local file.
    """
    print("--- Starting HTW Dresden Local File Importer (Fallback) ---")
    
    program_lines = get_study_program_lines()
    if not program_lines:
        print("No program lines found in the local file. Exiting.")
        return

    processed_count = 0
    for line in program_lines:
        details = parse_program_details_from_line(line)
        if details:
            update_database(details)
            processed_count += 1
    
    print(f"\n--- Importer finished. ---")
    print(f"Successfully processed and saved {processed_count} of {len(program_lines)} programs.")

if __name__ == "__main__":
    main()
