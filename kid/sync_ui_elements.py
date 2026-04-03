import os
import re

base_path = r"c:\Users\Admin\Documents\cubbycove\kid"
source_file = os.path.join(base_path, "home_logged_in.html")
targets = ["games.html", "favorites.html", "history.html"]

with open(source_file, "r", encoding="utf-8") as f:
    source_content = f.read()

# Sidebar Match
sidebar_pattern = re.compile(r"(<!-- SIDEBAR -->\s*<aside id=\"sidebar\".*?</aside>)", re.DOTALL)
sidebar_match = sidebar_pattern.search(source_content)

# Top Navigation Match
nav_pattern = re.compile(r"(<!-- TOP NAVIGATION BAR -->\s*<nav.*?<\/nav>)", re.DOTALL)
nav_match = nav_pattern.search(source_content)

# Main Content Margin Match
main_pattern = re.compile(r'(<!-- MAIN CONTENT -->\s*<main id="main-content" class=")(.*?)(">)')
main_match = main_pattern.search(source_content)

if not sidebar_match or not nav_match or not main_match:
    print("Could not find patterns in source file")
    exit(1)

new_sidebar = sidebar_match.group(1)
new_nav = nav_match.group(1)
new_main_class = main_match.group(2)

for target in targets:
    target_path = os.path.join(base_path, target)
    if not os.path.exists(target_path): continue
    with open(target_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    # Replace Sidebar
    content = re.sub(r"<!-- SIDEBAR -->\s*<aside id=\"sidebar\".*?</aside>", new_sidebar.replace('\\', '\\\\'), content, flags=re.DOTALL)
    
    # Replace Nav
    content = re.sub(r"<!-- TOP NAVIGATION BAR -->\s*<nav.*?<\/nav>", new_nav.replace('\\', '\\\\'), content, flags=re.DOTALL)
    
    # Replace Main Class
    content = re.sub(r'(<!-- MAIN CONTENT -->\s*<main id="main-content" class=")(.*?)(">)', r'\1' + new_main_class.replace('\\', '\\\\') + r'\3', content)

    with open(target_path, "w", encoding="utf-8") as f:
        f.write(content)
print("Updated all target files with new glassmorphism sidebar, header, and margins")
