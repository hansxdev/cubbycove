import sys
import re

with open('c:/Users/Admin/Documents/cubbycove/kid/home_logged_in.html', 'r', encoding='utf-8') as f:
    html = f.read()

# Pattern to find the Hero SECTION
pattern_hero = r'<!-- NEW HERO SECTION WITH SLIDER -->.*?<!-- QUICK GAMES SECTION -->'
hero_html = """<!-- FEATURED VIDEO CARDS GRID -->
        <div class="px-6 py-6 pb-2 relative z-10 text-center">
            <h1 class="text-3xl font-black text-[#5c3a21] mb-6 drop-shadow-sm text-left"><i class="fa-solid fa-fire text-orange-500 mr-2"></i> Trending Now</h1>
            <div class="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                
                <!-- Music -->
                <div class="group relative rounded-3xl bg-[#ff99cd] border-[4px] border-[#e8609f] p-[4px] shadow-[0_6px_0_#d65592] hover:shadow-[0_2px_0_#d65592] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all cursor-pointer">
                    <div class="bg-white rounded-[20px] overflow-hidden h-56 flex flex-col">
                        <div class="h-36 relative">
                            <img src="../images/thumb_music.png" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black/10 flex flex-col items-center justify-center">
                                <div class="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg group-hover:scale-110 transition-transform">
                                    <i class="fa-solid fa-play text-lg ml-1"></i>
                                </div>
                            </div>
                            <div class="absolute bottom-2 left-2 bg-white/90 backdrop-blur text-[#c2196e] font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                Music
                            </div>
                        </div>
                        <div class="flex-1 flex flex-col items-center justify-center p-3 text-center bg-[#ff99cd]/20">
                            <h3 class="font-extrabold text-[#991255] text-sm leading-tight drop-shadow-sm">Jam with the<br>Jungle Beats</h3>
                        </div>
                    </div>
                </div>

                <!-- Science -->
                <div class="group relative rounded-3xl bg-[#93c5fd] border-[4px] border-[#60a5fa] p-[4px] shadow-[0_6px_0_#3b82f6] hover:shadow-[0_2px_0_#3b82f6] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all cursor-pointer">
                    <div class="bg-white rounded-[20px] overflow-hidden h-56 flex flex-col">
                        <div class="h-36 relative">
                            <img src="../images/thumb_science.png" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black/10 flex flex-col items-center justify-center">
                                <div class="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg group-hover:scale-110 transition-transform">
                                    <i class="fa-solid fa-play text-lg ml-1"></i>
                                </div>
                            </div>
                            <div class="absolute bottom-2 left-2 bg-white/90 backdrop-blur text-[#1e40af] font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                Science
                            </div>
                        </div>
                        <div class="flex-1 flex flex-col items-center justify-center p-3 text-center bg-[#93c5fd]/20">
                            <h3 class="font-extrabold text-[#1e3a8a] text-sm leading-tight drop-shadow-sm">Fizzing Volcano<br>Fun!</h3>
                        </div>
                    </div>
                </div>

                <!-- Art -->
                <div class="group relative rounded-3xl bg-[#fef08a] border-[4px] border-[#fde047] p-[4px] shadow-[0_6px_0_#eab308] hover:shadow-[0_2px_0_#eab308] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all cursor-pointer">
                    <div class="bg-white rounded-[20px] overflow-hidden h-56 flex flex-col">
                        <div class="h-36 relative">
                            <img src="../images/thumb_art.png" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black/10 flex flex-col items-center justify-center">
                                <div class="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg group-hover:scale-110 transition-transform">
                                    <i class="fa-solid fa-play text-lg ml-1"></i>
                                </div>
                            </div>
                            <div class="absolute bottom-2 left-2 bg-white/90 backdrop-blur text-[#854d0e] font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                Art
                            </div>
                        </div>
                        <div class="flex-1 flex flex-col items-center justify-center p-3 text-center bg-[#fef08a]/20">
                            <h3 class="font-extrabold text-[#713f12] text-sm leading-tight drop-shadow-sm">Creative<br>Corner</h3>
                        </div>
                    </div>
                </div>

                <!-- Gaming -->
                <div class="group relative rounded-3xl bg-[#86efac] border-[4px] border-[#4ade80] p-[4px] shadow-[0_6px_0_#22c55e] hover:shadow-[0_2px_0_#22c55e] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all cursor-pointer">
                    <div class="bg-white rounded-[20px] overflow-hidden h-56 flex flex-col">
                        <div class="h-36 relative">
                            <img src="../images/thumb_gaming.png" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black/10 flex flex-col items-center justify-center">
                                <div class="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg group-hover:scale-110 transition-transform">
                                    <i class="fa-solid fa-play text-lg ml-1"></i>
                                </div>
                            </div>
                            <div class="absolute bottom-2 left-2 bg-white/90 backdrop-blur text-[#166534] font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                Gaming
                            </div>
                        </div>
                        <div class="flex-1 flex flex-col items-center justify-center p-3 text-center bg-[#86efac]/20">
                            <h3 class="font-extrabold text-[#14532d] text-sm leading-tight drop-shadow-sm">Blocky<br>Adventures</h3>
                        </div>
                    </div>
                </div>

                <!-- Nature -->
                <div class="group relative rounded-3xl bg-[#d8b4fe] border-[4px] border-[#c084fc] p-[4px] shadow-[0_6px_0_#9333ea] hover:shadow-[0_2px_0_#9333ea] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all cursor-pointer">
                    <div class="bg-white rounded-[20px] overflow-hidden h-56 flex flex-col">
                        <div class="h-36 relative">
                            <img src="../images/thumb_nature.png" class="w-full h-full object-cover">
                            <div class="absolute inset-0 bg-black/10 flex flex-col items-center justify-center">
                                <div class="w-12 h-12 bg-black/60 rounded-full flex items-center justify-center text-white backdrop-blur-sm shadow-lg group-hover:scale-110 transition-transform">
                                    <i class="fa-solid fa-play text-lg ml-1"></i>
                                </div>
                            </div>
                            <div class="absolute bottom-2 left-2 bg-white/90 backdrop-blur text-[#581c87] font-black text-[10px] px-3 py-1 rounded-full uppercase tracking-wider shadow-sm">
                                Nature
                            </div>
                        </div>
                        <div class="flex-1 flex flex-col items-center justify-center p-3 text-center bg-[#d8b4fe]/20">
                            <h3 class="font-extrabold text-[#4c1d95] text-sm leading-tight drop-shadow-sm">Animal<br>Wonders</h3>
                        </div>
                    </div>
                </div>

            </div>
        </div>
        
        <!-- QUICK GAMES SECTION -->"""

