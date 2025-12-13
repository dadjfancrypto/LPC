'use client';

import { useState, useEffect, useRef } from 'react';
import { Bar } from 'react-chartjs-2';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';

// Chart.jsの登録
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

export default function HouseholdRiskAnalysisPage() {
  const [activeTab, setActiveTab] = useState('tab-matrix');
  const [expandedDetails, setExpandedDetails] = useState<Set<string>>(new Set());

  const toggleDetails = (riskId: string) => {
    setExpandedDetails(prev => {
      const newSet = new Set(prev);
      if (newSet.has(riskId)) {
        newSet.delete(riskId);
      } else {
        newSet.add(riskId);
      }
      return newSet;
    });
  };

  const handleRiskItemClick = (targetId: string) => {
    let tabToActivate: string;
    if (targetId.startsWith('risk-a')) {
      tabToActivate = 'tab-a';
    } else {
      tabToActivate = 'tab-b';
    }
    setActiveTab(tabToActivate);
    
    setTimeout(() => {
      const targetElement = document.getElementById(targetId);
      if (targetElement) {
        if (!expandedDetails.has(targetId)) {
          toggleDetails(targetId);
        }
        targetElement.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // ハイライトアニメーション
        targetElement.classList.add('ring-2', 'ring-offset-2', targetId.startsWith('risk-a') ? 'ring-red-500' : 'ring-blue-500');
        setTimeout(() => {
          targetElement.classList.remove('ring-2', 'ring-offset-2', 'ring-red-500', 'ring-blue-500');
        }, 2500);
      }
    }, 100);
  };

  const chartOptionsA = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        display: false
      },
      title: {
        display: true,
        text: 'Aゾーン：保険/貯蓄で備えるリスクの費用感（最大5,000万円）',
        font: { size: 16 }
      },
      tooltip: {
        callbacks: {
          label: function(context: any): string {
            let label = context.dataset.label || ''; 
            if (label) {
              label += ': ';
            }
            if (context.parsed.y !== null) {
              if (context.parsed.y >= 10000) {
                label += (context.parsed.y / 10000).toLocaleString() + ' 万円';
              } else {
                label += context.parsed.y.toLocaleString() + ' 円';
              }
            }
            return label;
          }
        }
      }
    },
    scales: {
      y: {
        beginAtZero: true,
        max: 50000000,
        ticks: {
          callback: function(value: any): string {
            if (value >= 10000000) {
              return (value / 10000000).toLocaleString() + ' 千万円';
            } else if (value >= 10000) {
              return (value / 10000).toLocaleString() + ' 万円';
            }
            return value.toLocaleString() + ' 円';
          }
        }
      },
      x: {
        ticks: {
          autoSkip: false,
          maxRotation: 45,
          minRotation: 45,
          callback: function(this: any, value: any, index: number, values: any[]): string {
            const label = this.getLabelForValue(value);
            if (label.length > 10) {
              return label.substring(0, 10) + '...';
            }
            return label;
          }
        }
      }
    }
  };

  const chartOptionsB = {
    ...chartOptionsA,
    plugins: {
      ...chartOptionsA.plugins,
      title: {
        display: true,
        text: 'Bゾーン：貯蓄で対応するリスクの費用感（最大50万円）',
        font: { size: 16 }
      }
    },
    scales: {
      ...chartOptionsA.scales,
      y: {
        ...chartOptionsA.scales.y,
        max: 500000
      }
    }
  };

  const chartDataA = {
    labels: [
      '火災 (再建)', 
      '交通事故 (高額例)', 
      '心臓/脳血管疾患', 
      'がん治療', 
      '長期入院', 
      'パートナー死亡', 
      '介護費用(将来)',
      '老後資金 (不足額)', 
      '親の介護(子負担)'
    ],
    datasets: [{
      label: '費用感/損害額 (Aゾーン)',
      data: [
        25000000, 
        50000000, 
        10000000, 
        3000000, 
        1000000, 
        20000000, 
        5800000, 
        25000000, 
        1000000 
      ],
      backgroundColor: [
        'rgba(217, 83, 79, 0.6)',
        'rgba(217, 83, 79, 0.8)',
        'rgba(217, 83, 79, 0.8)', 
        'rgba(217, 83, 79, 0.6)',
        'rgba(217, 83, 79, 0.6)',
        'rgba(217, 83, 79, 0.6)',
        'rgba(217, 83, 79, 0.6)',
        'rgba(255, 165, 0, 0.8)', 
        'rgba(217, 83, 79, 0.6)'
      ],
      borderColor: 'rgba(217, 83, 79, 1)',
      borderWidth: 1
    }]
  };

  const chartDataB = {
    labels: [
      '自動車の軽微な物損', 
      '旅行キャンセル', 
      '上皮内がん (手術)', 
      '短期入院 (平均)', 
      '骨折 (通院)', 
      '風邪・インフル'
    ],
    datasets: [{
      label: '費用感 (Bゾーン)',
      data: [
        80000, 
        50000, 
        150000, 
        109000, 
        50000, 
        8000 
      ],
      backgroundColor: 'rgba(74, 144, 226, 0.6)',
      borderColor: 'rgba(74, 144, 226, 1)',
      borderWidth: 1
    }]
  };

  return (
    <div className="min-h-screen bg-[#FDFBF8] text-gray-800 font-sans antialiased">
      <div className="container mx-auto p-4 md:p-8 max-w-7xl">
        <header className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800 mb-2">家計のリスク分析ダッシュボード</h1>
          <p className="text-lg text-gray-600">保険で備えるリスク vs 貯蓄で備えるリスク</p>
        </header>

        <section className="mb-8 p-6 bg-white rounded-lg shadow-sm border border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-700 mb-3">このダッシュボードについて</h2>
          <p className="text-gray-600 leading-relaxed">
            私たちの生活には様々なリスクが存在しますが、すべてのリスクに保険で備えるのは非効率です。リスクは、その「影響度（発生した場合の損失額）」と「発生頻度」によって分類できます。
            このツールは、信頼できる公的統計や調査に基づき、どのリスクに「保険」で備え、どのリスクに「貯蓄」で対応すべきかを判断するためのデータを提供します。「全体像」でリスクのマップを把握し、各ゾーンで詳細なデータを確認してください。
          </p>
        </section>

        {/* タブナビゲーション */}
        <div className="mb-6 flex justify-center space-x-2 md:space-x-4">
          <button
            onClick={() => setActiveTab('tab-matrix')}
            className={`text-sm md:text-base py-3 px-4 md:px-6 rounded-lg border-2 transition-all ${
              activeTab === 'tab-matrix'
                ? 'border-red-600 bg-red-600 text-white font-semibold'
                : 'border-transparent bg-white hover:bg-gray-50'
            }`}
          >
            リスクの全体像 (マトリクス)
          </button>
          <button
            onClick={() => setActiveTab('tab-a')}
            className={`text-sm md:text-base py-3 px-4 md:px-6 rounded-lg border-2 transition-all ${
              activeTab === 'tab-a'
                ? 'border-red-600 bg-red-600 text-white font-semibold'
                : 'border-transparent bg-white hover:bg-gray-50'
            }`}
          >
            Aゾーン (保険で備える)
          </button>
          <button
            onClick={() => setActiveTab('tab-b')}
            className={`text-sm md:text-base py-3 px-4 md:px-6 rounded-lg border-2 transition-all ${
              activeTab === 'tab-b'
                ? 'border-red-600 bg-red-600 text-white font-semibold'
                : 'border-transparent bg-white hover:bg-gray-50'
            }`}
          >
            Bゾーン (貯蓄で備える)
          </button>
        </div>

        {/* タブコンテンツ */}
        <div>
          {/* Tab 1: リスクマトリクス */}
          {activeTab === 'tab-matrix' && (
            <div>
              <p className="text-center text-gray-600 mb-6 text-lg">リスクは「影響度（損失額）」と「発生頻度」で4つに分類されます。特に「影響度は大きいが発生頻度は低い」リスクが保険で備えるべき領域です。</p>
              <div className="relative p-8 md:p-16 pt-12 pb-16">
                <div className="grid grid-cols-2 gap-4 min-h-[500px] border border-gray-200 rounded-lg bg-white shadow-sm">
                  {/* 影響度:高 / 頻度:低 (保険で備える領域) */}
                  <div className="p-6 border-2 border-dashed border-gray-200 rounded-md relative">
                    <h4 className="text-red-600 font-bold text-lg mb-2">影響度: 高 / 発生頻度: 低</h4>
                    <p className="text-gray-500 text-sm mb-2">→ **保険**による備えが必須の領域</p>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-red-50 border border-red-600 text-red-700 font-medium hover:bg-red-100 transition-colors" onClick={() => handleRiskItemClick('risk-a-1')}>1. 火災などの住宅損傷</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-red-50 border border-red-600 text-red-700 font-medium hover:bg-red-100 transition-colors" onClick={() => handleRiskItemClick('risk-a-2')}>2. 交通事故による高額賠償</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-red-50 border border-red-600 text-red-700 font-medium hover:bg-red-100 transition-colors" onClick={() => handleRiskItemClick('risk-a-3')}>3. 心疾患・脳血管疾患</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-red-50 border border-red-600 text-red-700 font-medium hover:bg-red-100 transition-colors" onClick={() => handleRiskItemClick('risk-a-4')}>4. ステージの進んだがんの治療</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-red-50 border border-red-600 text-red-700 font-medium hover:bg-red-100 transition-colors" onClick={() => handleRiskItemClick('risk-a-5')}>5. 長期の入院（30日超）</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-red-50 border border-red-600 text-red-700 font-medium hover:bg-red-100 transition-colors" onClick={() => handleRiskItemClick('risk-a-6')}>6. パートナーの早期死亡</div>
                  </div>
                  {/* 影響度:高 / 頻度:高 (予防・保険の両輪が重要) */}
                  <div className="p-6 border-2 border-dashed border-gray-200 rounded-md relative">
                    <h4 className="text-orange-600 font-bold text-lg mb-2">影響度: 高 / 発生頻度: 高</h4>
                    <p className="text-gray-500 text-sm mb-2">→ **予防**努力と**貯蓄/保険**が重要な領域</p>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-red-50 border border-red-600 text-red-700 font-medium hover:bg-red-100 transition-colors" onClick={() => handleRiskItemClick('risk-a-7')}>7. 介護費用（将来的に）</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-red-50 border border-red-600 text-red-700 font-medium hover:bg-red-100 transition-colors" onClick={() => handleRiskItemClick('risk-a-8')}>8. 老後資金の不足</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-red-50 border border-red-600 text-red-700 font-medium hover:bg-red-100 transition-colors" onClick={() => handleRiskItemClick('risk-a-9')}>9. 親の介護（子の経済的負担）</div>
                  </div>
                  {/* 影響度:低 / 頻度:低 (貯蓄・無視) */}
                  <div className="p-6 border-2 border-dashed border-gray-200 rounded-md relative">
                    <h4 className="text-gray-600 font-bold text-lg mb-2">影響度: 低 / 発生頻度: 低</h4>
                    <p className="text-gray-500 text-sm mb-2">→ **貯蓄**で対応するか、損失を許容する領域</p>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-blue-50 border border-blue-500 text-blue-700 font-medium hover:bg-blue-100 transition-colors" onClick={() => handleRiskItemClick('risk-b-1')}>1. 自動車の軽微な物損事故</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-blue-50 border border-blue-500 text-blue-700 font-medium hover:bg-blue-100 transition-colors" onClick={() => handleRiskItemClick('risk-b-2')}>2. 旅行のキャンセル費用</div>
                  </div>
                  {/* 影響度:低 / 頻度:高 (貯蓄で対応) */}
                  <div className="p-6 border-2 border-dashed border-gray-200 rounded-md relative">
                    <h4 className="text-blue-600 font-bold text-lg mb-2">影響度: 低 / 発生頻度: 高</h4>
                    <p className="text-gray-500 text-sm mb-2">→ **貯蓄**（生活防衛資金）で対応すべき領域</p>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-blue-50 border border-blue-500 text-blue-700 font-medium hover:bg-blue-100 transition-colors" onClick={() => handleRiskItemClick('risk-b-3')}>3. 上皮内がん（ステージ0）</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-blue-50 border border-blue-500 text-blue-700 font-medium hover:bg-blue-100 transition-colors" onClick={() => handleRiskItemClick('risk-b-4')}>4. 短期の入院（1ヶ月未満）</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-blue-50 border border-blue-500 text-blue-700 font-medium hover:bg-blue-100 transition-colors" onClick={() => handleRiskItemClick('risk-b-5')}>5. 骨折</div>
                    <div className="cursor-pointer p-2 rounded-md mb-2 bg-blue-50 border border-blue-500 text-blue-700 font-medium hover:bg-blue-100 transition-colors" onClick={() => handleRiskItemClick('risk-b-6')}>6. 風邪やインフルエンザ</div>
                  </div>
                </div>
                {/* 軸タイトル */}
                <div className="absolute top-1/2 left-0 transform -translate-y-1/2 -translate-x-24 -rotate-90 font-bold text-lg text-gray-800">影響度（損失額）</div>
                <div className="absolute bottom-0 left-1/2 transform -translate-x-1/2 translate-y-8 font-bold text-lg text-gray-800">発生頻度</div>
              </div>
            </div>
          )}

          {/* Tab 2: Aゾーン */}
          {activeTab === 'tab-a' && (
            <div>
              <p className="text-center text-gray-600 mb-6 text-lg">「影響度が甚大」で、貯蓄だけではカバーしきれないリスク。一度起これば生活が破綻する可能性があるため、保険による備えが合理的です。</p>
              <div className="relative w-full max-w-2xl mx-auto mb-10" style={{ height: '350px' }}>
                <Bar data={chartDataA} options={chartOptionsA} />
              </div>
              <div className="space-y-6">
                {/* Aゾーン リスクカード */}
                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-a-1">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-a-1')}>
                    <h3 className="text-xl font-semibold text-red-600">1. 火災などの住宅損傷</h3>
                  </div>
                  {expandedDetails.has('risk-a-1') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">住宅の再建・修繕費用、家財の買い替え費用。数千万円単位。（失火責任法により、隣家からの延焼では原則賠償請求できない）</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">建物火災の発生件数は年間約2万件（令和4年）。水災（台風・豪雨）のリスクも増加。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">消防庁「消防白書」、住宅金融支援機構（住宅価格データ）</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">発生確率は低いが、被害額が極めて高額（数千万円単位）。生活の基盤そのものを失うリスクであり、貯蓄（住宅ローン返済と並行）での再建は困難。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-a-2">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-a-2')}>
                    <h3 className="text-xl font-semibold text-red-600">2. 交通事故による高額賠償</h3>
                  </div>
                  {expandedDetails.has('risk-a-2') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">死亡・重度後遺障害の場合、数億円の賠償命令（過去の判例では5億円超も）。自賠責保険（死亡時3,000万円）では全く足りない。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">交通事故発生件数（令和5年）は約30万件。高額賠償に至る確率は低いが、ゼロではない。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">損害保険料率算出機構「自動車保険の概況」、警察庁「交通統計」、裁判所判例</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">発生確率は低いが、一度発生した場合の賠償額が「数億円」と、個人の支払い能力（貯蓄）を遥かに超える。人生が破綻するレベルであり、貯蓄での対応は不可能。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-a-3">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-a-3')}>
                    <h3 className="text-xl font-semibold text-red-600">3. 心疾患・脳血管疾患</h3>
                  </div>
                  {expandedDetails.has('risk-a-3') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">治療費（手術・入院）やリハビリで**数百万円**の自己負担。後遺症が残った場合、**収入減や介護費用**が発生し、総損害は**1,000万円超**となる。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">心疾患は死亡原因の第2位、脳血管疾患は要介護原因の第1位。再発リスクが高く、長期的なリスク。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">厚生労働省「人口動態統計」（令和4年）、生命保険文化センター「生活保障に関する調査」</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">重篤な疾病の中でも、特に費用が高額かつ長期化し、生存後の生活レベルを大きく下げるリスク。現役世代での発症は収入の途絶に直結する。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-a-4">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-a-4')}>
                    <h3 className="text-xl font-semibold text-red-600">4. ステージの進んだがんの治療</h3>
                  </div>
                  {expandedDetails.has('risk-a-4') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">高額療養費制度適用後も、先進医療（例：陽子線治療 約260万円）、差額ベッド代、通院費、未承認薬などで数百万円の自己負担＋収入減。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">生涯罹患率：2人に1人。40代から増加。治療が長期化する（数年単位）リスク。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">国立がん研究センター「がん統計」、厚生労働省「医療給付実態調査」</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">治療の長期化による「治療費の継続的負担」と「就労不能による収入減」のダブルパンチ。特に先進医療や自由診療を選択する場合、貯蓄を一気に使い果たす可能性がある。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-a-5">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-a-5')}>
                    <h3 className="text-xl font-semibold text-red-600">5. 長期の入院（30日超）</h3>
                  </div>
                  {expandedDetails.has('risk-a-5') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">高額療養費制度適用後も、差額ベッド代（全国平均約6,500円/日）や雑費、収入減が累積。**都心部や大規模病院では差額ベッド代が15,000円〜30,000円超/日**になるケースがあり、長期化（3ヶ月等）で自己負担額は**100万円〜300万円超**になる。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">平均在院日数は全体で32.3日だが、精神障害や特定の難病では数ヶ月〜数年に及ぶことも。**全体としては発生頻度は低い**が、長期化リスクは無視できない。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">生命保険文化センター「生活保障に関する調査」（令和4年度）、厚生労働省「患者調査」（令和2年）</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">短期入院（Bゾーン）と異なり、入院が長期化すると、公的保険の効かない**差額ベッド代の地域差**がそのまま自己負担額に大きく影響し、貯蓄を圧迫する。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-a-6">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-a-6')}>
                    <h3 className="text-xl font-semibold text-red-600">6. パートナーの早期死亡</h3>
                  </div>
                  {expandedDetails.has('risk-a-6') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">死亡保険金の平均額は約2,000万円（必要額は世帯構成による）。遺族の生活費、教育費、住居費など。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">例：40歳男性の年間死亡率は0.098%（1,000人に約1人）。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">生命保険文化センター「生命保険に関する全国実態調査」（2021年度）、厚生労働省「令和5年簡易生命表」</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">遺された家族の長期的な生活基盤（特に子供の教育費や住宅ローン）を根底から揺るがすリスク。必要な保障額が数千万円単位となり、貯蓄でのカバーは困難。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow mt-8" id="risk-a-7">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-a-7')}>
                    <h3 className="text-xl font-semibold text-red-600">7. 介護費用（将来的に）</h3>
                  </div>
                  {expandedDetails.has('risk-a-7') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">一時的費用（住宅改修等）平均74万円。月額費用平均8.3万円。平均介護期間61.1ヶ月（約5年1ヶ月）。総額平均 約580万円。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">85歳以上では約60%が要介護（要支援）認定。介護期間は10年以上に及ぶケースも約18%。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">生命保険文化センター「生命保険に関する調査」（2021年度）、厚生労働省「介護給付費等実態統計」</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">平均でも約600万円、長期化すれば1,000万円を超える費用が必要。公的介護保険（1〜3割負担）があっても、特に施設介護や手厚い在宅サービスを選ぶと自己負担は重くなる。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-a-8">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-a-8')}>
                    <h3 className="text-xl font-semibold text-red-600">8. 老後資金の不足</h3>
                  </div>
                  {expandedDetails.has('risk-a-8') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">**約2,000万〜3,000万円超** (不足額)。平均的な老後生活（30年間）で、公的年金に加えて必要となる貯蓄・運用額。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">**ほぼ100%** (公的年金のみで満足な生活を送れない可能性)。長生きリスクとセット。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">金融庁「老後2,000万円問題」報告書（2019年）、総務省「家計調査報告」（2023年）</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">公的年金は最低限の生活費を賄う水準にあり、ゆとりある老後や医療・介護予備費を考慮すると、自助努力による準備が必須となる。発生頻度が最も高く、影響度が長期にわたるため、保険ではなく**計画的な積立・運用（自助）**が必要なリスク。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-a-9">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-a-9')}>
                    <h3 className="text-xl font-semibold text-red-600">9. 親の介護（子の経済的負担）</h3>
                  </div>
                  {expandedDetails.has('risk-a-9') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">月々の費用負担: **平均1.5万円**。一時費用: **平均50万円**。親が施設に入居した場合、施設費や医療費で子の負担がさらに増えるリスクがある。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">団塊の世代が75歳以上になることで、子の世代の介護リスクが急増中。子の介護期間は平均**54.5ヶ月（約4年半）**。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">公益財団法人 生命保険文化センター「生命保険に関する全国実態調査」（2021年度）</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">親の資産状況によっては、現役の子世代が自分の家計から捻出する必要が生じる。経済的な負担だけでなく、**介護離職**という形で収入が途絶える時間的リスクも伴う。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Tab 3: Bゾーン */}
          {activeTab === 'tab-b' && (
            <div>
              <p className="text-center text-gray-600 mb-6 text-lg">「影響度が限定的」で、貯蓄（生活防衛資金）で十分対応可能なリスク。保険で備えようとすると、保険料が割高になる可能性が高いです。</p>
              <div className="relative w-full max-w-2xl mx-auto mb-10" style={{ height: '350px' }}>
                <Bar data={chartDataB} options={chartOptionsB} />
              </div>
              <div className="space-y-6">
                {/* Bゾーン リスクカード */}
                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-b-1">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-b-1')}>
                    <h3 className="text-xl font-semibold text-blue-600">1. 自動車の軽微な物損事故</h3>
                  </div>
                  {expandedDetails.has('risk-b-1') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">バンパーの擦り傷修理、ドアミラー交換など。数万円〜10数万円。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">比較的高い（運転頻度による）。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">損害保険会社（車両保険の利用データなど）</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">費用が少額。保険（車両保険）を使うと等級が下がり翌年度以降の保険料が上がる（数万円）ため、少額の修理は貯蓄（自己負担）で対応した方が合理的な場合が多い。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-b-2">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-b-2')}>
                    <h3 className="text-xl font-semibold text-blue-600">2. 旅行のキャンセル費用</h3>
                  </div>
                  {expandedDetails.has('risk-b-2') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">旅行代金の数%〜100%。数万円程度が一般的。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">個人の事情（体調不良、急用）による（比較的高い）。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">各旅行会社の約款</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">費用が限定的であり、予測可能な損失範囲。趣味・娯楽の範囲であり、生活基盤を揺るがすリスクではないため、貯蓄で備えるのが基本。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow mt-8" id="risk-b-3">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-b-3')}>
                    <h3 className="text-xl font-semibold text-blue-600">3. 上皮内がん（ステージ0）</h3>
                  </div>
                  {expandedDetails.has('risk-b-3') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">日帰り手術や短期入院（数日）が中心。内視鏡手術などで10〜20万円程度（高額療養費制度適用）。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">がん全体の一部。早期発見により割合が増加。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">国立がん研究センター、医療機関の治療実績</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">「がん」と名はつくが、ステージの進んだがん（Aゾーン）とは別物。治療期間が短く、費用も限定的。転移のリスクが（定義上）ほぼなく、その後の就労への影響も少ないため。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-b-4">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-b-4')}>
                    <h3 className="text-xl font-semibold text-blue-600">4. 短期の入院（1ヶ月未満）</h3>
                  </div>
                  {expandedDetails.has('risk-b-4') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">入院時の自己負担費用は平均**19.8万円**。**大部屋（差額ベッド代なし）の場合、1日あたり平均8,143円**（医療費自己負担＋食事代＋諸雑費）。平均入院日数（13.4日）で総額**約10.9万円**に抑えられる。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">平均入院日数は**13.4日**（厚生労働省「患者調査」等より）。ただし、差額ベッド代は地域や病院のグレードにより大きく変動する（都心部では高額化しやすい）。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">生命保険文化センター「生活保障に関する調査」（令和4年度）、厚生労働省「患者調査」</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">公的保険（高額療養費制度）が非常に強力。差額ベッド代を避ける選択をすれば、費用は平均10万円台前半に抑えられ、貯蓄で十分対応可能。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-b-5">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-b-5')}>
                    <h3 className="text-xl font-semibold text-blue-600">5. 骨折</h3>
                  </div>
                  {expandedDetails.has('risk-b-5') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">通院治療（3割負担）で数万円程度。手術・短期入院を伴っても10〜20万円程度（高額療養費制度適用）。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">比較的高め（特に高齢者やスポーツ時）。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">医療機関の一般的な治療費</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">費用が比較的少額で、生命や長期の就労に直結するリスクは低い。貯蓄で対応可能な範囲。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="border border-gray-200 rounded-lg bg-white shadow-sm hover:shadow-md transition-shadow" id="risk-b-6">
                  <div className="p-5 cursor-pointer" onClick={() => toggleDetails('risk-b-6')}>
                    <h3 className="text-xl font-semibold text-blue-600">6. 風邪やインフルエンザ</h3>
                  </div>
                  {expandedDetails.has('risk-b-6') && (
                    <div className="p-5 border-t border-gray-200">
                      <table className="w-full border-collapse mt-4">
                        <tbody>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold w-1/4">費用感/損害額</th>
                            <td className="border border-gray-300 p-3 text-sm">診療費・薬剤費で数千円〜1万円程度（公的保険3割負担）。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">発生リスク率 / 期間</th>
                            <td className="border border-gray-300 p-3 text-sm">非常に高い（季節性、誰でも罹患する）。</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">エビデンス（出典）</th>
                            <td className="border border-gray-300 p-3 text-sm">厚生労働省（インフルエンザ流行マップなど）、一般的な医療費</td>
                          </tr>
                          <tr className="border border-gray-300">
                            <th className="border border-gray-300 p-3 text-left bg-gray-50 font-semibold">論理の裏付け</th>
                            <td className="border border-gray-300 p-3 text-sm">費用が少額で、発生頻度が高すぎる。「大数の法則」が働きにくく、保険で備える（少額の保険金を請求する）コスト（保険料）の方が高くつく。貯蓄で対応すべき典型。</td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

