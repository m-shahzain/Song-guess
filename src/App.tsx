/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { Quiz } from './components/Quiz';
import { Disc3 } from 'lucide-react';

export default function App() {
  return (
    <div className="min-h-screen bg-[#090314] text-slate-100 flex flex-col justify-between selection:bg-pink-500 selection:text-white font-sans antialiased relative overflow-x-hidden">
      {/* Dynamic Bollywood ambient background glow */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-1/4 w-[500px] h-[500px] bg-gradient-to-br from-pink-600/15 via-purple-700/10 to-transparent rounded-full blur-[120px]" />
        <div className="absolute bottom-10 right-1/4 w-[550px] h-[550px] bg-gradient-to-tl from-purple-800/20 via-amber-600/10 to-transparent rounded-full blur-[130px]" />
      </div>

      {/* Main Header / Nav */}
      <header className="relative z-10 w-full border-b border-purple-900/40 bg-[#0c041b]/80 backdrop-blur-md">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-pink-500 to-amber-400 flex items-center justify-center shadow-md shadow-pink-500/20">
              <Disc3 className="w-5 h-5 text-slate-950 animate-spin [animation-duration:8s]" />
            </div>
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-white">
                Bollywood<span className="text-pink-400">Beat</span>
              </span>
              <span className="text-[11px] font-semibold text-amber-400/90 hidden sm:inline">
                5-Second iTunes Edition
              </span>
            </div>
          </div>
        </div>
      </header>

      {/* Main Content: The Quiz Component */}
      <main className="relative z-10 flex-1 flex flex-col justify-center items-center py-4 sm:py-8">
        <Quiz />
      </main>

      {/* Footer */}
      <footer className="relative z-10 w-full border-t border-purple-900/30 bg-[#070210]/90 py-5 text-center text-xs text-purple-400/70">
        <div className="max-w-5xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <div>
            Powered by Apple iTunes Search API · Bollywood Music Trivia Edition
          </div>
          <div className="flex items-center gap-3">
            <span>Bollywood Night Theme</span>
          </div>
        </div>
      </footer>
    </div>
  );
}