html = re.sub(pattern_hero, hero_html, html, flags=re.DOTALL)

pattern_filter_chips = r'<!-- FILTER CHIPS \(Moved Below Quick Games\) -->.*?<!-- LEARNING PATHS -->'
filter_chips_html = """<!-- FILTER CHIPS (Moved Below Quick Games) -->
        <div class="px-6 py-2 flex gap-3 overflow-x-auto no-scrollbar pb-4 relative z-10">
            <button class="px-6 py-2 bg-gray-900 text-white rounded-full font-bold text-sm whitespace-nowrap shadow-md hover:scale-105 transition-transform">All</button>
            <button class="px-6 py-2 bg-white text-gray-700 border-2 border-transparent rounded-full font-bold text-sm whitespace-nowrap shadow-sm hover:border-gray-200 transition-colors">Cartoons</button>
            <button class="px-6 py-2 bg-white text-gray-700 border-2 border-transparent rounded-full font-bold text-sm whitespace-nowrap shadow-sm hover:border-gray-200 transition-colors">Learning</button>
            <button class="px-6 py-2 bg-white text-gray-700 border-2 border-transparent rounded-full font-bold text-sm whitespace-nowrap shadow-sm hover:border-gray-200 transition-colors">Music</button>
            <button class="px-6 py-2 bg-white text-gray-700 border-2 border-transparent rounded-full font-bold text-sm whitespace-nowrap shadow-sm hover:border-gray-200 transition-colors">Minecraft</button>
        </div>

        <!-- LEARNING PATHS -->"""
