import re

with open('c:/Users/Admin/Documents/cubbycove/kid/games.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Pattern to replace everything inside <main id="main-content"> ... </main>
pattern_main = r'(<main id="main-content"[^>]*>)(.*?)(</main>)'

new_main = """<main id="main-content" class="lg:ml-64 pt-16 min-h-screen transition-all duration-300 ease-in-out">

        <!-- Hero Banner (Featured Game) -->
        <div class="p-6 pb-2">
            <div class="relative w-full rounded-[2rem] overflow-hidden shadow-xl group cursor-pointer border-[6px] border-[#4ade80] bg-[#86efac] p-2 aspect-auto md:aspect-[21/9]">
                <div class="w-full h-full relative rounded-[1.5rem] overflow-hidden">
                    <img src="../images/space_explorer_banner.png"
                        class="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105">
                    
                    <!-- Gradient overlay to ensure text is readable if it overlaps -->
                    <div class="absolute inset-0 bg-gradient-to-r from-blue-900/80 via-blue-900/40 to-transparent"></div>
                    
                    <div class="absolute top-0 left-0 p-8 md:p-12 text-white flex flex-col justify-center h-full max-w-xl">
                        <span class="bg-cubby-yellow text-gray-900 text-xs font-black px-4 py-1.5 rounded-full mb-4 w-fit uppercase tracking-widest shadow-sm">FEATURED</span>
                        <h2 class="text-4xl md:text-5xl font-black mb-3 drop-shadow-lg text-white">Space Explorer 3000</h2>
                        <p class="text-white/90 text-sm md:text-lg mb-6 font-bold drop-shadow-md">Blast off into a galaxy of fun! Learn about planets while dodging asteroids.</p>
                        
                        <button onclick="playMemoryGame()" class="bg-[#9333ea] hover:bg-[#7e22ce] border-4 border-[#6b21a8] text-white font-black text-lg px-8 py-3 rounded-2xl shadow-[0_6px_0_#581c87] active:translate-y-2 active:shadow-none transition-all flex items-center gap-3 w-fit">
                            <i class="fa-solid fa-play"></i> Play Now
                        </button>
                    </div>
                </div>
            </div>
        </div>

        <!-- Game Grid -->
        <div class="px-6 py-6 pb-20">
            <h2 class="flex items-center gap-3 text-2xl font-black text-gray-800 mb-6 drop-shadow-sm">
                <i class="fa-solid fa-shapes text-cubby-purple text-3xl"></i> All Games
            </h2>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">

                <!-- Game Card 1 -->
                <div class="bg-[#bbf7d0] rounded-3xl border-[5px] border-[#4ade80] p-[5px] shadow-[0_6px_0_#22c55e] hover:shadow-[0_2px_0_#22c55e] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all cursor-pointer group flex flex-col">
                    <div class="bg-white rounded-[20px] pb-4 flex flex-col items-center justify-center relative overflow-hidden h-full pt-8">
                        <div class="w-16 h-16 bg-[#bbf7d0] text-[#166534] border-4 border-[#4ade80] rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                            <i class="fa-solid fa-magnifying-glass"></i>
                        </div>
                        <h3 class="font-extrabold text-gray-800 text-base text-center px-2 leading-tight">Math Whiz</h3>
                        <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Educational</p>
                    </div>
                </div>

                <!-- Game Card 2 -->
                <div class="bg-[#fef08a] rounded-3xl border-[5px] border-[#fde047] p-[5px] shadow-[0_6px_0_#eab308] hover:shadow-[0_2px_0_#eab308] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all cursor-pointer group flex flex-col">
                    <div class="bg-white rounded-[20px] pb-4 flex flex-col items-center justify-center relative overflow-hidden h-full pt-8">
                        <div class="w-16 h-16 bg-[#fef08a] text-[#854d0e] border-4 border-[#fde047] rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                            <i class="fa-solid fa-chess-knight"></i>
                        </div>
                        <h3 class="font-extrabold text-gray-800 text-base text-center px-2 leading-tight">Knight's Quest</h3>
                        <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Puzzle</p>
                    </div>
                </div>

                <!-- Game Card 3 -->
                <div class="bg-[#bfdbfe] rounded-3xl border-[5px] border-[#60a5fa] p-[5px] shadow-[0_6px_0_#3b82f6] hover:shadow-[0_2px_0_#3b82f6] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all cursor-pointer group flex flex-col">
                    <div class="bg-white rounded-[20px] pb-4 flex flex-col items-center justify-center relative overflow-hidden h-full pt-8">
                        <div class="w-16 h-16 bg-[#bfdbfe] text-[#1e40af] border-4 border-[#60a5fa] rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                            <i class="fa-solid fa-car-side"></i>
                        </div>
                        <h3 class="font-extrabold text-gray-800 text-base text-center px-2 leading-tight">Tiny Racers</h3>
                        <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Racing</p>
                    </div>
                </div>

                <!-- Game Card 4 -->
                <div class="bg-[#fed7aa] rounded-3xl border-[5px] border-[#fb923c] p-[5px] shadow-[0_6px_0_#f97316] hover:shadow-[0_2px_0_#f97316] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all cursor-pointer group flex flex-col">
                    <div class="bg-white rounded-[20px] pb-4 flex flex-col items-center justify-center relative overflow-hidden h-full pt-8">
                        <div class="w-16 h-16 bg-[#fed7aa] text-[#c2410c] border-4 border-[#fb923c] rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                            <i class="fa-solid fa-cookie-bite"></i>
                        </div>
                        <h3 class="font-extrabold text-gray-800 text-base text-center px-2 leading-tight">Cookie Clicker</h3>
                        <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Casual</p>
                    </div>
                </div>

                <!-- Game Card 5 -->
                <div class="bg-[#fbcfe8] rounded-3xl border-[5px] border-[#f472b6] p-[5px] shadow-[0_6px_0_#ec4899] hover:shadow-[0_2px_0_#ec4899] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all cursor-pointer group flex flex-col">
                    <div class="bg-white rounded-[20px] pb-4 flex flex-col items-center justify-center relative overflow-hidden h-full pt-8">
                        <div class="w-16 h-16 bg-[#fbcfe8] text-[#be185d] border-4 border-[#f472b6] rounded-full flex items-center justify-center text-3xl mb-4 group-hover:scale-110 transition-transform">
                            <i class="fa-solid fa-paintbrush"></i>
                        </div>
                        <h3 class="font-extrabold text-gray-800 text-base text-center px-2 leading-tight">Coloring Book</h3>
                        <p class="text-xs text-gray-400 font-bold uppercase tracking-wider mt-1">Creative</p>
                    </div>
                </div>

            </div>
        </div>
    </main>"""

m = re.search(pattern_main, html, flags=re.DOTALL)
if m is not None:
    assert m is not None  # help Pylance narrow type from Match | None to Match
    new_html = html[:m.start()] + new_main + html[m.end():]
    with open('c:/Users/Admin/Documents/cubbycove/kid/games.html', 'w', encoding='utf-8') as f:
        f.write(new_html)
    print("Updated games.html with new Space Explorer hero banner and chunky game cards!")
else:
    print("Could not find main-content block in games.html.")
