'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  calculateDisabilityBasicPension,
  calculateDisabilityEmployeePension,
  calculateEligibleChildrenCount,
  DisabilityLevel,
  formatCurrency,
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
      className={`w-full rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-slate-100 ${className}`}
    />
  );
}

function Select({ value, onChange, options }: { value: number | string; onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void; options: { value: number | string; label: string }[] }) {
  return (
    <div className="relative">
      <select
        value={value}
        onChange={onChange}
        className="w-full appearance-none rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-all text-slate-100"
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

/* ===================== メインコンポーネント ===================== */
export default function DisabilityPensionPage() {
  // --- State ---
  // 共通
  const [childrenCount, setChildrenCount] = useState<number | null>(null);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);
  const [spouseType, setSpouseType] = useState<'couple' | 'none' | undefined>(undefined);

  // 妻の情報
  const [ageWife, setAgeWife] = useState<number>(35);
  const [avgStdMonthlyWife, setAvgStdMonthlyWife] = useState<number>(300000);
  const [monthsWife, setMonthsWife] = useState<number>(120);
  const [levelWife, setLevelWife] = useState<DisabilityLevel>(2);

  // 夫の情報
  const [ageHusband, setAgeHusband] = useState<number>(38);
  const [avgStdMonthlyHusband, setAvgStdMonthlyHusband] = useState<number>(450000);
  const [monthsHusband, setMonthsHusband] = useState<number>(180);
  const [levelHusband, setLevelHusband] = useState<DisabilityLevel>(2);

  // 本人の情報（独身）
  const [ageSingle, setAgeSingle] = useState<number>(30);
  const [avgStdMonthlySingle, setAvgStdMonthlySingle] = useState<number>(350000);
  const [monthsSingle, setMonthsSingle] = useState<number>(100);
  const [levelSingle, setLevelSingle] = useState<DisabilityLevel>(2);

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
          if (basicInfo.spouseType) setSpouseType(basicInfo.spouseType);

          // 妻
          if (basicInfo.ageWife) setAgeWife(basicInfo.ageWife);
          if (basicInfo.avgStdMonthlyWife) setAvgStdMonthlyWife(basicInfo.avgStdMonthlyWife);
          if (basicInfo.monthsWife) setMonthsWife(basicInfo.monthsWife);

          // 夫
          if (basicInfo.ageHusband) setAgeHusband(basicInfo.ageHusband);
          if (basicInfo.avgStdMonthlyHusband) setAvgStdMonthlyHusband(basicInfo.avgStdMonthlyHusband);
          if (basicInfo.monthsHusband) setMonthsHusband(basicInfo.monthsHusband);

          // 本人
          if (basicInfo.age) setAgeSingle(basicInfo.age);
          if (basicInfo.avgStdMonthly) setAvgStdMonthlySingle(basicInfo.avgStdMonthly);
          if (basicInfo.employeePensionMonths) setMonthsSingle(basicInfo.employeePensionMonths);

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

  // 妻の障害年金
  const caseWifeDisability = useMemo(() => {
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges, levelWife);
    const basicPension = calculateDisabilityBasicPension(levelWife, eligibleChildren);

    // 配偶者加給年金（障害厚生年金）
    // 要件: 障害等級1級または2級で、生計を維持されている65歳未満の配偶者がいる場合
    // ここでは簡易的に、夫が65歳未満であれば加算対象とする
    const spouseAge = ageHusband;
    const spouseBonus = (levelWife <= 2 && spouseAge < 65) ? 234800 : 0; // 令和6年度額（簡易）

    const employeePension = calculateDisabilityEmployeePension(
      levelWife,
      spouseBonus,
      0, // 報酬比例部分の計算に必要なパラメータ（今回は簡易計算のため0または省略）
      avgStdMonthlyWife,
      monthsWife,
      true // みなし300月を使用
    );

    return {
      basicPension,
      employeePension,
      total: basicPension + employeePension
    };
  }, [levelWife, childrenAges, ageHusband, avgStdMonthlyWife, monthsWife]);

  // 夫の障害年金
  const caseHusbandDisability = useMemo(() => {
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges, levelHusband);
    const basicPension = calculateDisabilityBasicPension(levelHusband, eligibleChildren);

    const spouseAge = ageWife;
    const spouseBonus = (levelHusband <= 2 && spouseAge < 65) ? 234800 : 0;

    const employeePension = calculateDisabilityEmployeePension(
      levelHusband,
      spouseBonus,
      0,
      avgStdMonthlyHusband,
      monthsHusband,
      true
    );

    return {
      basicPension,
      employeePension,
      total: basicPension + employeePension
    };
  }, [levelHusband, childrenAges, ageWife, avgStdMonthlyHusband, monthsHusband]);

  // 本人（独身）の障害年金
  const caseSingleDisability = useMemo(() => {
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges, levelSingle);
    const basicPension = calculateDisabilityBasicPension(levelSingle, eligibleChildren);

    const employeePension = calculateDisabilityEmployeePension(
      levelSingle,
      0, // 配偶者なし
      0,
      avgStdMonthlySingle,
      monthsSingle,
      true
    );

    return {
      basicPension,
      employeePension,
      total: basicPension + employeePension
    };
  }, [levelSingle, childrenAges, avgStdMonthlySingle, monthsSingle]);


  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500/30 pb-20">
      {/* ヘッダー */}
      <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-8 bg-amber-500 rounded-full"></span>
            障害年金シミュレーター
          </h1>
          <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
            TOPへ戻る
          </Link>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          {/* 左カラム：入力エリア */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
                <span className="text-amber-400">⚙️</span> 前提条件
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

                {spouseType === 'couple' && (
                  <>
                    <Accordion
                      title="妻の情報"
                      defaultOpen={false}
                      headerContent={`${levelWife}級 / 月収${(avgStdMonthlyWife / 10000).toFixed(0)}万`}
                    >
                      <div className="space-y-4">
                        <div>
                          <Label>障害等級</Label>
                          <Select
                            value={levelWife}
                            onChange={(e) => setLevelWife(Number(e.target.value) as DisabilityLevel)}
                            options={[
                              { value: 1, label: '1級' },
                              { value: 2, label: '2級' },
                              { value: 3, label: '3級' },
                            ]}
                          />
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
                      headerContent={`${levelHusband}級 / 月収${(avgStdMonthlyHusband / 10000).toFixed(0)}万`}
                    >
                      <div className="space-y-4">
                        <div>
                          <Label>障害等級</Label>
                          <Select
                            value={levelHusband}
                            onChange={(e) => setLevelHusband(Number(e.target.value) as DisabilityLevel)}
                            options={[
                              { value: 1, label: '1級' },
                              { value: 2, label: '2級' },
                              { value: 3, label: '3級' },
                            ]}
                          />
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
                  </>
                )}

                {spouseType === 'none' && (
                  <Accordion
                    title="本人の情報"
                    defaultOpen={true}
                    headerContent={`${levelSingle}級 / 月収${(avgStdMonthlySingle / 10000).toFixed(0)}万`}
                  >
                    <div className="space-y-4">
                      <div>
                        <Label>障害等級</Label>
                        <Select
                          value={levelSingle}
                          onChange={(e) => setLevelSingle(Number(e.target.value) as DisabilityLevel)}
                          options={[
                            { value: 1, label: '1級' },
                            { value: 2, label: '2級' },
                            { value: 3, label: '3級' },
                          ]}
                        />
                      </div>
                      <div>
                        <Label>平均標準報酬月額</Label>
                        <Input value={avgStdMonthlySingle} onChange={(e) => setAvgStdMonthlySingle(Number(e.target.value))} />
                      </div>
                      <div>
                        <Label>厚生年金加入月数</Label>
                        <Input value={monthsSingle} onChange={(e) => setMonthsSingle(Number(e.target.value))} />
                      </div>
                    </div>
                  </Accordion>
                )}
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

            {spouseType === 'couple' && (
              <>
                {/* 妻の障害年金 */}
                <section>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                      <span className="text-xl">👩</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-100">妻が障害状態になった場合</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <ResultCard title="障害基礎年金" amount={caseWifeDisability.basicPension} colorClass="border-rose-500/30" />
                    <ResultCard title="障害厚生年金" amount={caseWifeDisability.employeePension} colorClass="border-rose-500/30" />
                    <div className="p-4 rounded-xl bg-rose-900/20 border border-rose-500/50 backdrop-blur-sm">
                      <div className="text-xs text-rose-300 mb-1">合計受給額（年額）</div>
                      <div className="text-2xl font-bold text-rose-400">
                        {formatCurrency(caseWifeDisability.total)}<span className="text-sm font-normal ml-1">円</span>
                      </div>
                    </div>
                  </div>
                </section>

                {/* 夫の障害年金 */}
                <section className="pt-12 border-t border-slate-800">
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                      <span className="text-xl">👨</span>
                    </div>
                    <h2 className="text-2xl font-bold text-slate-100">夫が障害状態になった場合</h2>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                    <ResultCard title="障害基礎年金" amount={caseHusbandDisability.basicPension} colorClass="border-emerald-500/30" />
                    <ResultCard title="障害厚生年金" amount={caseHusbandDisability.employeePension} colorClass="border-emerald-500/30" />
                    <div className="p-4 rounded-xl bg-emerald-900/20 border border-emerald-500/50 backdrop-blur-sm">
                      <div className="text-xs text-emerald-300 mb-1">合計受給額（年額）</div>
                      <div className="text-2xl font-bold text-emerald-400">
                        {formatCurrency(caseHusbandDisability.total)}<span className="text-sm font-normal ml-1">円</span>
                      </div>
                    </div>
                  </div>
                </section>
              </>
            )}

            {spouseType === 'none' && (
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/10 flex items-center justify-center text-amber-400 border border-amber-500/20">
                    <span className="text-xl">👤</span>
                  </div>
                  <h2 className="text-2xl font-bold text-slate-100">本人が障害状態になった場合</h2>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <ResultCard title="障害基礎年金" amount={caseSingleDisability.basicPension} colorClass="border-amber-500/30" />
                  <ResultCard title="障害厚生年金" amount={caseSingleDisability.employeePension} colorClass="border-amber-500/30" />
                  <div className="p-4 rounded-xl bg-amber-900/20 border border-amber-500/50 backdrop-blur-sm">
                    <div className="text-xs text-amber-300 mb-1">合計受給額（年額）</div>
                    <div className="text-2xl font-bold text-amber-400">
                      {formatCurrency(caseSingleDisability.total)}<span className="text-sm font-normal ml-1">円</span>
                    </div>
                  </div>
                </div>
              </section>
            )}

            {!spouseType && (
              <div className="p-8 rounded-2xl bg-slate-900/40 border border-slate-800 text-center">
                <p className="text-slate-400 mb-4">プロフィール設定で「世帯タイプ」を選択してください。</p>
                <Link
                  href="/simulators/customer-profile"
                  className="inline-block px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-full transition-colors"
                >
                  プロフィール設定へ
                </Link>
              </div>
            )}

          </div>
        </div>
      </div>
    </main>
  );
}
