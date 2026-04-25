<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Volumetric 3D UI</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                    colors: {
                        textPrimary: '#111827',
                        textSecondary: '#6b7280',
                    }
                }
            }
        }
    </script>
    <style>
        /* * THE SECRET SAUCE FOR THE "SWELLING" 3D FEEL 
         */
         
        /* 1. The Pillowy White Container Base */
        .neo-container {
            background-color: #ffffff;
            /* Removed all shadows and added a crisp, thin border */
            box-shadow: none !important;
            border: 1px solid rgba(0, 0, 0, 0.08) !important;
        }

        /* 2. The Volumetric "Swelling" Black Button */
        .neo-dark-btn {
            /* Vertical gradient to simulate curvature (lighter top, dark bottom) */
            background: linear-gradient(180deg, #38383b 0%, #111112 100%) !important;
            box-shadow: 
                inset 0px 1.5px 1px rgba(255, 255, 255, 0.35), /* Sharp, tight white reflection on the top lip */
                inset 0px 6px 10px rgba(255, 255, 255, 0.1),   /* Soft white volume swelling the top half */
                inset 0px -2px 4px rgba(0, 0, 0, 0.6),         /* Dark bottom inner shadow wrapping the edge */
                0px 3px 8px -3px rgba(0, 0, 0, 0.5),          /* Tighter outer drop shadow */
                0px 2px 4px -1px rgba(0, 0, 0, 0.3) !important; /* Closer grounding shadow */
            border: none !important;
            transition: all 0.2s ease;
        }

        /* 3. Physical Press Animation */
        .neo-dark-btn:active {
            transform: translateY(2px);
            box-shadow: 
                inset 0px 2px 4px rgba(0, 0, 0, 0.6), 
                inset 0px 4px 8px rgba(0, 0, 0, 0.4),
                0px 2px 4px rgba(0, 0, 0, 0.2) !important;
        }

        /* 4. Inactive Light Buttons (solid cool gray, no glass effect) */
        .neo-light-btn {
            background-color: #e2e4e8; /* Solid cool gray */
            box-shadow: inset 0px 1px 2px rgba(0, 0, 0, 0.05); /* Extremely subtle deboss, no white highlight */
            border: none !important;
        }
        .neo-light-btn:hover {
            background-color: #d1d5db;
        }
    </style>
</head>
<!-- Notice the background is slightly gray (#eaedf1) so the white container shadows pop! -->
<body class="bg-[#eaedf1] antialiased flex items-center justify-center min-h-screen m-0 py-10">

    <!-- Main Wrapper -->
    <div class="flex flex-col items-center gap-6 sm:gap-8 w-full px-4">
        
        <!-- Row 1: Tabs -->
        <div class="flex items-center gap-1 p-2 rounded-[18px] neo-container w-max max-w-full overflow-x-auto no-scrollbar">
            <!-- Active Tab -->
            <button class="px-5 py-2.5 sm:px-8 sm:py-[10px] rounded-[14px] text-sm sm:text-[15px] font-medium text-white neo-dark-btn whitespace-nowrap focus:outline-none">Storage</button>
            <!-- Inactive Tabs -->
            <button class="px-5 py-2.5 sm:px-8 sm:py-[10px] rounded-[14px] text-sm sm:text-[15px] font-medium text-textSecondary hover:text-textPrimary transition-colors whitespace-nowrap focus:outline-none bg-transparent">Inactive</button>
            <button class="px-5 py-2.5 sm:px-8 sm:py-[10px] rounded-[14px] text-sm sm:text-[15px] font-medium text-textSecondary hover:text-textPrimary transition-colors whitespace-nowrap focus:outline-none bg-transparent mr-2">Inactive</button>
        </div>

        <!-- Row 2: Pagination -->
        <div class="flex items-center gap-1.5 sm:gap-2 p-1.5 rounded-[18px] neo-container w-max">
            <button class="w-9 h-9 sm:w-11 sm:h-11 flex items-center justify-center text-textSecondary hover:text-textPrimary transition-colors focus:outline-none rounded-[14px] bg-transparent ml-1">
                <svg class="w-4 h-4 sm:w-5 sm:h-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 18 9 12 15 6"></polyline></svg>
            </button>
            <!-- Active Page -->
            <button class="w-9 h-9 sm:w-[46px] sm:h-[46px] flex items-center justify-center rounded-[14px] text-white neo-dark-btn font-medium text-sm sm:text-[15px] focus:outline-none">1</button>
            <!-- Inactive Pages -->
            <button class="w-9 h-9 sm:w-[44px] sm:h-[44px] flex items-center justify-center rounded-[14px] text-textSecondary font-medium text-sm sm:text-[15px] neo-light-btn transition-colors focus:outline-none">2</button>
            <button class="w-9 h-9 sm:w-[44px] sm:h-[44px] flex items-center justify-center rounded-[14px] text-textSecondary font-medium text-sm sm:text-[15px] neo-light-btn transition-colors focus:outline-none">3</button>
            <button class="w-9 h-9 sm:w-[44px] sm:h-[44px] flex items-center justify-center rounded-[14px] text-textSecondary font-medium text-sm sm:text-[15px] neo-light-btn transition-colors focus:outline-none">4</button>
            <button class="w-9 h-9 sm:w-[44px] sm:h-[44px] flex items-center justify-center rounded-[14px] text-textSecondary font-medium text-sm sm:text-[15px] neo-light-btn transition-colors focus:outline-none mr-1">5</button>
        </div>

        <!-- Row 3: Checkboxes and Tools -->
        <div class="flex items-center justify-center flex-wrap gap-4 sm:gap-6 w-full mt-2">
            
            <!-- Checkbox Container -->
            <div class="flex items-center gap-5 sm:gap-7 neo-container p-2 pl-3 sm:pl-4 pr-5 sm:pr-8 rounded-[20px]">
                <!-- Active Check -->
                <label class="flex items-center gap-3 sm:gap-4 cursor-pointer group">
                    <div class="w-8 h-8 sm:w-[42px] sm:h-[42px] flex items-center justify-center rounded-[12px] neo-dark-btn">
                        <svg class="w-4 h-4 sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span class="text-textPrimary font-medium text-sm sm:text-[16px] select-none">Check</span>
                </label>
                
                <!-- Inactive Check -->
                <label class="flex items-center gap-3 sm:gap-4 cursor-pointer group">
                    <div class="w-8 h-8 sm:w-[42px] sm:h-[42px] flex items-center justify-center rounded-[12px] neo-light-btn transition-all">
                        <svg class="w-4 h-4 sm:w-[18px] sm:h-[18px]" viewBox="0 0 24 24" fill="none" stroke="#a0aab5" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
                    </div>
                    <span class="text-textPrimary font-medium text-sm sm:text-[16px] select-none">Check</span>
                </label>
            </div>

            <!-- Premium Tools Block -->
            <div class="flex items-center neo-container p-1.5 rounded-[18px]">
                <button class="bg-transparent hover:bg-gray-50 flex items-center justify-center w-10 h-10 sm:w-[46px] sm:h-[46px] rounded-[14px] text-textPrimary transition-all active:scale-95 focus:outline-none">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <line x1="4" y1="12" x2="20" y2="12"></line>
                        <line x1="4" y1="6" x2="20" y2="6"></line>
                        <line x1="4" y1="18" x2="20" y2="18"></line>
                    </svg>
                </button>

                <div class="w-1"></div>

                <button class="neo-dark-btn flex items-center justify-center w-10 h-10 sm:w-[46px] sm:h-[46px] rounded-[14px] text-white focus:outline-none">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="white">
                        <rect x="4" y="4" width="6.5" height="6.5" rx="1.5" />
                        <rect x="13.5" y="4" width="6.5" height="6.5" rx="1.5" />
                        <rect x="4" y="13.5" width="6.5" height="6.5" rx="1.5" />
                        <rect x="13.5" y="13.5" width="6.5" height="6.5" rx="1.5" />
                    </svg>
                </button>
            </div>
        </div>


        <!-- Row 4: Segmented Aspect Ratio Control -->
        <div class="flex flex-col items-center gap-3 w-full mt-4">
            <div class="flex items-center gap-1 p-2 rounded-[18px] neo-container w-max">
                <button class="px-6 sm:px-8 py-2.5 rounded-[14px] text-sm sm:text-[15px] font-medium text-textSecondary hover:text-textPrimary transition-colors focus:outline-none">9:16</button>
                <button class="px-6 sm:px-8 py-2.5 rounded-[14px] text-sm sm:text-[15px] font-medium text-white neo-dark-btn focus:outline-none">4:5</button>
                <button class="px-6 sm:px-8 py-2.5 rounded-[14px] text-sm sm:text-[15px] font-medium text-textSecondary hover:text-textPrimary transition-colors focus:outline-none">3:4</button>
            </div>
        </div>

       

    </div>

</body>
</html>



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
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&display=swap" rel="stylesheet">

    <style>
        body {
            font-family: 'Inter', sans-serif;
            background-color: #f7f7f9;
            /* Exact recreation of the dashed grid pattern */
            background-image: url("data:image/svg+xml,%3csvg width='80' height='80' xmlns='http://www.w3.org/2000/svg'%3e%3cpath d='M 80 0 L 0 0 0 80' fill='none' stroke='%23e6e7eb' stroke-width='1.2' stroke-dasharray='4 4'/%3e%3c/svg%3e");
            -webkit-font-smoothing: antialiased;
        }

        /* Complex gradient for the premium border state */
        .premium-border-gradient {
            background: linear-gradient(110deg, 
                #ff9a9e 0%,    /* Pinkish red */
                #fecfef 20%,   /* Soft pink */
                #e0c3fc 40%,   /* Soft purple */
                #8ec5fc 60%,   /* Light blue */
                #a8edea 80%,   /* Light teal/green */
                #d4fc79 100%   /* Soft yellow-green */
            );
        }

        /* Subtle glowing shadow for the bottom component */
        .premium-shadow {
            box-shadow: 0 20px 40px -15px rgba(200, 170, 240, 0.4);
        }

        /* Standard subtle shadow for the top component */
        .standard-shadow {
            box-shadow: 0 12px 36px -12px rgba(0, 0, 0, 0.06);
        }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center relative overflow-hidden">

    <!-- Main Centered Container -->
    <div class="w-full max-w-[640px] flex flex-col gap-14 px-4 z-10">

        <!-- ========================================== -->
        <!-- TOP COMPONENT (Standard State)             -->
        <!-- ========================================== -->
        <div class="bg-white rounded-[24px] p-4 standard-shadow border border-gray-100">
            
            <!-- Input Area -->
            <div class="flex items-center gap-3 w-full px-1 pb-3">
                <button class="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                    <i data-lucide="plus" class="w-[22px] h-[22px] stroke-[1.5]"></i>
                </button>
                
                <input type="text" placeholder="Ask anything..." class="flex-1 bg-transparent outline-none text-[15px] placeholder:text-gray-400 text-gray-800" />
                
                <button class="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                    <i data-lucide="mic" class="w-[20px] h-[20px] stroke-[1.5]"></i>
                </button>
                
                <button class="w-[32px] h-[32px] rounded-full bg-[#111] hover:bg-black text-white flex items-center justify-center shadow-md transition-transform active:scale-95 flex-shrink-0">
                    <!-- Standard state waveform icon -->
                    <i data-lucide="audio-lines" class="w-4 h-4 stroke-[2]"></i>
                </button>
            </div>

            <!-- Toolbar Area -->
            <div class="flex justify-between items-center mt-1">
                
                <!-- Left tool group -->
                <div class="flex items-center gap-2">
                    <!-- Model Pill -->
                    <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-[#fefefe] shadow-sm hover:bg-gray-50 transition-colors">
                        <i data-lucide="hexagon" class="w-3.5 h-3.5 text-gray-500 stroke-[1.5]"></i>
                        <span class="text-[12px] font-medium text-gray-600">GPT 5.4</span>
                    </button>
                    
                    <!-- Icons Pill -->
                    <div class="flex items-center rounded-full border border-gray-200 bg-[#fefefe] shadow-sm overflow-hidden h-[30px]">
                        <button class="px-2.5 h-full hover:bg-gray-50 text-gray-400 flex items-center justify-center transition-colors">
                            <i data-lucide="refresh-cw" class="w-3.5 h-3.5 stroke-[1.5]"></i>
                        </button>
                        <div class="w-[1px] h-3.5 bg-gray-200"></div>
                        <button class="px-2.5 h-full hover:bg-gray-50 text-gray-400 flex items-center justify-center transition-colors">
                            <i data-lucide="mouse-pointer-2" class="w-3.5 h-3.5 stroke-[1.5]"></i>
                        </button>
                        <div class="w-[1px] h-3.5 bg-gray-200"></div>
                        <button class="px-2.5 h-full hover:bg-gray-50 text-gray-400 flex items-center justify-center transition-colors">
                            <i data-lucide="globe" class="w-3.5 h-3.5 stroke-[1.5]"></i>
                        </button>
                    </div>
                </div>

                <!-- Right tool group -->
                <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-[#fefefe] shadow-sm hover:bg-gray-50 transition-colors">
                    <i data-lucide="layout-template" class="w-3.5 h-3.5 text-gray-500 stroke-[1.5]"></i>
                    <span class="text-[12px] font-medium text-gray-600">Promt library</span>
                </button>
                
            </div>
        </div>


        <!-- ========================================== -->
        <!-- BOTTOM COMPONENT (Premium Active State)    -->
        <!-- ========================================== -->
        
        <!-- Gradient Border Wrapper (p-[1.5px] creates the thin border effect) -->
        <div class="rounded-[24px] p-[1.5px] premium-border-gradient premium-shadow relative z-10">
            
            <!-- Inner White Container -->
            <div class="bg-white w-full h-full rounded-[22.5px] px-4 pt-3 pb-4 flex flex-col">
                
                <!-- Header (Opus 4.7 Update) -->
                <div class="flex justify-between items-center w-full px-1 pb-2">
                    <div class="flex items-center gap-1.5 text-[11px] font-medium text-gray-400">
                        <!-- Custom colored icon for the "New" badge -->
                        <svg class="w-3.5 h-3.5 text-[#8ab4f8]" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M9.937 15.5A2 2 0 0 0 8.5 14.063l-6.135-1.582a.5.5 0 0 1 0-.962L8.5 9.936A2 2 0 0 0 9.937 8.5l1.582-6.135a.5.5 0 0 1 .963 0L14.063 8.5A2 2 0 0 0 15.5 9.937l6.135 1.581a.5.5 0 0 1 0 .964L15.5 14.063a2 2 0 0 0-1.437 1.437l-1.582 6.135a.5.5 0 0 1-.963 0z"/>
                        </svg>
                        <span>New: Opus 4.7 is available</span>
                    </div>
                    
                    <button class="flex items-center gap-1.5 text-[11px] font-medium text-gray-700 hover:opacity-80 transition-opacity">
                        <!-- Bright orange filled sparkle icon -->
                        <svg class="w-3.5 h-3.5 text-[#ff8b53] fill-[#ff8b53]" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round">
                             <path d="m12 3-1.912 5.813a2 2 0 0 1-1.275 1.275L3 12l5.813 1.912a2 2 0 0 1 1.275 1.275L12 21l1.912-5.813a2 2 0 0 1 1.275-1.275L21 12l-5.813-1.912a2 2 0 0 1-1.275-1.275L12 3Z"/>
                        </svg>
                        <span>Try Opus 4.7</span>
                    </button>
                </div>

                <!-- Input Area -->
                <div class="flex items-center gap-3 w-full px-1 py-1 pb-3">
                    <button class="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                        <i data-lucide="plus" class="w-[22px] h-[22px] stroke-[1.5]"></i>
                    </button>
                    
                    <!-- Active text with blinking cursor -->
                    <div class="flex-1 text-[15px] text-gray-800 flex items-center h-6">
                        What's my next
                        <div class="w-[1.5px] h-[18px] bg-[#3b82f6] ml-[2px] animate-pulse rounded-full"></div>
                    </div>
                    
                    <button class="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
                        <i data-lucide="mic" class="w-[20px] h-[20px] stroke-[1.5]"></i>
                    </button>
                    
                    <!-- Active Submit Button -->
                    <button class="w-[32px] h-[32px] rounded-full bg-[#111] hover:bg-black text-white flex items-center justify-center shadow-md transition-transform active:scale-95 flex-shrink-0">
                        <i data-lucide="arrow-up" class="w-4 h-4 stroke-[2.5]"></i>
                    </button>
                </div>

                <!-- Toolbar Area (Same as top) -->
                <div class="flex justify-between items-center mt-1">
                    
                    <div class="flex items-center gap-2">
                        <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-[#fefefe] shadow-sm hover:bg-gray-50 transition-colors">
                            <i data-lucide="hexagon" class="w-3.5 h-3.5 text-gray-500 stroke-[1.5]"></i>
                            <span class="text-[12px] font-medium text-gray-600">GPT 5.4</span>
                        </button>
                        
                        <div class="flex items-center rounded-full border border-gray-200 bg-[#fefefe] shadow-sm overflow-hidden h-[30px]">
                            <button class="px-2.5 h-full hover:bg-gray-50 text-gray-400 flex items-center justify-center transition-colors">
                                <i data-lucide="refresh-cw" class="w-3.5 h-3.5 stroke-[1.5]"></i>
                            </button>
                            <div class="w-[1px] h-3.5 bg-gray-200"></div>
                            <button class="px-2.5 h-full hover:bg-gray-50 text-gray-400 flex items-center justify-center transition-colors">
                                <i data-lucide="mouse-pointer-2" class="w-3.5 h-3.5 stroke-[1.5]"></i>
                            </button>
                            <div class="w-[1px] h-3.5 bg-gray-200"></div>
                            <button class="px-2.5 h-full hover:bg-gray-50 text-gray-400 flex items-center justify-center transition-colors">
                                <i data-lucide="globe" class="w-3.5 h-3.5 stroke-[1.5]"></i>
                            </button>
                        </div>
                    </div>

                    <button class="flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-gray-200 bg-[#fefefe] shadow-sm hover:bg-gray-50 transition-colors">
                        <i data-lucide="layout-template" class="w-3.5 h-3.5 text-gray-500 stroke-[1.5]"></i>
                        <span class="text-[12px] font-medium text-gray-600">Promt library</span>
                    </button>
                    
                </div>
            </div>
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
        <span class="text-[12px] font-medium text-gray-400 tracking-wide">AI Input</span>
    </div>

    <!-- Initialize Icons -->
    <script>
        lucide.createIcons();
    </script>
</body>
</html>











