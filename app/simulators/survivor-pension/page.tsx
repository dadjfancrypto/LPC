'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  calculateAge,
  calculateFiscalYearAge,
  generateTimeline,
  calculateSurvivorBasicPension,
  calculateSurvivorEmployeePension,
  calculateChukoreiKasan,
  calculateWidowPension,
  calculateLumpSumDeath,
  formatCurrency,
  TimelineItem,
  PensionType,
  calculateEligibleChildrenCount,
  PolicyMode,
  POLICY_MODES,
} from '../../utils/pension-calc';

/* ===================== UI Components ===================== */

function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={`bg-slate-900/40 border border-slate-800 rounded-2xl backdrop-blur-sm ${className}`}>
      {children}
    </div>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{children}</label>;
}

function Input({ type = "number", value, onChange, className = "" }: { type?: string; value: number | string; onChange: (e: React.ChangeEvent<HTMLInputElement>) => void; className?: string }) {
  return (
    <input
      type={type}
      value={value}
      onChange={onChange}
      className={`w-full rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-100 ${className}`}
    />
  );
}

function Select({ value, onChange, options }: { value: number | string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: number | string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-100"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
    </div>
  );
}

/* ===================== アコーディオン ===================== */
function Accordion({ title, children, defaultOpen = false, onClear, headerContent }: { title: string; children: React.ReactNode; defaultOpen?: boolean; onClear?: () => void; headerContent?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left text-sm flex items-center justify-between px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 transition-all"
        >
          <span className="flex items-center gap-2 flex-wrap">
            <span className="font-bold text-slate-200">{title}</span>
            {headerContent && <span className="text-xs opacity-70 font-normal border-l border-slate-600 pl-2">{headerContent}</span>}
          </span>
          <span className={`text-slate-400 transition-transform duration-300 ${open ? 'rotate-180' : ''}`}>
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </span>
        </button>
        {onClear && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-rose-900/20 hover:border-rose-900/50 hover:text-rose-400 text-slate-400 transition-all"
            title="クリア"
          >
            <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
              <path strokeLinecap="round" strokeLinejoin="round" d="M14.74 9l-.346 9m-4.788 0L9.26 9m9.968-3.21c.342.052.682.107 1.022.166m-1.022-.165L18.16 19.673a2.25 2.25 0 01-2.244 2.077H8.084a2.25 2.25 0 01-2.244-2.077L4.772 5.79m14.456 0a48.108 48.108 0 00-3.478-.397m-12 .562c.34-.059.68-.114 1.022-.165m0 0a48.11 48.11 0 013.478-.397m7.5 0v-.916c0-1.18-.91-2.164-2.09-2.201a51.964 51.964 0 00-3.32 0c-1.18.037-2.09 1.022-2.09 2.201v.916m7.5 0a48.667 48.667 0 00-7.5 0" />
            </svg>
          </button>
        )}
      </div>
      {open && (
        <div className="p-4 border border-slate-800 border-t-0 rounded-b-xl bg-slate-900/20 animate-slide-down">
          {children}
        </div>
      )}
    </div>
  );
}

/* ===================== 結果表示コンポーネント ===================== */
function ResultCard({ title, amount, colorClass }: { title: string; amount: number; colorClass: string }) {
  return (
    <div className={`p-4 rounded-xl border ${colorClass} bg-slate-900/40 backdrop-blur-sm`}>
      <div className="text-xs text-slate-400 mb-1">{title}</div>
      <div className="text-xl font-bold text-slate-100">
        {amount > 0 ? formatCurrency(amount) : '---'}
        <span className="text-xs font-normal text-slate-500 ml-1">円/年</span>
      </div>
    </div>
  );
}

