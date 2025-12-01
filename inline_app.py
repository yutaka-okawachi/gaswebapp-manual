
import re
import os

index_path = r'c:\Users\okawa\gaswebapp-manual\mahler-search-app\index.html'
app_js_path = r'c:\Users\okawa\gaswebapp-manual\mahler-search-app\js\app.js'

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

try:
    index_content = read_file(index_path)
    app_js_content = read_file(app_js_path)

    # Regex to find the script tag for app.js (handling versions and attributes)
    # Matches <script src="js/app.js..."></script>
    pattern = r'<script src="js/app\.js[^"]*"></script>'
    
    match = re.search(pattern, index_content)
    if match:
        # Create the new script block
        new_script_block = f'<script>\n// Inlined app.js\n{app_js_content}\n</script>'
        
        # Use simple string replacement for the matched tag
        # This avoids re.sub trying to process backslashes in the JS code
        tag_to_replace = match.group(0)
        new_index_content = index_content.replace(tag_to_replace, new_script_block)
        
        with open(index_path, 'w', encoding='utf-8') as f:
            f.write(new_index_content)
            
        print("Successfully inlined app.js into index.html")
    else:
        print("Could not find <script src=\"js/app.js...\"> tag in index.html")

except Exception as e:
    print(f"Error: {e}")
