
file_path = r'c:\Users\okawa\gaswebapp-manual\mahler-search-app\index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

target = '<script src="js/app.js"></script>'
replacement = '''<script src="js/app.js?v=20251201-fix3"></script>
<script>
  document.addEventListener('DOMContentLoaded', () => {
    console.log('Initializing Mahler Search App...');
    if (typeof loadData === 'function') {
      loadData('mahler').then(() => {
        console.log('Mahler data loaded successfully');
      }).catch(e => {
        console.error('Failed to load Mahler data:', e);
      });
    } else {
      console.error('Critical Error: app.js not loaded or loadData not defined');
    }
  });
</script>'''

if target in content:
    new_content = content.replace(target, replacement)
    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(new_content)
    print("Successfully updated index.html with init logic.")
else:
    print("Target script tag not found.")
