<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>AI Video Prompt UI</title>
    <script src="https://cdn.tailwindcss.com"></script>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
    <script>
        tailwind.config = {
            theme: {
                extend: {
                    fontFamily: {
                        sans: ['Inter', 'sans-serif'],
                    },
                    colors: {
                        bgMain: '#f4f5f5',
                        wireframeStroke: '#e5e7eb',
                        cardBg: '#ffffff',
                        toolbarBg: '#f2f3f5',
                        toolbarBtnActive: '#e5e6e8',
                        textPrimary: '#1a1a1a',
                        textSecondary: '#666666',
                        accentBlue: '#2563eb',
                        thumb1Green: '#1C5F4A',
                        thumb1Orange: '#E46A2A',
                        thumb2Green: '#124C3B',
                        thumb3Orange: '#DF5A26',
                        thumb3Red: '#CD332B'
                    },
                    boxShadow: {
                        /* Added the subtle 1px structural shadow to the main card alongside its large blur */
                        'card': '0 1px 2px rgba(0, 0, 0, 0.03), 0 24px 60px -15px rgba(0, 0, 0, 0.1), 0 10px 30px -10px rgba(0, 0, 0, 0.05)',
                        'btn': '0 2px 6px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
                        'btnSubmit': '0 4px 12px rgba(0, 0, 0, 0.15)',
                    }
                }
            }
        }
    </script>
    <style>
        body {
            background-color: #f4f5f5;
            overflow: hidden;
        }

        /* Subtle blinking cursor animation */
        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
        .cursor-blink {
            animation: blink 1s step-end infinite;
            color: #2563eb;
            font-weight: 300;
            margin-left: 1px;
            display: inline-block;
            transform: translateY(-1px);
        }

        /* CSS Art for Thumbnails to avoid external dependencies while maintaining aesthetic */
        .thumb-1::before {
            content: '';
            position: absolute;
            right: 0; top: 0; bottom: 0;
            width: 55%;
            background-color: #E46A2A;
        }
        .thumb-1::after {
            content: '';
            position: absolute;
            bottom: 0; left: 50%;
            transform: translateX(-50%);
            width: 48px; height: 50px;
            background-color: #F2A77A; /* skin tone approx */
            border-radius: 20px 20px 0 0;
            border: 4px solid #1C5F4A;
            z-index: 10;
        }
        .thumb-1-detail {
            position: absolute;
            bottom: 10px; left: 50%;
            transform: translateX(-50%);
            width: 60px; height: 24px;
            background-color: #1C56A4; /* blue pants approx */
            border-radius: 12px;
            z-index: 20;
            box-shadow: 0 4px 0 #E3342F; /* red shoes approx */
        }

        .thumb-2::before {
            content: '';
            position: absolute;
            top: 50%; left: 50%;
            transform: translate(-50%, -50%) rotate(-15deg);
            width: 36px; height: 80px;
            background-color: #F1E9DE; /* white dress approx */
            border-radius: 16px;
            box-shadow: inset 0 -10px 0 rgba(0,0,0,0.1);
        }
        .thumb-2-detail {
            position: absolute;
            top: 15px; left: 30px;
            width: 12px; height: 12px;
            background-color: #DF6526; /* skin tone approx */
            border-radius: 50%;
        }

        .thumb-3::before {
            content: '';
            position: absolute;
            bottom: 0; left: 0; right: 0;
            height: 45%;
            background-color: #DF5A26; /* orange floor */
        }
        .thumb-3::after {
            content: '';
            position: absolute;
            top: 35%; left: 15%;
            width: 50px; height: 20px;
            background-color: #F1E9DE; /* white fabric approx */
            border-radius: 10px;
            transform: rotate(20deg);
            z-index: 10;
        }
        .thumb-3-detail {
            position: absolute;
            top: 25%; left: 35%;
            width: 24px; height: 34px;
            background-color: #1a1a1a; /* dark hair/shadow approx */
            border-radius: 12px 12px 0 0;
        }

        [contenteditable]:empty:before {
            content: attr(placeholder);
            color: #9ca3af;
            cursor: text;
        }
        
        /* Remove outline from contenteditable */
        [contenteditable]:focus {
            outline: none;
        }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center relative font-sans antialiased text-textPrimary">

    <!-- Background Wireframe -->
    <div class="absolute inset-0 pointer-events-none flex items-center justify-center select-none overflow-hidden">
        <!-- Horizontal dashed lines -->
        <div class="absolute w-full border-t border-dashed border-wireframeStroke top-[20%]"></div>
        <div class="absolute w-full border-t border-dashed border-wireframeStroke top-[80%]"></div>
        
        <!-- Central Browser Wireframe Container -->
        <div class="relative w-[760px] h-[640px]">
            <!-- Dashed outline stretching beyond window -->
            <div class="absolute -inset-x-20 inset-y-0 border-x border-dashed border-wireframeStroke"></div>
            
            <!-- Browser Window Shape -->
            <div class="absolute inset-0 border border-wireframeStroke rounded-[32px] overflow-hidden flex flex-col">
                <!-- Top Bar -->
                <div class="h-16 border-b border-wireframeStroke flex items-center px-8 relative">
                    <!-- Mac style dots -->
                    <div class="flex gap-2">
                        <div class="w-2.5 h-2.5 rounded-full bg-[#d1d5db]"></div>
                        <div class="w-2.5 h-2.5 rounded-full bg-[#d1d5db]"></div>
                        <div class="w-2.5 h-2.5 rounded-full bg-[#d1d5db]"></div>
                    </div>
                    <!-- Address Bar -->
                    <div class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-[300px] h-8 border border-wireframeStroke rounded-md flex items-center justify-end px-3">
                        <span class="text-[10px] font-bold text-[#9ca3af] tracking-wider">LEFT</span>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Application Card - Added the crisp e2e4e7 border to match button styling -->
    <div class="bg-cardBg border border-[#e2e4e7] rounded-[28px] w-[520px] shadow-card relative z-10 p-5 pt-4 flex flex-col gap-5">
        
        <!-- Header -->
        <div class="flex justify-between items-center px-1">
            <button class="bg-white border border-[#e2e4e7] shadow-sm hover:bg-gray-50 transition-all rounded-full p-2.5 flex items-center justify-center group focus:outline-none">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="text-textPrimary group-hover:scale-110 transition-transform">
                    <path d="M18 6 6 18"/>
                    <path d="m6 6 12 12"/>
                </svg>
            </button>
            <span class="font-bold text-[17px] text-textPrimary tracking-tight pr-2">Drafts</span>
        </div>

        <!-- Image Thumbnails Section -->
        <div class="flex gap-3 px-1">
            <!-- Thumbnail 1 -->
            <div class="w-[88px] h-[88px] rounded-2xl overflow-hidden relative shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] bg-thumb1Green thumb-1">
                <div class="thumb-1-detail"></div>
            </div>
            
            <!-- Thumbnail 2 -->
            <div class="w-[88px] h-[88px] rounded-2xl overflow-hidden relative shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] bg-thumb2Green thumb-2">
                <div class="thumb-2-detail"></div>
            </div>
            
            <!-- Thumbnail 3 -->
            <div class="w-[88px] h-[88px] rounded-2xl overflow-hidden relative shadow-[inset_0_0_0_1px_rgba(0,0,0,0.06)] bg-thumb3Red thumb-3">
                <div class="thumb-3-detail"></div>
            </div>
        </div>

        <!-- Text Input Area -->
        <div class="px-1 mt-1">
            <p class="text-[19px] leading-[1.45] text-textPrimary font-normal tracking-[-0.01em] whitespace-pre-wrap cursor-text" contenteditable="true" spellcheck="false">Use the storyboard uploaded to create an advertising retro short video in 30 seconds.<span class="cursor-blink">|</span></p>
        </div>

        <!-- Bottom Toolbar - Expanded background pill to cover all items -->
        <div class="flex items-center justify-between mt-3 bg-[#f2f3f5] p-1.5 rounded-[24px] border border-[#e2e4e7]/80 mx-0.5">
            
            <!-- Left Action Group -->
            <div class="flex items-center">
                
                <!-- Add Button -->
                <button class="bg-white border border-[#e2e4e7] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-gray-50 flex items-center justify-center w-11 h-11 rounded-[16px] text-textPrimary transition-all active:scale-95 focus:outline-none">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M5 12h14"/>
                        <path d="M12 5v14"/>
                    </svg>
                </button>

                <!-- Magic/AI Button -->
                <button class="bg-white border border-[#e2e4e7] shadow-[0_1px_2px_rgba(0,0,0,0.03)] hover:bg-gray-50 flex items-center justify-center w-11 h-11 rounded-[16px] text-textPrimary transition-all active:scale-95 focus:outline-none ml-1.5 relative overflow-hidden group">
                    <!-- Custom SVG representing the 'A with lightning bolt' -->
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="group-hover:scale-105 transition-transform">
                        <path d="m4 19 6-14 6 14"/>
                        <path d="M6 14h8"/>
                        <!-- Filled lightning bolt -->
                        <polygon points="19 6 15 13 19 13 13 22 15 14 11 14 19 6" fill="currentColor" stroke="none" transform="translate(4, -1) scale(0.65)"/>
                    </svg>
                </button>

                <!-- Small gap between actions and toggles -->
                <div class="w-2"></div>

                <!-- Media Type Toggles Container -->
                <div class="flex items-center gap-0.5 bg-[#e5e6e8] p-0.5 rounded-[16px] border border-[#e2e4e7]/50">
                    <!-- Image Toggle -->
                    <button class="flex items-center gap-2 px-3 py-2 rounded-[14px] text-[15px] font-medium text-textSecondary hover:text-textPrimary transition-colors focus:outline-none">
                        <!-- Custom Image/Crop Icon -->
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M4 8V4h4"/>
                            <path d="M20 8V4h-4"/>
                            <path d="M4 16v4h4"/>
                            <path d="M20 16v4h-4"/>
                            <rect width="8" height="8" x="8" y="8" rx="1"/>
                            <circle cx="12" cy="12" r="1.5" fill="currentColor" stroke="none"/>
                        </svg>
                        Image
                    </button>

                    <!-- Video Toggle (Active State) -->
                    <button class="flex items-center gap-2 px-3 py-2 rounded-[14px] text-[15px] font-medium text-textPrimary bg-white border border-[#e2e4e7] shadow-[0_1px_2px_rgba(0,0,0,0.03)] transition-all focus:outline-none">
                        <!-- Standard Pen/Edit Icon representing video generation tweaks -->
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 20h9"/>
                            <path d="M16.376 3.622a1 1 0 0 1 3.002 3.002L7.368 18.635a2 2 0 0 1-.855.506l-2.872.838a.5.5 0 0 1-.62-.62l.838-2.872a2 2 0 0 1 .506-.854z"/>
                        </svg>
                        Video
                    </button>
                </div>
            </div>

            <!-- Right Action Group -->
            <div class="flex items-center gap-1 pr-0.5">
                <!-- Microphone Button -->
                <button class="p-3 text-textSecondary hover:text-textPrimary transition-colors flex items-center justify-center rounded-full focus:outline-none">
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                        <path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/>
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                        <line x1="12" x2="12" y1="19" y2="22"/>
                    </svg>
                </button>

                <!-- Submit Button -->
                <button class="bg-[#1a1a1a] hover:bg-black text-white flex items-center justify-center w-[46px] h-[46px] rounded-[18px] shadow-btnSubmit transition-all active:scale-95 focus:outline-none">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                        <path d="m5 12 7-7 7 7"/>
                        <path d="M12 19V5"/>
                    </svg>
                </button>
            </div>
            
        </div>
    </div>

    <!-- Script to handle custom cursor behavior inside contenteditable -->
    <script>
        // Optional script to make the fake cursor behave a bit more naturally 
        // by hiding it when the user actually focuses and clicks into the text area
        const editableElement = document.querySelector('[contenteditable]');
        const cursorSpan = document.querySelector('.cursor-blink');

        editableElement.addEventListener('focus', () => {
            // Once they start typing or modifying, we let the native browser cursor take over
            editableElement.addEventListener('input', hideFakeCursor, { once: true });
            editableElement.addEventListener('click', hideFakeCursor, { once: true });
        });

        function hideFakeCursor() {
            if(cursorSpan) {
                cursorSpan.style.display = 'none';
            }
        }
    </script>
</body>
</html>