import os
import sqlite3
import requests
from bs4 import BeautifulSoup
from datetime import datetime
import re

# --- Configuration ---
BASE_URL = "https://www.htw-dresden.de"
DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), '../hochschuhl-abc.db')
EDITOR_TAG = "Crawler_v2"
LOCAL_HTML_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'htw-dresden.html')


def get_study_program_links():
    """
    Reads the local HTML file to get links to all individual study programs.
    """
    links = []
    try:
        project_root = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        html_file_path = os.path.join(project_root, 'htw-dresden.html')
        print(f"Reading local HTML file: {html_file_path}")

        with open(html_file_path, 'r', encoding='utf-8') as f:
            content = f.read()
        
        # The links are in the text, not in `<a>` tags.
        # We will use regex to find them.
        # The pattern is: a line starting with "* " followed by the program name.
        # The program name is then converted to a URL slug.
        
        # This is still a bit brittle, but it's the best we can do with the current HTML.
        
        # The regex will find all lines starting with `* Bachelor`, `* Master`, or `* Diplom`.
        program_pattern = re.compile(r'\* (Bachelor|Master|Diplom) .*')
        
        found_programs = program_pattern.findall(content)
        
        # The content is not well-formed HTML, so we will just search the raw text
        for line in content.splitlines():
            if line.strip().startswith('* Bachelor') or line.strip().startswith('* Master') or line.strip().startswith('* Diplom'):
                program_name = line.strip().replace('* ', '')
                # This is a hacky way to create a URL slug from the program name
                slug = program_name.lower().replace(' ', '-').replace('/', '-').replace('(', '').replace(')', '').replace('ä', 'ae').replace('ö', 'oe').replace('ü', 'ue').replace('ß', 'ss')
                # This is a guess for the URL structure. It's likely wrong.
                url = f"{BASE_URL}/studium/vor-dem-studium/studienangebot/{slug}"
                if url not in links:
                    links.append(url)

        print(f"Found {len(links)} unique study program links.")
        return links
    except FileNotFoundError:
        print(f"Error: The file {html_file_path} was not found.")
        return []
    except Exception as e:
        print(f"An error occurred: {e}")
        return []

def scrape_program_details(url):
    """
    Scrapes detailed information from a single study program page.
    """
    try:
        print(f"Scraping: {url}")
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
        }
        response = requests.get(url, headers=headers)
        if response.status_code == 404:
            print(f"Skipping {url} (404 Not Found)")
            return None
        response.raise_for_status()
        soup = BeautifulSoup(response.content, 'html.parser')

        details = {'url': url}
        
        headline_tag = soup.find('h1')
        details['headline'] = headline_tag.text.strip() if headline_tag else 'Nicht gefunden'

        main_content = soup.find('main', class_='main')
        if not main_content:
            print(f"Could not find main content for {url}")
            return None

        key_facts = {}
        fact_box = main_content.find('div', class_='fakten')
        if fact_box:
            for row in fact_box.find_all('div', class_='row'):
                label_div = row.find('div', class_='label')
                value_div = row.find('div', class_='value')
                if label_div and value_div:
                    label = label_div.text.strip()
                    value = value_div.get_text(separator=', ', strip=True)
                    key_facts[label] = value
        details.update(key_facts)

        text_body = ""
        content_area = main_content.find('div', class_='content-element') 
        if content_area:
            for unwanted in content_area.find_all(['div'], class_=['fakten', 'social-media-share', 'link-list', 'teaser-grid']):
                if unwanted:
                    unwanted.decompose()
            
            text_body = content_area.get_text(separator='\n\n', strip=True)
            text_body = re.sub(r'\n{3,}', '\n\n', text_body)

        details['text_body'] = text_body
        
        return details
    except requests.exceptions.RequestException as e:
        print(f"Error scraping {url}: {e}")
        return None

def format_entry_text(details):
    """Formats the scraped details into a single markdown text block."""
    text = ""
    for key, value in details.items():
        if key not in ['headline', 'url', 'text_body', 'NC-Werte', 'Bewerbungsfrist']:
             text += f"### {key}\n{value}\n\n" 
    
    text += details.get('text_body', '')

    if details.get('Bewerbungsfrist'):
        text += f"\n\n### Bewerbungsfrist\n{details['Bewerbungsfrist']}"
    if details.get('NC-Werte'):
        text += f"\n\n### NC-Werte\n{details['NC-Werte']}"

    return text.strip()

def update_database(program_data):
    """
    Inserts or updates a program in the database.
    """
    if not program_data or not program_data.get('headline') or program_data.get('headline') == 'Nicht gefunden':
        print(f"Skipping entry with no headline: {program_data.get('url')}")
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
    Main function to run the crawler and update the database.
    """
    print("--- Starting HTW Dresden Crawler ---")
    
    program_links = get_study_program_links()
    if not program_links:
        print("No links found. Exiting.")
        return

    crawled_count = 0
    for link in program_links:
        details = scrape_program_details(link)
        if details:
            update_database(details)
            crawled_count += 1
    
    print(f"\n--- Crawler finished. ---")
    print(f"Successfully crawled and processed {crawled_count} of {len(program_links)} links.")

if __name__ == "__main__":
    main()