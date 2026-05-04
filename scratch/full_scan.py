import os
import json
import re
from html.parser import HTMLParser

class SimpleHTMLValidator(HTMLParser):
    def __init__(self):
        super().__init__()
        self.errors = []
    def handle_error(self, message):
        self.errors.append(message)

def check_file(filepath):
    results = []
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
    except UnicodeDecodeError:
        return ["Encoding Error: Not UTF-8"]
    
    # Check JSON-LD
    scripts = re.findall(r'<script type="application/ld\+json">(.*?)</script>', content, re.DOTALL)
    for i, s in enumerate(scripts):
        try:
            json.loads(s)
        except json.JSONDecodeError as e:
            results.append(f"JSON-LD Error in block {i+1}: {e}")

    # Check for obvious unclosed meta tags or common broken patterns
    # (Checking for quotes in meta tags)
    meta_matches = re.findall(r'<meta [^>]*>', content)
    for meta in meta_matches:
        if 'content="' in meta and meta.count('"') % 2 != 0:
            results.append(f"Broken Meta Tag (unclosed quote?): {meta}")

    # Basic HTML check
    parser = SimpleHTMLValidator()
    try:
        parser.feed(content)
        if parser.errors:
            results.extend(parser.errors)
    except Exception as e:
        results.append(f"HTML Parser Error: {e}")

    return results

html_files = [
    'index.html',
    'mahler-search-app/mahler.html',
    'mahler-search-app/dic.html',
    'mahler-search-app/terms_search.html',
    'mahler-search-app/rs_terms_search.html',
    'mahler-search-app/rw_terms_search.html',
    'mahler-search-app/richard_strauss.html',
    'mahler-search-app/richard_wagner.html',
    'mahler-search-app/notes.html',
    'mahler-search-app/other.html'
]

for f in html_files:
    if os.path.exists(f):
        errors = check_file(f)
        if errors:
            print(f"FAILED: {f}")
            for err in errors:
                print(f"  - {err}")
        else:
            print(f"PASSED: {f}")
    else:
        print(f"NOT FOUND: {f}")
