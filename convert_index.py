
import os

src_index_path = r'c:\Users\okawa\gaswebapp-manual\src\index.html'
common_styles_path = r'c:\Users\okawa\gaswebapp-manual\src\common_styles.html'
common_scripts_path = r'c:\Users\okawa\gaswebapp-manual\src\common_scripts.html'
dest_index_path = r'c:\Users\okawa\gaswebapp-manual\mahler-search-app\index.html'

def read_file(path):
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

try:
    index_content = read_file(src_index_path)
    styles_content = read_file(common_styles_path)
    scripts_content = read_file(common_scripts_path)

    # Replace GAS include tags with actual content
    # Note: common_styles.html and common_scripts.html already include <style> and <script> tags respectively
    new_content = index_content.replace("<?!= include('common_styles.html') ?>", styles_content)
    new_content = new_content.replace("<?!= include('common_scripts.html') ?>", scripts_content)

    with open(dest_index_path, 'w', encoding='utf-8') as f:
        f.write(new_content)

    print("Successfully converted and merged index.html")

except Exception as e:
    print(f"Error: {e}")
