import re

files_to_update = [
    'c:/Users/Admin/Documents/cubbycove/kid/home_logged_in.html',
    'c:/Users/Admin/Documents/cubbycove/kid/games.html'
]

bg_style = """
    <style>
        body {
            background-image: url('../images/bg_sky.png');
            background-size: cover;
            background-position: center;
            background-attachment: fixed;
            background-blend-mode: overlay;
            background-color: rgba(255, 255, 255, 0.85); /* Opacity overlay */
        }
        #sidebar {
            background-image: url('../images/bg_sky.png');
            background-size: cover;
            background-position: left;
            background-blend-mode: overlay;
            background-color: rgba(255, 255, 255, 0.95); /* Sidebar is lighter */
        }
    </style>
"""

for file_path in files_to_update:
    with open(file_path, 'r', encoding='utf-8') as f:
        html = f.read()

    # Inject style into head
    if '<style>' not in html or 'bg_sky.png' not in html:
        html = re.sub(r'</head>', bg_style + '\n</head>', html)
    
    # Remove bg-gray-50 from body, bg-white from sidebar so our CSS handles it
    html = html.replace('bg-gray-50 text-gray-800', 'text-gray-800')
    html = html.replace('w-64 bg-white overflow-y-auto', 'w-64 overflow-y-auto')

    with open(file_path, 'w', encoding='utf-8') as f:
        f.write(html)
    print(f"Updated backgrounds for {file_path}")
