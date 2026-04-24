liek her eis teh screen creaetd 


<div class="w-full min-h-screen bg-[#050505] flex flex-col relative overflow-hidden" style="font-family: 'Inter', -apple-system, sans-serif">
  
  <!-- Header -->
  <header class="pt-[16px] px-[24px] flex items-center justify-between z-[10]">
    <div class="flex items-center justify-center w-[48px] h-[48px]">
      <!-- Stylized 'A' Logo -->
      <svg width="32" height="32" viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 4L4 28H9L16 12L23 28H28L16 4Z" fill="#F5F5F5"/>
        <path d="M12 20H20" stroke="#050505" stroke-width="2"/>
      </svg>
    </div>
    
    <div class="flex items-center gap-[12px]">
      <!-- Glass Well: Notification -->
      <button class="w-[48px] h-[48px] rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.05)] border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] backdrop-blur-md">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EBEBEB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>
      </button>
      <!-- Glass Well: Message -->
      <button class="w-[48px] h-[48px] rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.05)] border border-white/10 shadow-[inset_0_2px_4px_rgba(0,0,0,0.3)] backdrop-blur-md">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EBEBEB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
      </button>
      <!-- User Avatar -->
      <div class="w-[48px] h-[48px] rounded-full border border-white/20 overflow-hidden">
        <img src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=100&q=80" alt="User" class="w-full h-full object-cover">
      </div>
    </div>
  </header>

  <!-- Hero Section -->
  <section class="mt-[32px] px-[24px] flex flex-col gap-[24px]">
    <h1 class="text-[#EBEBEB] text-[34px] font-[700] leading-[38px] tracking-tight">
      Explore Nearby<br/>Properties
    </h1>
    
    <!-- Floating Search Pill -->
    <div class="relative w-full h-[60px]">
      <div class="absolute inset-y-0 left-[20px] flex items-center pointer-events-none">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#A1A1A1" stroke-width="1" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line></svg>
      </div>
      <input 
        type="text" 
        placeholder="Search properties..." 
        class="w-full h-full bg-[rgba(255,255,255,0.05)] border border-white/10 rounded-full pl-[52px] pr-[24px] text-[#EBEBEB] placeholder-[#666666] focus:outline-none focus:border-white/20 backdrop-blur-xl"
      >
    </div>
  </section>

  <!-- Category Bar -->
  <section class="mt-[32px] overflow-x-auto no-scrollbar">
    <div class="flex gap-[12px] px-[24px] pb-[4px]">
      <!-- Active Chip -->
      <button class="px-[24px] h-[48px] rounded-full bg-[#F5F5F5] text-[#050505] text-[14px] font-[600] whitespace-nowrap flex items-center justify-center">
        Apartment
      </button>
      <!-- Inactive Chips -->
      <button class="px-[24px] h-[48px] rounded-full bg-[rgba(255,255,255,0.08)] border border-white/5 text-[#A1A1A1] text-[14px] font-[500] whitespace-nowrap flex items-center justify-center backdrop-blur-md">
        Office
      </button>
      <button class="px-[24px] h-[48px] rounded-full bg-[rgba(255,255,255,0.08)] border border-white/5 text-[#A1A1A1] text-[14px] font-[500] whitespace-nowrap flex items-center justify-center backdrop-blur-md">
        Duplex
      </button>
      <button class="px-[24px] h-[48px] rounded-full bg-[rgba(255,255,255,0.08)] border border-white/5 text-[#A1A1A1] text-[14px] font-[500] whitespace-nowrap flex items-center justify-center backdrop-blur-md">
        Villa
      </button>
    </div>
  </section>

  <!-- Main Content: Property List -->
  <main class="flex-1 mt-[32px] px-[24px] pb-[120px] overflow-y-auto no-scrollbar space-y-[24px]">
    
    <!-- Property Card 1 -->
    <div class="w-full p-[20px] rounded-[32px] bg-[rgba(25,25,25,0.65)] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur-[40px]">
      <!-- Card Header -->
      <div class="flex items-start gap-[16px] mb-[20px]">
        <div class="w-[48px] h-[48px] rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.05)] border border-white/10 shadow-inner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EBEBEB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </div>
        <div class="flex flex-col">
          <h3 class="text-[#EBEBEB] text-[18px] font-[600] leading-tight">Sunrise Bay Ridge</h3>
          <p class="text-[#A1A1A1] text-[14px]">San Francisco, California, USA</p>
        </div>
      </div>

      <!-- Metadata Chips -->
      <div class="flex flex-wrap gap-[8px] mb-[20px]">
        <div class="px-[12px] py-[6px] rounded-full bg-white/5 border border-white/5 text-[#A1A1A1] text-[12px] font-[500]">800 sq ft</div>
        <div class="px-[12px] py-[6px] rounded-full bg-white/5 border border-white/5 text-[#A1A1A1] text-[12px] font-[500]">4 Beds</div>
        <div class="px-[12px] py-[6px] rounded-full bg-white/5 border border-white/5 text-[#A1A1A1] text-[12px] font-[500]">Balcony</div>
        <div class="px-[12px] py-[6px] rounded-full bg-white/5 border border-white/5 text-[#A1A1A1] text-[12px] font-[500]">Amenities</div>
      </div>

      <!-- Property Image -->
      <div class="relative w-full aspect-[4/3] rounded-[24px] overflow-hidden">
        <img src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80" alt="Property" class="w-full h-full object-cover">
        
        <!-- Floating See Details Button -->
        <button class="absolute bottom-[16px] right-[16px] h-[48px] px-[24px] rounded-full bg-[#F5F5F5] text-[#050505] text-[14px] font-[600] shadow-lg flex items-center justify-center active:scale-95 transition-transform">
          See Details
        </button>

        <!-- Like Overlay (Optional but adds to aesthetic) -->
        <div class="absolute bottom-[16px] left-[16px] px-[12px] py-[8px] rounded-full bg-black/40 backdrop-blur-md border border-white/10 text-white text-[12px] font-[500]">
          5k+ tap love this
        </div>
      </div>
    </div>

    <!-- Property Card 2 -->
    <div class="w-full p-[20px] rounded-[32px] bg-[rgba(25,25,25,0.65)] border border-white/10 shadow-[0_8px_32px_0_rgba(0,0,0,0.8),inset_0_0_0_1px_rgba(255,255,255,0.1)] backdrop-blur-[40px]">
      <!-- Card Header -->
      <div class="flex items-start gap-[16px] mb-[20px]">
        <div class="w-[48px] h-[48px] rounded-full flex items-center justify-center bg-[rgba(255,255,255,0.05)] border border-white/10 shadow-inner">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#EBEBEB" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        </div>
        <div class="flex flex-col">
          <h3 class="text-[#EBEBEB] text-[18px] font-[600] leading-tight">Ocean Breeze</h3>
          <p class="text-[#A1A1A1] text-[14px]">Miami, Florida, USA</p>
        </div>
      </div>

      <!-- Metadata Chips -->
      <div class="flex flex-wrap gap-[8px] mb-[20px]">
        <div class="px-[12px] py-[6px] rounded-full bg-white/5 border border-white/5 text-[#A1A1A1] text-[12px] font-[500]">1200 sq ft</div>
        <div class="px-[12px] py-[6px] rounded-full bg-white/5 border border-white/5 text-[#A1A1A1] text-[12px] font-[500]">3 Beds</div>
        <div class="px-[12px] py-[6px] rounded-full bg-white/5 border border-white/5 text-[#A1A1A1] text-[12px] font-[500]">Pool</div>
      </div>

      <!-- Property Image -->
      <div class="relative w-full aspect-[4/3] rounded-[24px] overflow-hidden">
        <img src="https://images.unsplash.com/photo-1613490493576-7fde63acd811?auto=format&fit=crop&w=800&q=80" alt="Property" class="w-full h-full object-cover">
        
        <button class="absolute bottom-[16px] right-[16px] h-[48px] px-[24px] rounded-full bg-[#F5F5F5] text-[#050505] text-[14px] font-[600] shadow-lg flex items-center justify-center">
          See Details
        </button>
      </div>
    </div>

  </main>

  <!-- Floating Obsidian Dock -->
  <nav class="fixed bottom-[24px] left-1/2 -translate-x-1/2 w-[calc(100%-48px)] max-w-[400px] h-[80px] z-[20]">
    <div class="w-full h-full bg-gradient-to-br from-white/[0.12] via-[rgba(18,18,18,0.85)] to-[rgba(10,10,10,0.95)] border border-white/10 rounded-full flex items-center justify-around px-[12px] shadow-[0_24px_64px_0_rgba(0,0,0,0.9),inset_0_0_0_1px_rgba(255,255,255,0.15)] backdrop-blur-[40px]">
      
      <!-- Home (Active) -->
      <button class="flex items-center gap-[8px] px-[16px] py-[10px] rounded-full bg-gradient-to-b from-white/[0.18] to-white/[0.04] border border-white/10 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.1)]">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#F5F5F5" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
        <span class="text-[#F5F5F5] text-[14px] font-[600]">Home</span>
      </button>

      <!-- Heart -->
      <button class="w-[48px] h-[48px] flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A1A1A1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"></path></svg>
      </button>

      <!-- Stats -->
      <button class="w-[48px] h-[48px] flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A1A1A1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="20" x2="18" y2="10"></line><line x1="12" y1="20" x2="12" y2="4"></line><line x1="6" y1="20" x2="6" y2="14"></line></svg>
      </button>

      <!-- Profile -->
      <button class="w-[48px] h-[48px] flex items-center justify-center rounded-full hover:bg-white/5 transition-colors">
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#A1A1A1" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"></path><circle cx="12" cy="7" r="4"></circle></svg>
      </button>

    </div>
  </nav>

  <!-- Subtle Background Glows (Obsidian Lume Effect) -->
  <div class="absolute top-[-5%] right-[-15%] w-[500px] h-[500px] bg-gradient-to-br from-white/[0.03] to-transparent blur-[120px] rounded-full pointer-events-none z-0"></div>
  <div class="absolute top-[20%] left-[-10%] w-[400px] h-[400px] bg-gradient-to-tr from-white/[0.02] to-transparent blur-[100px] rounded-full pointer-events-none z-0"></div>
  <div class="absolute bottom-[-10%] right-[10%] w-[600px] h-[600px] bg-gradient-to-tl from-white/[0.03] to-transparent blur-[140px] rounded-full pointer-events-none z-0"></div>
  <div class="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,255,255,0.02),transparent)] pointer-events-none z-0"></div>

