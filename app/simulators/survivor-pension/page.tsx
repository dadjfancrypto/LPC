'use client';

import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
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
  calculateOldAgeBasicPension,
  calculateOldAgeEmployeePension,
  PolicyMode,
  POLICY_MODES,
} from '../../utils/pension-calc';

type Segment = {
  label: string;
  years: number;
  widthYears?: number;
  className: string;
  amountYear?: number;
};

type Tick = {
  edgeIndex?: number;
  posYears?: number;
  posPx?: number;
  labelLines: string[];
};

type Geometry = {
  used: number;
  edgesRaw: number[];
  totalYears: number;
  rawW: number[];
};

const BAR_HEIGHT = 150;
const MIN_SEG_PX = 120;

function CalculationLogic({ 
  details, 
  color 
}: { 
  details: { label: string; value: string }[]; 
  color: 'emerald' | 'sky'
}) {
  const [showCalc, setShowCalc] = useState(false);
  
  const colorMap = {
    emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-900/10' },
    sky: { border: 'border-sky-500/30', bg: 'bg-sky-900/10' },
  };
  const styles = colorMap[color];
  const borderColor = styles.border;
  const bgColor = styles.bg;
  
  return (
    <div className={`mt-0 rounded-b-xl rounded-t-none border border-t-0 ${borderColor} ${bgColor} p-4`}>
      <button
        onClick={() => setShowCalc(!showCalc)}
        className="text-sm text-slate-400 hover:text-slate-200 transition-colors flex items-center gap-2 w-full font-bold"
      >
        <span>{showCalc ? '▼' : '▶'}</span>
        <span>計算ロジック</span>
      </button>
      {showCalc && (
        <div className="mt-3 space-y-4 text-sm">
          {details.map((detail, idx) => {
            const isFormula = detail.label.startsWith('　');
            const labelText = detail.label.replace(/^　+/, '');
            
            // バッジの色を決定
            let badgeClass = '';
            let badgeText = '';
            if (labelText.includes('基礎年金')) {
              badgeClass = 'bg-blue-900/50 text-blue-200 border border-blue-700/50';
              badgeText = '基礎年金';
            } else if (labelText.includes('厚生年金')) {
              badgeClass = 'bg-green-900/50 text-green-200 border border-green-700/50';
              badgeText = '厚生年金';
            } else if (labelText.includes('加算')) {
              badgeClass = 'bg-gray-700/50 text-gray-300 border border-gray-600/50';
              badgeText = '加算';
            }
            
            if (isFormula) {
              // 数式の表示
              return (
                <div key={idx} className="pl-6 py-2 bg-black/30 rounded border border-slate-700/50">
                  <div className="font-mono text-xs text-slate-300">
                    <span className="text-slate-500">計算式:</span> {labelText}
                  </div>
                  <div className="font-mono text-xs text-emerald-400 mt-1">
                    = {detail.value}
                  </div>
                </div>
              );
            } else {
              // 通常の項目表示
              return (
                <div key={idx} className="flex items-start justify-between gap-4">
                  <div className="flex items-center gap-2 flex-1">
                    {badgeText && (
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${badgeClass}`}>
                        {badgeText}
                      </span>
                    )}
                    <span className="text-slate-300">{labelText}</span>
                  </div>
                  <span className="text-slate-100 font-semibold text-right">{detail.value}</span>
                </div>
              );
            }
          })}
        </div>
      )}
    </div>
  );
}

function calculateOldAgePensionAdjustment(baseAmount: number, claimAge: number): number {
  if (claimAge === 65) return baseAmount;

  if (claimAge < 65) {
    const monthsEarly = (65 - claimAge) * 12;
    const reductionRate = monthsEarly * 0.004;
    return baseAmount * (1 - reductionRate);
  } else {
    const monthsLate = (claimAge - 65) * 12;
    const increaseRate = monthsLate * 0.007;
    return baseAmount * (1 + increaseRate);
  }
}

function AutoFitLine({
  text,
  className = '',
  maxRem = 1.0,
  minScale = 0.5,
  align = 'center',
}: {
  text: string;
  className?: string;
  maxRem?: number;
  minScale?: number;
  align?: 'left' | 'center' | 'right';
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const parent = el.parentElement;
    if (!parent) return;

    el.style.transform = 'none';
    el.style.width = 'auto';
    el.style.whiteSpace = 'nowrap';

    const pW = parent.clientWidth;
    const cW = el.scrollWidth;

    if (cW > pW && cW > 0) {
      const s = Math.max(minScale, pW / cW);
      setScale(s);
    } else {
      setScale(1);
    }
  }, [text, minScale]);

  const origin = align === 'left' ? 'left center' : align === 'right' ? 'right center' : 'center center';

  return (
    <div
      ref={ref}
      className={`origin-left whitespace-nowrap leading-none ${className}`}
      style={{
        fontSize: `${maxRem}rem`,
        transform: `scale(${scale})`,
        transformOrigin: origin,
        width: scale < 1 ? '100%' : 'auto',
      }}
    >
      {text}
    </div>
  );
}

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

function useSharedGeometry(measureRef: React.RefObject<HTMLDivElement | null>, segments: Segment[]): Geometry {
  const [innerW, setInnerW] = useState(0);
  useLayoutEffect(() => {
    const resize = () => setInnerW(measureRef.current?.clientWidth ?? 0);
    resize();
    const ro = new ResizeObserver(resize);
    if (measureRef.current) ro.observe(measureRef.current);
    return () => ro.disconnect();
  }, [measureRef]);

  return useMemo(() => {
    const barW = innerW;
    const widthYearsArr = segments.map((s) => Math.max(0, s.widthYears ?? s.years));
    const totalYearsRaw = widthYearsArr.reduce((s, x) => s + x, 0);
    const totalYears = Math.max(1e-6, totalYearsRaw);

    const ideal = widthYearsArr.map((y) => (y / totalYears) * barW);
    const smallFlags = ideal.map((w, i) => widthYearsArr[i] > 0 && w < MIN_SEG_PX);
    const minTotal = smallFlags.reduce((sum, f) => sum + (f ? MIN_SEG_PX : 0), 0);
    const largeIdeal = ideal.map((w, i) => (smallFlags[i] ? 0 : w));
    const largeIdealSum = largeIdeal.reduce((a, b) => a + b, 0);
    const remain = Math.max(0, barW - minTotal);

    const floatW = segments.map((_, i) => {
      if (widthYearsArr[i] <= 0) return 0;
      return smallFlags[i] ? MIN_SEG_PX : largeIdealSum > 0 ? (largeIdeal[i] / largeIdealSum) * remain : 0;
    });

    const quantW = floatW.map((w) => Math.floor(w));
    let usedFloor = quantW.reduce((a, b) => a + b, 0);
    let delta = barW - usedFloor;
    if (delta !== 0) {
      const idx = quantW
        .map((w, i) => ({ w, i }))
        .filter((x) => x.w > 0)
        .slice(-1)[0]?.i;
      if (idx !== undefined) {
        quantW[idx] += delta;
        usedFloor += delta;
      }
    }
    for (let i = 0; i < quantW.length; i++) {
      if (quantW[i] > 0 && quantW[i] <= 1) {
        const giveTo = i < quantW.length - 1 ? i + 1 : i - 1;
        if (giveTo >= 0) {
          quantW[giveTo] += quantW[i];
          quantW[i] = 0;
        }
      }
    }

    const used = quantW.reduce((a, b) => a + b, 0);
    const edgesRaw: number[] = [];
    let acc = 0;
    for (let i = 0; i < quantW.length; i++) {
      acc += quantW[i];
      edgesRaw.push(acc);
    }
    return { used, edgesRaw, totalYears, rawW: quantW };
  }, [segments, innerW]);
}

function PensionSegmentsBar({ segments, geometry }: { segments: Segment[]; geometry: Geometry }) {
  return (
    <div className="relative" style={{ width: geometry.used, height: BAR_HEIGHT }}>
      <div
        className="relative flex overflow-visible rounded-2xl border border-white/15"
        style={{ width: geometry.used, height: BAR_HEIGHT }}
      >
        {segments.map((s, i) => {
          const w = geometry.rawW[i];
          if (w <= 1) return null;
          const showText = w >= MIN_SEG_PX;
          const amountText = s.amountYear !== undefined ? `${(s.amountYear / 10000).toFixed(0)}万円` : '';
          const monthlyText = s.amountYear !== undefined ? `月${(s.amountYear / 120000).toFixed(1)}万` : '';
          const titleText = `${s.label} ${s.years}年`;
          return (
            <div
              key={i}
              className={`${s.className} ring-1 ring-white/15 relative flex flex-col justify-center items-stretch px-3 overflow-hidden`}
              style={{ width: w }}
              title={titleText}
            >
              {showText && (
                <>
                  {monthlyText && (
                    <AutoFitLine text={monthlyText} maxRem={1.5} minScale={0.6} className="text-white font-bold" align="left" />
                  )}
                  <AutoFitLine text={amountText} maxRem={1.1} minScale={0.6} className="text-white/80 mt-1" align="left" />
                  <AutoFitLine
                    text={titleText}
                    maxRem={1.0}
                    minScale={0.5}
                    className="text-white/70 mt-1"
                    align="left"
                  />
                </>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function AgeTicksBar({ ticks, geometry }: { ticks: Tick[]; geometry: Geometry }) {
  return (
    <div className="relative h-32" style={{ width: geometry.used }}>
      <div className="absolute left-0 right-0 top-5 h-[2px] bg-white/25 rounded" />
      {ticks.map((t, i) => {
        const leftPx =
          t.posPx !== undefined ? t.posPx : Math.round(((t.posYears || 0) / geometry.totalYears) * geometry.used);
        return (
          <div key={i} className="absolute -translate-x-1/2" style={{ left: `${leftPx}px` }}>
            <div className="h-6 w-px bg-white/70 mx-auto" />
            <div className="mt-1 text-xs md:text-sm opacity-90 text-center leading-[1.2]">
              {t.labelLines.map((ln, j) => (
                <div key={j} className="whitespace-nowrap">
                  {ln}
                </div>
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
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
            title="Clear"
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

function TimelineBlock({
  title,
  color,
  segments,
  ticks,
  blockNumber,
  hasLogic = false,
}: {
  title: string;
  color: 'emerald' | 'sky';
  segments: Segment[];
  ticks: Tick[];
  blockNumber?: 1 | 2;
  hasLogic?: boolean;
}) {
  
  // ①は緑系、②は青系に統一
  let border = '';
  let bg = '';
  if (blockNumber === 1) {
    border = 'border-emerald-500/40';
    bg = 'bg-emerald-900/20';
  } else if (blockNumber === 2) {
    border = 'border-sky-500/40';
    bg = 'bg-sky-900/20';
  } else {
    border = color === 'emerald' ? 'border-emerald-500/40' : 'border-sky-500/40';
    bg = color === 'emerald' ? 'bg-emerald-900/20' : 'bg-sky-900/20';
  }
  const measureRef = useRef<HTMLDivElement>(null);
  const geometry = useSharedGeometry(measureRef, segments);

  const ticksResolved: Tick[] = useMemo(() => {
    const edgesPx = [0, ...geometry.edgesRaw];
    return ticks.map((t) => {
      if (t.edgeIndex !== undefined) {
        const idx = Math.max(0, Math.min(edgesPx.length - 1, t.edgeIndex));
        return { ...t, posPx: edgesPx[idx] };
      }
      return t;
    });
  }, [ticks, geometry.edgesRaw]);

  const roundedClass = hasLogic ? 'rounded-t-2xl rounded-b-none border-b-0' : 'rounded-2xl';
  const mbClass = hasLogic ? 'mb-0' : 'mb-8';

  return (
    <div className={`${roundedClass} ${border} ${bg} p-8 md:p-10 ${mbClass}`}>
      <div className="text-base font-semibold mb-3">{title}</div>
      <div ref={measureRef} className="w-full h-0 overflow-hidden" />
      <PensionSegmentsBar segments={segments} geometry={geometry} />
      <AgeTicksBar ticks={ticksResolved} geometry={geometry} />
    </div>
  );
}

function PeriodCard({ title, amount, period, colorClass, icon, pensionTypes }: { 
  title: string; 
  amount: number; 
  period: string; 
  colorClass: string; 
  icon: string;
  pensionTypes?: string[];
}) {
  return (
    <div className={`p-8 rounded-2xl border-2 ${colorClass} bg-slate-900/40 backdrop-blur-sm`}>
      <div className="flex items-center gap-3 mb-4">
        <span className="text-3xl">{icon}</span>
        <div className="text-lg font-bold text-slate-300">{title}</div>
      </div>
      <div className="text-4xl font-bold text-slate-100 mb-3">
        {amount > 0 ? `月額 ${(amount / 12 / 10000).toFixed(1)}万円` : '---'}
      </div>
      {amount > 0 && (
        <div className="text-xl font-normal text-slate-400 mb-4">
          年額 {(amount / 10000).toFixed(0)}万円
        </div>
      )}
      {pensionTypes && pensionTypes.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {pensionTypes.map((type, idx) => (
            <span key={idx} className="px-3 py-1.5 rounded-lg text-sm font-semibold bg-slate-700/50 text-slate-300 border border-slate-600/50">
              {type}
            </span>
          ))}
        </div>
      )}
      <div className="text-base text-slate-500">{period}</div>
    </div>
  );
}

export default function SurvivorPensionPage() {
  const [mode, setMode] = useState<PolicyMode>('current');
  const [showWifeSection, setShowWifeSection] = useState(true);
  const [showHusbandSection, setShowHusbandSection] = useState(true);
  const [spouseType, setSpouseType] = useState<'couple' | 'single'>('couple');

  const [childrenCount, setChildrenCount] = useState<number | null>(null);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);

  const [ageWife, setAgeWife] = useState<number>(35);
  const [avgStdMonthlyWife, setAvgStdMonthlyWife] = useState<number>(300000);
  const [monthsWife, setMonthsWife] = useState<number>(120);
  const [useMinashi300Wife, setUseMinashi300Wife] = useState<boolean>(true);
  const [oldAgeStartWife, setOldAgeStartWife] = useState<number>(65);

  const [ageHusband, setAgeHusband] = useState<number>(38);
  const [avgStdMonthlyHusband, setAvgStdMonthlyHusband] = useState<number>(450000);
  const [monthsHusband, setMonthsHusband] = useState<number>(180);
  const [useMinashi300Husband, setUseMinashi300Husband] = useState<boolean>(true);
  const [oldAgeStartHusband, setOldAgeStartHusband] = useState<number>(65);

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

  const caseHusbandDeath = useMemo(() => {
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges);
    const basicPension = calculateSurvivorBasicPension(eligibleChildren);
    const survivorEmployeePension = calculateSurvivorEmployeePension(
      avgStdMonthlyHusband,
      monthsHusband,
      useMinashi300Husband
    );

    const youngestChildAge = childrenAges.length > 0 ? Math.min(...childrenAges) : null;
    const yearsUntilChild18 = youngestChildAge !== null ? Math.max(0, 18 - youngestChildAge) : 0;
    const ageAfterChild = ageWife + yearsUntilChild18;

    // 最適な老齢年金開始年齢を計算
    const wifeOwnBasic = calculateOldAgeBasicPension();
    const wifeOwnEmployee = calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife);
    
    // 最適化ロジック削除: ユーザー設定値をそのまま使用
    const effectiveOldAgeStartWife = oldAgeStartWife;

    const withChildrenAmount = basicPension + survivorEmployeePension;
    
    // 改正モード（2028年見直し）の場合
    let afterChildrenAmount = 0;
    let pensionTypesAfterChildren: string[] = [];
    
    if (mode === 'revised2028') {
      // 中高齢寡婦加算は廃止（0円）
      // 子がいなくなった後は原則5年間のみ遺族厚生年金
      const yearsAfterChild = effectiveOldAgeStartWife - ageAfterChild;
      if (yearsAfterChild > 0) {
        // 5年間は遺族厚生年金を支給（簡易実装：所得要件は考慮しない）
        afterChildrenAmount = survivorEmployeePension;
        pensionTypesAfterChildren = ['遺族厚生年金（5年間）'];
      } else {
        afterChildrenAmount = 0;
      }
    } else {
      // 現行制度
      const chukoreiKasanAfter = (ageAfterChild >= 40 && ageAfterChild < 65) ? calculateChukoreiKasan() : 0;
      afterChildrenAmount = survivorEmployeePension + chukoreiKasanAfter;
      pensionTypesAfterChildren = ['遺族厚生年金'];
      if (chukoreiKasanAfter > 0) {
        pensionTypesAfterChildren.push('中高齢寡婦加算');
      }
    }

    // 妻自身の老齢年金（簡易計算）
    const adjustedOwnBasic = calculateOldAgePensionAdjustment(wifeOwnBasic, effectiveOldAgeStartWife);
    const adjustedOwnEmployee = calculateOldAgePensionAdjustment(wifeOwnEmployee, effectiveOldAgeStartWife);
    
    const maxEmployeePart = Math.max(survivorEmployeePension, adjustedOwnEmployee);
    const oldAgeAmount = adjustedOwnBasic + maxEmployeePart;

    return {
      basicPension,
      employeePension: survivorEmployeePension,
      total: basicPension + survivorEmployeePension,
      withChildrenAmount,
      afterChildrenAmount,
      oldAgeAmount,
      yearsUntilChild18,
      ageAfterChild,
      pensionTypesWithChildren: ['遺族基礎年金', '遺族厚生年金'],
      pensionTypesAfterChildren,
      pensionTypesOldAge: ['老齢基礎年金', '老齢厚生年金', '遺族厚生年金（差額）'],
    };
  }, [mode, childrenAges, avgStdMonthlyHusband, monthsHusband, useMinashi300Husband, ageWife, oldAgeStartWife, avgStdMonthlyWife, monthsWife]);

  const caseWifeDeath = useMemo(() => {
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges);
    const basicPension = calculateSurvivorBasicPension(eligibleChildren);
    const survivorEmployeePension = calculateSurvivorEmployeePension(
      avgStdMonthlyWife,
      monthsWife,
      useMinashi300Wife
    );

    const youngestChildAge = childrenAges.length > 0 ? Math.min(...childrenAges) : null;
    const yearsUntilChild18 = youngestChildAge !== null ? Math.max(0, 18 - youngestChildAge) : 0;
    const ageAfterChild = ageHusband + yearsUntilChild18;

    // 最適な老齢年金開始年齢を計算
    const husbandOwnBasicCalc = calculateOldAgeBasicPension();
    const husbandOwnEmployeeCalc = calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband);
    
    // 最適化ロジック削除: ユーザー設定値をそのまま使用
    const effectiveOldAgeStartHusband = oldAgeStartHusband;

    const withChildrenAmount = basicPension + survivorEmployeePension;
    
    // 改正モード（2028年見直し）の場合
    let afterChildrenAmount = 0;
    let pensionTypesAfterChildren: string[] = [];
    
    if (mode === 'revised2028') {
      // 夫は中高齢寡婦加算なし（元々女性のみの制度）
      // 子がいなくなった後は原則5年間のみ遺族厚生年金
      const yearsAfterChild = effectiveOldAgeStartHusband - ageAfterChild;
      if (yearsAfterChild > 0) {
        // 5年間は遺族厚生年金を支給（簡易実装：所得要件は考慮しない）
        afterChildrenAmount = survivorEmployeePension;
        pensionTypesAfterChildren = ['遺族厚生年金（5年間）'];
      } else {
        afterChildrenAmount = 0;
      }
    } else {
      // 現行制度：夫は60歳から遺族厚生年金（55〜59歳は停止）
      // 簡易実装：子がいなくなった後は遺族厚生年金を支給
      afterChildrenAmount = survivorEmployeePension;
      pensionTypesAfterChildren = ['遺族厚生年金（60歳〜）'];
    }
    
    // 夫自身の老齢年金（簡易計算）
    const adjustedOwnBasic = calculateOldAgePensionAdjustment(husbandOwnBasicCalc, effectiveOldAgeStartHusband);
    const adjustedOwnEmployee = calculateOldAgePensionAdjustment(husbandOwnEmployeeCalc, effectiveOldAgeStartHusband);
    
    const maxEmployeePart = Math.max(survivorEmployeePension, adjustedOwnEmployee);
    const oldAgeAmount = adjustedOwnBasic + maxEmployeePart;

    return {
      basicPension,
      employeePension: survivorEmployeePension,
      total: basicPension + survivorEmployeePension,
      withChildrenAmount,
      afterChildrenAmount,
      oldAgeAmount,
      yearsUntilChild18,
      ageAfterChild,
      pensionTypesWithChildren: ['遺族基礎年金', '遺族厚生年金'],
      pensionTypesAfterChildren,
      pensionTypesOldAge: ['老齢基礎年金', '老齢厚生年金', '遺族厚生年金（差額）'],
    };
  }, [mode, childrenAges, avgStdMonthlyWife, monthsWife, useMinashi300Wife, ageHusband, oldAgeStartHusband, avgStdMonthlyHusband, monthsHusband]);

  const timelineDataHusband = useMemo(() => {
    const block1 = { segments: [] as Segment[], ticks: [] as Tick[] };
    const block2 = { segments: [] as Segment[], ticks: [] as Tick[] };
    const widen = (y: number) => Math.max(y, 5);

    // Block 1: 子がいる期間（子の年齢による変動を反映）
    const yearsTo18List = childrenAges
      .map(age => Math.max(0, 18 - age))
      .filter(y => y > 0)
      .sort((a, b) => a - b);
    
    // 老齢年金開始年齢がこの期間に含まれる場合、その時点でも区切る
    const yearsToOldAge = Math.max(0, oldAgeStartWife - ageWife);
    const pointsArr = [0, ...yearsTo18List];
    
    // 老齢年金開始が「現在」より後で、「子がいなくなる」より前の場合のみ追加
    const maxYears = pointsArr[pointsArr.length - 1] || 0;
    if (yearsToOldAge > 0 && (!maxYears || yearsToOldAge < maxYears)) {
      pointsArr.push(yearsToOldAge);
    }

    const points = Array.from(new Set(pointsArr)).sort((a, b) => a - b);
    const maxYearsWithChild = points[points.length - 1] || 0;

      if (maxYearsWithChild > 0) {
        const initialLines = [`妻${ageWife}`];
        childrenAges.forEach((age) => {
          if (age <= 18) {
            initialLines.push(`子${age}`);
          }
        });
        block1.ticks.push({
          edgeIndex: 0,
          labelLines: initialLines
        });

      for (let i = 0; i < points.length - 1; i++) {
        const startY = points[i];
        const endY = points[i+1];
        const duration = endY - startY;

        // その期間の支給額計算
        const agesAtStart = childrenAges.map(a => a + startY);
        const eligibleCount = calculateEligibleChildrenCount(agesAtStart);
        const basicPension = calculateSurvivorBasicPension(eligibleCount);
        const amount = basicPension + caseHusbandDeath.employeePension;

        // セクションごとに色を変える（緑系のグラデーション）
        const greenColors = ['bg-emerald-600/80', 'bg-emerald-500/80', 'bg-emerald-400/80'];
        const colorClass = greenColors[i % greenColors.length];

        block1.segments.push({
          label: `子${eligibleCount}人`,
          years: duration,
          widthYears: widen(duration),
          className: `${colorClass} ring-1 ring-white/20`,
          amountYear: amount
        });

        // Ticks for Block 1
        const lines = [`妻${ageWife + endY}`];
        
        // 老齢年金開始のタイミングならラベルを追加
        if (ageWife + endY === oldAgeStartWife) {
          lines.push('老齢開始');
        }

        childrenAges.forEach((age, idx) => {
           const currentAge = age + endY;
           if (currentAge <= 18) {
             lines.push(`子${currentAge}`);
           }
        });
        block1.ticks.push({
          edgeIndex: i + 1,
          labelLines: lines
        });
      }
    }

    // Block 2: 子がいなくなった後
    const ageAfterChild = ageWife + maxYearsWithChild;
    const startAge = Math.min(ageAfterChild, oldAgeStartWife);
    const endAge = 100;
    const totalDuration = endAge - startAge;
    
    const chukoreiEndAge = oldAgeStartWife; 
    const period1Duration = Math.max(0, chukoreiEndAge - startAge);
    
    let segmentCount = 0;

    if (period1Duration > 0) {
      const isChukorei = startAge >= 40 && startAge < 65;
      block2.segments.push({
        label: isChukorei ? '寡婦加算' : '遺族厚生',
        years: period1Duration,
        widthYears: widen(period1Duration),
        className: 'bg-blue-500/80 ring-1 ring-white/20',
        amountYear: caseHusbandDeath.afterChildrenAmount
      });
      segmentCount++;
    }

    const period2Duration = endAge - oldAgeStartWife;
    if (period2Duration > 0) {
      block2.segments.push({
        label: '老齢年金',
        years: period2Duration,
        widthYears: widen(period2Duration),
        className: 'bg-blue-500/80 ring-1 ring-white/20',
        amountYear: caseHusbandDeath.oldAgeAmount
      });
      segmentCount++;
    }

    block2.ticks.push({
      edgeIndex: 0,
      labelLines: [`妻${startAge}`, startAge === ageWife ? '現在' : '']
    });

    if (period1Duration > 0) {
      block2.ticks.push({
        edgeIndex: 1,
        labelLines: [`妻${oldAgeStartWife}`, '老齢開始']
      });
    }

    block2.ticks.push({
      edgeIndex: segmentCount,
      labelLines: [`妻${endAge}`]
    });

    return { block1: maxYearsWithChild > 0 ? block1 : null, block2 };
  }, [ageWife, childrenAges, caseHusbandDeath, oldAgeStartWife]);

  const timelineDataWife = useMemo(() => {
    const block1 = { segments: [] as Segment[], ticks: [] as Tick[] };
    const block2 = { segments: [] as Segment[], ticks: [] as Tick[] };
    const widen = (y: number) => Math.max(y, 5);

    // Block 1: 子がいる期間
    const yearsTo18List = childrenAges
      .map(age => Math.max(0, 18 - age))
      .filter(y => y > 0)
      .sort((a, b) => a - b);
    
    // 老齢年金開始年齢がこの期間に含まれる場合、その時点でも区切る
    const yearsToOldAge = Math.max(0, oldAgeStartHusband - ageHusband);
    const pointsArr = [0, ...yearsTo18List];
    
    // 老齢年金開始が「現在」より後で、「子がいなくなる」より前の場合のみ追加
    const maxYears = pointsArr[pointsArr.length - 1] || 0;
    if (yearsToOldAge > 0 && (!maxYears || yearsToOldAge < maxYears)) {
      pointsArr.push(yearsToOldAge);
    }

    const points = Array.from(new Set(pointsArr)).sort((a, b) => a - b);
    const maxYearsWithChild = points[points.length - 1] || 0;

      if (maxYearsWithChild > 0) {
        const initialLines = [`夫${ageHusband}`];
        childrenAges.forEach((age) => {
          if (age <= 18) {
            initialLines.push(`子${age}`);
          }
        });
        block1.ticks.push({
          edgeIndex: 0,
          labelLines: initialLines
        });

      for (let i = 0; i < points.length - 1; i++) {
        const startY = points[i];
        const endY = points[i+1];
        const duration = endY - startY;

        const agesAtStart = childrenAges.map(a => a + startY);
        const eligibleCount = calculateEligibleChildrenCount(agesAtStart);
        const basicPension = calculateSurvivorBasicPension(eligibleCount);
        const amount = basicPension + caseWifeDeath.employeePension;

        // セクションごとに色を変える（緑系のグラデーション）
        const greenColors = ['bg-emerald-600/80', 'bg-emerald-500/80', 'bg-emerald-400/80'];
        const colorClass = greenColors[i % greenColors.length];

        block1.segments.push({
          label: `子${eligibleCount}人`,
          years: duration,
          widthYears: widen(duration),
          className: `${colorClass} ring-1 ring-white/20`,
          amountYear: amount
        });

        // Ticks for Block 1
        const lines = [`夫${ageHusband + endY}`];
        
        // 老齢年金開始のタイミングならラベルを追加
        if (ageHusband + endY === oldAgeStartHusband) {
          lines.push('老齢開始');
        }

        childrenAges.forEach((age, idx) => {
           const currentAge = age + endY;
           if (currentAge <= 18) {
             lines.push(`子${currentAge}`);
           }
        });
        block1.ticks.push({
          edgeIndex: i + 1,
          labelLines: lines
        });
      }
    }

    // Block 2
    const ageAfterChild = ageHusband + maxYearsWithChild;
    const startAge = Math.min(ageAfterChild, oldAgeStartHusband);
    const endAge = 100;
    const totalDuration = endAge - startAge;

    const period1Duration = Math.max(0, oldAgeStartHusband - startAge);
    let segmentCount = 0;

    if (period1Duration > 0) {
      block2.segments.push({
        label: '遺族厚生',
        years: period1Duration,
        widthYears: widen(period1Duration),
        className: 'bg-blue-500/80 ring-1 ring-white/20',
        amountYear: caseWifeDeath.afterChildrenAmount
      });
      segmentCount++;
    }

    const period2Duration = endAge - oldAgeStartHusband;
    if (period2Duration > 0) {
      block2.segments.push({
        label: '老齢年金',
        years: period2Duration,
        widthYears: widen(period2Duration),
        className: 'bg-blue-500/80 ring-1 ring-white/20',
        amountYear: caseWifeDeath.oldAgeAmount
      });
      segmentCount++;
    }

    block2.ticks.push({
      edgeIndex: 0,
      labelLines: [`夫${startAge}`, startAge === ageHusband ? '現在' : '']
    });

    if (period1Duration > 0) {
      block2.ticks.push({
        edgeIndex: 1,
        labelLines: [`夫${oldAgeStartHusband}`, '老齢開始']
      });
    }

    block2.ticks.push({
      edgeIndex: segmentCount,
      labelLines: [`夫${endAge}`]
    });

    return { block1: maxYearsWithChild > 0 ? block1 : null, block2 };
  }, [ageHusband, childrenAges, caseWifeDeath, oldAgeStartHusband]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 pb-20">
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
                              <Label>平均標準報酬月額 (万円)</Label>
                              <div className="relative">
                                <Select
                                  value={avgStdMonthlyWife / 10000}
                                  onChange={(e) => setAvgStdMonthlyWife(Number(e.target.value) * 10000)}
                                  options={Array.from({ length: 96 }, (_, i) => ({ value: 5 + i, label: `${5 + i}万円` }))}
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
                              <Label>平均標準報酬月額 (万円)</Label>
                              <div className="relative">
                                <Select
                                  value={avgStdMonthlyHusband / 10000}
                                  onChange={(e) => setAvgStdMonthlyHusband(Number(e.target.value) * 10000)}
                                  options={Array.from({ length: 96 }, (_, i) => ({ value: 5 + i, label: `${5 + i}万円` }))}
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

          <section>
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                <span className="text-2xl">👩</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-100">妻の受給額</h2>
                <p className="text-sm text-slate-400 mt-0.5">夫が死亡した場合</p>
              </div>
            </div>


            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <PeriodCard
                  title="子がいる期間"
                  amount={caseHusbandDeath.withChildrenAmount}
                  period={`${ageWife}歳 - ${caseHusbandDeath.ageAfterChild}歳`}
                  colorClass="border-emerald-500/30"
                  icon="👶"
                  pensionTypes={caseHusbandDeath.pensionTypesWithChildren}
                />
                <PeriodCard
                  title="子がいなくなった後"
                  amount={caseHusbandDeath.afterChildrenAmount}
                  period={`${caseHusbandDeath.ageAfterChild}歳 - ${oldAgeStartWife}歳`}
                  colorClass="border-sky-500/30"
                  icon="💼"
                  pensionTypes={caseHusbandDeath.pensionTypesAfterChildren}
                />
                <PeriodCard
                  title="年金開始後"
                  amount={caseHusbandDeath.oldAgeAmount}
                  period={`${oldAgeStartWife}歳 - 100歳`}
                  colorClass="border-sky-500/30"
                  icon="🎂"
                  pensionTypes={caseHusbandDeath.pensionTypesOldAge}
                />
            </div>

            {timelineDataHusband.block1 && (
              <>
                <TimelineBlock
                  title="👶 ① 子がいる期間（遺族基礎年金支給）"
                  color="emerald"
                  segments={timelineDataHusband.block1.segments}
                  ticks={timelineDataHusband.block1.ticks}
                  blockNumber={1}
                  hasLogic={true}
                />
                <CalculationLogic
                  color="emerald"
                  details={[
                    { label: '遺族基礎年金（基本額）', value: '83.2万円' },
                    { label: '子の加算（第1子・第2子）', value: '各23.9万円' },
                    { label: '子の加算（第3子以降）', value: '各8.0万円' },
                    { label: '遺族厚生年金（年額）', value: `${(caseHusbandDeath.employeePension / 10000).toFixed(1)}万円` },
                    { label: '　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000 × 3/4', value: `${(avgStdMonthlyHusband / 10000).toFixed(1)}万 × ${useMinashi300Husband ? Math.max(monthsHusband, 300) : monthsHusband}月 × 5.481/1000 × 3/4 = ${(caseHusbandDeath.employeePension / 10000).toFixed(1)}万円` },
                  ]}
                />
              </>
            )}

            <div className="mt-8">
              <TimelineBlock
                title="💼 ② 子がいなくなった後 〜 老後"
                color="sky"
                segments={timelineDataHusband.block2.segments}
                ticks={timelineDataHusband.block2.ticks}
                blockNumber={2}
                hasLogic={true}
              />
            </div>
            <CalculationLogic
              color="sky"
              details={[
                { label: '遺族厚生年金（年額）', value: `${(caseHusbandDeath.employeePension / 10000).toFixed(1)}万円` },
                { label: '　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000 × 3/4', value: `${(avgStdMonthlyHusband / 10000).toFixed(1)}万 × ${useMinashi300Husband ? Math.max(monthsHusband, 300) : monthsHusband}月 × 5.481/1000 × 3/4 = ${(caseHusbandDeath.employeePension / 10000).toFixed(1)}万円` },
                { label: '中高齢寡婦加算（該当時）', value: '62.4万円' },
                { label: `妻の老齢基礎年金（${oldAgeStartWife}歳〜）`, value: `${(calculateOldAgePensionAdjustment(calculateOldAgeBasicPension(), oldAgeStartWife) / 10000).toFixed(1)}万円` },
                ...(oldAgeStartWife !== 65 ? [{ 
                  label: '　繰り上げ・繰り下げ調整', 
                  value: oldAgeStartWife < 65 
                    ? `83.2万円 × (1 - ${((65 - oldAgeStartWife) * 12 * 0.4).toFixed(1)}%) = ${(calculateOldAgePensionAdjustment(calculateOldAgeBasicPension(), oldAgeStartWife) / 10000).toFixed(1)}万円`
                    : `83.2万円 × (1 + ${((oldAgeStartWife - 65) * 12 * 0.7).toFixed(1)}%) = ${(calculateOldAgePensionAdjustment(calculateOldAgeBasicPension(), oldAgeStartWife) / 10000).toFixed(1)}万円`
                }] : []),
                { label: `妻の老齢厚生年金（${oldAgeStartWife}歳〜）`, value: `${(calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife), oldAgeStartWife) / 10000).toFixed(1)}万円` },
                { label: '　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000', value: `${(avgStdMonthlyWife / 10000).toFixed(1)}万 × ${monthsWife}月 × 5.481/1000 = ${(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife) / 10000).toFixed(1)}万円` },
                ...(oldAgeStartWife !== 65 ? [{ 
                  label: '　繰り上げ・繰り下げ調整', 
                  value: oldAgeStartWife < 65 
                    ? `${(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife) / 10000).toFixed(1)}万円 × (1 - ${((65 - oldAgeStartWife) * 12 * 0.4).toFixed(1)}%) = ${(calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife), oldAgeStartWife) / 10000).toFixed(1)}万円`
                    : `${(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife) / 10000).toFixed(1)}万円 × (1 + ${((oldAgeStartWife - 65) * 12 * 0.7).toFixed(1)}%) = ${(calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife), oldAgeStartWife) / 10000).toFixed(1)}万円`
                }] : []),
                { label: '遺族厚生年金（差額調整後）', value: `${(Math.max(0, caseHusbandDeath.employeePension - calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife), oldAgeStartWife)) / 10000).toFixed(1)}万円` },
                { label: '　Max(遺族厚生年金 - 妻の老齢厚生年金, 0)', value: `Max(${(caseHusbandDeath.employeePension / 10000).toFixed(1)}万 - ${(calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife), oldAgeStartWife) / 10000).toFixed(1)}万, 0) = ${(Math.max(0, caseHusbandDeath.employeePension - calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife), oldAgeStartWife)) / 10000).toFixed(1)}万円` },
                { label: '65歳以降の合計（年額）', value: `${(caseHusbandDeath.oldAgeAmount / 10000).toFixed(1)}万円` },
                { label: '　老齢基礎 + 老齢厚生 + 遺族厚生（差額）', value: `${(calculateOldAgePensionAdjustment(calculateOldAgeBasicPension(), oldAgeStartWife) / 10000).toFixed(1)}万 + ${(calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife), oldAgeStartWife) / 10000).toFixed(1)}万 + ${(Math.max(0, caseHusbandDeath.employeePension - calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife), oldAgeStartWife)) / 10000).toFixed(1)}万 = ${(caseHusbandDeath.oldAgeAmount / 10000).toFixed(1)}万円` },
              ]}
            />
          </section>

          <section className="pt-12 border-t border-slate-800">
            <div className="flex items-center gap-3 mb-6">
              <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/30">
                <span className="text-2xl">👨</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-slate-100">夫の受給額</h2>
                <p className="text-sm text-slate-400 mt-0.5">妻が死亡した場合</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
              <PeriodCard
                title="子がいる期間"
                amount={caseWifeDeath.withChildrenAmount}
                period={`${ageHusband}歳 - ${caseWifeDeath.ageAfterChild}歳`}
                colorClass="border-emerald-500/30"
                icon="👶"
                pensionTypes={caseWifeDeath.pensionTypesWithChildren}
              />
              <PeriodCard
                title="子がいなくなった後"
                amount={caseWifeDeath.afterChildrenAmount}
                period={`${caseWifeDeath.ageAfterChild}歳 - ${oldAgeStartHusband}歳`}
                colorClass="border-sky-500/30"
                icon="💼"
                pensionTypes={caseWifeDeath.pensionTypesAfterChildren}
              />
              <PeriodCard
                title="年金開始後"
                amount={caseWifeDeath.oldAgeAmount}
                period={`${oldAgeStartHusband}歳 - 100歳`}
                colorClass="border-sky-500/30"
                icon="🎂"
                pensionTypes={caseWifeDeath.pensionTypesOldAge}
              />
            </div>

            {timelineDataWife.block1 && (
              <>
                <TimelineBlock
                  title="👶 ① 子がいる期間（遺族基礎年金支給）"
                  color="emerald"
                  segments={timelineDataWife.block1.segments}
                  ticks={timelineDataWife.block1.ticks}
                  blockNumber={1}
                  hasLogic={true}
                />
                <CalculationLogic
                  color="emerald"
                  details={[
                    { label: '遺族基礎年金（基本額）', value: '83.2万円' },
                    { label: '子の加算（第1子・第2子）', value: '各23.9万円' },
                    { label: '子の加算（第3子以降）', value: '各8.0万円' },
                    { label: '遺族厚生年金（年額）', value: `${(caseWifeDeath.employeePension / 10000).toFixed(1)}万円` },
                    { label: '　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000 × 3/4', value: `${(avgStdMonthlyWife / 10000).toFixed(1)}万 × ${useMinashi300Wife ? Math.max(monthsWife, 300) : monthsWife}月 × 5.481/1000 × 3/4 = ${(caseWifeDeath.employeePension / 10000).toFixed(1)}万円` },
                  ]}
                />
              </>
            )}

            <div className="mt-8">
              <TimelineBlock
                title="💼 ② 子がいなくなった後 〜 老後"
                color="sky"
                segments={timelineDataWife.block2.segments}
                ticks={timelineDataWife.block2.ticks}
                blockNumber={2}
                hasLogic={true}
              />
            </div>
            <CalculationLogic
              color="sky"
              details={[
                { label: `夫の老齢基礎年金（${oldAgeStartHusband}歳〜）`, value: `${(calculateOldAgePensionAdjustment(calculateOldAgeBasicPension(), oldAgeStartHusband) / 10000).toFixed(1)}万円` },
                ...(oldAgeStartHusband !== 65 ? [{ 
                  label: '　繰り上げ・繰り下げ調整', 
                  value: oldAgeStartHusband < 65 
                    ? `83.2万円 × (1 - ${((65 - oldAgeStartHusband) * 12 * 0.4).toFixed(1)}%) = ${(calculateOldAgePensionAdjustment(calculateOldAgeBasicPension(), oldAgeStartHusband) / 10000).toFixed(1)}万円`
                    : `83.2万円 × (1 + ${((oldAgeStartHusband - 65) * 12 * 0.7).toFixed(1)}%) = ${(calculateOldAgePensionAdjustment(calculateOldAgeBasicPension(), oldAgeStartHusband) / 10000).toFixed(1)}万円`
                }] : []),
                { label: `夫の老齢厚生年金（${oldAgeStartHusband}歳〜）`, value: `${(calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband), oldAgeStartHusband) / 10000).toFixed(1)}万円` },
                { label: '　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000', value: `${(avgStdMonthlyHusband / 10000).toFixed(1)}万 × ${monthsHusband}月 × 5.481/1000 = ${(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband) / 10000).toFixed(1)}万円` },
                ...(oldAgeStartHusband !== 65 ? [{ 
                  label: '　繰り上げ・繰り下げ調整', 
                  value: oldAgeStartHusband < 65 
                    ? `${(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband) / 10000).toFixed(1)}万円 × (1 - ${((65 - oldAgeStartHusband) * 12 * 0.4).toFixed(1)}%) = ${(calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband), oldAgeStartHusband) / 10000).toFixed(1)}万円`
                    : `${(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband) / 10000).toFixed(1)}万円 × (1 + ${((oldAgeStartHusband - 65) * 12 * 0.7).toFixed(1)}%) = ${(calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband), oldAgeStartHusband) / 10000).toFixed(1)}万円`
                }] : []),
                { label: '遺族厚生年金（差額調整後）', value: `${(Math.max(0, caseWifeDeath.employeePension - calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband), oldAgeStartHusband)) / 10000).toFixed(1)}万円` },
                { label: '　Max(遺族厚生年金 - 夫の老齢厚生年金, 0)', value: `Max(${(caseWifeDeath.employeePension / 10000).toFixed(1)}万 - ${(calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband), oldAgeStartHusband) / 10000).toFixed(1)}万, 0) = ${(Math.max(0, caseWifeDeath.employeePension - calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband), oldAgeStartHusband)) / 10000).toFixed(1)}万円` },
                { label: '65歳以降の合計（年額）', value: `${(caseWifeDeath.oldAgeAmount / 10000).toFixed(1)}万円` },
                { label: '　老齢基礎 + 老齢厚生 + 遺族厚生（差額）', value: `${(calculateOldAgePensionAdjustment(calculateOldAgeBasicPension(), oldAgeStartHusband) / 10000).toFixed(1)}万 + ${(calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband), oldAgeStartHusband) / 10000).toFixed(1)}万 + ${(Math.max(0, caseWifeDeath.employeePension - calculateOldAgePensionAdjustment(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband), oldAgeStartHusband)) / 10000).toFixed(1)}万 = ${(caseWifeDeath.oldAgeAmount / 10000).toFixed(1)}万円` },
              ]}
            />
          </section>
        </div>
      </div>
    </main>
  );
}
