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

const BAR_HEIGHT = 64;
const MIN_SEG_PX = 60;

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

function useSharedGeometry(measureRef: React.RefObject<HTMLDivElement>, segments: Segment[]): Geometry {
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
          const amountText = s.amountYear !== undefined ? `${(s.amountYear / 10000).toFixed(0)}荳・・` : '';
          const titleText = `${s.label} ${s.years}蟷ｴ`;
          return (
            <div
              key={i}
              className={`${s.className} ring-1 ring-white/15 relative flex flex-col justify-center items-stretch px-2 overflow-hidden`}
              style={{ width: w }}
              title={titleText}
            >
              {showText && (
                <>
                  <AutoFitLine text={amountText} maxRem={0.95} minScale={0.35} className="text-white" align="left" />
                  <AutoFitLine
                    text={titleText}
                    maxRem={0.78}
                    minScale={0.35}
                    className="text-white/90 mt-0.5"
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
    <div className="relative h-20" style={{ width: geometry.used }}>
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
}: {
  title: string;
  color: 'emerald' | 'sky' | 'rose';
  segments: Segment[];
  ticks: Tick[];
}) {
  const border = color === 'emerald' ? 'border-emerald-500/40' : color === 'rose' ? 'border-rose-500/40' : 'border-sky-500/40';
  const bg = color === 'emerald' ? 'bg-emerald-900/20' : color === 'rose' ? 'bg-rose-900/20' : 'bg-sky-900/20';
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

  return (
    <div className={`rounded-2xl ${border} ${bg} p-8 md:p-10 mb-8`}>
      <div className="text-base font-semibold mb-3">{title}</div>
      <div ref={measureRef} className="w-full h-0 overflow-hidden" />
      <PensionSegmentsBar segments={segments} geometry={geometry} />
      <AgeTicksBar ticks={ticksResolved} geometry={geometry} />
    </div>
  );
}

function PeriodCard({ title, amount, period, colorClass, icon }: { title: string; amount: number; period: string; colorClass: string; icon: string }) {
  return (
    <div className={`p-5 rounded-xl border ${colorClass} bg-slate-900/40 backdrop-blur-sm`}>
      <div className="flex items-center gap-2 mb-2">
        <span className="text-lg">{icon}</span>
        <div className="text-sm font-bold text-slate-300">{title}</div>
      </div>
      <div className="text-2xl font-bold text-slate-100 mb-1">
        {amount > 0 ? `${(amount / 10000).toFixed(0)}荳・・` : '---'}
        <span className="text-xs font-normal text-slate-500 ml-1">/蟷ｴ</span>
      </div>
      <div className="text-xs text-slate-500">{period}</div>
    </div>
  );
}

export default function SurvivorPensionPage() {
  const [mode, setMode] = useState<PolicyMode>('current');

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
    const employeePension = calculateSurvivorEmployeePension(
      avgStdMonthlyHusband,
      monthsHusband,
      useMinashi300Husband
    );
    const isChukorei = (ageWife >= 40 && ageWife < 65 && eligibleChildren === 0);
    const chukoreiKasan = isChukorei ? calculateChukoreiKasan() : 0;

    const youngestChildAge = childrenAges.length > 0 ? Math.min(...childrenAges) : null;
    const yearsUntilChild18 = youngestChildAge !== null ? Math.max(0, 18 - youngestChildAge) : 0;
    const ageAfterChild = ageWife + yearsUntilChild18;

    const withChildrenAmount = basicPension + employeePension;
    const afterChildrenAmount = employeePension + (ageAfterChild >= 40 && ageAfterChild < 65 ? calculateChukoreiKasan() : 0);
    const oldAgeAmount = calculateOldAgePensionAdjustment(employeePension, oldAgeStartWife);

    return {
      basicPension,
      employeePension,
      chukoreiKasan,
      total: basicPension + employeePension + chukoreiKasan,
      withChildrenAmount,
      afterChildrenAmount,
      oldAgeAmount,
      yearsUntilChild18,
      ageAfterChild,
    };
  }, [mode, childrenAges, avgStdMonthlyHusband, monthsHusband, useMinashi300Husband, ageWife, oldAgeStartWife]);

  const caseWifeDeath = useMemo(() => {
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges);
    const basicPension = calculateSurvivorBasicPension(eligibleChildren);
    const employeePension = calculateSurvivorEmployeePension(
      avgStdMonthlyWife,
      monthsWife,
      useMinashi300Wife
    );

    const youngestChildAge = childrenAges.length > 0 ? Math.min(...childrenAges) : null;
    const yearsUntilChild18 = youngestChildAge !== null ? Math.max(0, 18 - youngestChildAge) : 0;
    const ageAfterChild = ageHusband + yearsUntilChild18;

    const withChildrenAmount = basicPension + employeePension;
    const afterChildrenAmount = employeePension;
    const oldAgeAmount = calculateOldAgePensionAdjustment(employeePension, oldAgeStartHusband);

    return {
      basicPension,
      employeePension,
      total: basicPension + employeePension,
      withChildrenAmount,
      afterChildrenAmount,
      oldAgeAmount,
      yearsUntilChild18,
      ageAfterChild,
    };
  }, [mode, childrenAges, avgStdMonthlyWife, monthsWife, useMinashi300Wife, ageHusband, oldAgeStartHusband]);

  const timelineSegmentsHusband = useMemo(() => {
    const segs: Segment[] = [];
    const widenYears = (y: number) => (y > 0 && y <= 3 ? 4 : y);

    if (caseHusbandDeath.yearsUntilChild18 > 0) {
      segs.push({
        label: '蝓ｺ遉・蜴夂函',
        years: caseHusbandDeath.yearsUntilChild18,
        widthYears: widenYears(caseHusbandDeath.yearsUntilChild18),
        className: 'bg-emerald-500/80 ring-1 ring-white/20',
        amountYear: caseHusbandDeath.withChildrenAmount
      });
    }

    const yearsChukorei = Math.max(0, oldAgeStartWife - caseHusbandDeath.ageAfterChild);

    if (yearsChukorei > 0) {
      segs.push({
        label: caseHusbandDeath.ageAfterChild >= 40 ? '荳ｭ鬮倬ｽ｢+蜴夂函' : '蜴夂函縺ｮ縺ｿ',
        years: yearsChukorei,
        widthYears: widenYears(yearsChukorei),
        className: 'bg-emerald-400/80 ring-1 ring-white/20',
        amountYear: caseHusbandDeath.afterChildrenAmount
      });
    }

    const yearsOldAge = 100 - oldAgeStartWife;
    segs.push({
      label: '閠・ｽ｢+蜴夂函',
      years: yearsOldAge,
      widthYears: widenYears(yearsOldAge),
      className: 'bg-emerald-300/80 ring-1 ring-white/20',
      amountYear: caseHusbandDeath.oldAgeAmount
    });

    return segs;
  }, [ageWife, childrenAges, caseHusbandDeath, oldAgeStartWife]);

  const timelineTicksHusband = useMemo(() => {
    const ticks: Tick[] = [];

    ticks.push({ posYears: 0, labelLines: [`${ageWife}豁ｳ`] });

    if (caseHusbandDeath.yearsUntilChild18 > 0) {
      ticks.push({ posYears: caseHusbandDeath.yearsUntilChild18, labelLines: [`${caseHusbandDeath.ageAfterChild}豁ｳ`, '譛ｫ蟄・8豁ｳ'] });
    }

    const yearsUntilOldAge = oldAgeStartWife - ageWife;
    if (yearsUntilOldAge > 0 && yearsUntilOldAge > caseHusbandDeath.yearsUntilChild18) {
      ticks.push({ posYears: yearsUntilOldAge, labelLines: [`${oldAgeStartWife}豁ｳ`, '閠・ｽ｢髢句ｧ・] });
    }

    return ticks;
  }, [ageWife, caseHusbandDeath, oldAgeStartWife]);

  const timelineSegmentsWife = useMemo(() => {
    const segs: Segment[] = [];
    const widenYears = (y: number) => (y > 0 && y <= 3 ? 4 : y);

    if (caseWifeDeath.yearsUntilChild18 > 0) {
      segs.push({
        label: '蝓ｺ遉・蜴夂函',
        years: caseWifeDeath.yearsUntilChild18,
        widthYears: widenYears(caseWifeDeath.yearsUntilChild18),
        className: 'bg-rose-500/80 ring-1 ring-white/20',
        amountYear: caseWifeDeath.withChildrenAmount
      });
    }

    const yearsAfterChild = Math.max(0, oldAgeStartHusband - caseWifeDeath.ageAfterChild);

    if (yearsAfterChild > 0) {
      segs.push({
        label: '蜴夂函縺ｮ縺ｿ',
        years: yearsAfterChild,
        widthYears: widenYears(yearsAfterChild),
        className: 'bg-rose-400/80 ring-1 ring-white/20',
        amountYear: caseWifeDeath.afterChildrenAmount
      });
    }

    const yearsOldAge = 100 - oldAgeStartHusband;
    segs.push({
      label: '閠・ｽ｢+蜴夂函',
      years: yearsOldAge,
      widthYears: widenYears(yearsOldAge),
      className: 'bg-rose-300/80 ring-1 ring-white/20',
      amountYear: caseWifeDeath.oldAgeAmount
    });

    return segs;
  }, [ageHusband, childrenAges, caseWifeDeath, oldAgeStartHusband]);

  const timelineTicksWife = useMemo(() => {
    const ticks: Tick[] = [];

    ticks.push({ posYears: 0, labelLines: [`${ageHusband}豁ｳ`] });

    if (caseWifeDeath.yearsUntilChild18 > 0) {
      ticks.push({ posYears: caseWifeDeath.yearsUntilChild18, labelLines: [`${caseWifeDeath.ageAfterChild}豁ｳ`, '譛ｫ蟄・8豁ｳ'] });
    }

    const yearsUntilOldAge = oldAgeStartHusband - ageHusband;
    if (yearsUntilOldAge > 0 && yearsUntilOldAge > caseWifeDeath.yearsUntilChild18) {
      ticks.push({ posYears: yearsUntilOldAge, labelLines: [`${oldAgeStartHusband}豁ｳ`, '閠・ｽ｢髢句ｧ・] });
    }

    return ticks;
  }, [ageHusband, caseWifeDeath, oldAgeStartHusband]);

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-emerald-500/30 pb-20">
      <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-8 bg-emerald-500 rounded-full"></span>
            驕ｺ譌丞ｹｴ驥代す繝溘Η繝ｬ繝ｼ繧ｿ繝ｼ
          </h1>
          <div className="flex items-center gap-4">
            <div className="hidden md:flex items-center gap-2 bg-slate-800/50 rounded-lg p-1 border border-slate-700">
              <button
                onClick={() => setMode('current')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'current' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
              >
                迴ｾ陦悟宛蠎ｦ
              </button>
              <button
                onClick={() => setMode('revised2028')}
                className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all ${mode === 'revised2028' ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
              >
                2028謾ｹ豁｣譯・              </button>
            </div>
            <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
              TOP縺ｸ謌ｻ繧・            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">

          <div className="lg:col-span-4 space-y-6">
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 backdrop-blur-sm">
              <h2 className="text-lg font-bold text-slate-200 mb-6 flex items-center gap-2">
                <span className="text-emerald-400">笞呻ｸ・/span> 蜑肴署譚｡莉ｶ
              </h2>

              <div className="space-y-4">
                <Accordion
                  title="蝓ｺ譛ｬ諠・ｱ・亥ｭ撰ｼ・
                  defaultOpen={true}
                  onClear={() => { setChildrenCount(null); setChildrenAges([]); }}
                  headerContent={childrenCount !== null ? `${childrenCount}莠ｺ` : undefined}
                >
                  <div className="space-y-4">
                    <div>
                      <Label>蟄舌・莠ｺ謨ｰ</Label>
                      <Select
                        value={childrenCount ?? ''}
                        onChange={(e) => setChildrenCount(e.target.value ? Number(e.target.value) : null)}
                        options={[
                          { value: '', label: '--' },
                          ...Array.from({ length: 6 }, (_, i) => ({ value: i, label: `${i}莠ｺ` }))
                        ]}
                      />
                    </div>
                    {childrenCount !== null && childrenCount > 0 && (
                      <div className="grid grid-cols-2 gap-2">
                        {Array.from({ length: childrenCount }).map((_, i) => (
                          <div key={i}>
                            <Label>{i + 1}莠ｺ逶ｮ縺ｮ蟷ｴ鮨｢</Label>
                            <Select
                              value={childrenAges[i] ?? 0}
                              onChange={(e) => {
                                const newAges = [...childrenAges];
                                newAges[i] = Number(e.target.value);
                                setChildrenAges(newAges);
                              }}
                              options={Array.from({ length: 23 }, (_, j) => ({ value: j, label: `${j}豁ｳ` }))}
                            />
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </Accordion>

                <Accordion
                  title="螯ｻ縺ｮ諠・ｱ"
                  defaultOpen={false}
                  headerContent={`${ageWife}豁ｳ / 譛亥庶${(avgStdMonthlyWife / 10000).toFixed(0)}荳㌔}
                >
                  <div className="space-y-4">
                    <div>
                      <Label>蟷ｴ鮨｢</Label>
                      <Input value={ageWife} onChange={(e) => setAgeWife(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>蟷ｳ蝮・ｨ呎ｺ門ｱ驟ｬ譛磯｡・/Label>
                      <Input value={avgStdMonthlyWife} onChange={(e) => setAvgStdMonthlyWife(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>蜴夂函蟷ｴ驥大刈蜈･譛域焚</Label>
                      <Input value={monthsWife} onChange={(e) => setMonthsWife(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>閠・ｽ｢蟷ｴ驥鷹幕蟋句ｹｴ鮨｢</Label>
                      <Select
                        value={oldAgeStartWife}
                        onChange={(e) => setOldAgeStartWife(Number(e.target.value))}
                        options={Array.from({ length: 16 }, (_, i) => ({ value: 60 + i, label: `${60 + i}豁ｳ` }))}
                      />
                    </div>
                  </div>
                </Accordion>

                <Accordion
                  title="螟ｫ縺ｮ諠・ｱ"
                  defaultOpen={false}
                  headerContent={`${ageHusband}豁ｳ / 譛亥庶${(avgStdMonthlyHusband / 10000).toFixed(0)}荳㌔}
                >
                  <div className="space-y-4">
                    <div>
                      <Label>蟷ｴ鮨｢</Label>
                      <Input value={ageHusband} onChange={(e) => setAgeHusband(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>蟷ｳ蝮・ｨ呎ｺ門ｱ驟ｬ譛磯｡・/Label>
                      <Input value={avgStdMonthlyHusband} onChange={(e) => setAvgStdMonthlyHusband(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>蜴夂函蟷ｴ驥大刈蜈･譛域焚</Label>
                      <Input value={monthsHusband} onChange={(e) => setMonthsHusband(Number(e.target.value))} />
                    </div>
                    <div>
                      <Label>閠・ｽ｢蟷ｴ驥鷹幕蟋句ｹｴ鮨｢</Label>
                      <Select
                        value={oldAgeStartHusband}
                        onChange={(e) => setOldAgeStartHusband(Number(e.target.value))}
                        options={Array.from({ length: 16 }, (_, i) => ({ value: 60 + i, label: `${60 + i}豁ｳ` }))}
                      />
                    </div>
                  </div>
                </Accordion>
              </div>

              <div className="mt-8 pt-6 border-t border-slate-800">
                <Link
                  href="/simulators/customer-profile"
                  className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors text-sm font-bold"
                >
                  <span>側</span> 繝励Ο繝輔ぅ繝ｼ繝ｫ險ｭ螳壹∈
                </Link>
              </div>
            </div>
          </div>

          <div className="lg:col-span-8 space-y-8">

            <section>
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400 border border-emerald-500/20">
                  <span className="text-xl">捉</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-100">螟ｫ縺梧ｭｻ莠｡縺励◆蝣ｴ蜷・/h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <PeriodCard
                  title="蟄舌′縺・ｋ譛滄俣"
                  amount={caseHusbandDeath.withChildrenAmount}
                  period={`${ageWife}豁ｳ - ${caseHusbandDeath.ageAfterChild}豁ｳ`}
                  colorClass="border-emerald-500/30"
                  icon="存"
                />
                <PeriodCard
                  title="蟄舌′縺・↑縺上↑縺｣縺溷ｾ・
                  amount={caseHusbandDeath.afterChildrenAmount}
                  period={`${caseHusbandDeath.ageAfterChild}豁ｳ - ${oldAgeStartWife}豁ｳ`}
                  colorClass="border-emerald-500/30"
                  icon="直"
                />
                <PeriodCard
                  title="蟷ｴ驥鷹幕蟋句ｾ・
                  amount={caseHusbandDeath.oldAgeAmount}
                  period={`${oldAgeStartWife}豁ｳ - 100豁ｳ`}
                  colorClass="border-emerald-500/30"
                  icon="獅"
                />
              </div>

              <TimelineBlock
                title="蜿礼ｵｦ繧ｿ繧､繝繝ｩ繧､繝ｳ・亥ｦｻ縺ｮ蟷ｴ鮨｢・・
                color="emerald"
                segments={timelineSegmentsHusband}
                ticks={timelineTicksHusband}
              />
            </section>

            <section className="pt-12 border-t border-slate-800">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-400 border border-rose-500/20">
                  <span className="text-xl">束</span>
                </div>
                <h2 className="text-2xl font-bold text-slate-100">螯ｻ縺梧ｭｻ莠｡縺励◆蝣ｴ蜷・/h2>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                <PeriodCard
                  title="蟄舌′縺・ｋ譛滄俣"
                  amount={caseWifeDeath.withChildrenAmount}
                  period={`${ageHusband}豁ｳ - ${caseWifeDeath.ageAfterChild}豁ｳ`}
                  colorClass="border-rose-500/30"
                  icon="存"
                />
                <PeriodCard
                  title="蟄舌′縺・↑縺上↑縺｣縺溷ｾ・
                  amount={caseWifeDeath.afterChildrenAmount}
                  period={`${caseWifeDeath.ageAfterChild}豁ｳ - ${oldAgeStartHusband}豁ｳ`}
                  colorClass="border-rose-500/30"
                  icon="直"
                />
                <PeriodCard
                  title="蟷ｴ驥鷹幕蟋句ｾ・
                  amount={caseWifeDeath.oldAgeAmount}
                  period={`${oldAgeStartHusband}豁ｳ - 100豁ｳ`}
                  colorClass="border-rose-500/30"
                  icon="獅"
                />
              </div>

              <TimelineBlock
                title="蜿礼ｵｦ繧ｿ繧､繝繝ｩ繧､繝ｳ・亥､ｫ縺ｮ蟷ｴ鮨｢・・
                color="rose"
                segments={timelineSegmentsWife}
                ticks={timelineTicksWife}
              />
            </section>

          </div>
        </div>
      </div>
    </main>
  );
}
