import json
import re

try:
    with open('index.html', 'r', encoding='utf-8') as f:
        content = f.read()
    
    scripts = re.findall(r'<script type="application/ld\+json">(.*?)</script>', content, re.DOTALL)
    for i, s in enumerate(scripts):
        try:
            json.loads(s)
            print(f"JSON-LD block {i+1}: Valid")
        except json.JSONDecodeError as e:
            print(f"JSON-LD block {i+1}: Invalid - {e}")
            # Find the line in the original file
            start_pos = content.find(s)
            line_no = content.count('\n', 0, start_pos) + 1
            print(f"  Starts around line {line_no}")
            print("  Content snippet:", s.strip()[:100], "...")
            
except Exception as e:
    print(f"Error: {e}")
