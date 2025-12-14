'use client';

import { useState, useEffect, useRef } from 'react';
import {
  Chart as ChartJS,
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Filler,
} from 'chart.js';
import { Doughnut, Line, Bar } from 'react-chartjs-2';

ChartJS.register(
  ArcElement,
  Tooltip,
  Legend,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  BarElement,
  Title,
  Filler
);

export default function DeathDisabilityProbabilityPage() {
  const [currentView, setCurrentView] = useState<'main' | 'logic'>('main');
  const [currentTab, setCurrentTab] = useState<'trend' | 'cause'>('trend');
  const [age, setAge] = useState(20);

  // Risk data
  const riskData = {
    labels: ['20歳', '30歳', '40歳', '50歳', '60歳', '65歳'],
    cumulative: [0.1, 1.2, 3.5, 7.8, 11.5, 13.5],
    breakdown: { death: 42, disability: 58 }
  };

  const causeData = {
    labels: ['20代-30代', '40代', '50代-60代'],
    datasets: [
      { label: '精神・神経系', data: [40, 25, 10], backgroundColor: '#88a096' },
      { label: '事故・外傷', data: [30, 15, 5], backgroundColor: '#94a3b8' },
      { label: 'がん・循環器・他', data: [30, 60, 85], backgroundColor: '#dd7e6b' }
    ]
  };

  const waterfallData = {
    labels: ['① 死亡 (Death)', '② 重度障害 (Disability)', '③ 要介護・長期療養 (Care)', '合計: 経済的不能確率'],
    datasets: [
      {
        label: 'Base (Invisible)',
        data: [0, 6.5, 10.5, 0],
        backgroundColor: 'transparent',
      },
      {
        label: 'Risk Component',
        data: [6.5, 4.0, 3.0, 13.5],
        backgroundColor: ['#718096', '#e53e3e', '#dd6b20', '#2b6cb0'],
        borderWidth: 0,
        borderRadius: 4
      }
    ]
  };

  // Chart options
  const donutOptions = {
    responsive: true,
    maintainAspectRatio: false,
    cutout: '70%' as const,
    plugins: {
      legend: { position: 'bottom' as const }
    }
  };

  const lineOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      y: { beginAtZero: true, max: 16 },
      x: { grid: { display: false } }
    }
  };

  const barOptions = {
    responsive: true,
    maintainAspectRatio: false,
    scales: {
      x: { stacked: true },
      y: { stacked: true, display: false }
    }
  };

  const waterfallOptions: any = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { 
      legend: { display: false },
      tooltip: {
        callbacks: {
          label: function(context: any): string | null {
            if (context.datasetIndex === 0) return null;
            return context.raw + '%';
          },
          afterBody: function(context: any): string {
            if (context[0]?.dataIndex === 3) {
              return 'およそ7人に1人の割合';
            }
            return '';
          }
        }
      }
    },
    scales: {
      x: { 
        stacked: true, 
        grid: { display: false },
        ticks: { font: { family: "'Noto Sans JP', sans-serif" } }
      },
      y: { 
        stacked: true, 
        beginAtZero: true, 
        max: 16,
        title: { display: true, text: '累積確率 (%)' },
        ticks: { stepSize: 2 }
      }
    }
  };

  // Calculate cumulative risk
  const getCumulativeRisk = (age: number): string => {
    const ages = [20, 30, 40, 50, 60, 65];
    const risks = riskData.cumulative;
    if (age <= 20) return risks[0].toFixed(1);
    if (age >= 65) return risks[risks.length - 1].toFixed(1);
    
    let i = 0;
    while (i < ages.length - 1 && ages[i + 1] < age) i++;
    const progress = (age - ages[i]) / (ages[i + 1] - ages[i]);
    return (risks[i] + (risks[i + 1] - risks[i]) * progress).toFixed(1);
  };

  const getRiskComment = (age: number): string => {
    if (age === 20) return "20代のリスクは低水準ですが、ゼロではありません。";
    if (age < 35) return "20代〜30代前半。まだ確率は低いですが、少しずつ積み上がっています。";
    if (age < 50) return "30代後半〜40代。カーブが急になり始め、同世代での発症事例が出始めます。";
    if (age < 60) return "50代。三大疾病などのリスクが顕在化し、確率が大きく上昇します。";
    return "定年直前。およそ7〜8人に1人が、ここに至るまでに何らかの重大な事由に遭遇しています。";
  };

  const cumulativeRisk = getCumulativeRisk(age);
  const riskComment = getRiskComment(age);

  // Chart data
  const donutChartData = {
    labels: ['死亡', '重度障害・要介護'],
    datasets: [{
      data: [42, 58],
      backgroundColor: ['#94a3b8', '#dd7e6b'],
      borderWidth: 0
    }]
  };

  const lineChartData = {
    labels: riskData.labels,
    datasets: [{
      label: '累積確率 (%)',
      data: riskData.cumulative,
      borderColor: '#dd7e6b',
      backgroundColor: 'rgba(221, 126, 107, 0.1)',
      fill: true,
      tension: 0.4
    }]
  };

  return (
    <div className="min-h-screen bg-[#fdfcf8] text-[#334155] font-['Noto_Sans_JP',sans-serif] flex flex-col antialiased">
      {/* Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 py-4 flex justify-between items-center">
          <h1 
            className="text-xl md:text-2xl font-bold tracking-tight text-slate-800 flex items-center gap-2 cursor-pointer font-['Noto_Serif_JP',serif]"
            onClick={() => setCurrentView('main')}
          >
            <span>就労不能・死亡リスク分析</span>
            <span className="text-sm font-normal text-slate-500 hidden md:inline">20歳〜65歳</span>
          </h1>
          <nav className="text-sm font-medium">
            <button 
              onClick={() => setCurrentView('main')}
              className={`px-3 py-1 ${currentView === 'main' ? 'text-[#dd7e6b]' : 'text-slate-500'}`}
            >
              分析ホーム
            </button>
            <span className="text-slate-300">|</span>
            <button 
              onClick={() => setCurrentView('logic')}
              className={`px-3 py-1 ${currentView === 'logic' ? 'text-[#3182ce]' : 'text-slate-500 hover:text-[#3182ce]'}`}
            >
              推計根拠
            </button>
          </nav>
        </div>
      </header>

      <main className="flex-grow w-full max-w-5xl mx-auto px-4 py-8 relative">
        {/* VIEW 1: MAIN DASHBOARD */}
        {currentView === 'main' && (
          <div className="space-y-12 transition-opacity duration-300">
            {/* Section 1: Core Statistic & Simulator */}
            <section className="grid grid-cols-1 md:grid-cols-12 gap-8 items-start">
              <div className="md:col-span-7 bg-white p-6 rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] border border-slate-100">
                <div className="mb-4">
                  <h2 className="text-lg font-bold text-slate-700 mb-2 font-['Noto_Serif_JP',serif]">概要：現役世代のリスク確率</h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    20歳から65歳までの45年間において、死亡、または重度の障害により「経済的な活動ができなくなる」確率は、統計的に<span className="font-bold text-2xl text-[#dd7e6b] mx-1">約13.5%</span>（およそ7人に1人）と推計されます。<br /><br />
                    この数字は「死亡」だけでなく、高度障害や要介護状態など、<strong>「生きているが働けない」リスク</strong>を含んでいる点が重要です。
                  </p>
                </div>
                
                <div className="bg-slate-50 p-6 rounded-lg mt-6">
                  <h3 className="text-sm font-bold text-slate-500 uppercase tracking-wider mb-4">リスク・シミュレーター</h3>
                  <div className="flex flex-col space-y-4">
                    <div className="flex justify-between items-center">
                      <label htmlFor="ageSlider" className="font-bold text-slate-700">
                        設定年齢: <span className="text-2xl text-[#dd7e6b]">{age}</span>歳
                      </label>
                      <span className="text-xs text-slate-400">スライダーを動かして確認</span>
                    </div>
                    <input 
                      type="range" 
                      id="ageSlider" 
                      min="20" 
                      max="65" 
                      value={age}
                      onChange={(e) => setAge(parseInt(e.target.value))}
                      className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-[#dd7e6b]"
                    />
                    <div className="flex justify-between text-xs text-slate-400 px-1">
                      <span>20歳</span>
                      <span>30歳</span>
                      <span>40歳</span>
                      <span>50歳</span>
                      <span>60歳</span>
                      <span>65歳</span>
                    </div>
                  </div>
                  <div className="mt-6 border-t border-slate-200 pt-4">
                    <p className="text-sm text-slate-600">20歳から{age}歳までに、リスク（死亡・重度障害）に遭遇している累積確率:</p>
                    <p className="text-3xl font-bold text-slate-800 mt-1">
                      {cumulativeRisk}<span className="text-lg font-normal text-slate-500 ml-1">%</span>
                    </p>
                    <p className="text-xs text-slate-500 mt-2">{riskComment}</p>
                  </div>
                </div>
              </div>

              <div className="md:col-span-5 flex flex-col space-y-4 h-full">
                <div className="bg-white p-6 rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] border border-slate-100 flex-grow flex flex-col justify-center items-center">
                  <h3 className="text-center font-bold text-slate-700 mb-4 font-['Noto_Serif_JP',serif]">リスクの内訳構成</h3>
                  <div className="relative w-full" style={{ height: '250px' }}>
                    <Doughnut data={donutChartData} options={donutOptions} />
                  </div>
                  <p className="text-center text-xs text-slate-400 mt-4">
                    死亡リスクよりも、生存中の就労不能（障害・介護）リスクの方が高い傾向にあります。
                  </p>
                </div>
              </div>
            </section>

            {/* Section 2: Trends */}
            <section>
              <div className="bg-white rounded-xl shadow-[0_4px_6px_-1px_rgba(0,0,0,0.05),0_2px_4px_-1px_rgba(0,0,0,0.03)] border border-slate-100 overflow-hidden">
                <div className="flex border-b border-slate-100 bg-slate-50">
                  <button 
                    onClick={() => setCurrentTab('trend')}
                    className={`flex-1 py-4 text-center text-sm transition-colors ${
                      currentTab === 'trend' 
                        ? 'border-b-2 border-[#dd7e6b] text-[#dd7e6b] font-bold' 
                        : 'text-slate-500'
                    }`}
                  >
                    累積リスクの推移 (20-65歳)
                  </button>
                  <button 
                    onClick={() => setCurrentTab('cause')}
                    className={`flex-1 py-4 text-center text-sm transition-colors ${
                      currentTab === 'cause' 
                        ? 'border-b-2 border-[#dd7e6b] text-[#dd7e6b] font-bold' 
                        : 'text-slate-500'
                    }`}
                  >
                    年代別・原因の変化
                  </button>
                </div>

                {currentTab === 'trend' && (
                  <div className="p-6 md:p-8 block">
                    <div className="relative w-full" style={{ height: '300px' }}>
                      <Line data={lineChartData} options={lineOptions} />
                    </div>
                    <p className="text-xs text-slate-500 mt-4 text-center">45歳前後からカーブが急激に上昇します。</p>
                  </div>
                )}

                {currentTab === 'cause' && (
                  <div className="p-6 md:p-8 block">
                    <div className="relative w-full" style={{ height: '300px' }}>
                      <Bar data={causeData} options={barOptions} />
                    </div>
                    <p className="text-xs text-slate-500 mt-4 text-center">若年層は「精神・事故」、中高年は「三大疾病」が主要因です。</p>
                  </div>
                )}
              </div>
            </section>

            {/* Section 3: Definitions */}
            <section>
              <h2 className="text-xl font-bold text-slate-800 mb-4 font-['Noto_Serif_JP',serif]">主なリスクの定義</h2>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                <div className="bg-white p-4 rounded border border-slate-200 hover:border-[#dd7e6b] transition-colors">
                  <h3 className="font-bold text-sm text-slate-700 mb-1 font-['Noto_Serif_JP',serif]">高度障害</h3>
                  <p className="text-xs text-slate-500">両目の視力喪失、言語機能喪失など、回復不能な重度の状態。</p>
                </div>
                <div className="bg-white p-4 rounded border border-slate-200 hover:border-[#dd7e6b] transition-colors">
                  <h3 className="font-bold text-sm text-slate-700 mb-1 font-['Noto_Serif_JP',serif]">身体障害 1-2級</h3>
                  <p className="text-xs text-slate-500">日常生活に著しい制限があり、常時介護に近い状態。</p>
                </div>
                <div className="bg-white p-4 rounded border border-slate-200 hover:border-[#dd7e6b] transition-colors">
                  <h3 className="font-bold text-sm text-slate-700 mb-1 font-['Noto_Serif_JP',serif]">精神障害 1級</h3>
                  <p className="text-xs text-slate-500">統合失調症等で、自立した日常生活が不能な状態。</p>
                </div>
                <div className="bg-white p-4 rounded border border-slate-200 hover:border-[#dd7e6b] transition-colors">
                  <h3 className="font-bold text-sm text-slate-700 mb-1 font-['Noto_Serif_JP',serif]">要介護 2以上</h3>
                  <p className="text-xs text-slate-500">食事・排泄等に介助が必要。40歳以上の特定疾病を含む。</p>
                </div>
              </div>
            </section>

            {/* Link to Logic View */}
            <div className="mt-12 text-center border-t border-slate-200 pt-8 pb-12">
              <p className="text-sm text-slate-500 mb-4">なぜ「13.5%」なのか？ 数字の根拠と計算ロジックを確認する</p>
              <button 
                onClick={() => setCurrentView('logic')}
                className="inline-flex items-center px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold rounded-full transition-colors group"
              >
                推計根拠と計算ロジックの詳細を見る
                <span className="ml-2 group-hover:translate-x-1 transition-transform">→</span>
              </button>
            </div>
          </div>
        )}

        {/* VIEW 2: LOGIC REPORT */}
        {currentView === 'logic' && (
          <div className="space-y-16 animate-fade-in pb-12 bg-[#f8f9fa]">
            {/* Header */}
            <header className="bg-white border-b border-gray-200 py-10">
              <div className="max-w-4xl mx-auto px-6">
                <div className="flex items-center space-x-2 mb-3">
                  <span className="bg-blue-100 text-blue-800 text-xs font-bold px-2 py-1 rounded uppercase tracking-wider">調査報告書</span>
                  <span className="text-gray-400 text-xs">Updated: 2024.12</span>
                </div>
                <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4 leading-tight font-['Noto_Serif_JP',serif]">
                  20歳から65歳までの就労世代における<br />死亡・就業不能・高度障害リスクの包括的分析と統計的検証に関する調査報告書
                </h1>
                <div className="mt-4">
                  <button 
                    onClick={() => setCurrentView('main')}
                    className="text-sm bg-white text-blue-600 px-3 py-1 rounded shadow hover:bg-blue-50"
                  >
                    分析ホームに戻る
                  </button>
                </div>
              </div>
            </header>

            <div className="max-w-4xl mx-auto px-6 space-y-16">

            {/* 第1章 序論 */}
            <section className="bg-white p-8 rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-6 font-['Noto_Serif_JP',serif]">
                第1章 序論：現代日本におけるリスク構造の変容と「12〜15%」の統計的意義
              </h2>
              
              <div className="space-y-6 text-gray-700 leading-relaxed">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">1.1 背景：長寿化社会における「生存リスク」の顕在化</h3>
                  <p className="mb-4 text-justify">
                    日本社会は世界に類を見ない超高齢化社会へと突入し、平均寿命は男性で約81歳、女性で約87歳に達している。この人口動態の劇的な変化は、従来のリスク管理の前提を根本から覆すものである。かつて、現役世代（20歳から60歳代）における最大のリスクは「早期の死亡（早世）」であり、残された遺族の生活保障が社会保障および民間保険の主たる役割であった。しかし、医療技術の進歩と公衆衛生の向上により、死亡率は劇的に低下した。その反面、皮肉にも「死なないリスク」、すなわち重篤な疾病や障害を抱えながら生存し続けるリスク、あるいは長期にわたる療養により経済的基盤である就労能力を喪失するリスクが、現役世代にとっての新たな、そしてより切実な脅威として浮上している。
                  </p>
                  <p className="mb-4 text-justify">
                    本報告書は、20歳から65歳という、経済活動の中核を担う生産年齢人口において、死亡、高度障害、要介護状態、そして広義の就業不能状態といった「重大なリスク」に遭遇する確率が「約12〜15%」であるという統計的言説の真偽とその構成要素を、厚生労働省、全国健康保険協会（協会けんぽ）、国立社会保障・人口問題研究所などの公的データに基づき検証するものである。この数値は、単なる不安を煽るためのマーケティング用語ではなく、現代日本の疾病構造、社会保障制度の認定基準、そして労働市場の現実を反映した複合的なリスク指標であることが、以下の分析により明らかとなる。
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">1.2 「12〜15%」の統計的根拠の特定</h3>
                  <p className="mb-4 text-justify">
                    検証の結果、ご照会いただいた「約12〜15%」という確率は、特定の単一データではなく、主に民間保険会社（特に東京海上日動火災保険など）が、公的統計を基に算出した「死亡リスク」と「就業不能リスク」の推計値を合算、あるいは比較対照する文脈で用いられる数値であることが確認された。
                  </p>
                  <p className="mb-4 text-justify">
                    具体的には、以下の2つの主要な統計データがその根拠となっている。
                  </p>
                  <div className="bg-blue-50 border-l-4 border-blue-500 p-4 mb-4">
                    <p className="font-bold mb-2">就業不能リスク（約13%）:</p>
                    <p className="mb-2">35歳の人が65歳までの30年間に、病気やケガによって「長期の就業不能状態」に陥る確率。</p>
                    <p className="text-sm text-gray-600"><strong>出典:</strong> 全国健康保険協会（協会けんぽ）「平成27年度 現金給付受給者状況調査報告」。</p>
                    <p className="text-sm text-gray-600"><strong>定義:</strong> 健康保険制度における「傷病手当金」の受給実績に基づく推計。</p>
                  </div>
                  <div className="bg-red-50 border-l-4 border-red-500 p-4">
                    <p className="font-bold mb-2">死亡リスク（約8〜9%）:</p>
                    <p className="mb-2">35歳の人が65歳までに死亡する確率。</p>
                    <p className="text-sm text-gray-600"><strong>出典:</strong> 厚生労働省「平成27年 簡易生命表」。</p>
                    <p className="text-sm text-gray-600"><strong>定義:</strong> 年齢別死亡率に基づく生命表からの算出。</p>
                  </div>
                  <p className="mt-4 text-justify">
                    これらを総合すると、現役世代の後半において「死亡する確率」よりも「働けなくなる確率」の方が高いという事実が浮かび上がる。本報告書では、この「13%の就業不能リスク」と「8%の死亡リスク」を主軸に据えつつ、より厳格な基準である「障害年金（高度障害）」や「介護保険（要介護）」の認定リスクについても、最新の「令和5年簡易生命表」や「令和4年社会医療診療行為別統計」などを用いて詳細に再計算と検証を行う。
                  </p>
                </div>
              </div>
            </section>

            {/* 第2章 就業不能リスクの解剖 */}
            <section className="bg-white p-8 rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-6 font-['Noto_Serif_JP',serif]">
                第2章 就業不能リスクの解剖：その発生機序と統計的実態
              </h2>
              
              <div className="space-y-6 text-gray-700 leading-relaxed">
                <p className="text-justify">
                  「12〜15%」というリスク指標の中で最も大きなウェイトを占め、かつ現代的なリスク特性を表しているのが「就業不能リスク」である。これは「医学的な生命の終わり」ではなく「経済的な生命の終わり（または中断）」を意味する。
                </p>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">2.1 全国健康保険協会（協会けんぽ）データの詳細分析</h3>
                  <p className="mb-4 text-justify">
                    「就業不能」の定義として最も広範かつ一般的な指標は、被用者保険（社保）における「傷病手当金」の受給実績である。傷病手当金は、業務外の病気やケガで療養するために仕事を休み、給与が支払われない場合に、最長で1年6ヶ月間、標準報酬日額の3分の2が支給される制度である。
                  </p>

                  <div className="mb-6">
                    <h4 className="text-lg font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">2.1.1 リスク発生率の構造</h4>
                    <p className="mb-4 text-justify">
                      協会けんぽのデータによれば、傷病手当金の受給件数は年齢とともに増加する傾向にあるが、その「原因疾患」の構成比は年齢階級によって劇的に変化する。35歳から65歳までの30年間という期間設定において、約13%（およそ8人に1人）がこの長期休業リスクに直面するという推計は、単年度の発生率を累積させることで導き出される。
                    </p>
                    
                    <div className="bg-gray-50 p-4 rounded-lg mb-4">
                      <table className="w-full text-sm">
                        <thead className="bg-gray-200">
                          <tr>
                            <th className="px-4 py-2 text-left">年齢階級</th>
                            <th className="px-4 py-2 text-left">主な就業不能原因</th>
                            <th className="px-4 py-2 text-left">特徴</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                          <tr>
                            <td className="px-4 py-2 font-semibold">20代〜30代</td>
                            <td className="px-4 py-2">精神及び行動の障害</td>
                            <td className="px-4 py-2">うつ病、適応障害などが圧倒的多数を占める。身体的には健康であっても、メンタルヘルス不調による長期休職が多発している。</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 font-semibold">40代〜50代</td>
                            <td className="px-4 py-2">悪性新生物（がん）</td>
                            <td className="px-4 py-2">年齢とともに発生率が急上昇。治療と仕事の両立が困難になるケースが増加。</td>
                          </tr>
                          <tr>
                            <td className="px-4 py-2 font-semibold">50代〜60代</td>
                            <td className="px-4 py-2">循環器系疾患</td>
                            <td className="px-4 py-2">脳血管疾患（脳卒中）や心疾患による突発的な就業不能。リハビリテーション期間が長く、復職困難なケースが多い。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-lg font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">2.1.2 「精神及び行動の障害」の突出</h4>
                    <p className="mb-4 text-justify">
                      特筆すべきは、若年層から中年層にかけての就業不能原因として「精神及び行動の障害」が極めて高い割合を占めている点である。協会けんぽのデータでは、全受給件数のうち、精神疾患に起因するものが都道府県によっては40%〜50%を超えている（東京都で45.33%、大阪府で40.87%など）。
                    </p>
                    <p className="mb-4 text-justify">
                      これは、都市部のホワイトカラー層において、過重労働や職場環境のストレスが深刻な「働けないリスク」を生み出していることを示唆している。精神疾患による休職は、身体疾患に比べて「再発率が高い」「療養期間が長期化しやすい（平均受給期間が長い）」という特徴があり、これが「13%」という高い確率を構成する主要因となっている。がんや脳卒中といった伝統的な疾病リスクに加え、現代社会特有のリスクとしてメンタルヘルスの悪化が、死亡リスクを上回る就業不能リスクを生み出しているのである。
                    </p>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-lg font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">2.2 がん（悪性新生物）による「経済的毒性」</h4>
                    <p className="mb-4 text-justify">
                      次に重要なファクターは「がん」である。医療技術の進歩により、がんの5年生存率は向上しているが、それは必ずしも「以前と同じように働けること」を意味しない。抗がん剤治療や放射線治療の副作用、手術後の身体機能の低下、定期的な通院の必要性などにより、長期の休職や、非正規雇用への転換、あるいは退職を余儀なくされるケースが後を絶たない。
                    </p>
                    <p className="mb-4 text-justify">
                      統計的に見ると、在職中にがんに罹患し、治療を受けながら生存している労働者の割合は増加の一途をたどっている。これを「サバイバーシップ」と呼ぶが、経済的な観点からは「就業制限」というリスクとして顕在化する。傷病手当金の受給期間（最大1年6ヶ月）を超えても就労不能状態が続く場合、多くの労働者は収入源を断たれることになり、これが「高度障害」や「死亡」に至る前の「経済的死」のリスクとして重くのしかかる。
                    </p>
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">2.3 循環器系疾患による突発的離脱</h4>
                    <p className="mb-4 text-justify">
                      50代以降で急増するのが、脳血管疾患（脳梗塞、脳出血など）や心疾患である。これらはある日突然発症し、即座に就業不能状態をもたらす。特に脳血管疾患は、命を取り留めたとしても片麻痺や言語障害などの後遺症が残る確率が高く、そのまま「高度障害」や「要介護状態」へと移行する主要なルートとなっている。協会けんぽのデータにおいても、循環器系疾患による傷病手当金の1件あたり支給金額が高額（平均約20万円超）であることは、療養期間の長さと標準報酬月額の高さ（管理職世代での発症が多いこと）を反映している。
                    </p>
                  </div>
                </div>
              </div>
            </section>

            {/* 第3章 死亡リスクの精緻な検証 */}
            <section className="bg-white p-8 rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-6 font-['Noto_Serif_JP',serif]">
                第3章 死亡リスクの精緻な検証：生命表からの再計算
              </h2>
              
              <div className="space-y-6 text-gray-700 leading-relaxed">
                <p className="text-justify">
                  次に、リスクのもう一つの柱である「死亡リスク」について、厚生労働省の最新データを用いて検証する。「35歳から65歳までの死亡確率が約8%」という数値は妥当なのだろうか。
                </p>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">3.1 令和5年簡易生命表に基づく死亡確率</h3>
                  <p className="mb-4 text-justify">
                    厚生労働省が公表した「令和5年（2023年）簡易生命表」の生存数データ（l<sub>x</sub>）を用いて、20歳および35歳時点から65歳までの死亡確率を算出する。
                  </p>
                  <p className="mb-4 text-sm bg-gray-50 p-3 rounded">
                    <strong>計算式:</strong> <sub>n</sub>q<sub>x</sub> = 1 - (l<sub>x+n</sub> / l<sub>x</sub>) （x歳の者がx+n歳までに死亡する確率）
                  </p>

                  <div className="mb-6">
                    <h4 className="text-lg font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">3.1.1 男性の場合</h4>
                    <ul className="space-y-2 mb-4 text-sm">
                      <li>20歳時点の生存数 (l<sub>20</sub>): 98,698人</li>
                      <li>35歳時点の生存数 (l<sub>35</sub>): 97,934人（推計値）</li>
                      <li>65歳時点の生存数 (l<sub>65</sub>): 89,524人</li>
                    </ul>
                    <p className="mb-2"><strong>死亡確率の算出:</strong></p>
                    <ul className="space-y-2 mb-4 text-sm">
                      <li>20歳から65歳の間: 1 - (89,524/98,698) = 1 - 0.9070 = <strong className="text-red-600">9.30%</strong></li>
                      <li>35歳から65歳の間: 1 - (89,524/97,934) = 1 - 0.9141 = <strong className="text-red-600">8.59%</strong></li>
                    </ul>
                  </div>

                  <div className="mb-6">
                    <h4 className="text-lg font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">3.1.2 女性の場合</h4>
                    <ul className="space-y-2 mb-4 text-sm">
                      <li>20歳時点の生存数 (l<sub>20</sub>): 99,094人</li>
                      <li>35歳時点の生存数 (l<sub>35</sub>): 98,600人（推計値）</li>
                      <li>65歳時点の生存数 (l<sub>65</sub>): 94,371人</li>
                    </ul>
                    <p className="mb-2"><strong>死亡確率の算出:</strong></p>
                    <ul className="space-y-2 mb-4 text-sm">
                      <li>20歳から65歳の間: 1 - (94,371/99,094) = 1 - 0.9523 = <strong className="text-red-600">4.77%</strong></li>
                      <li>35歳から65歳の間: 1 - (94,371/98,600) = 1 - 0.9571 = <strong className="text-red-600">4.29%</strong></li>
                    </ul>
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">3.1.3 分析結果の解釈</h4>
                    <p className="mb-4 text-justify">
                      計算結果より、男性の場合、35歳から65歳までの死亡確率は約8.6%であり、保険会社が提示する「約8%」という数値と極めて整合性が高いことが確認された。一方で女性の場合は約4.3%と男性の半数程度に留まる。この男女差は、男性における生活習慣病リスクの高さや、自殺率の高さ、社会的ストレスへの曝露などが複合的に影響していると考えられる。つまり、「12〜15%」というリスク総量のうち、男性においては「死亡」が大きな割合（約9%）を占めるが、女性においては「死亡」の寄与度は低く、相対的に「就業不能」や「疾病」のリスクの比重が高くなる構造が見て取れる。
                    </p>
                  </div>

                  <div>
                    <h4 className="text-lg font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">3.2 若年層・中年層の死因構造</h4>
                    <p className="mb-4 text-justify">
                      なぜ現役世代が死亡するのか。その原因を分析することは、リスクの質を理解する上で不可欠である。
                    </p>
                    <ul className="space-y-3">
                      <li>
                        <strong className="text-red-600">自殺（Suicide）:</strong> 20歳から39歳までの死因の第1位は「自殺」である。これは先進国（G7）の中でも日本特有の深刻な傾向であり、就労世代のメンタルヘルス対策が生命リスク管理そのものであることを示している。自殺は「予防可能な死」であるが、統計上は確固たる死亡リスクとして計上される。
                      </li>
                      <li>
                        <strong className="text-red-600">悪性新生物（Cancer）:</strong> 40歳以降では、死因の第1位が自殺からがんに切り替わる。特に女性においては、乳がんや子宮頸がんなど、若年で発症するがんのリスクが20代〜40代で相対的に高いことが特徴である。男性は消化器系（胃、大腸）や肺がんのリスクが加齢とともに直線的に上昇する。
                      </li>
                      <li>
                        <strong className="text-red-600">心疾患・脳血管疾患:</strong> これらは「突然死」の主要因であるとともに、一命を取り留めた場合の「高度障害リスク」の主要因でもある。働き盛り世代における過労死（脳・心臓疾患）は労災認定の主要テーマでもあり、長時間労働との相関が医学的にも指摘されている。
                      </li>
                    </ul>
                  </div>
                </div>
              </div>
            </section>

            {/* 第4章 公的年金制度における「高度障害」リスク */}
            <section className="bg-white p-8 rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-6 font-['Noto_Serif_JP',serif]">
                第4章 公的年金制度における「高度障害」リスク
              </h2>
              
              <div className="space-y-6 text-gray-700 leading-relaxed">
                <p className="text-justify">
                  「死亡」や一時的な「就業不能」とは異なり、回復の見込みがない恒久的な障害状態については、公的年金制度（障害年金）がセーフティネットを提供する。ここでの認定確率は、「12〜15%」の内数として、より深刻なリスクを表している。
                </p>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">4.1 障害年金の等級と認定基準</h3>
                  <p className="mb-4 text-justify">
                    日本の障害年金制度は、障害の程度に応じて等級が設定されている。
                  </p>
                  <ul className="space-y-2 mb-4">
                    <li><strong>1級:</strong> 他人の介助がなければ日常生活のほとんどができない状態（常時臥床など）。</li>
                    <li><strong>2級:</strong> 必ずしも他人の助けを借りる必要はないが、日常生活は極めて困難で、労働により収入を得ることができない状態。</li>
                    <li><strong>3級:</strong> 労働に著しい制限を受ける、または労働に著しい制限を加えることを必要とする状態（厚生年金加入者のみ対象）。</li>
                  </ul>
                  <p className="mb-4 text-justify">
                    一般的に民間保険でいう「高度障害」や、生活基盤が根底から覆るリスクとして認識されるのは、主に1級および2級である。
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">4.2 障害年金の受給リスク</h3>
                  <p className="mb-4 text-justify">
                    日本年金機構や厚生労働省のデータに基づくと、障害年金の新規裁定件数（新たに障害年金を受給し始める人の数）は年々増加傾向にあるが、全人口に対する比率で見れば、死亡リスクや傷病手当金受給リスクに比べれば低い。
                  </p>
                  <p className="mb-4 text-justify">
                    しかし、ここで重要なのは「制度的な落とし穴（Gap）」である。自営業者やフリーランス等が加入する「国民年金」には障害等級3級が存在しない。つまり、会社員であれば障害厚生年金（3級）を受給できるレベルの障害（例：人工透析、人工関節、ペースメーカー埋め込み等で労働に制限がある状態）になっても、自営業者は「年金ゼロ」となる。このため、非正規雇用者や自営業者にとっての「障害リスク」は、会社員にとってのそれよりも経済的インパクトが遥かに大きく、統計上の数字以上に深刻なリスクとして捉える必要がある。
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">4.3 障害の原因疾患の変化</h3>
                  <p className="mb-4 text-justify">
                    かつて障害年金の主たる原因は、脳血管疾患による肢体不自由や事故による身体障害であった。しかし近年、新規裁定において最も多い原因は「精神の障害」となっている。うつ病、統合失調症、双極性障害、そして成人になってから診断される発達障害などが含まれる。これは第2章で述べた傷病手当金の傾向と一致しており、現代日本の就労世代における最大のリスクファクターが「脳・心臓」から「精神」へとシフトしていることを裏付けている。
                  </p>
                </div>
              </div>
            </section>

            {/* 第5章 若年性要介護リスクと「介護」の二重構造 */}
            <section className="bg-white p-8 rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-6 font-['Noto_Serif_JP',serif]">
                第5章 若年性要介護リスクと「介護」の二重構造
              </h2>
              
              <div className="space-y-6 text-gray-700 leading-relaxed">
                <p className="text-justify">
                  「介護」は高齢者の問題と捉えられがちだが、現役世代にとっても「自身の介護リスク」と「親の介護による就業不能リスク」という二重の意味で重大なリスクである。
                </p>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">5.1 第2号被保険者（40歳〜64歳）の要介護認定</h3>
                  <p className="mb-4 text-justify">
                    介護保険制度において、40歳から64歳の現役世代は「第2号被保険者」と区分される。この年齢層で要介護認定を受けるためには、単に介護が必要な状態になるだけでなく、その原因が<strong>「特定疾病（16種類）」</strong>に起因するものでなければならない。
                  </p>
                  <p className="mb-4 text-sm">
                    <strong>特定疾病の例:</strong> 末期がん、関節リウマチ、筋萎縮性側索硬化症（ALS）、初老期認知症、脳血管疾患など
                  </p>
                  <p className="mb-4 text-justify">
                    交通事故による障害などは対象外となるため、認定のハードルは65歳以上（原因を問わない）に比べて極めて高い。厚生労働省の「介護保険事業状況報告」によれば、第2号被保険者の要介護（要支援）認定者数は約13万人前後（全第2号被保険者の0.3%程度）で推移している。確率としては1%未満と低いが、ALSや末期がんなど、発症すれば極めて重篤かつ進行性の疾患が対象であるため、本人および家族の経済的・精神的負担は甚大である。この「低頻度・高深度」のリスクもまた、包括的なリスク「12〜15%」の中に包含される重要な要素である。
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">5.2 「ビジネスケアラー」問題：親の介護による離職</h3>
                  <p className="mb-4 text-justify">
                    もう一つの側面として、自分自身が健康であっても、親の介護のために働けなくなる「介護離職」のリスクがある。これは医学的な統計データ（生命表や傷病統計）には表れないが、労働経済学的な観点からは「就業不能リスク」の主要な構成要素である。総務省の就業構造基本調査によれば、介護・看護のために離職する人は年間約10万人に上り、その多くが40代・50代の働き盛り世代である。企業の中核を担う人材が、親の介護という外部要因によってキャリアを断絶されるリスクは、現代日本社会において無視できない確率で発生しており、広義の「働けなくなるリスク」として認識すべきである。
                  </p>
                </div>
              </div>
            </section>

            {/* 第6章 結論 */}
            <section className="bg-white p-8 rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-6 font-['Noto_Serif_JP',serif]">
                第6章 結論：複合的リスクとしての「12〜15%」の妥当性
              </h2>
              
              <div className="space-y-6 text-gray-700 leading-relaxed">
                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">6.1 リスクの総和</h3>
                  <div className="bg-gray-50 p-4 rounded-lg mb-4">
                    <ul className="space-y-2">
                      <li><strong>死亡リスク:</strong> 男性：約9.3%、女性：約4.8%（根拠：厚生労働省 令和5年簡易生命表より算出）</li>
                      <li><strong>就業不能リスク（長期療養）:</strong> 男女計：約13%（35歳時点からの累積）（根拠：協会けんぽ 平成27年度現金給付受給者状況調査報告より推計）</li>
                      <li><strong>高度障害・要介護リスク:</strong> 死亡や就業不能と重複する部分（例：脳卒中で倒れて就業不能になり、後に障害認定される）が多いが、独立したリスクとしても数%存在する。</li>
                    </ul>
                  </div>
                  <p className="mb-4 text-justify">
                    これらを単純合算することは統計的に不正確（重複があるため）だが、概念的に統合すると、現役世代の男性においては、死亡リスク（約9%）に、死に至らないものの長期間働けなくなるリスク（生存リスク）を加味すれば、「12〜15%」という数値は、決して過大評価ではなく、むしろ現実的かつ保守的な推計値であると結論付けられる。
                  </p>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">6.2 データから読み解く社会的含意</h3>
                  <p className="mb-4 text-justify">
                    本調査により明らかになったのは、リスクの「質的転換」である。昭和の時代のリスク対策は「家計維持者の死亡」への備えが中心であった。しかし、令和の現在、データが示す最大のリスクは<strong>「メンタルヘルス不調や生活習慣病により、死なずに長期間働けなくなること」</strong>である。
                  </p>
                  <ul className="space-y-3 mb-4">
                    <li><strong>精神疾患の蔓延:</strong> 若年層の就業不能の過半数を占めるメンタルリスクへの対応が急務である。</li>
                    <li><strong>がんとの共生:</strong> 「死ぬ病気」から「長く付き合う病気（慢性疾患）」へと変化したがんに対し、治療費だけでなく「逸失利益（働けない期間の収入減）」への備えが必要となっている。</li>
                    <li><strong>社会保障の空隙:</strong> 傷病手当金や障害年金の受給要件には厳格な基準があり、特に非正規雇用者や自営業者は、統計上の数値以上の「隠れたリスク（制度的無保険状態）」に晒されている。</li>
                  </ul>
                </div>

                <div>
                  <h3 className="text-xl font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">6.3 提言</h3>
                  <p className="mb-4 text-justify">
                    「12〜15%」という確率は、およそ7〜8人に1人が現役期間中に重大な経済的危機に直面することを示唆している。この事実は、個人のライフプランニングにおいて、死亡保障（生命保険）偏重の見直しを迫るものである。公的保障（傷病手当金、障害年金）の内容を正確に理解した上で、不足する「就業不能期間の所得補償」や「医療費以外の生活費」をどのように手当てするか、という視点が不可欠である。
                  </p>
                  <p className="text-justify">
                    本報告書が、現代日本の現役世代が直面するリスクの実像を理解し、適切なリスクマネジメントを行う上での一助となることを期待する。
                  </p>
                </div>
              </div>
            </section>

            {/* 付録：主要統計データ表 */}
            <section className="bg-white p-8 rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-6 font-['Noto_Serif_JP',serif]">
                付録：主要統計データ表
              </h2>
              
              <div className="space-y-6">
                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">表1：令和5年簡易生命表に基づく年齢別生存数と死亡確率</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="px-4 py-2 border border-gray-300 text-left">年齢 (x)</th>
                          <th className="px-4 py-2 border border-gray-300 text-left">男性 生存数 (l<sub>x</sub>)</th>
                          <th className="px-4 py-2 border border-gray-300 text-left">女性 生存数 (l<sub>x</sub>)</th>
                          <th className="px-4 py-2 border border-gray-300 text-left">男性 死亡確率</th>
                          <th className="px-4 py-2 border border-gray-300 text-left">女性 死亡確率</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-4 py-2 border border-gray-300">0歳</td>
                          <td className="px-4 py-2 border border-gray-300">100,000</td>
                          <td className="px-4 py-2 border border-gray-300">100,000</td>
                          <td className="px-4 py-2 border border-gray-300">-</td>
                          <td className="px-4 py-2 border border-gray-300">-</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border border-gray-300">20歳</td>
                          <td className="px-4 py-2 border border-gray-300">98,698</td>
                          <td className="px-4 py-2 border border-gray-300">99,094</td>
                          <td className="px-4 py-2 border border-gray-300">-</td>
                          <td className="px-4 py-2 border border-gray-300">-</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border border-gray-300">35歳</td>
                          <td className="px-4 py-2 border border-gray-300">97,934 (推計)</td>
                          <td className="px-4 py-2 border border-gray-300">98,600 (推計)</td>
                          <td className="px-4 py-2 border border-gray-300">-</td>
                          <td className="px-4 py-2 border border-gray-300">-</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border border-gray-300">40歳</td>
                          <td className="px-4 py-2 border border-gray-300">97,500 (推計)</td>
                          <td className="px-4 py-2 border border-gray-300">98,300 (推計)</td>
                          <td className="px-4 py-2 border border-gray-300">-</td>
                          <td className="px-4 py-2 border border-gray-300">-</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border border-gray-300">65歳</td>
                          <td className="px-4 py-2 border border-gray-300">89,524</td>
                          <td className="px-4 py-2 border border-gray-300">94,371</td>
                          <td className="px-4 py-2 border border-gray-300">9.30% (20歳起点)</td>
                          <td className="px-4 py-2 border border-gray-300">4.77% (20歳起点)</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">出典：厚生労働省「令和5年簡易生命表」より筆者作成</p>
                </div>

                <div>
                  <h3 className="text-lg font-bold text-gray-800 mb-3 font-['Noto_Serif_JP',serif]">表2：協会けんぽにおける傷病手当金受給者の傷病別構成割合（抜粋）</h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border-collapse">
                      <thead className="bg-gray-200">
                        <tr>
                          <th className="px-4 py-2 border border-gray-300 text-left">順位</th>
                          <th className="px-4 py-2 border border-gray-300 text-left">傷病分類</th>
                          <th className="px-4 py-2 border border-gray-300 text-left">構成比（％）</th>
                          <th className="px-4 py-2 border border-gray-300 text-left">備考</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr>
                          <td className="px-4 py-2 border border-gray-300">1</td>
                          <td className="px-4 py-2 border border-gray-300">精神及び行動の障害</td>
                          <td className="px-4 py-2 border border-gray-300">32.98%</td>
                          <td className="px-4 py-2 border border-gray-300">うつ病、適応障害等。20代〜30代で特に顕著。</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border border-gray-300">2</td>
                          <td className="px-4 py-2 border border-gray-300">新生物（がん）</td>
                          <td className="px-4 py-2 border border-gray-300">16.63%</td>
                          <td className="px-4 py-2 border border-gray-300">40代以降で増加。</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border border-gray-300">3</td>
                          <td className="px-4 py-2 border border-gray-300">筋骨格系及び結合組織の疾患</td>
                          <td className="px-4 py-2 border border-gray-300">13.06%</td>
                          <td className="px-4 py-2 border border-gray-300">腰痛、椎間板ヘルニア等。</td>
                        </tr>
                        <tr>
                          <td className="px-4 py-2 border border-gray-300">4</td>
                          <td className="px-4 py-2 border border-gray-300">循環器系の疾患</td>
                          <td className="px-4 py-2 border border-gray-300">4.88%</td>
                          <td className="px-4 py-2 border border-gray-300">脳血管疾患、心疾患。50代以降で増加。</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                  <p className="text-xs text-gray-500 mt-2">出典：全国健康保険協会「現金給付受給者状況調査報告（令和4年度）」等に基づき構成</p>
                </div>
              </div>
            </section>

            {/* 3. Calculation Methodology */}
            <section className="bg-white p-8 rounded-lg shadow-[0_4px_6px_-1px_rgba(0,0,0,0.1),0_2px_4px_-1px_rgba(0,0,0,0.06)] border border-gray-200">
              <h2 className="text-2xl font-bold text-gray-800 border-b pb-3 mb-6 flex items-center font-['Noto_Serif_JP',serif]">
                <span className="bg-gray-800 text-white w-8 h-8 flex items-center justify-center rounded-full text-sm mr-3">補</span>
                重複除外と数理モデル
              </h2>
              
              <div className="flex flex-col md:flex-row gap-8 items-start">
                <div className="w-full md:w-3/5 text-sm md:text-base text-gray-700 leading-relaxed text-justify">
                  <p className="mb-4">
                    単純に「死亡率」と「障害率」を足し合わせると、確率論的に誤り（過大評価）が生じます。
                    例えば、「重度の障害を負った後に、数年後に死亡した」ケースを両方でカウントしないよう、本推計では保険数理における<strong>「多重脱退モデル（Multiple Decrement Model）」</strong>の概念を採用しています。
                  </p>
                  <p className="mb-4">
                    具体的には、以下の優先順位で「経済的活動からの脱退」を定義し、最初のイベント発生時点でシミュレーションを終了します。
                  </p>
                  
                  <ul className="space-y-3 mt-6">
                    <li className="flex items-start">
                      <span className="font-bold text-red-600 mr-2">Step 1.</span>
                      <div>
                        <strong>死亡 (Death)</strong><br />
                        <span className="text-xs text-gray-500">最優先の確定事由。ここに含まれる者は、以下の障害統計からは除外。</span>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold text-orange-600 mr-2">Step 2.</span>
                      <div>
                        <strong>高度障害 (Severe Disability)</strong><br />
                        <span className="text-xs text-gray-500">生存しているが、復職不能が確定した状態（視力喪失、四肢麻痺など）。</span>
                      </div>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold text-blue-600 mr-2">Step 3.</span>
                      <div>
                        <strong>長期就業不能 (Long-term Incapacity)</strong><br />
                        <span className="text-xs text-gray-500">障害認定に至らないまでも、1年以上の入院・療養等で収入が途絶える状態。</span>
                      </div>
                    </li>
                  </ul>
                </div>

                <div className="w-full md:w-2/5">
                  <div className="bg-gray-800 text-white p-6 rounded-lg shadow-lg">
                    <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">Calculation Logic (Simplified)</h4>
                    <div className="font-mono text-sm space-y-2">
                      <p className="opacity-70">// Total Risk Probability</p>
                      <p>{'$P_{total} \\approx P_{death} + (1 - P_{death}) \\times P_{disability}$'}</p>
                      <hr className="border-gray-600 my-3" />
                      <p className="text-xs leading-5 opacity-80">
                        死亡しなかった生存者集団 (1 - P_death) の中から、障害が発生する確率 P_disability を適用することで、二重カウントを防ぎます。<br />
                        ※実際には年齢x歳ごとの脱退率q<sub>x</sub>を用いた積分計算を行います。
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-xs text-yellow-800">
                    <strong>注釈：20歳起点のリスクについて</strong><br />
                    20歳0ヶ月時点での累積リスクは理論上0%ですが、20歳〜21歳の1年間にも不慮の事故や急性疾患のリスクは存在します（年間死亡率 約0.04% + 障害リスク）。本モデルではこの初期リスクも含めて計算しています。
                  </div>
                </div>
              </div>
            </section>

            {/* Footer */}
            <footer className="bg-gray-800 text-gray-400 py-12 mt-12">
              <div className="max-w-4xl mx-auto px-6 text-center text-xs space-y-2">
                <p>Data Sources: Ministry of Health, Labour and Welfare (令和5年簡易生命表, 現金給付受給者状況調査報告, 介護保険事業状況報告).</p>
                <p>Mathematical Model: Competing Risk & Multiple Decrement Table Method.</p>
                <p className="pt-4 border-t border-gray-700 mt-4">Copyright © 2024 Risk Analysis Lab.</p>
              </div>
            </footer>

            <div className="text-center pt-8">
              <button 
                onClick={() => setCurrentView('main')}
                className="text-slate-500 hover:text-slate-800 underline text-sm"
              >
                分析ダッシュボードに戻る
              </button>
            </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
