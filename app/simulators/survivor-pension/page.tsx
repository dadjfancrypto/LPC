'use client';
import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { calculateEligibleChildrenCount, PolicyMode } from '../../utils/pension-calc';
import { calculateSurvivorPensionAmounts } from '../../utils/survivor-pension-logic';
import { PensionCup, CashFlowTimeline } from '../../components/PensionVisualizations';
import { calculateSurvivorWorkIncome, calculateRequiredExpenses } from '../../utils/financial-planning';
import { calculateDisabilityPensionAmounts } from '../../utils/disability-pension-logic';

// --- Helper Components ---

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

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">{children}</label>;
}

function Accordion({ title, children, defaultOpen = false, onClear, headerContent }: { title: string; children: React.ReactNode; defaultOpen?: boolean; onClear?: () => void; headerContent?: React.ReactNode }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2 mb-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left text-sm flex items-center justify-between px-4 py-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-slate-800 transition-all"
        >
          <span className="font-bold text-slate-200">{title}</span>
          <div className="flex items-center gap-3">
            {headerContent && <span className="text-xs text-slate-400 font-normal hidden sm:block">{headerContent}</span>}
            <svg className={`w-4 h-4 text-slate-500 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </button>
        {onClear && (
          <button
            onClick={onClear}
            className="p-3 rounded-xl border border-slate-800 bg-slate-900/60 hover:bg-rose-900/20 hover:border-rose-800 hover:text-rose-400 text-slate-500 transition-all"
            title="リセット"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
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

// --- Main Component ---

export default function SurvivorPensionPage() {
  const [mode, setMode] = useState<PolicyMode>('current');
  const [spouseType, setSpouseType] = useState<'couple' | 'single'>('couple');

  const [childrenCount, setChildrenCount] = useState<number | null>(null);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);

  const [ageWife, setAgeWife] = useState<number>(35);
  const [sliderRatio, setSliderRatio] = useState(0.9);

  const [avgStdMonthlyWife, setAvgStdMonthlyWife] = useState<number>(300000);
  const [monthsWife, setMonthsWife] = useState<number>(120);
  const [useMinashi300Wife, setUseMinashi300Wife] = useState<boolean>(true);
  const [oldAgeStartWife, setOldAgeStartWife] = useState<number>(65);

  const [ageHusband, setAgeHusband] = useState<number>(38);
  const [avgStdMonthlyHusband, setAvgStdMonthlyHusband] = useState<number>(Math.round(5_000_000 / 12)); // 500万円（年収）
  const [monthsHusband, setMonthsHusband] = useState<number>(180);
  const [useMinashi300Husband, setUseMinashi300Husband] = useState<boolean>(true);
  const [oldAgeStartHusband, setOldAgeStartHusband] = useState<number>(65);

  const [currentSavingsTotal, setCurrentSavingsTotal] = useState<number>(0);
  const [existingInsuranceTotal, setExistingInsuranceTotal] = useState<number>(0);
  const [educationCourse, setEducationCourse] = useState<string>('private_hs');
  const [cramSchoolOptions, setCramSchoolOptions] = useState<any>({ elementary: true, juniorHigh: true, highSchool: true });

  const [showNotes, setShowNotes] = useState(false);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const savedBasic = localStorage.getItem('customer-profile-basic');
      if (savedBasic) {
        try {
          const basicInfo = JSON.parse(savedBasic);

          if (basicInfo.childrenCount !== undefined) setChildrenCount(basicInfo.childrenCount);
          if (basicInfo.childrenAges) setChildrenAges(basicInfo.childrenAges);

          if (basicInfo.ageWife) setAgeWife(basicInfo.ageWife);
          if (basicInfo.avgStdMonthlyWife) setAvgStdMonthlyWife(basicInfo.avgStdMonthlyWife);
          if (basicInfo.monthsWife) setMonthsWife(basicInfo.monthsWife);
          if (basicInfo.useMinashi300Wife !== undefined) setUseMinashi300Wife(basicInfo.useMinashi300Wife);
          if (basicInfo.oldAgeStartWife) setOldAgeStartWife(basicInfo.oldAgeStartWife);

          if (basicInfo.ageHusband) setAgeHusband(basicInfo.ageHusband);
          if (basicInfo.avgStdMonthlyHusband) setAvgStdMonthlyHusband(basicInfo.avgStdMonthlyHusband);
          if (basicInfo.monthsHusband) setMonthsHusband(basicInfo.monthsHusband);
          if (basicInfo.useMinashi300Husband !== undefined) setUseMinashi300Husband(basicInfo.useMinashi300Husband);
          if (basicInfo.oldAgeStartHusband) setOldAgeStartHusband(basicInfo.oldAgeStartHusband);

          if (basicInfo.spouseType) setSpouseType(basicInfo.spouseType);

          if (basicInfo.currentSavingsTotal !== undefined) setCurrentSavingsTotal(basicInfo.currentSavingsTotal);
          if (basicInfo.existingInsuranceTotal !== undefined) setExistingInsuranceTotal(basicInfo.existingInsuranceTotal);
          if (basicInfo.educationCourse) setEducationCourse(basicInfo.educationCourse);
          if (basicInfo.cramSchoolOptions) setCramSchoolOptions(basicInfo.cramSchoolOptions);

        } catch (e) {
          console.error('Failed to load basic info', e);
        }
      }
    }
  }, []);

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

  const calculateYearlyData = (
    scenario: 'husband_death' | 'wife_death' | 'husband_disability' | 'wife_disability'
  ) => {
    const isWifeSurvivor = scenario === 'husband_death' || scenario === 'husband_disability';
    const isDisability = scenario === 'husband_disability' || scenario === 'wife_disability';

    const currentAge = isWifeSurvivor ? ageWife : ageHusband;
    const spouseAge = isWifeSurvivor ? ageHusband : ageWife;
    const myAnnualIncome = isWifeSurvivor ? (avgStdMonthlyWife * 12) : (avgStdMonthlyHusband * 12);

    // Asset Income (Monthly)
    const yearsLeft = 100 - currentAge;
    const assetMonthly = yearsLeft > 0 ? (currentSavingsTotal + existingInsuranceTotal) / (yearsLeft * 12) : 0;

    const data = [];
    let totalShortfall = 0;

    for (let age = currentAge; age <= 100; age++) {
      const yearIndex = age - currentAge;

      // Work Income
      let workIncome = 0;
      if (age < 65) {
        workIncome = calculateSurvivorWorkIncome(myAnnualIncome, sliderRatio);
      }

      // Pension Income
      let pensionIncome = 0;
      const currentChildrenAges = childrenAges.map(a => a + yearIndex);

      if (isDisability) {
        const disabilityAmount = calculateDisabilityPensionAmounts({
          level: 2,
          hasSpouse: true,
          ageSpouse: age,
          childrenAges: currentChildrenAges,
          avgStdMonthly: isWifeSurvivor ? avgStdMonthlyHusband : avgStdMonthlyWife,
          months: isWifeSurvivor ? monthsHusband : monthsWife,
          useMinashi300: isWifeSurvivor ? useMinashi300Husband : useMinashi300Wife,
        }).total;
        pensionIncome = disabilityAmount / 12;
      } else {
        const survivorAmount = calculateSurvivorPensionAmounts({
          ageWife: isWifeSurvivor ? age : (spouseAge + yearIndex),
          ageHusband: isWifeSurvivor ? (spouseAge + yearIndex) : age,
          childrenAges: currentChildrenAges,
          survivorSource: {
            avgStdMonthly: isWifeSurvivor ? avgStdMonthlyHusband : avgStdMonthlyWife,
            months: isWifeSurvivor ? monthsHusband : monthsWife,
            useMinashi300: isWifeSurvivor ? useMinashi300Husband : useMinashi300Wife
          },
          ownSource: {
            avgStdMonthly: isWifeSurvivor ? avgStdMonthlyWife : avgStdMonthlyHusband,
            months: isWifeSurvivor ? monthsWife : monthsHusband
          },
          oldAgeStart: isWifeSurvivor ? oldAgeStartWife : oldAgeStartHusband,
          isWifeDeath: !isWifeSurvivor,
          mode: 'current'
        }).total;
        pensionIncome = survivorAmount / 12;
      }

      // Expenses
      const expenses = calculateRequiredExpenses({
        age,
        livingCostBase: 200000,
        educationCourse: educationCourse as any,
        childrenAges: currentChildrenAges,
        currentAgeOfParent: age,
        cramSchoolOptions
      });

      // Shortfall
      const totalIncome = workIncome + pensionIncome + assetMonthly;
      if (expenses > totalIncome) {
        totalShortfall += (expenses - totalIncome);
      }

      data.push({
        age,
        workIncome,
        pensionIncome,
        assetIncome: assetMonthly,
        expenses
      });
    }

    const firstYear = data[0] || { workIncome: 0, pensionIncome: 0, assetIncome: 0, expenses: 0 };

    return {
      timelineData: data,
      cupData: {
        workIncome: firstYear.workIncome,
        pensionAmount: firstYear.pensionIncome,
        assetAmount: firstYear.assetIncome,
        totalRequired: firstYear.expenses
      },
      totalShortfall
    };
  };

  const scenarioHusbandDeath = useMemo(() => calculateYearlyData('husband_death'), [ageWife, ageHusband, childrenAges, avgStdMonthlyWife, avgStdMonthlyHusband, monthsWife, monthsHusband, useMinashi300Wife, useMinashi300Husband, oldAgeStartWife, oldAgeStartHusband, sliderRatio, currentSavingsTotal, existingInsuranceTotal, educationCourse, cramSchoolOptions]);
  const scenarioHusbandDisability = useMemo(() => calculateYearlyData('husband_disability'), [ageWife, ageHusband, childrenAges, avgStdMonthlyWife, avgStdMonthlyHusband, monthsWife, monthsHusband, useMinashi300Wife, useMinashi300Husband, oldAgeStartWife, oldAgeStartHusband, sliderRatio, currentSavingsTotal, existingInsuranceTotal, educationCourse, cramSchoolOptions]);
  const scenarioWifeDeath = useMemo(() => calculateYearlyData('wife_death'), [ageWife, ageHusband, childrenAges, avgStdMonthlyWife, avgStdMonthlyHusband, monthsWife, monthsHusband, useMinashi300Wife, useMinashi300Husband, oldAgeStartWife, oldAgeStartHusband, sliderRatio, currentSavingsTotal, existingInsuranceTotal, educationCourse, cramSchoolOptions]);
  const scenarioWifeDisability = useMemo(() => calculateYearlyData('wife_disability'), [ageWife, ageHusband, childrenAges, avgStdMonthlyWife, avgStdMonthlyHusband, monthsWife, monthsHusband, useMinashi300Wife, useMinashi300Husband, oldAgeStartWife, oldAgeStartHusband, sliderRatio, currentSavingsTotal, existingInsuranceTotal, educationCourse, cramSchoolOptions]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-sky-500/30 pb-20">
      <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
              遺族年金シミュレーター
            </h1>
            <Link
              href="/simulators/survivor-pension/rules"
              className="text-base text-slate-400 hover:text-emerald-400 transition-colors flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-emerald-500/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              遺族年金について
            </Link>
          </div>
          <div className="flex items-center gap-4">
            <button onClick={() => setShowNotes(!showNotes)} className="text-sm text-slate-400 hover:text-white transition-colors">
              このシミュレータの注意点
            </button>
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
              TOPへ戻る
            </Link>
          </div>
        </div>

        {showNotes && (
          <div className="max-w-6xl mx-auto px-6 py-4 border-b border-slate-800 bg-slate-900/80 backdrop-blur-md">
            <ul className="list-disc list-inside text-sm text-slate-400 space-y-2">
              <li>本シミュレーションは概算であり、実際の受給額と異なる場合があります。</li>
              <li>賞与を含めた平均標準報酬額をもとに計算しています。</li>
              <li>国民年金の寡婦年金、死亡一時金は考慮していません。</li>
              <li>2003年4月以降の計算式（7.125/1000 または 5.481/1000）に基づいています。</li>
              <li>正しい年金額は年金機構にお問い合わせください。</li>
            </ul>
          </div>
        )}
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="space-y-8">

          <Accordion
            title="⚙️ 基本情報"
            headerContent="反映されている情報: Customer Profile"
            defaultOpen={false}
            onClear={() => { setChildrenCount(null); setChildrenAges([]); }}
          >
            <div className="space-y-6">
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
                <div className="grid grid-cols-3 gap-2">
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

              {spouseType === 'couple' && (
                <>
                  <div className="pt-4 border-t border-slate-700">
                    <h3 className="text-sm font-bold text-rose-400 mb-3">妻の情報</h3>
                    <div className="space-y-3">
                      <div>
                        <Label>年齢</Label>
                        <Select
                          value={ageWife}
                          onChange={(e) => setAgeWife(Number(e.target.value))}
                          options={Array.from({ length: 83 }, (_, i) => ({ value: 18 + i, label: `${18 + i}歳` }))}
                        />
                      </div>
                      <div>
                        <Label>昨年の年収（額面） (万円)</Label>
                        <div className="relative">
                          <Select
                            value={Math.round(avgStdMonthlyWife * 12 / 10000)}
                            onChange={(e) => {
                              const annualIncome = Number(e.target.value) * 10000;
                              setAvgStdMonthlyWife(Math.round(annualIncome / 12));
                            }}
                            options={Array.from({ length: 71 }, (_, i) => {
                              const value = 300 + i * 10; // 300万円〜1000万円（10万円刻み）
                              return { value, label: `${value}万円` };
                            })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>厚生年金加入月数</Label>
                        <Input value={monthsWife} onChange={(e) => setMonthsWife(Number(e.target.value))} />
                      </div>
                      <div>
                        <Label>老齢年金開始年齢</Label>
                        <Select
                          value={oldAgeStartWife}
                          onChange={(e) => setOldAgeStartWife(Number(e.target.value))}
                          options={Array.from({ length: 16 }, (_, i) => ({ value: 60 + i, label: `${60 + i}歳` }))}
                        />
                      </div>
                      <div className="flex items-start gap-2 mt-2">
                        <input
                          type="checkbox"
                          id="useMinashi300Wife"
                          checked={useMinashi300Wife}
                          onChange={(e) => setUseMinashi300Wife(e.target.checked)}
                          className="mt-1 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                        />
                        <label htmlFor="useMinashi300Wife" className="text-xs text-slate-400 leading-tight">
                          みなし300月を適用
                          <span className="block text-[10px] text-slate-500 mt-0.5">現在厚生年金に加入している方はチェック</span>
                        </label>
                      </div>
                    </div>
                  </div>

                  <div className="pt-4 border-t border-slate-700">
                    <h3 className="text-sm font-bold text-emerald-400 mb-3">夫の情報</h3>
                    <div className="space-y-3">
                      <div>
                        <Label>年齢</Label>
                        <Select
                          value={ageHusband}
                          onChange={(e) => setAgeHusband(Number(e.target.value))}
                          options={Array.from({ length: 83 }, (_, i) => ({ value: 18 + i, label: `${18 + i}歳` }))}
                        />
                      </div>
                      <div>
                        <Label>昨年の年収（額面） (万円)</Label>
                        <div className="relative">
                          <Select
                            value={Math.round(avgStdMonthlyHusband * 12 / 10000)}
                            onChange={(e) => {
                              const annualIncome = Number(e.target.value) * 10000;
                              setAvgStdMonthlyHusband(Math.round(annualIncome / 12));
                            }}
                            options={Array.from({ length: 71 }, (_, i) => {
                              const value = 300 + i * 10; // 300万円〜1000万円（10万円刻み）
                              return { value, label: `${value}万円` };
                            })}
                          />
                        </div>
                      </div>
                      <div>
                        <Label>厚生年金加入月数</Label>
                        <Input value={monthsHusband} onChange={(e) => setMonthsHusband(Number(e.target.value))} />
                      </div>
                      <div>
                        <Label>老齢年金開始年齢</Label>
                        <Select
                          value={oldAgeStartHusband}
                          onChange={(e) => setOldAgeStartHusband(Number(e.target.value))}
                          options={Array.from({ length: 16 }, (_, i) => ({ value: 60 + i, label: `${60 + i}歳` }))}
                        />
                      </div>
                      <div className="flex items-start gap-2 mt-2">
                        <input
                          type="checkbox"
                          id="useMinashi300Husband"
                          checked={useMinashi300Husband}
                          onChange={(e) => setUseMinashi300Husband(e.target.checked)}
                          className="mt-1 rounded border-slate-700 bg-slate-800 text-emerald-500 focus:ring-emerald-500"
                        />
                        <label htmlFor="useMinashi300Husband" className="text-xs text-slate-400 leading-tight">
                          みなし300月を適用
                          <span className="block text-[10px] text-slate-500 mt-0.5">現在厚生年金に加入している方はチェック</span>
                        </label>
                      </div>
                    </div>
                  </div>
                </>
              )}
            </div>
          </Accordion>

          {/* Slider */}
          <div className="bg-slate-900/40 p-6 rounded-2xl border border-slate-800">
            <h2 className="text-lg font-bold mb-4">就労収入のリスク調整</h2>
            <input
              type="range"
              min="0.5"
              max="1.0"
              step="0.1"
              value={sliderRatio}
              onChange={(e) => setSliderRatio(parseFloat(e.target.value))}
              className="w-full"
            />
            <div className="text-right text-sm text-slate-400 mt-2">
              調整率: {(sliderRatio * 100).toFixed(0)}%
            </div>
          </div>

          {/* Scenario 1: Husband Death */}
          <section>
            <h2 className="text-xl font-bold text-rose-400 mb-4">夫が亡くなった場合 (妻: {ageWife}歳)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <PensionCup
                label="月額収支 (初年度)"
                workIncome={scenarioHusbandDeath.cupData.workIncome}
                pensionAmount={scenarioHusbandDeath.cupData.pensionAmount}
                assetAmount={scenarioHusbandDeath.cupData.assetAmount}
                totalRequired={scenarioHusbandDeath.cupData.totalRequired}
              />
              <div className="md:col-span-2 h-64 bg-slate-900/40 rounded-2xl border border-slate-800 p-4">
                <CashFlowTimeline data={scenarioHusbandDeath.timelineData} height={200} />
              </div>
            </div>
            <div className="mt-4 text-center text-rose-400 font-bold text-xl">
              必要保障額: {(scenarioHusbandDeath.totalShortfall / 10000).toFixed(0)}万円
            </div>
          </section>

          {/* Scenario 2: Husband Disability */}
          <section>
            <h2 className="text-xl font-bold text-orange-400 mb-4">夫が障害状態になった場合</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <PensionCup
                label="月額収支 (初年度)"
                workIncome={scenarioHusbandDisability.cupData.workIncome}
                pensionAmount={scenarioHusbandDisability.cupData.pensionAmount}
                assetAmount={scenarioHusbandDisability.cupData.assetAmount}
                totalRequired={scenarioHusbandDisability.cupData.totalRequired}
              />
              <div className="md:col-span-2 h-64 bg-slate-900/40 rounded-2xl border border-slate-800 p-4">
                <CashFlowTimeline data={scenarioHusbandDisability.timelineData} height={200} />
              </div>
            </div>
            <div className="mt-4 text-center text-orange-400 font-bold text-xl">
              必要保障額: {(scenarioHusbandDisability.totalShortfall / 10000).toFixed(0)}万円
            </div>
          </section>

          {/* Scenario 3: Wife Death */}
          <section>
            <h2 className="text-xl font-bold text-sky-400 mb-4">妻が亡くなった場合 (夫: {ageHusband}歳)</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <PensionCup
                label="月額収支 (初年度)"
                workIncome={scenarioWifeDeath.cupData.workIncome}
                pensionAmount={scenarioWifeDeath.cupData.pensionAmount}
                assetAmount={scenarioWifeDeath.cupData.assetAmount}
                totalRequired={scenarioWifeDeath.cupData.totalRequired}
              />
              <div className="md:col-span-2 h-64 bg-slate-900/40 rounded-2xl border border-slate-800 p-4">
                <CashFlowTimeline data={scenarioWifeDeath.timelineData} height={200} />
              </div>
            </div>
            <div className="mt-4 text-center text-sky-400 font-bold text-xl">
              必要保障額: {(scenarioWifeDeath.totalShortfall / 10000).toFixed(0)}万円
            </div>
          </section>

          {/* Scenario 4: Wife Disability */}
          <section>
            <h2 className="text-xl font-bold text-emerald-400 mb-4">妻が障害状態になった場合</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <PensionCup
                label="月額収支 (初年度)"
                workIncome={scenarioWifeDisability.cupData.workIncome}
                pensionAmount={scenarioWifeDisability.cupData.pensionAmount}
                assetAmount={scenarioWifeDisability.cupData.assetAmount}
                totalRequired={scenarioWifeDisability.cupData.totalRequired}
              />
              <div className="md:col-span-2 h-64 bg-slate-900/40 rounded-2xl border border-slate-800 p-4">
                <CashFlowTimeline data={scenarioWifeDisability.timelineData} height={200} />
              </div>
            </div>
            <div className="mt-4 text-center text-emerald-400 font-bold text-xl">
              必要保障額: {(scenarioWifeDisability.totalShortfall / 10000).toFixed(0)}万円
            </div>
          </section>

        </div>
      </div>
    </main>
  );
}
