
file_path = r'c:\Users\okawa\gaswebapp-manual\mahler-search-app\index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

if '<script src="js/app.js"></script>' not in content:
    new_content = content.replace('</body>', '<script src="js/app.js"></script>\n</body>')
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully added app.js script tag.")
else:
    print("Script tag already exists.")