/* ===================== タイムラインコンポーネント ===================== */
function TimelineView({ items }: { items: TimelineItem[] }) {
  return (
    <div className="relative pl-8 border-l-2 border-slate-800 space-y-8 py-4">
      {items.map((item, index) => (
        <div key={index} className="relative">
          {/* ドット */}
          <div className={`absolute -left-[39px] top-1 w-5 h-5 rounded-full border-4 border-slate-950 ${item.type === 'event' ? 'bg-emerald-500' : 'bg-slate-600'
            }`} />

          {/* 年齢ラベル */}
          <div className="text-xs font-bold text-slate-500 mb-1 font-mono">
            {item.age}歳
          </div>

          {/* コンテンツ */}
          <div className="bg-slate-900/40 border border-slate-800 rounded-xl p-4 hover:bg-slate-900/60 transition-colors">
            <div className="font-bold text-slate-200 mb-2">{item.label}</div>

            {/* 金額の内訳 */}
            {item.amount > 0 && (
              <div className="space-y-2">
                <div className="text-2xl font-bold text-emerald-400 font-mono">
                  {formatCurrency(item.amount)}<span className="text-sm text-slate-500 ml-1">円/年</span>
                </div>

                {item.breakdown && item.breakdown.length > 0 && (
                  <div className="space-y-1 pt-2 border-t border-slate-800/50">
                    {item.breakdown.map((b, i) => (
                      <div key={i} className="flex justify-between text-xs text-slate-400">
                        <span>{b.name}</span>
                        <span>{formatCurrency(b.amount)}円</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {item.amount === 0 && item.type !== 'event' && (
              <div className="text-sm text-slate-500 italic">受給なし</div>
            )}
          </div>
        </div>
      ))}
    </div>
  );
}

/* ===================== メインコンポーネント ===================== */
export default function SurvivorPensionPage() {
  // --- State ---
  const [mode, setMode] = useState<PolicyMode>('current');

  // 共通
  const [childrenCount, setChildrenCount] = useState<number | null>(null);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);

  // 妻の情報
  const [ageWife, setAgeWife] = useState<number>(35);
  const [avgStdMonthlyWife, setAvgStdMonthlyWife] = useState<number>(300000);
  const [monthsWife, setMonthsWife] = useState<number>(120);
  const [useMinashi300Wife, setUseMinashi300Wife] = useState<boolean>(true);
  const [oldAgeStartWife, setOldAgeStartWife] = useState<number>(65);

  // 夫の情報
  const [ageHusband, setAgeHusband] = useState<number>(38);
  const [avgStdMonthlyHusband, setAvgStdMonthlyHusband] = useState<number>(450000);
  const [monthsHusband, setMonthsHusband] = useState<number>(180);
  const [useMinashi300Husband, setUseMinashi300Husband] = useState<boolean>(true);
  const [oldAgeStartHusband, setOldAgeStartHusband] = useState<number>(65);

  // --- Effects ---
  // localStorageから読み込み
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedBasic = localStorage.getItem('customer-profile-basic');
      if (savedBasic) {
        try {
          const basicInfo = JSON.parse(savedBasic);

          // 共通
          if (basicInfo.childrenCount !== undefined) setChildrenCount(basicInfo.childrenCount);
          if (basicInfo.childrenAges) setChildrenAges(basicInfo.childrenAges);

          // 妻
          if (basicInfo.ageWife) setAgeWife(basicInfo.ageWife);
          if (basicInfo.avgStdMonthlyWife) setAvgStdMonthlyWife(basicInfo.avgStdMonthlyWife);
          if (basicInfo.monthsWife) setMonthsWife(basicInfo.monthsWife);
          if (basicInfo.useMinashi300Wife !== undefined) setUseMinashi300Wife(basicInfo.useMinashi300Wife);
          if (basicInfo.oldAgeStartWife) setOldAgeStartWife(basicInfo.oldAgeStartWife);

          // 夫
          if (basicInfo.ageHusband) setAgeHusband(basicInfo.ageHusband);
          if (basicInfo.avgStdMonthlyHusband) setAvgStdMonthlyHusband(basicInfo.avgStdMonthlyHusband);
          if (basicInfo.monthsHusband) setMonthsHusband(basicInfo.monthsHusband);
          if (basicInfo.useMinashi300Husband !== undefined) setUseMinashi300Husband(basicInfo.useMinashi300Husband);
          if (basicInfo.oldAgeStartHusband) setOldAgeStartHusband(basicInfo.oldAgeStartHusband);

        } catch (e) {
          console.error('Failed to load basic info', e);
        }
      }
    }
  }, []);

  // 子の人数変更時の処理
  useEffect(() => {
    if (childrenCount === null) return;
    if (childrenAges.length !== childrenCount) {
      const newAges = [...childrenAges];
      if (newAges.length < childrenCount) {
        while (newAges.length < childrenCount) newAges.push(0);
      } else {
        newAges.splice(childrenCount);
      }
      setChildrenAges(newAges);
    }
  }, [childrenCount]);


  // --- Calculations (Memoized) ---

  // ケース1: 夫が死亡（妻が受け取る）
  const caseHusbandDeath = useMemo(() => {
    const currentPolicy = POLICY_MODES[mode];

    // 遺族基礎年金
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges);
    const basicPension = calculateSurvivorBasicPension(eligibleChildren);

    // 遺族厚生年金
    const employeePension = calculateSurvivorEmployeePension(
      avgStdMonthlyHusband,
      monthsHusband,
      useMinashi300Husband
    );

    // 中高齢寡婦加算
    // 要件: 夫死亡時に40歳以上65歳未満の妻で、生計を同じくする子がいない（または子が18歳到達年度末を過ぎた）
    // ここでは簡易的に「現在40歳以上かつ子が0人」の場合に加算フラグを立てるシミュレーションとする
    // ※厳密にはタイムライン上で判定するが、ここでは「現在の受給額」としての参考値
    const isChukorei = (ageWife >= 40 && ageWife < 65 && eligibleChildren === 0);
    const chukoreiKasan = isChukorei ? calculateChukoreiKasan() : 0;

    // 経過的寡婦加算（今回は簡易化のため省略または0）
    const keikatekiKasan = 0;

    return {
      basicPension,
      employeePension,
      chukoreiKasan,
      keikatekiKasan,
      total: basicPension + employeePension + chukoreiKasan + keikatekiKasan
    };
  }, [mode, childrenAges, avgStdMonthlyHusband, monthsHusband, useMinashi300Husband, ageWife]);

  // ケース2: 妻が死亡（夫が受け取る）
  const caseWifeDeath = useMemo(() => {
    const currentPolicy = POLICY_MODES[mode];

    // 遺族基礎年金
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges);
    const basicPension = calculateSurvivorBasicPension(eligibleChildren);

    // 遺族厚生年金
    // ※夫が受け取る場合、55歳以上である必要があるなどの要件があるが、受給額ベースの計算は同様
    const employeePension = calculateSurvivorEmployeePension(
      avgStdMonthlyWife,
      monthsWife,
      useMinashi300Wife
    );

    return {
      basicPension,
      employeePension,
      total: basicPension + employeePension
    };
  }, [mode, childrenAges, avgStdMonthlyWife, monthsWife, useMinashi300Wife]);

  // タイムライン生成（夫死亡ケース）
  const timelineHusbandDeath = useMemo(() => {
    return generateTimeline({
      currentAge: ageWife,
      targetAge: 100, // 100歳まで
      spouseDeathAge: ageHusband, // 現在時点で死亡と仮定
      childrenAges: childrenAges,
      pensionAmounts: {
        basic: caseHusbandDeath.basicPension,
        employee: caseHusbandDeath.employeePension,
        chukorei: calculateChukoreiKasan(),
      },
      isWife: true, // 受給者は妻
      oldAgeStart: oldAgeStartWife,
    });
  }, [ageWife, ageHusband, childrenAges, caseHusbandDeath, oldAgeStartWife]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 pb-20">
      {/* ヘッダー */}
      <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
            遺族年金シミュレーター
          </h1>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
              <button
                onClick={() => setMode('current')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'current' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
              >
                現行制度
              </button>
              <button
                onClick={() => setMode('revised2028')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'revised2028' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
              >
                2028改正案
              </button>
            </div>
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
              TOPへ戻る
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* 左カラム：入力エリア */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
                <span className="text-emerald-400">⚙️</span> 前提条件
              </h2>

              <div className="space-y-4">
                <Accordion
                  title="基本情報（子）"
                  defaultOpen={true}
                  onClear={() => { setChildrenCount(null); setChildrenAges([]); }}
                  headerContent={childrenCount !== null ? `${childrenCount}人` : undefined}
                >
                  <div className="space-y-4">
                    <div>
                      <Label>子の人数</Label>
                      <Select
                        value={childrenCount ?? ''}
                        onChange={(e) => setChildrenCount(e.target.value ? Number(e.target.value) : null)}
                        options={[
                          { value: '', label: '--' },
                          ...Array.from({ length: 6 }, (_, i) => ({ value: i, label: `${i}人` }))
                        ]}
                      />
                    </div>
                    {childrenCount !== null && childrenCount > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: childrenCount }).map((_, i) => (
                          <div key={i}>
                            <Label>{i + 1}人目の年齢</Label>
                            <Select
                              value={childrenAges[i] ?? 0}
                              onChange={(e) => {
                                const newAges = [...childrenAges];
                                newAges[i] = Number(e.target.value);
                                setChildrenAges(newAges);
                              }}
                              options={Array.from({ length: 23 }, (_, j) => ({ value: j, label: `${j}歳` }))}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Accordion>

                <Accordion
                  title="妻の情報"
                  defaultOpen={false}
                  headerContent={`${ageWife}歳 / 月収${(avgStdMonthlyWife / 10000).toFixed(0)}万`}
                >
                  <div className="space-y-4">
                    <div>
                      <Label>年齢</Label>
                      <Input value={ageWife} onChange={(e) => setAgeWife(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>平均標準報酬月額</Label>
                      <Input value={avgStdMonthlyWife} onChange={(e) => setAvgStdMonthlyWife(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>厚生年金加入月数</Label>
                      <Input value={monthsWife} onChange={(e) => setMonthsWife(Number(e.target.value))} />
                    </div>
                  </div>
                </Accordion>

                <Accordion
                  title="夫の情報"
                  defaultOpen={false}
                  headerContent={`${ageHusband}歳 / 月収${(avgStdMonthlyHusband / 10000).toFixed(0)}万`}
                >
                  <div className="space-y-4">
                    <div>
                      <Label>年齢</Label>
                      <Input value={ageHusband} onChange={(e) => setAgeHusband(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>平均標準報酬月額</Label>
                      <Input value={avgStdMonthlyHusband} onChange={(e) => setAvgStdMonthlyHusband(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>厚生年金加入月数</Label>
                      <Input value={monthsHusband} onChange={(e) => setMonthsHusband(Number(e.target.value))} />
                    </div>
                  </div>
                </Accordion>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <Link
                  href="/simulators/customer-profile"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm font-bold"
                >
                  <span>👤</span> プロフィール設定へ
                </Link>
              </div>
            </div>
          </div>

          {/* 右カラム：結果エリア */}
          <div className="lg:col-span-8 space-y-8">

            {/* ケース1: 夫死亡 */}
            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <span className="text-xl">👨</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-100">夫が死亡した場合</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                <ResultCard title="遺族基礎年金" amount={caseHusbandDeath.basicPension} colorClass="border-emerald-500/30" />
                <ResultCard title="遺族厚生年金" amount={caseHusbandDeath.employeePension} colorClass="border-emerald-500/30" />
                <ResultCard title="中高齢寡婦加算" amount={caseHusbandDeath.chukoreiKasan} colorClass="border-emerald-500/30" />
                <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/50 backdrop-blur-sm">
                  <div className="text-xs text-emerald-300 mb-1">合計受給額（年額）</div>
                  <div className="text-2xl font-bold text-emerald-400">
                    {formatCurrency(caseHusbandDeath.total)}<span className="text-sm font-normal ml-1">円</span>
                  </div>
                </div>
              </div>

              <div className="bg-slate-900/40 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
                <h3 className="text-sm font-bold text-slate-400 mb-6 uppercase tracking-wider">受給タイムライン（妻の年齢）</h3>
                <TimelineView items={timelineHusbandDeath} />
              </div>
            </section>

            {/* ケース2: 妻死亡 */}
            <section className="pt-12 border-t border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                  <span className="text-xl">👩</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-100">妻が死亡した場合</h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <ResultCard title="遺族基礎年金" amount={caseWifeDeath.basicPension} colorClass="border-rose-500/30" />
                <ResultCard title="遺族厚生年金" amount={caseWifeDeath.employeePension} colorClass="border-rose-500/30" />
                <div className="p-4 rounded-xl bg-rose-900/20 border border-rose-500/50 backdrop-blur-sm">
                  <div className="text-xs text-rose-300 mb-1">合計受給額（年額）</div>
                  <div className="text-2xl font-bold text-rose-400">
                    {formatCurrency(caseWifeDeath.total)}<span className="text-sm font-normal ml-1">円</span>
                  </div>
                </div>
              </div>

              <div className="p-4 rounded-xl bg-slate-800/50 border border-slate-700 text-sm text-slate-400">
                <p>※ 夫が受け取る場合、年齢要件（55歳以上）や受給開始時期（60歳から）などの制限があります。詳細なタイムラインは現在開発中です。</p>
              </div>
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