</div>

<style>
  .no-scrollbar::-webkit-scrollbar {
    display: none;
  }
  .no-scrollbar {
    -ms-overflow-style: none;
    scrollbar-width: none;
  }
</style>





now here is the block index for this screen, while editing a screen with prompt,... it never works... becaus its built in away that never can match a user prompt.. i mean in 80% of the cases... it wont work... bcoz we dont know how user will ask an edit.

{
  "blocks": [
    {
      "id": "screen-shell",
      "kind": "shell",
      "name": "Screen Shell",
      "depth": 0,
      "endLine": 16,
      "preview": "",
      "tagName": "div",
      "keywords": [
        "shell",
        "div",
        "min",
        "full",
        "screen",
        "050505",
        "flex",
        "col",
        "relative",
        "overflow",
        "hidden"
      ],
      "parentId": null,
      "endOffset": 1102,
      "startLine": 1,
      "startOffset": 0
    },
    {
      "id": "header-1",
      "kind": "header",
      "name": "16px",
      "depth": 1,
      "endLine": 16,
      "preview": "",
      "tagName": "header",
      "keywords": [
        "header",
        "16px",
        "24px",
        "flex",
        "items",
        "center",
        "justify",
        "between"
      ],
      "parentId": "screen-shell",
      "endOffset": 1102,
      "startLine": 4,
      "startOffset": 165
    },
    {
      "id": "section-1",
      "kind": "section",
      "name": "32px",
      "depth": 0,
      "endLine": 38,
      "preview": "Explore Nearby Properties",
      "tagName": "section",
      "keywords": [
        "section",
        "32px",
        "24px",
        "flex",
        "col",
        "gap",
        "explore",
        "nearby",
        "properties"
      ],
      "parentId": "screen-shell",
      "endOffset": 2549,
      "startLine": 30,
      "startOffset": 1996
    },
    {
      "id": "section-2",
      "kind": "section",
      "name": "32px",
      "depth": 0,
      "endLine": 66,
      "preview": "Apartment Office Duplex Villa",
      "tagName": "section",
      "keywords": [
        "section",
        "32px",
        "overflow",
        "auto",
        "scrollbar",
        "apartment",
        "office",
        "duplex",
        "villa"
      ],
      "parentId": "screen-shell",
      "endOffset": 4073,
      "startLine": 49,
      "startOffset": 2967
    },
    {
      "id": "section-3",
      "kind": "section",
      "name": "Gap",
      "depth": 1,
      "endLine": 65,
      "preview": "Apartment Office Duplex Villa",
      "tagName": "div",
      "keywords": [
        "section",
        "div",
        "gap",
        "flex",
        "12px",
        "24px",
        "4px",
        "apartment",
        "office",
        "duplex",
        "villa"
      ],
      "parentId": "section-2",
      "endOffset": 4060,
      "startLine": 50,
      "startOffset": 3028
    },
    {
      "id": "section-4",
      "kind": "section",
      "name": "32px",
      "depth": 0,
      "endLine": 76,
      "preview": "",
      "tagName": "main",
      "keywords": [
        "section",
        "main",
        "32px",
        "flex",
        "24px",
        "120px",
        "overflow",
        "auto",
        "scrollbar",
        "space"
      ],
      "parentId": "screen-shell",
      "endOffset": 4893,
      "startLine": 69,
      "startOffset": 4116
    },
    {
      "id": "section-5",
      "kind": "section",
      "name": "Relative",
      "depth": 0,
      "endLine": 105,
      "preview": "See Details 5k+ tap love this",
      "tagName": "div",
      "keywords": [
        "section",
        "div",
        "relative",
        "full",
        "aspect",
        "rounded",
        "24px",
        "overflow",
        "hidden",
        "see",
        "details",
        "tap",
        "love",
        "this"
      ],
      "parentId": "screen-shell",
      "endOffset": 6751,
      "startLine": 93,
      "startOffset": 5902
    },
    {
      "id": "footer-1",
      "kind": "footer",
      "name": "Absolute",
      "depth": 1,
      "endLine": 99,
      "preview": "See Details",
      "tagName": "button",
      "keywords": [
        "footer",
        "button",
        "absolute",
        "bottom",
        "16px",
        "right",
        "48px",
        "24px",
        "rounded",
        "full",
        "f5f5f5",
        "text",
        "050505",
        "14px",
        "font",
        "600",
        "shadow",
        "flex",
        "items",
        "center"
      ],
      "parentId": "section-5",
      "endOffset": 6456,
      "startLine": 97,
      "startOffset": 6201
    },
    {
      "id": "footer-2",
      "kind": "footer",
      "name": "Absolute",
      "depth": 1,
      "endLine": 104,
      "preview": "5k+ tap love this",
      "tagName": "div",
      "keywords": [
        "footer",
        "div",
        "absolute",
        "bottom",
        "16px",
        "left",
        "12px",
        "8px",
        "rounded",
        "full",
        "black",
        "backdrop",
        "blur",
        "border",
        "white",
        "text",
        "font",
        "500",
        "tap",
        "love"
      ],
      "parentId": "section-5",
      "endOffset": 6738,
      "startLine": 102,
      "startOffset": 6529
    },
    {
      "id": "footer-3",
      "kind": "footer",
      "name": "Absolute",
      "depth": 1,
      "endLine": 134,
      "preview": "See Details",
      "tagName": "button",
      "keywords": [
        "footer",
        "button",
        "absolute",
        "bottom",
        "16px",
        "right",
        "48px",
        "24px",
        "rounded",
        "full",
        "f5f5f5",
        "text",
        "050505",
        "14px",
        "font",
        "600",
        "shadow",
        "flex",
        "items",
        "center"
      ],
      "parentId": "screen-shell",
      "endOffset": 8762,
      "startLine": 132,
      "startOffset": 8544
    },
    {
      "id": "nav-1",
      "kind": "nav",
      "name": "Fixed",
      "depth": 0,
      "endLine": 146,
      "preview": "",
      "tagName": "nav",
      "keywords": [
        "nav",
        "fixed",
        "bottom",
        "24px",
        "left",
        "translate",
        "calc",
        "100",
        "48px",
        "max",
        "400px",
        "80px"
      ],
      "parentId": "screen-shell",
      "endOffset": 9698,
      "startLine": 141,
      "startOffset": 8835
    },
    {
      "id": "footer-4",
      "kind": "footer",
      "name": "Absolute",
      "depth": 0,
      "endLine": 171,
      "preview": "",
      "tagName": "div",
      "keywords": [
        "footer",
        "div",
        "absolute",
        "bottom",
        "right",
        "600px",
        "gradient",
        "from",
        "white",
        "transparent",
        "blur",
        "140px",
        "rounded",
        "full",
        "pointer",
        "events",
        "none"
      ],
      "parentId": "screen-shell",
      "endOffset": 11790,
      "startLine": 171,
      "startOffset": 11615
    }
  ],
  "rootId": "screen-shell",
  "version": 1
}