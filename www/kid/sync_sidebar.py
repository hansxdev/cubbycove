import os
import re

base_path = r"c:\Users\Admin\Documents\cubbycove\kid"
source_file = os.path.join(base_path, "home_logged_in.html")
targets = ["games.html", "favorites.html", "history.html"]

with open(source_file, "r", encoding="utf-8") as f:
    source_content = f.read()

sidebar_pattern = re.compile(r"(<!-- SIDEBAR -->\s*<aside id=\"sidebar\".*?</aside>)", re.DOTALL)
sidebar_match = sidebar_pattern.search(source_content)

style_pattern = re.compile(r"(body\s*\{\s*background-image:\s*url\('\.\./images/bg_sky_3d\.png'\);.*?})", re.DOTALL)
style_match = style_pattern.search(source_content)

if not sidebar_match or not style_match:
    print("Could not find patterns in source file")
    exit(1)

new_sidebar = sidebar_match.group(1)
new_style = style_match.group(1)

for target in targets:
    target_path = os.path.join(base_path, target)
    if not os.path.exists(target_path): continue
    with open(target_path, "r", encoding="utf-8") as f:
        content = f.read()
    
    content = re.sub(r"<!-- SIDEBAR -->\s*<aside id=\"sidebar\".*?</aside>", new_sidebar.replace('\\', '\\\\'), content, flags=re.DOTALL)
    content = re.sub(r"body\s*\{\s*background-image:\s*url\('\.\./images/bg_sky\.png'\);.*?}", new_style.replace('\\', '\\\\'), content, flags=re.DOTALL)
    
    with open(target_path, "w", encoding="utf-8") as f:
        f.write(content)
print("Updated all target files")
