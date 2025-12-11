'use client';

import { useState, useEffect, useRef } from 'react';

interface SimulationDisclaimerProps {
  isOpen?: boolean;
  onToggle?: () => void;
}

export default function SimulationDisclaimer({ isOpen: externalIsOpen, onToggle }: SimulationDisclaimerProps) {
  const [internalIsOpen, setInternalIsOpen] = useState(false);
  const isOpen = externalIsOpen !== undefined ? externalIsOpen : internalIsOpen;
  const detailsRef = useRef<HTMLDetailsElement>(null);

  useEffect(() => {
    if (externalIsOpen !== undefined && externalIsOpen && detailsRef.current) {
      // すべてのdetails要素を開く
      const allDetails = detailsRef.current.querySelectorAll('details');
      allDetails.forEach((detail) => {
        detail.open = true;
      });
    }
  }, [externalIsOpen]);

  const handleToggle = () => {
    if (externalIsOpen === undefined) {
      setInternalIsOpen((prev) => !prev);
    }
    if (onToggle) {
      onToggle();
    }
  };

  return (
    <div className="disclaimer-container mt-12 pt-8 border-t border-slate-800">
      <button
        onClick={handleToggle}
        className="w-full flex items-center justify-between mb-4 p-4 rounded-lg bg-slate-900/60 border border-slate-800 hover:border-slate-700 hover:bg-slate-900/80 transition-all duration-300"
      >
        <h3 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
          <span className="text-amber-400">⚠️</span>
          シミュレーションに関する重要な注意事項
        </h3>
        <span className={`text-slate-400 transition-transform duration-300 ${isOpen ? 'rotate-180' : ''}`}>
          ⌃
        </span>
      </button>

      {isOpen && (
        <div ref={detailsRef} className="space-y-4">
          <p className="text-xs text-slate-400 leading-relaxed">
            このシミュレーションは、お客様の保障の現状を概算で把握し、保険提案のたたき台を作成するためのものです。実際の公的給付額や将来の必要額とは異なる場合がありますので、必ず以下の点をご理解のうえご参照ください。
          </p>

          <div className="space-y-3">
            {/* 1. 概算・現状ベースの計算に関する注意 */}
            <details className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
              <summary className="font-medium text-slate-300 cursor-pointer list-none flex items-center justify-between">
                <span>1. 概算・現状ベースの計算に関する注意</span>
                <span className="text-slate-500 text-xs">⌃</span>
              </summary>
              <ul className="list-disc pl-5 mt-3 text-xs text-slate-400 space-y-2 leading-relaxed">
                <li>
                  <strong className="text-slate-300">【現在の情報に基づく概算です】</strong> 本シミュレーションは、「現在の生活状況、現在の給与水準」に基づいて計算しています。将来の昇給、退職金、企業年金、その他の資産の増加などは一切反映されておりません。
                </li>
                <li>
                  <strong className="text-slate-300">【物価上昇率・金利は考慮していません】</strong> 将来の物価上昇（インフレ）や金利の変動は考慮していません。このため、将来の「不足額」は、物価上昇の影響を受けてさらに大きくなる可能性があります。
                </li>
                <li>
                  <strong className="text-slate-300">【概算の計算式を適用しています】</strong> 入力された「年収」を基に、公的年金制度上の「平均報酬月額」を推定し、計算式に当てはめて公的給付額を算出しています。実際の受給額は、加入期間、保険料納付状況によって必ず異なります。
                </li>
                <li>
                  <strong className="text-slate-300">【加入期間の特例に関する注意】</strong> 遺族年金および障害年金の給付額計算において、年金加入期間が25年（300カ月）未満の場合は特例として300カ月と見なして計算していますが、実際の受給資格や金額は、個別の加入履歴に基づき日本年金機構が決定します。
                </li>
              </ul>
            </details>

            {/* 2. 公的給付の変動に関する注意 */}
            <details className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
              <summary className="font-medium text-slate-300 cursor-pointer list-none flex items-center justify-between">
                <span>2. 公的給付の変動に関する注意</span>
                <span className="text-slate-500 text-xs">⌃</span>
              </summary>
              <ul className="list-disc pl-5 mt-3 text-xs text-slate-400 space-y-2 leading-relaxed">
                <li>
                  <strong className="text-slate-300">【将来の制度改正リスク】</strong> 公的年金や児童手当、児童扶養手当などの公的給付制度は、将来的に改正される可能性があります。改正された場合、このシミュレーションで算出した給付額とは異なる金額となる可能性があります。
                </li>
                <li>
                  <strong className="text-slate-300">【お客様の加入時期により給付額が変わります】</strong> 遺族年金や障害年金の受給金額は、過去の年金加入期間や厚生年金への加入時期によって細かく変動します。
                </li>
                <li>
                  <strong className="text-slate-300">【所得制限による変動】</strong> 児童扶養手当や公的年金には、遺族となる方の所得に応じた制限があります。個別の所得状況によっては給付額が変動します。
                </li>
              </ul>
            </details>

            {/* 3. その他（最終確認事項） */}
            <details className="p-4 bg-slate-900/40 border border-slate-800 rounded-lg hover:border-slate-700 transition-colors">
              <summary className="font-medium text-slate-300 cursor-pointer list-none flex items-center justify-between">
                <span>3. その他（最終確認事項）</span>
                <span className="text-slate-500 text-xs">⌃</span>
              </summary>
              <ul className="list-disc pl-5 mt-3 text-xs text-slate-400 space-y-2 leading-relaxed">
                <li>
                  <strong className="text-slate-300">【保険商品の選定は最終判断ではありません】</strong> このシミュレーション結果は、お客様に「必要な保障額」という目標額を提示するものであり、特定の保険商品への加入を推奨するものではありません。
                </li>
                <li>
                  <strong className="text-slate-300">【最終確認は年金機構へ】</strong> 遺族年金や障害年金などの公的給付の正確な受給資格や金額については、必ず<strong className="text-slate-200">日本年金機構</strong>にご確認ください。
                </li>
              </ul>
            </details>
          </div>
        </div>
      )}
    </div>
  );
}

