
import re

file_path = r'c:\Users\okawa\gaswebapp-manual\mahler-search-app\index.html'

with open(file_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Regex to find the inlined script block and the init script block
# Matches <script>\n// Inlined app.js ... </script>\n<script> ... </script>
# We need to be careful to match everything.
# The structure is:
# <script>
# // Inlined app.js
# ...
# </script>
#   <script>
#     document.addEventListener...
#   </script>

# Let's find the start of the inlined app.js
start_marker = '// Inlined app.js'
start_pos = content.find(start_marker)

if start_pos != -1:
    # Find the opening <script> tag before the marker
    script_start = content.rfind('<script', 0, start_pos)
    
    # Find the end of the init script.
    # We know the init script ends with </script> and is followed by </head> or <body> (if it was in head)
    # But wait, I previously put it in <head>.
    # So it should be followed by </head>.
    
    # Let's find the </head> tag
    head_end = content.find('</head>')
    
    if head_end != -1 and script_start != -1 and script_start < head_end:
        # Extract the block to move
        # It's everything from script_start to head_end
        block_to_move = content[script_start:head_end]
        
        # Remove it from the current location
        new_content = content[:script_start] + content[head_end:]
        
        # Insert it before </body>
        body_end = new_content.find('</body>')
        if body_end != -1:
            final_content = new_content[:body_end] + block_to_move + '\n' + new_content[body_end:]
            
            with open(file_path, 'w', encoding='utf-8') as f:
                f.write(final_content)
            print("Successfully moved inlined scripts to end of body.")
        else:
            print("Could not find </body> tag.")
    else:
        print("Could not find script block in head.")
else:
    print("Could not find '// Inlined app.js' marker.")
