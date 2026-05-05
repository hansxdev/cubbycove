import os
import re

base_dir = r"c:\Users\Admin\Documents\cubbycove\kid"

def get_file_contents(filename):
    with open(filename, 'r', encoding='utf-8') as f:
        return f.read()

def write_file_contents(filename, content):
    with open(filename, 'w', encoding='utf-8') as f:
        f.write(content)

home_contents = get_file_contents(os.path.join(base_dir, 'home_logged_in.html'))

# 1. Extract NAV
nav_match = re.search(r'(<nav.*?</nav>)', home_contents, re.DOTALL)
if not nav_match:
    raise Exception("Nav not found")
nav_content = nav_match.group(1)

# 2. Extract ASIDE
aside_match = re.search(r'(<aside id="sidebar".*?</aside>)', home_contents, re.DOTALL)
if not aside_match:
    raise Exception("Aside not found")
aside_content = aside_match.group(1)

# 3. Extract Overlay
overlay_match = re.search(r'(<div id="overlay".*?</div>)', home_contents, re.DOTALL)
overlay_content = overlay_match.group(1) if overlay_match else ""

# 4. Extract MODALS (Everything between </main> and Before <!-- Appwrite & Data -->)
# Look for </main> and <!-- Appwrite & Data -->
modals_match = re.search(r'</main>\s*(.*?)\s*<!-- Appwrite & Data -->', home_contents, re.DOTALL)
if not modals_match:
    raise Exception("Modals not found")
modals_content = modals_match.group(1)

# 5. Extract SCRIPTS
scripts_match = re.search(r'(<!-- Appwrite &.*?</html>)', home_contents, re.DOTALL)
if not scripts_match:
    raise Exception("Scripts not found")
scripts_content = scripts_match.group(1)

