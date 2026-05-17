<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Input Interface Recreation</title>
    
    <!-- Tailwind CSS -->
    <script src="https://cdn.tailwindcss.com"></script>
    
    <!-- Lucide Icons -->
    <script src="https://unpkg.com/lucide@latest"></script>
    
    <!-- Google Fonts: Inter -->
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;900&display=swap" rel="stylesheet">

    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f7f7f9;
            /* Exact recreation of the dashed grid pattern */
            background-image: url("data:image/svg+xml,%3csvg width='80' height='80' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M 80 0 L 0 0 0 80' fill='none' stroke='%23e6e7eb' stroke-width='1.2' stroke-dasharray='4 4'/%3e%3c/svg%3e");
            -webkit-font-smoothing: antialiased;
        }

        /* The original premium gradient border you liked */
        .premium-border-gradient {
            background: linear-gradient(110deg, 
                #ff9a9e 0%, 
                #fecfef 20%, 
                #e0c3fc 40%, 
                #8ec5fc 60%, 
                #a8edea 80%, 
                #d4fc79 100%
            );
        }

        /* Hide scrollbar completely to prevent overlapping rounded corners */
        .no-scrollbar::-webkit-scrollbar {
            display: none;
        }
        .no-scrollbar {
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center relative overflow-hidden">

    <!-- Main Centered Container -->
    <div class="w-full max-w-[640px] flex flex-col px-4 z-10">

        <!-- ========================================== -->
        <!-- TWO-LAYER BOXED STYLE WITH GRADIENT        -->
        <!-- ========================================== -->
        
        <!-- Gradient Border Wrapper -->
        <div class="rounded-[24px] p-[2px] premium-border-gradient relative z-10">
            
            <!-- OUTER BOX (Layer 1 - White) -->
            <div class="bg-white w-full rounded-[22px] p-2 flex flex-col">
                
                <!-- Header (Tight padding to save space) -->
                <div class="flex justify-between items-center w-full px-2 pt-2 pb-3">
                    <div class="flex items-center gap-1.5 text-[11px] font-bold text-gray-600 uppercase tracking-wide">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-gray-700"></i>
                        <span>Drawgle UI V2.0</span>
                    </div>
                    
                    <button class="flex items-center gap-1.5 text-[11px] font-bold text-gray-800 uppercase tracking-wide hover:opacity-70 transition-opacity">
                        <i data-lucide="sparkles" class="w-3.5 h-3.5 text-gray-800"></i>
                        <span>Pro</span>
                    </button>
                </div>

                <!-- INNER BOX (Layer 2 - Light Gray, Relative Container) -->
                <!-- Removed overflow-hidden here so the dropdown can pop out! -->
                <div class="relative flex flex-col rounded-2xl bg-[#f4f4f6] border border-gray-100">
                    
                    <!-- Textarea Container -->
                    <div class="overflow-y-auto max-h-[300px] no-scrollbar rounded-2xl">
                        <textarea 
                            placeholder="Describe the app UI you want to design... e.g., A minimalist dashboard for a fintech app with dark mode." 
                            class="w-full min-h-[110px] bg-transparent outline-none text-[15px] placeholder:text-gray-400 text-gray-800 resize-none px-4 pt-4 pb-16 leading-relaxed no-scrollbar"
                        ></textarea>
                    </div>

                    <!-- Absolute Toolbar (Floats inside the inner box) -->
                    <div class="absolute right-2 bottom-2 left-2 flex justify-between items-center">
                        
                        <div class="flex items-center gap-2">
                            <!-- File Upload Icon (Clean Thin Border) -->
                            <button class="w-[36px] h-[36px] rounded-xl bg-white border border-gray-200 hover:bg-gray-50 text-gray-600 flex items-center justify-center transition-colors">
                                <i data-lucide="image-plus" class="w-4 h-4 stroke-[2]"></i>
                            </button>

                            <!-- Themes Dropdown Pill (Clean Thin Border) -->
                            <div class="relative group dropdown-container">
                                <button class="flex items-center gap-1.5 px-3 h-[36px] rounded-xl border border-gray-200 bg-white hover:bg-gray-50 transition-colors relative z-20">
                                    <i data-lucide="palette" class="w-4 h-4 text-gray-600 stroke-[1.5]"></i>
                                    <span class="text-[13px] font-medium text-gray-700">Themes</span>
                                    <i data-lucide="chevron-down" class="w-3 h-3 text-gray-400 group-hover:rotate-180 transition-transform duration-200"></i>
                                </button>
                                
                                <!-- THEMES GRID DROPDOWN (Rigid Thin Border, No Shadow) -->
                                <div class="absolute bottom-full left-0 mb-2 w-[280px] bg-white border border-gray-200 rounded-[16px] opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 transform origin-bottom translate-y-1 group-hover:translate-y-0 z-[100] p-3 shadow-none">
                                    
                                    <!-- Dropdown Header -->
                                    <div class="flex justify-between items-center mb-3 px-1">
                                        <span class="text-[12px] font-semibold text-gray-800">Design style</span>
                                        <i data-lucide="x" class="w-3.5 h-3.5 text-gray-400 hover:text-gray-700 transition-colors cursor-pointer"></i>
                                    </div>

                                    <!-- Grid Layout for Themes -->
                                    <div class="grid grid-cols-2 gap-3">
                                        
                                        <!-- Theme: Auto (Active State) -->
                                        <div class="flex flex-col gap-1.5 cursor-pointer group/item">
                                            <!-- Orange border for active selection -->
                                            <div class="h-[60px] rounded-xl border-[1.5px] border-orange-500 bg-[#f4f3ed] flex justify-center items-center transition-colors">
                                                <i data-lucide="sparkles" class="w-5 h-5 text-gray-400"></i>
                                            </div>
                                            <span class="text-[11px] font-semibold text-gray-700">Auto</span>
                                        </div>

                                        <!-- Theme: Neo-Brutalism -->
                                        <div class="flex flex-col gap-1.5 cursor-pointer group/item">
                                            <div class="h-[60px] rounded-xl border border-gray-200 bg-black flex justify-center items-center transition-colors group-hover/item:border-gray-400">
                                                <span class="text-[18px] font-black text-[#ccff00] tracking-tighter">Aa</span>
                                            </div>
                                            <span class="text-[11px] font-medium text-gray-600">Neo-Brutalism</span>
                                        </div>

                                        <!-- Theme: Glassmorphism -->
                                        <div class="flex flex-col gap-1.5 cursor-pointer group/item">
                                            <div class="h-[60px] rounded-xl border border-gray-200 bg-gradient-to-br from-indigo-900 via-purple-800 to-fuchsia-900 flex justify-center items-center transition-colors group-hover/item:border-gray-400">
                                                <span class="text-[18px] font-medium text-white/90 italic tracking-wide" style="font-family: serif;">Aa</span>
                                            </div>
                                            <span class="text-[11px] font-medium text-gray-600">Glassmorphism</span>
                                        </div>

                                        <!-- Theme: Playful Whimsical -->
                                        <div class="flex flex-col gap-1.5 cursor-pointer group/item">
                                            <div class="h-[60px] rounded-xl border border-gray-200 bg-[#ffff80] flex justify-center items-center transition-colors relative overflow-hidden group-hover/item:border-gray-400">
                                                <div class="absolute -top-1.5 -left-1.5 w-6 h-6 bg-pink-400 rounded-full"></div>
                                                <div class="absolute bottom-1 right-2 w-2.5 h-2.5 bg-cyan-400 rounded-full"></div>
                                                <span class="text-[18px] font-bold text-pink-600 relative z-10">Aa</span>
                                            </div>
                                            <span class="text-[11px] font-medium text-gray-600">Playful Whimsical</span>
                                        </div>

                                    </div>
                                </div>
                            </div>
                        </div>

                        <!-- Active Submit Button (Black, Rounded) -->
                        <button class="w-[36px] h-[36px] rounded-xl bg-black hover:bg-gray-800 text-white flex items-center justify-center transition-transform active:scale-95 flex-shrink-0 z-20">
                            <i data-lucide="arrow-up" class="w-4 h-4 stroke-[2.5]"></i>
                        </button>
                        
                    </div>
                </div> <!-- End Inner Box -->
            </div> <!-- End Outer Box -->
        </div>
    </div>

    <!-- ========================================== -->
    <!-- FOOTER CONTEXT ELEMENTS                    -->
    <!-- ========================================== -->
    
    <!-- User Avatar & Handle (Bottom Left) -->
    <div class="absolute bottom-8 left-8 flex items-center gap-2 z-0">
        <img src="https://i.pravatar.cc/100?img=11" alt="User Avatar" class="w-6 h-6 rounded-full border border-gray-200 shadow-sm object-cover" />
        <span class="text-[12px] font-medium text-gray-400 tracking-wide">@disarto_max</span>
    </div>

    <!-- Branding/Label (Bottom Right) -->
    <div class="absolute bottom-8 right-8 z-0">
        <span class="text-[12px] font-medium text-gray-400 tracking-wide">Drawgle AI</span>
    </div>

    <!-- Initialize Icons -->
    <script>
        lucide.createIcons();
    </script>
</body>
</html>