html = re.sub(pattern_filter_chips, filter_chips_html, html, flags=re.DOTALL)

pattern_quick_games = r'<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">.*?</div>\s*</div>\s*<!-- FILTER CHIPS'
quick_games_html = """<div class="grid grid-cols-1 sm:grid-cols-3 gap-6">
                <!-- Game 1 -->
                <a href="games.html" class="block group relative">
                    <div class="bg-[#bfdbfe] border-[4px] border-[#93c5fd] rounded-3xl p-6 text-center shadow-[0_6px_0_#93c5fd] hover:shadow-[0_2px_0_#93c5fd] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all min-h-[140px] flex flex-col items-center justify-center overflow-hidden">
                        <!-- Floral decorative corner -->
                        <i class="fa-solid fa-seedling absolute bottom-2 left-3 text-blue-400 text-2xl rotate-45 opacity-50"></i>
                        <i class="fa-solid fa-leaf absolute top-2 right-3 text-blue-400 text-2xl -rotate-45 opacity-50"></i>
                        
                        <div class="w-12 h-12 bg-white/70 rounded-2xl flex items-center justify-center text-2xl mb-3 shadow-sm border border-white text-blue-600 font-extrabold leading-tight">
                            <span class="text-sm">12<br>34</span>
                        </div>
                        <h3 class="font-extrabold text-blue-900 text-xl tracking-tight">Math Adventure</h3>
                    </div>
                </a>
                <!-- Game 2 -->
                <a href="games.html" class="block group relative">
                    <div class="bg-[#bbf7d0] border-[4px] border-[#86efac] rounded-3xl p-6 text-center shadow-[0_6px_0_#86efac] hover:shadow-[0_2px_0_#86efac] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all min-h-[140px] flex flex-col items-center justify-center overflow-hidden">
                        <!-- Floral decorative corner -->
                        <i class="fa-solid fa-seedling absolute bottom-2 left-3 text-green-500 text-2xl rotate-45 opacity-50"></i>
                        <i class="fa-solid fa-leaf absolute top-2 right-3 text-green-500 text-2xl -rotate-45 opacity-50"></i>
                        
                        <div class="w-12 h-12 bg-white/70 rounded-2xl flex items-center justify-center text-xl mb-3 shadow-sm border border-white text-green-700 font-extrabold">
                            <i class="fa-solid fa-pen"></i>
                        </div>
                        <h3 class="font-extrabold text-green-900 text-xl tracking-tight">Word Builder</h3>
                    </div>
                </a>
                <!-- Game 3 -->
                <a href="games.html" class="block group relative">
                    <div class="bg-[#fbcfe8] border-[4px] border-[#f9a8d4] rounded-3xl p-6 text-center shadow-[0_6px_0_#f9a8d4] hover:shadow-[0_2px_0_#f9a8d4] hover:translate-y-1 active:translate-y-2 active:shadow-none transition-all min-h-[140px] flex flex-col items-center justify-center overflow-hidden">
                        <!-- Floral decorative corner -->
                        <i class="fa-solid fa-seedling absolute bottom-2 left-3 text-pink-500 text-2xl rotate-45 opacity-50"></i>
                        <i class="fa-solid fa-leaf absolute top-2 right-3 text-pink-500 text-2xl -rotate-45 opacity-50"></i>
                        
                        <div class="w-12 h-12 bg-white/70 rounded-2xl flex items-center justify-center text-xl mb-3 shadow-sm border border-white text-pink-600 font-extrabold">
                            <i class="fa-solid fa-palette"></i>
                        </div>
                        <h3 class="font-extrabold text-pink-900 text-xl tracking-tight">Art Studio</h3>
                    </div>
                </a>
            </div>
        </div>
        <!-- FILTER CHIPS"""
html = re.sub(pattern_quick_games, quick_games_html, html, flags=re.DOTALL)

with open('c:/Users/Admin/Documents/cubbycove/kid/home_logged_in.html', 'w', encoding='utf-8') as f:
    f.write(html)
print("Updated home_logged_in.html with new grid formatting!")
