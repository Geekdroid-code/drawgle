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
                        bgMain: '#f9fafb', 
                        promptGrayOuter: '#f2f3f5', /* The main gray container bg */
                        wireframeStroke: '#e5e7eb',
                        cardBg: '#ffffff',
                        toolbarBg: '#f7f8f9', /* Slightly off-white for the tools pill */
                        textPrimary: '#111111',
                        textSecondary: '#666666',
                        textMuted: '#999999',
                        pdfRed: '#e94235',
                        imgBlue: '#7dd3fc'
                    },
                    boxShadow: {
                        'outerApp': '0 24px 60px -15px rgba(0, 0, 0, 0.05), 0 4px 12px rgba(0, 0, 0, 0.02)',
                        'promptBox': '0 12px 32px -10px rgba(0, 0, 0, 0.06), 0 4px 12px rgba(0, 0, 0, 0.03)',
                        'innerWhiteBox': '0 2px 8px rgba(0, 0, 0, 0.04), 0 1px 2px rgba(0, 0, 0, 0.02)',
                        'pill': '0 1px 2px rgba(0, 0, 0, 0.03)',
                        'btnSubmit': '0 4px 14px rgba(0, 0, 0, 0.12), inset 0 1px 0 rgba(255,255,255,0.1)',
                    }
                }
            }
        }
    </script>
    <style>
        body {
            background-color: #f9fafb;
            background-image: radial-gradient(#e5e7eb 1px, transparent 1px);
            background-size: 24px 24px;
            overflow: hidden;
        }

        @keyframes blink {
            0%, 100% { opacity: 1; }
            50% { opacity: 0; }
        }
        .cursor-blink {
            animation: blink 1s step-end infinite;
            color: #1a1a1a;
            font-weight: 300;
            margin-left: 1px;
            display: inline-block;
            transform: translateY(-1px);
        }

        [contenteditable]:empty:before {
            content: attr(placeholder);
            color: #a1a1aa;
            cursor: text;
        }
        
        [contenteditable]:focus {
            outline: none;
        }

        /* CSS art for the PDF icon */
        .pdf-icon {
            width: 14px;
            height: 18px;
            background-color: #f2f2f2;
            border: 1px solid #e2e4e7;
            border-radius: 3px;
            position: relative;
            display: flex;
            align-items: flex-end;
            justify-content: center;
            padding-bottom: 2px;
            box-shadow: inset 0 -4px 0 rgba(233, 66, 53, 0.1);
        }
        .pdf-icon::before {
            content: '';
            position: absolute;
            top: -1px; right: -1px;
            width: 5px; height: 5px;
            background-color: #e2e4e7;
            border-bottom-left-radius: 3px;
            clip-path: polygon(100% 0, 0 100%, 100% 100%);
        }
        .pdf-text {
            font-size: 4px;
            font-weight: 800;
            color: #e94235;
            letter-spacing: -0.2px;
        }
    </style>
</head>
<body class="min-h-screen flex items-center justify-center relative font-sans antialiased text-textPrimary">

    <!-- Outer Presentation Wrapper -->
    <div class="bg-white border border-[#e2e4e7] rounded-[48px] w-[800px] h-[560px] shadow-outerApp p-12 flex flex-col justify-end relative overflow-hidden">
        
        <!-- Gradient fade to simulate content above -->
        <div class="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-white to-transparent pointer-events-none z-10"></div>

        <!-- NEW STRUCTURE: Outer Gray Prompt Container -->
        <div class="bg-promptGrayOuter border border-[#e2e4e7] rounded-[36px] shadow-promptBox p-2 flex flex-col relative z-20">
            
            <!-- Top Section: Attachments (Sitting on Gray Background) -->
            <div class="flex flex-wrap items-center gap-2.5 px-3 pt-2 pb-2.5">
                
                <!-- Attachment Pill: PDF -->
                <div class="flex items-center gap-2.5 bg-white border border-[#e2e4e7] rounded-[18px] pl-3 pr-2.5 py-1.5 shadow-pill transition-all hover:bg-gray-50 cursor-pointer group">
                    <div class="pdf-icon">
                        <span class="pdf-text">PDF</span>
                    </div>
                    <span class="text-[15px] font-medium text-textPrimary tracking-tight">brief.pdf</span>
                    <button class="text-textMuted hover:text-textPrimary transition-colors focus:outline-none ml-1 group-hover:bg-gray-100 rounded-full p-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18"/>
                            <path d="m6 6 12 12"/>
                        </svg>
                    </button>
                </div>

                <!-- Attachment Pill: Image -->
                <div class="flex items-center gap-2.5 bg-white border border-[#e2e4e7] rounded-[18px] pl-3 pr-2.5 py-1.5 shadow-pill transition-all hover:bg-gray-50 cursor-pointer group">
                    <div class="w-4 h-4 rounded-full bg-imgBlue shadow-[inset_0_0_0_1px_rgba(0,0,0,0.05)]"></div>
                    <span class="text-[15px] font-medium text-textPrimary tracking-tight">cloud.png</span>
                    <button class="text-textMuted hover:text-textPrimary transition-colors focus:outline-none ml-1 group-hover:bg-gray-100 rounded-full p-0.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M18 6 6 18"/>
                            <path d="m6 6 12 12"/>
                        </svg>
                    </button>
                </div>

            </div>

            <!-- Inner White Container (Prompt Box + Toolbar) -->
            <div class="bg-white border border-[#e2e4e7]/80 rounded-[28px] shadow-innerWhiteBox flex flex-col">
                
                <!-- Middle Section: Text Input -->
                <div class="px-4 pt-4 pb-6">
                    <p class="text-[22px] leading-[1.3] text-textPrimary font-normal tracking-[-0.01em] whitespace-pre-wrap cursor-text" contenteditable="true" spellcheck="false">Can you create folders in Google Docs<span class="cursor-blink">|</span></p>
                </div>

                <!-- Bottom Section: Toolbar -->
                <div class="flex items-center justify-between px-2 pb-2">
                    
                    <!-- Left Tools (Grouped in pill) -->
                    <div class="flex items-center bg-toolbarBg p-1 rounded-[22px] border border-[#e2e4e7]/60 mr-auto shadow-[inset_0_1px_2px_rgba(0,0,0,0.01)]">
                        
                        <!-- Tool 1: Add Document (Outline) -->
                        <button class="w-[36px] h-[36px] rounded-[18px] flex items-center justify-center text-textSecondary hover:text-textPrimary hover:bg-white transition-all active:scale-95 focus:outline-none">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                                <path d="M12 18v-6"/>
                                <path d="M9 15h6"/>
                            </svg>
                        </button>

                        <!-- Tool 2: Magic Wand (Active state - solid background) -->
                        <button class="w-[36px] h-[36px] rounded-[18px] flex items-center justify-center text-textPrimary bg-white shadow-pill border border-[#e2e4e7]/50 transition-all active:scale-95 focus:outline-none ml-0.5">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round">
                                <path d="m15.5 4.5 4 4-10 10h-4v-4l10-10Z"/>
                                <path d="M10 5l1 2 2 1-2 1-1 2-1-2-2-1 2-1z"/>
                                <path d="m2 22 4-4"/>
                            </svg>
                        </button>

                        <!-- Tool 3: Dashed Circle/Focus -->
                        <button class="w-[36px] h-[36px] rounded-[18px] flex items-center justify-center text-textMuted hover:text-textPrimary hover:bg-white transition-all active:scale-95 focus:outline-none ml-0.5">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="8" stroke-dasharray="4 4"/>
                            </svg>
                        </button>

                        <!-- Tool 4: Dashed Selection & Cursor -->
                        <button class="w-[36px] h-[36px] rounded-[18px] flex items-center justify-center text-textMuted hover:text-textPrimary hover:bg-white transition-all active:scale-95 focus:outline-none ml-0.5 relative">
                            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <rect x="3" y="3" width="16" height="16" rx="3" stroke-dasharray="4 4" class="opacity-60"/>
                                <!-- Solid pointer arrow overlapping the dashed line -->
                                <path d="M12 12l6.5 2.5-2.5 1-1 2.5L12 12z" fill="white" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round"/>
                            </svg>
                        </button>

                    </div>

                    <!-- Middle: Model Selector -->
                    <button class="flex items-center gap-2 bg-white border border-[#e2e4e7] rounded-full px-4 py-2 shadow-pill hover:bg-gray-50 transition-colors focus:outline-none mr-2.5">
                        <!-- Knot/AI Logo -->
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" class="text-textPrimary">
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z" stroke-dasharray="2 2" class="opacity-50"/>
                            <path d="M12 6a6 6 0 1 0 0 12 6 6 0 1 0 0-12z"/>
                            <path d="M8.5 8.5l7 7m0-7l-7 7"/>
                        </svg>
                        <span class="text-[15px] font-medium text-textPrimary tracking-tight mt-px">GPT 5.0</span>
                    </button>

                    <!-- Right: Submit/Voice Button -->
                    <button class="bg-gradient-to-b from-[#2a2a2a] to-[#111111] border border-[#000000] hover:from-[#333333] hover:to-[#1a1a1a] text-white w-[42px] h-[42px] rounded-[16px] flex items-center justify-center shadow-btnSubmit transition-all active:scale-95 focus:outline-none mr-0.5">
                        <!-- Waveform/Voice Icon -->
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M12 4v16"/>
                            <path d="M8 8v8"/>
                            <path d="M16 8v8"/>
                            <path d="M4 11v2"/>
                            <path d="M20 11v2"/>
                        </svg>
                    </button>

                </div>
            </div>
        </div>
        
        <!-- Subtle Expand Icon (bottom right corner artifact) -->
        <div class="absolute bottom-6 right-6 text-textMuted hover:text-textPrimary cursor-pointer transition-colors">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="m15 9-6 6"/>
                <path d="M9 9h6v6"/>
            </svg>
        </div>

    </div>

    <!-- Script to handle custom cursor behavior inside contenteditable -->
    <script>
        const editableElement = document.querySelector('[contenteditable]');
        const cursorSpan = document.querySelector('.cursor-blink');

        editableElement.addEventListener('focus', () => {
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