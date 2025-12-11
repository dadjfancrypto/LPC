'use client';

import { useState } from 'react';
import Link from 'next/link';
import SimulationDisclaimer from '../components/SimulationDisclaimer';

export default function Home() {
  const [showDisclaimer, setShowDisclaimer] = useState(false);

  const handleDisclaimerClick = () => {
    setShowDisclaimer(true);
    // スクロールしてコンポーネントを表示
    setTimeout(() => {
      const element = document.getElementById('disclaimer-section');
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 100);
  };
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-sky-500/30">
      <main className="max-w-6xl mx-auto px-6 py-20">
        {/* Header */}
        <header className="mb-24 text-center relative">
          {/* 背景装飾 */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-sky-500/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] bg-emerald-500/10 rounded-full blur-3xl pointer-events-none mix-blend-screen" />

          <div className="relative z-10">
            <div className="inline-block mb-4 px-4 py-1.5 rounded-full bg-slate-900/80 border border-slate-800 text-slate-400 text-xs font-bold tracking-wider uppercase backdrop-blur-sm">
              Financial Planning Tools
            </div>
            <h1 className="text-5xl md:text-7xl font-bold mb-6 tracking-tight">
              <span className="bg-gradient-to-r from-sky-400 via-emerald-400 to-sky-400 bg-clip-text text-transparent bg-[length:200%_auto] animate-gradient">
                Life Planning
              </span>
              <br />
              <span className="text-slate-100">Simulators</span>
            </h1>
            <p className="text-slate-400 text-lg md:text-xl max-w-2xl mx-auto leading-relaxed">
              将来の不確実性に、確かな備えを。<br className="hidden md:block" />
              公的年金と必要保障額を可視化する、プロフェッショナルなシミュレーションツール。
            </p>
            <div className="mt-6">
              <button
                onClick={handleDisclaimerClick}
                className="text-slate-500 hover:text-slate-400 text-sm transition-colors duration-200 underline underline-offset-4 decoration-slate-600 hover:decoration-slate-500"
              >
                本シミュレーションをご利用いただく前に、必ずご確認・ご了承いただきたい重要事項
              </button>
            </div>
          </div>
        </header>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 relative z-10">
          {/* Customer Profile */}
          <Link
            href="/simulators/customer-profile"
            className="group relative p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-900/60 transition-all duration-500 backdrop-blur-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-sky-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex flex-col h-full">
              <div className="w-14 h-14 mb-6 rounded-2xl bg-sky-500/10 flex items-center justify-center text-sky-400 group-hover:scale-110 transition-transform duration-500 border border-sky-500/20 group-hover:border-sky-500/40 group-hover:shadow-[0_0_20px_rgba(14,165,233,0.2)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-3 group-hover:text-sky-400 transition-colors">
                基本情報設定
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-grow">
                家族構成、収入、加入年金制度などの基本情報を設定します。すべてのシミュレーションの基礎となります。
              </p>
              <div className="flex items-center text-sky-400 text-sm font-bold group-hover:translate-x-2 transition-transform duration-300">
                設定をはじめる
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 ml-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Survivor Pension */}
          <Link
            href="/simulators/survivor-pension"
            className="group relative p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-emerald-500/50 hover:bg-slate-900/60 transition-all duration-500 backdrop-blur-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex flex-col h-full">
              <div className="w-14 h-14 mb-6 rounded-2xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform duration-500 border border-emerald-500/20 group-hover:border-emerald-500/40 group-hover:shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M21 8.25c0-2.485-2.099-4.5-4.688-4.5-1.935 0-3.597 1.126-4.312 2.733-.715-1.607-2.377-2.733-4.313-2.733C5.1 3.75 3 5.765 3 8.25c0 7.22 9 12 9 12s9-4.78 9-12z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-3 group-hover:text-emerald-400 transition-colors">
                遺族年金シミュレーター
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-grow">
                万が一の際に遺族が受け取れる公的年金（遺族基礎年金・遺族厚生年金）の受給額と期間を試算します。
              </p>
              <div className="flex items-center text-emerald-400 text-sm font-bold group-hover:translate-x-2 transition-transform duration-300">
                詳細を確認する
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 ml-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Disability Pension */}
          <Link
            href="/simulators/disability-pension"
            className="group relative p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-amber-500/50 hover:bg-slate-900/60 transition-all duration-500 backdrop-blur-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex flex-col h-full">
              <div className="w-14 h-14 mb-6 rounded-2xl bg-amber-500/10 flex items-center justify-center text-amber-400 group-hover:scale-110 transition-transform duration-500 border border-amber-500/20 group-hover:border-amber-500/40 group-hover:shadow-[0_0_20px_rgba(245,158,11,0.2)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 12c0-1.232-.046-2.453-.138-3.662a4.006 4.006 0 00-3.7-3.7 48.678 48.678 0 00-7.324 0 4.006 4.006 0 00-3.7 3.7c-.017.22-.032.441-.046.662M19.5 12l3-3m-3 3l-3-3m-12 3c0 1.232.046 2.453.138 3.662a4.006 4.006 0 003.7 3.7 48.656 48.656 0 007.324 0 4.006 4.006 0 003.7-3.7c.017-.22.032-.441.046-.662M4.5 12l3 3m-3-3l-3 3" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-3 group-hover:text-amber-400 transition-colors">
                障害年金シミュレーター
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-grow">
                病気や怪我で障害状態になった場合に受け取れる障害年金（基礎・厚生）の目安を試算します。
              </p>
              <div className="flex items-center text-amber-400 text-sm font-bold group-hover:translate-x-2 transition-transform duration-300">
                詳細を確認する
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 ml-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Necessary Coverage */}
          <Link
            href="/simulators/necessary-coverage"
            className="group relative p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-rose-500/50 hover:bg-slate-900/60 transition-all duration-500 backdrop-blur-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-rose-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex flex-col h-full">
              <div className="w-14 h-14 mb-6 rounded-2xl bg-rose-500/10 flex items-center justify-center text-rose-400 group-hover:scale-110 transition-transform duration-500 border border-rose-500/20 group-hover:border-rose-500/40 group-hover:shadow-[0_0_20px_rgba(244,63,94,0.2)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v17.25m0 0c-1.472 0-2.882.265-4.185.75M12 20.25c1.472 0 2.882.265 4.185.75M18.75 4.97A48.416 48.416 0 0012 4.5c-2.291 0-4.545.16-6.75.47m13.5 0c1.01.143 2.01.317 3 .52m-3-.52l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L18.75 4.971zm-16.5.52c.99-.203 1.99-.377 3-.52m0 0l2.62 10.726c.122.499-.106 1.028-.589 1.202a5.988 5.988 0 01-2.031.352 5.988 5.988 0 01-2.031-.352c-.483-.174-.711-.703-.59-1.202L5.25 4.971z" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-3 group-hover:text-rose-400 transition-colors">
                必要保障額
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-grow">
                遺族の生活費と公的年金の差額（ギャップ）を可視化し、民間保険などで準備すべき必要保障額を算出します。
              </p>
              <div className="flex items-center text-rose-400 text-sm font-bold group-hover:translate-x-2 transition-transform duration-300">
                シミュレーションへ
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 ml-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </Link>

          {/* Work Page - Risk Map */}
          <Link
            href="/work"
            className="group relative p-8 rounded-3xl bg-slate-900/40 border border-slate-800 hover:border-indigo-500/50 hover:bg-slate-900/60 transition-all duration-500 backdrop-blur-sm overflow-hidden"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
            <div className="relative flex flex-col h-full">
              <div className="w-14 h-14 mb-6 rounded-2xl bg-indigo-500/10 flex items-center justify-center text-indigo-400 group-hover:scale-110 transition-transform duration-500 border border-indigo-500/20 group-hover:border-indigo-500/40 group-hover:shadow-[0_0_20px_rgba(99,102,241,0.2)]">
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-7 h-7">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 002.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 00-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 00.75-.75 2.25 2.25 0 00-.1-.664m-5.8 0A2.251 2.251 0 0113.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h4.125M8.25 8.25l2.25-2.25m0 0l2.25 2.25m-2.25-2.25v13.5m0 0l2.25 2.25m-2.25-2.25l-2.25 2.25M12 8.25V12m0 0v3.75m0-3.75h3.75m-3.75 0H12" />
                </svg>
              </div>
              <h2 className="text-2xl font-bold text-slate-100 mb-3 group-hover:text-indigo-400 transition-colors">
                あなたの人生リスクMAP
              </h2>
              <p className="text-slate-400 text-sm leading-relaxed mb-6 flex-grow">
                リスクマトリクスを使って、人生のリスクを「事故の頻度」と「損害額」で整理し、可視化します。
              </p>
              <div className="flex items-center text-indigo-400 text-sm font-bold group-hover:translate-x-2 transition-transform duration-300">
                ワークをはじめる
                <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4 ml-2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
                </svg>
              </div>
            </div>
          </Link>
        </div>

        {/* Simulation Disclaimer Section */}
        <div id="disclaimer-section" className="mt-16">
          <SimulationDisclaimer isOpen={showDisclaimer} onToggle={() => setShowDisclaimer(!showDisclaimer)} />
        </div>
      </main>
    </div>
  );
}