def apply_template(filename, active_page_name):
    filepath = os.path.join(base_dir, filename)
    contents = get_file_contents(filepath)
    
    # Replace NAV
    contents = re.sub(r'<nav.*?</nav>', nav_content, contents, count=1, flags=re.DOTALL)
    
    # Replace ASIDE
    contents = re.sub(r'<aside id="sidebar".*?</aside>', aside_content, contents, count=1, flags=re.DOTALL)
    
    # Replace OVERLAY
    if '<div id="overlay"' in contents:
        contents = re.sub(r'<div id="overlay"[^>]*>.*?</div>', overlay_content, contents, count=1, flags=re.DOTALL)
    else:
        # Insert overlay before main
        contents = re.sub(r'(<main id="main-content"|<main class=)', overlay_content + '\n\n    \\1', contents)
    
    # Replace MODALS and SCRIPTS
    # We strip everything after </main> and replace it
    contents = re.sub(r'</main>\s*.*</html>', f'</main>\n\n    {modals_content}\n\n    {scripts_content}', contents, flags=re.DOTALL)

    # Make target active
    if active_page_name == 'Games':
        # Remove active class from home
        contents = contents.replace('class="flex items-center gap-4 px-4 py-3 bg-cubby-blue/20 border-[3px] border-cubby-blue text-cubby-blue rounded-2xl shadow-[0_4px_0_#3b82f6] font-black text-lg sidebar-link transition-all duration-300 active:translate-y-1 active:shadow-none"',
                                    'class="flex items-center gap-4 px-4 py-3 bg-white/60 border-[3px] border-transparent hover:border-cubby-blue hover:bg-cubby-blue/10 text-gray-600 hover:text-cubby-blue rounded-2xl shadow-sm hover:shadow-[0_4px_0_#3b82f6] font-black text-lg transition-all duration-300 sidebar-link active:translate-y-1 active:shadow-none group"')
        contents = contents.replace('<i class="fa-solid fa-house text-xl w-6 text-center"></i>', '<i class="fa-solid fa-house text-xl w-6 text-center text-cubby-blue group-hover:scale-110 transition-transform"></i>')
        
        # Add active class to games
        contents = re.sub(r'<a href="games.html".*?</a>', 
                          r'<a href="games.html"\n                class="flex items-center gap-4 px-4 py-3 bg-cubby-orange/20 border-[3px] border-cubby-orange text-cubby-orange rounded-2xl shadow-[0_4px_0_#f97316] font-black text-lg sidebar-link transition-all duration-300 active:translate-y-1 active:shadow-none">\n                <i class="fa-solid fa-gamepad text-xl w-6 text-center"></i>\n                <span\n                    class="sidebar-label whitespace-nowrap inline-block overflow-hidden transition-all duration-300">Games</span>\n            </a>', 
                          contents, flags=re.DOTALL)
                          
    elif active_page_name == 'Favorites':
        contents = contents.replace('class="flex items-center gap-4 px-4 py-3 bg-cubby-blue/20 border-[3px] border-cubby-blue text-cubby-blue rounded-2xl shadow-[0_4px_0_#3b82f6] font-black text-lg sidebar-link transition-all duration-300 active:translate-y-1 active:shadow-none"',
                                    'class="flex items-center gap-4 px-4 py-3 bg-white/60 border-[3px] border-transparent hover:border-cubby-blue hover:bg-cubby-blue/10 text-gray-600 hover:text-cubby-blue rounded-2xl shadow-sm hover:shadow-[0_4px_0_#3b82f6] font-black text-lg transition-all duration-300 sidebar-link active:translate-y-1 active:shadow-none group"')
        contents = contents.replace('<i class="fa-solid fa-house text-xl w-6 text-center"></i>', '<i class="fa-solid fa-house text-xl w-6 text-center text-cubby-blue group-hover:scale-110 transition-transform"></i>')
        contents = re.sub(r'<a href="favorites.html".*?</a>', 
                          r'<a href="favorites.html"\n                class="flex items-center gap-4 px-4 py-3 bg-cubby-pink/20 border-[3px] border-cubby-pink text-cubby-pink rounded-2xl shadow-[0_4px_0_#ec4899] font-black text-lg sidebar-link transition-all duration-300 active:translate-y-1 active:shadow-none">\n                <i class="fa-solid fa-heart text-xl w-6 text-center"></i>\n                <span\n                    class="sidebar-label whitespace-nowrap inline-block overflow-hidden transition-all duration-300">Favorites</span>\n            </a>', 
                          contents, flags=re.DOTALL)
                          
    elif active_page_name == 'History':
        contents = contents.replace('class="flex items-center gap-4 px-4 py-3 bg-cubby-blue/20 border-[3px] border-cubby-blue text-cubby-blue rounded-2xl shadow-[0_4px_0_#3b82f6] font-black text-lg sidebar-link transition-all duration-300 active:translate-y-1 active:shadow-none"',
                                    'class="flex items-center gap-4 px-4 py-3 bg-white/60 border-[3px] border-transparent hover:border-cubby-blue hover:bg-cubby-blue/10 text-gray-600 hover:text-cubby-blue rounded-2xl shadow-sm hover:shadow-[0_4px_0_#3b82f6] font-black text-lg transition-all duration-300 sidebar-link active:translate-y-1 active:shadow-none group"')
        contents = contents.replace('<i class="fa-solid fa-house text-xl w-6 text-center"></i>', '<i class="fa-solid fa-house text-xl w-6 text-center text-cubby-blue group-hover:scale-110 transition-transform"></i>')
        contents = re.sub(r'<a href="history.html".*?</a>', 
                          r'<a href="history.html"\n                class="flex items-center gap-4 px-4 py-3 bg-cubby-purple/20 border-[3px] border-cubby-purple text-cubby-purple rounded-2xl shadow-[0_4px_0_#a855f7] font-black text-lg sidebar-link transition-all duration-300 active:translate-y-1 active:shadow-none">\n                <i class="fa-solid fa-clock-rotate-left text-xl w-6 text-center"></i>\n                <span\n                    class="sidebar-label whitespace-nowrap inline-block overflow-hidden transition-all duration-300">History</span>\n            </a>', 
                          contents, flags=re.DOTALL)

    write_file_contents(filepath, contents)
    print(f"Successfully processed {filename}")

apply_template('games.html', 'Games')
apply_template('favorites.html', 'Favorites')
apply_template('history.html', 'History')
