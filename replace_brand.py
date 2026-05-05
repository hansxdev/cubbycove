import os
import glob

project_dir = r"c:\Users\Admin\Documents\cubbycove"
extensions = ["*.html", "*.js", "*.md", "*.css"]

files_to_check = []
for ext in extensions:
    # use recursive glob
    pattern = os.path.join(project_dir, "**", ext)
    files_to_check.extend(glob.glob(pattern, recursive=True))

replacements = [
    ("Cubby Cove", "CubbyCove"),
    ("cubby cove", "cubbycove"),
    ("CUBBY COVE", "CUBBYCOVE")
]

updated_count = 0
for filepath in files_to_check:
    if ".git" in filepath or "node_modules" in filepath:
        continue
        
    try:
        with open(filepath, 'r', encoding='utf-8') as f:
            content = f.read()
            
        original = content
        for old, new in replacements:
            content = content.replace(old, new)
            
        if content != original:
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(content)
            updated_count += 1
            print(f"Updated brand name in: {os.path.relpath(filepath, project_dir)}")
    except Exception as e:
        print(f"Could not process {filepath}: {e}")

print(f"\nBrand name standardisation complete. Updated {updated_count} files.")
