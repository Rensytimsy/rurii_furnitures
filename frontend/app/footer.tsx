"use client"


export default function Footer() {
    return (
        <footer className="bg-[#202940] text-white border-t-2 border-[#4B4038] py-6 px-8 text-md">
            <div className="max-w-7xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">

                <div className="text-xs tracking-wide text-center md:text-left">
                    &copy; 2026 <span className="text-[#CAAA98]">RtStudio Tech</span>. All rights reserved.
                </div>

                <div className="text-center font-medium">
                    POS System Built by
                    <a href="https://www.rtstudio.tech" target="_blank" className="text-[#CAAA98] font-bold hover:text-white transition-colors ml-1">
                        RtStudio Tech.
                    </a>
                </div>
                <div className="flex items-center gap-4">
                    <a href="https://www.rtstudio.tech/support" target="_blank" className="hover:text-white text-xs transition-colors">Support</a>
                    <span className="text-[#4B4038]">|</span>
                    <a href="https://www.rtstudio.tech" target="_blank" className="text-[#CAAA98] hover:text-white transition-colors" aria-label="Website">
                        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9m-9 9a9 9 0 019-9"></path></svg>
                    </a>
                </div>

            </div>
        </footer>
    )
}