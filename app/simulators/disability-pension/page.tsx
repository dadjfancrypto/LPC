'use client';

import React, { useState, useEffect, useMemo, useRef, useLayoutEffect } from 'react';
import Link from 'next/link';
import {
  calculateAge,
  calculateFiscalYearAge,
  calculateOldAgeBasicPension,
  calculateOldAgeEmployeePension,
  DisabilityLevel,
  formatCurrency,
  POLICY_MODES,
} from '../../utils/pension-calc';
import { calculateDisabilityPensionAmounts, SPOUSE_BONUS_2024 as SPOUSE_BONUS } from '../../utils/disability-pension-logic';

/* ===================== 型定義 & 定数 ===================== */

type Segment = {
  label: string;
  years: number;
  widthYears?: number;
  className: string;
  amountYear?: number;
  style?: React.CSSProperties;
  startAge?: number;
  endAge?: number;
  startAges?: string[]; // 開始時点の家族年齢リスト（例: ['妻32', '夫32', '子3', '子1']）
  endAges?: string[]; // 終了時点の家族年齢リスト
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

function getGradientColor(baseColor: 'amber' | 'emerald' | 'sky' | 'blue', index: number) {
  const rgbMap = {
    amber: '217, 119, 6',   // amber-600
    emerald: '5, 150, 105', // emerald-600
    sky: '14, 165, 233',    // sky-500
    blue: '59, 130, 246',   // blue-500
  };
  const rgb = rgbMap[baseColor] || rgbMap.amber;
  const maxOpacity = 0.9;
  const minOpacity = 0.4;
  const step = 0.1;
  const opacity = Math.max(minOpacity, maxOpacity - (index * step));

  return `rgba(${rgb}, ${opacity})`;
}

function CalculationLogic({
  details,
  color
}: {
  details: { label: string; value: string }[];
  color: 'emerald' | 'sky' | 'amber'
}) {
  const [showCalc, setShowCalc] = useState(false);

  const colorMap = {
    emerald: { border: 'border-emerald-500/30', bg: 'bg-emerald-900/10' },
    sky: { border: 'border-sky-500/30', bg: 'bg-sky-900/10' },
    amber: { border: 'border-amber-500/30', bg: 'bg-amber-900/10' },
  };
  const styles = colorMap[color] || colorMap.amber;
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
              badgeText = labelText.includes('障害') ? '障害基礎' : '基礎年金';
            } else if (labelText.includes('厚生年金')) {
              badgeClass = 'bg-green-900/50 text-green-200 border border-green-700/50';
              badgeText = labelText.includes('障害') ? '障害厚生' : '厚生年金';
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
    <div className="relative" style={{ width: geometry.used }}>
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
          const isLast = i === segments.length - 1;

          return (
            <div
              key={i}
              className="relative flex flex-col"
              style={{ width: w }}
            >
              <div
                className={`${s.className} ring-1 ring-white/15 relative flex flex-col justify-center items-stretch px-1 overflow-hidden`}
                style={{ width: w, height: BAR_HEIGHT, ...s.style }}
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
              {/* 年齢ラベル表示エリア */}
              <div className="relative min-h-[60px] flex items-start justify-between mt-1">
                {/* すべてのセグメントの開始地点に年齢リストを表示 */}
                {s.startAges && s.startAges.length > 0 && (
                  <div className="text-[10px] text-slate-400 leading-tight pl-0.5">
                    {s.startAges.map((ageLabel, idx) => (
                      <div key={idx} className="whitespace-nowrap">
                        {ageLabel}
                      </div>
                    ))}
                  </div>
                )}
                {/* 最後のセグメントの終了地点に年齢リストを表示 */}
                {isLast && s.endAges && s.endAges.length > 0 && (
                  <div className="text-[10px] text-slate-400 leading-tight text-right pr-0.5">
                    {s.endAges.map((ageLabel, idx) => (
                      <div key={idx} className="whitespace-nowrap">
                        {ageLabel}
                      </div>
                    ))}
                  </div>
                )}
              </div>
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
  color: 'emerald' | 'sky' | 'amber';
  segments: Segment[];
  ticks: Tick[];
  blockNumber?: 1 | 2 | 3;
  hasLogic?: boolean;
}) {

  // 配色ロジック: color="amber"の場合はアンバー/オレンジ系、blockNumber=2の場合は青系、それ以外は緑系
  let border = '';
  let bg = '';
  if (color === 'amber') {
    // ①（加算あり期間）はアンバー/オレンジ系
    border = 'border-amber-500/40';
    bg = 'bg-amber-900/20';
  } else if (blockNumber === 2) {
    // ②は青系
    border = 'border-sky-500/40';
    bg = 'bg-sky-900/20';
  } else if (blockNumber === 1) {
    // blockNumber=1でcolorがamberでない場合は緑系
    border = 'border-emerald-500/40';
    bg = 'bg-emerald-900/20';
  } else if (blockNumber === 3) {
    border = 'border-emerald-500/40';
    bg = 'bg-emerald-900/20';
  } else {
    // blockNumberが指定されていない場合はcolorプロパティを使用
    if (color === 'sky') {
      border = 'border-sky-500/40';
      bg = 'bg-sky-900/20';
    } else {
      border = 'border-emerald-500/40';
      bg = 'bg-emerald-900/20';
    }
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

/* ===================== Main Page Component ===================== */

export default function DisabilityPensionPage() {
  const [spouseType, setSpouseType] = useState<'couple' | 'none' | undefined>('couple');
  const [childrenCount, setChildrenCount] = useState<number | null>(null);
  const [childrenAges, setChildrenAges] = useState<number[]>([]);

  // 妻の情報
  const [levelWife, setLevelWife] = useState<DisabilityLevel>(2);
  const [ageWife, setAgeWife] = useState<number>(35);
  const [avgStdMonthlyWife, setAvgStdMonthlyWife] = useState<number>(300000);
  const [monthsWife, setMonthsWife] = useState<number>(120);
  const [useMinashi300Wife, setUseMinashi300Wife] = useState<boolean>(true);

  // 夫の情報
  const [levelHusband, setLevelHusband] = useState<DisabilityLevel>(2);
  const [ageHusband, setAgeHusband] = useState<number>(38);
  const [avgStdMonthlyHusband, setAvgStdMonthlyHusband] = useState<number>(450000);
  const [monthsHusband, setMonthsHusband] = useState<number>(180);
  const [useMinashi300Husband, setUseMinashi300Husband] = useState<boolean>(true);

  // 本人の情報（単身用）
  const [levelSingle, setLevelSingle] = useState<DisabilityLevel>(2);
  const [ageSingle, setAgeSingle] = useState<number>(30);
  const [avgStdMonthlySingle, setAvgStdMonthlySingle] = useState<number>(400000);
  const [monthsSingle, setMonthsSingle] = useState<number>(150);

  const [showNotes, setShowNotes] = useState(false);

  // Load/Save logic
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('customer-profile-basic');
      if (saved) {
        try {
          const basic = JSON.parse(saved);
          if (basic.spouseType) setSpouseType(basic.spouseType === 'single' ? 'none' : 'couple');
          if (basic.childrenCount !== undefined) setChildrenCount(basic.childrenCount);
          if (basic.childrenAges) setChildrenAges(basic.childrenAges);

          if (basic.ageWife) setAgeWife(basic.ageWife);
          if (basic.avgStdMonthlyWife) setAvgStdMonthlyWife(basic.avgStdMonthlyWife);
          if (basic.monthsWife) setMonthsWife(basic.monthsWife);
          if (basic.useMinashi300Wife !== undefined) setUseMinashi300Wife(basic.useMinashi300Wife);

          if (basic.ageHusband) setAgeHusband(basic.ageHusband);
          if (basic.avgStdMonthlyHusband) setAvgStdMonthlyHusband(basic.avgStdMonthlyHusband);
          if (basic.monthsHusband) setMonthsHusband(basic.monthsHusband);
          if (basic.useMinashi300Husband !== undefined) setUseMinashi300Husband(basic.useMinashi300Husband);

          // Single profile mapping
          if (basic.spouseType === 'single') {
            // Map husband/wife/self depending on logic, but use defaults for now or map from self
            if (basic.ageSelf) setAgeSingle(basic.ageSelf); // if exists
            else if (basic.ageHusband) setAgeSingle(basic.ageHusband);
            if (basic.avgStdMonthlyHusband) setAvgStdMonthlySingle(basic.avgStdMonthlyHusband);
          }

        } catch (e) { console.error(e); }
      }
    }
  }, []);

  // 子の年齢配列の長さ調整
  useEffect(() => {
    if (childrenCount === null) return;
    if (childrenAges.length !== childrenCount) {
      const newAges = [...childrenAges];
      while (newAges.length < childrenCount) newAges.push(0);
      if (newAges.length > childrenCount) newAges.splice(childrenCount);
      setChildrenAges(newAges);
    }
  }, [childrenCount]);

  // -----------------------------------------------------------
  // 計算ロジック & タイムライン生成 (妻が障害状態)
  // -----------------------------------------------------------
  const timelineDataWife = useMemo(() => {
    // 1. 金額計算
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges);

    // 配偶者加給年金判定
    const hasSpouse = true; // Couple mode

    const { basicPension, employeePension, total, spouseBonus } = calculateDisabilityPensionAmounts({
      level: levelWife,
      hasSpouse,
      ageSpouse: ageHusband,
      childrenAges,
      avgStdMonthly: avgStdMonthlyWife,
      months: monthsWife,
      useMinashi300: useMinashi300Wife
    });

    // 2. タイムライン構築
    // Block 1: 子がいる期間（子の加算対象期間）
    const yearsTo18List = childrenAges
      .map(age => Math.max(0, 18 - age))
      .filter(y => y > 0)
      .sort((a, b) => a - b);

    const yearsToSelf65 = Math.max(0, 65 - ageWife); // 本人が65歳になるまで
    const yearsToSpouse65 = Math.max(0, 65 - ageHusband);

    // pointsには子の年齢到達点と、配偶者加算終了点を含める
    const pointsArr = [0, ...yearsTo18List];
    if (yearsToSpouse65 > 0) pointsArr.push(yearsToSpouse65);

    // 各ポイントを本人65歳でキャップする（65歳を超える場合は65歳で止める）
    const cappedPoints = pointsArr.map(y => Math.min(y, yearsToSelf65));

    const points = Array.from(new Set(cappedPoints)).sort((a, b) => a - b);
    const maxChangeYears = points[points.length - 1] || 0;

    const block1 = { segments: [] as Segment[], ticks: [] as Tick[] };
    const widen = (y: number) => Math.max(y, 5);

    // Block 1 生成
    if (maxChangeYears > 0) {
      // 初期Ticks
      const initialLines = [`妻${ageWife}`, `夫${ageHusband}`];
      childrenAges.forEach(age => { if (age <= 18) initialLines.push(`子${age}`); });
      block1.ticks.push({ edgeIndex: 0, labelLines: initialLines });

      for (let i = 0; i < points.length - 1; i++) {
        const startY = points[i];
        const endY = points[i + 1];
        const duration = endY - startY;

        // この期間の状況
        const currentChildrenAges = childrenAges.map(a => a + startY);
        const currentEligible = calculateEligibleChildrenCount(currentChildrenAges);
        const currentHusbandAge = ageHusband + startY;
        const currentWifeAge = ageWife + startY;

        const { basicPension: currentBasic, employeePension: currentEmployee, total: currentTotal, spouseBonus: currentSpouseBonus } = calculateDisabilityPensionAmounts({
          level: levelWife,
          hasSpouse: true,
          ageSpouse: currentHusbandAge,
          childrenAges: currentChildrenAges,
          avgStdMonthly: avgStdMonthlyWife,
          months: monthsWife,
          useMinashi300: useMinashi300Wife
        });

        let label = `障害${levelWife}級`;
        if (currentEligible > 0) label += `+子${currentEligible}`;
        if (currentSpouseBonus > 0) label += `+配偶者`;

        const startAge = currentWifeAge;
        const endAge = ageWife + endY;

        // 開始時点の家族年齢リスト
        const startAges: string[] = [`妻${ageWife + startY}`, `夫${ageHusband + startY}`];
        childrenAges.forEach((age) => {
          const currentAge = age + startY;
          if (currentAge <= 18) {
            startAges.push(`子${currentAge}`);
          }
        });

        // 終了時点の家族年齢リスト（最後のセグメントのみ）
        const endAges: string[] | undefined = i === points.length - 2 ? [] : undefined;
        if (endAges) {
          endAges.push(`妻${ageWife + endY}`, `夫${ageHusband + endY}`);
          childrenAges.forEach((age) => {
            const currentAge = age + endY;
            if (currentAge <= 18) {
              endAges!.push(`子${currentAge}`);
            }
          });
        }

        block1.segments.push({
          label,
          years: duration,
          widthYears: widen(duration),
          className: `ring-1 ring-white/20`,
          style: { backgroundColor: getGradientColor('amber', i) },
          amountYear: currentTotal,
          startAge,
          endAge,
          startAges,
          endAges
        });

        // Ticks
        const lines = [`妻${ageWife + endY}`, `夫${ageHusband + endY}`];

        childrenAges.forEach(age => {
          const curr = age + endY;
          if (curr <= 18) lines.push(`子${curr}`);
        });

        block1.ticks.push({ edgeIndex: i + 1, labelLines: lines });
      }
    }

    // Block 2: 加算終了後 〜 65歳
    const block2 = { segments: [] as Segment[], ticks: [] as Tick[] };
    const startAge = ageWife + maxChangeYears;
    const endAge = 65;
    const duration2 = Math.max(0, endAge - startAge);

    if (duration2 > 0) {
      // 最終形態の金額
      const finalBasic = calculateDisabilityBasicPension(levelWife, 0);
      const finalSpouseBonus = 0;
      const finalEmployee = calculateDisabilityEmployeePension(levelWife, finalSpouseBonus, 0, avgStdMonthlyWife, monthsWife, useMinashi300Wife);
      const finalTotal = finalBasic + finalEmployee;

      const startAges: string[] = [`妻${startAge}`, `夫${ageHusband + (startAge - ageWife)}`];
      const endAges: string[] = [`妻${endAge}`, `夫${ageHusband + (endAge - ageWife)}`];

      block2.segments.push({
        label: '障害年金（継続）',
        years: duration2,
        widthYears: widen(duration2),
        className: 'ring-1 ring-white/20',
        style: { backgroundColor: getGradientColor('sky', 0) },
        amountYear: finalTotal,
        startAge,
        endAge,
        startAges,
        endAges: undefined // 最後のセグメントではないので終了年齢は非表示
      });

      const linesStart = [`妻${startAge}`, maxChangeYears === 0 ? '現在' : ''];
      linesStart.push(`夫${ageHusband + maxChangeYears}`);
      block2.ticks.push({ edgeIndex: 0, labelLines: linesStart });

      block2.ticks.push({ edgeIndex: 1, labelLines: [`妻${endAge}`, `夫${ageHusband + maxChangeYears + duration2}`] });
    }

    // Block 2 (65歳以降): 繰り下げ受給を含む最適化（損益分岐点探索）
    const block2_65plus = {
      segments: [] as Segment[],
      ticks: [] as Tick[],
      optimizedPattern: null as 'A' | 'B' | null,
      optimizedAmount: 0,
      switchAge: null as number | null,
      breakEvenAge: null as number | null
    };
    const startAge65 = 65;
    const endAge100 = 100;
    const maxDeferralAge = 75;

    // 基準額（A）: 障害年金総額
    const disabilityBasic = calculateDisabilityBasicPension(levelWife, 0);
    const disabilityEmployee = calculateDisabilityEmployeePension(levelWife, 0, 0, avgStdMonthlyWife, monthsWife, useMinashi300Wife);
    const oldAgeEmployeeAt65 = calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife);
    // 障害厚生と老齢厚生の高い方を採用
    const selectedEmployeePension = Math.max(disabilityEmployee, oldAgeEmployeeAt65);
    const disabilityTotal = disabilityBasic + selectedEmployeePension;

    // 老齢基礎年金と老齢厚生年金の基準額
    const oldAgeBasicBase = calculateOldAgeBasicPension();
    const oldAgeEmployeeBase = calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife);

    // 65歳から75歳まで1年刻みで探索
    let switchAge: number | null = null;
    let switchAmount = 0;

    for (let age = startAge65; age <= maxDeferralAge; age++) {
      // 繰り下げ月数と増額率を計算（1ヶ月あたり+0.7%）
      const deferralMonths = (age - startAge65) * 12;
      const multiplier = 1 + (deferralMonths * 0.007);

      // 老齢年金総額（B）
      const oldAgeBasic = oldAgeBasicBase * multiplier;
      const oldAgeEmployee = oldAgeEmployeeBase * multiplier;
      const oldAgeTotal = oldAgeBasic + oldAgeEmployee;

      // 老齢年金が障害年金を上回る最初の年齢を見つける
      if (oldAgeTotal > disabilityTotal) {
        switchAge = age;
        switchAmount = oldAgeTotal;
        break;
      }
    }

    // 最適化パターンを決定
    if (switchAge !== null) {
      block2_65plus.optimizedPattern = 'B';
      block2_65plus.optimizedAmount = switchAmount;
      block2_65plus.switchAge = switchAge;
      block2_65plus.breakEvenAge = switchAge;

      // タイムラインを分割
      const durationBeforeSwitch = switchAge - startAge65;
      const durationAfterSwitch = endAge100 - switchAge;

      // 65歳〜切り替え年齢まで: 障害年金
      if (durationBeforeSwitch > 0) {
        const startAges: string[] = [`妻${startAge65}`, `夫${ageHusband + (startAge65 - ageWife)}`];
        const endAges: string[] = [`妻${switchAge}`, `夫${ageHusband + (switchAge - ageWife)}`];

        block2_65plus.segments.push({
          label: '障害年金',
          years: durationBeforeSwitch,
          widthYears: widen(durationBeforeSwitch),
          className: 'ring-1 ring-white/20',
          style: { backgroundColor: getGradientColor('sky', 0) },
          amountYear: disabilityTotal,
          startAge: startAge65,
          endAge: switchAge,
          startAges,
          endAges: undefined // 最後のセグメントではないので終了年齢は非表示
        });
      }

      // 切り替え年齢〜100歳まで: 老齢年金（繰下げ）
      if (durationAfterSwitch > 0) {
        const deferralMonths = (switchAge - startAge65) * 12;
        const multiplier = 1 + (deferralMonths * 0.007);
        const switchAmountFinal = (oldAgeBasicBase + oldAgeEmployeeBase) * multiplier;

        const startAges: string[] = [`妻${switchAge}`, `夫${ageHusband + (switchAge - ageWife)}`];
        const endAges: string[] = [`妻${endAge100}`, `夫${ageHusband + (endAge100 - ageWife)}`];

        block2_65plus.segments.push({
          label: `${switchAge}歳繰下げ`,
          years: durationAfterSwitch,
          widthYears: widen(durationAfterSwitch),
          className: 'ring-1 ring-white/20',
          style: { backgroundColor: getGradientColor('sky', 1) },
          amountYear: switchAmountFinal,
          startAge: switchAge,
          endAge: endAge100,
          startAges,
          endAges // 最後のセグメントなので終了年齢を表示
        });
      }
    } else {
      // 切り替えポイントが見つからなかった場合: 一生涯障害年金
      block2_65plus.optimizedPattern = 'A';
      block2_65plus.optimizedAmount = disabilityTotal;
      block2_65plus.switchAge = null;
      block2_65plus.breakEvenAge = null;

      const duration = endAge100 - startAge65;
      const startAges: string[] = [`妻${startAge65}`, `夫${ageHusband + (startAge65 - ageWife)}`];
      const endAges: string[] = [`妻${endAge100}`, `夫${ageHusband + (endAge100 - ageWife)}`];

      block2_65plus.segments.push({
        label: '障害年金（継続）',
        years: duration,
        widthYears: widen(duration),
        className: 'ring-1 ring-white/20',
        style: { backgroundColor: getGradientColor('sky', 0) },
        amountYear: disabilityTotal,
        startAge: startAge65,
        endAge: endAge100,
        startAges,
        endAges // 最後のセグメントなので終了年齢を表示
      });
    }

    // Ticks生成
    let tickIndex = 0;
    block2_65plus.ticks.push({ edgeIndex: tickIndex++, labelLines: [`妻${startAge65}`] });

    if (block2_65plus.switchAge !== null && block2_65plus.segments.length > 1) {
      // 切り替えポイントがある場合
      const seg1Years = block2_65plus.segments[0].years;
      const switchAge = block2_65plus.switchAge;
      const labels = [`妻${switchAge}`, `⤴ ${switchAge}歳で老齢年金の方が高くなるため切替`];
      block2_65plus.ticks.push({
        posYears: seg1Years,
        labelLines: labels
      });
    }

    block2_65plus.ticks.push({ edgeIndex: block2_65plus.segments.length, labelLines: [`妻${endAge100}`] });

    // Pension Types for Card
    const pensionTypes = ['障害基礎年金', '障害厚生年金'];
    if (eligibleChildren > 0) pensionTypes.push('子の加算');
    if (spouseBonus > 0) pensionTypes.push('配偶者加給年金');

    return {
      total,
      basicPension,
      employeePension,
      pensionTypes,
      block1: maxChangeYears > 0 ? block1 : null,
      block2,
      block2_65plus,
      ageAfterChange: startAge
    };
  }, [levelWife, childrenAges, ageWife, ageHusband, avgStdMonthlyWife, monthsWife, useMinashi300Wife]);

  // -----------------------------------------------------------
  // 計算ロジック & タイムライン生成 (夫が障害状態)
  // -----------------------------------------------------------
  const timelineDataHusband = useMemo(() => {
    // 1. 金額計算
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges);

    // 妻が65歳未満なら加算
    const hasSpouse = true;
    const spouseBonus = (hasSpouse && ageWife < 65) ? SPOUSE_BONUS : 0;

    const basicPension = calculateDisabilityBasicPension(levelHusband, eligibleChildren);
    const employeePension = calculateDisabilityEmployeePension(levelHusband, spouseBonus, 0, avgStdMonthlyHusband, monthsHusband, useMinashi300Husband);

    const total = basicPension + employeePension;

    // 2. タイムライン構築
    const yearsTo18List = childrenAges
      .map(age => Math.max(0, 18 - age))
      .filter(y => y > 0)
      .sort((a, b) => a - b);

    const yearsToSelf65 = Math.max(0, 65 - ageHusband); // 本人65歳
    const yearsToSpouse65 = Math.max(0, 65 - ageWife);

    // pointsには子の年齢到達点と、配偶者加算終了点を含める
    const pointsArr = [0, ...yearsTo18List];
    if (yearsToSpouse65 > 0) pointsArr.push(yearsToSpouse65);

    // 各ポイントを本人65歳でキャップする
    const cappedPoints = pointsArr.map(y => Math.min(y, yearsToSelf65));

    const points = Array.from(new Set(cappedPoints)).sort((a, b) => a - b);
    const maxChangeYears = points[points.length - 1] || 0;

    const block1 = { segments: [] as Segment[], ticks: [] as Tick[] };
    const widen = (y: number) => Math.max(y, 5);

    if (maxChangeYears > 0) {
      const initialLines = [`夫${ageHusband}`, `妻${ageWife}`];
      childrenAges.forEach(age => { if (age <= 18) initialLines.push(`子${age}`); });
      block1.ticks.push({ edgeIndex: 0, labelLines: initialLines });

      for (let i = 0; i < points.length - 1; i++) {
        const startY = points[i];
        const endY = points[i + 1];
        const duration = endY - startY;

        const currentChildrenAges = childrenAges.map(a => a + startY);
        const currentEligible = calculateEligibleChildrenCount(currentChildrenAges);
        const currentWifeAge = ageWife + startY;
        const currentSpouseBonus = (currentWifeAge < 65) ? SPOUSE_BONUS : 0;

        const currentBasic = calculateDisabilityBasicPension(levelHusband, currentEligible);
        const currentEmployee = calculateDisabilityEmployeePension(levelHusband, currentSpouseBonus, 0, avgStdMonthlyHusband, monthsHusband, useMinashi300Husband);
        const currentTotal = currentBasic + currentEmployee;

        let label = `障害${levelHusband}級`;
        if (currentEligible > 0) label += `+子${currentEligible}`;
        if (currentSpouseBonus > 0) label += `+配偶者`;

        const startAge = ageHusband + startY;
        const endAge = ageHusband + endY;

        // 開始時点の家族年齢リスト
        const startAges: string[] = [`夫${ageHusband + startY}`, `妻${ageWife + startY}`];
        childrenAges.forEach((age) => {
          const currentAge = age + startY;
          if (currentAge <= 18) {
            startAges.push(`子${currentAge}`);
          }
        });

        // 終了時点の家族年齢リスト（最後のセグメントのみ）
        const endAges: string[] | undefined = i === points.length - 2 ? [] : undefined;
        if (endAges) {
          endAges.push(`夫${ageHusband + endY}`, `妻${ageWife + endY}`);
          childrenAges.forEach((age) => {
            const currentAge = age + endY;
            if (currentAge <= 18) {
              endAges!.push(`子${currentAge}`);
            }
          });
        }

        block1.segments.push({
          label,
          years: duration,
          widthYears: widen(duration),
          className: `ring-1 ring-white/20`,
          style: { backgroundColor: getGradientColor('amber', i) },
          amountYear: currentTotal,
          startAge,
          endAge,
          startAges,
          endAges
        });

        const lines = [`夫${ageHusband + endY}`, `妻${ageWife + endY}`];

        childrenAges.forEach(age => {
          const curr = age + endY;
          if (curr <= 18) lines.push(`子${curr}`);
        });

        block1.ticks.push({ edgeIndex: i + 1, labelLines: lines });
      }
    }

    const block2 = { segments: [] as Segment[], ticks: [] as Tick[] };
    const startAge = ageHusband + maxChangeYears;
    const endAge = 65;
    const duration2 = Math.max(0, endAge - startAge);

    if (duration2 > 0) {
      const finalBasic = calculateDisabilityBasicPension(levelHusband, 0);
      const finalSpouseBonus = 0;
      const finalEmployee = calculateDisabilityEmployeePension(levelHusband, finalSpouseBonus, 0, avgStdMonthlyHusband, monthsHusband, useMinashi300Husband);
      const finalTotal = finalBasic + finalEmployee;

      const startAges: string[] = [`夫${startAge}`, `妻${ageWife + (startAge - ageHusband)}`];
      const endAges: string[] = [`夫${endAge}`, `妻${ageWife + (endAge - ageHusband)}`];

      block2.segments.push({
        label: '障害年金（継続）',
        years: duration2,
        widthYears: widen(duration2),
        className: 'ring-1 ring-white/20',
        style: { backgroundColor: getGradientColor('sky', 0) },
        amountYear: finalTotal,
        startAge,
        endAge,
        startAges,
        endAges: undefined // 最後のセグメントではないので終了年齢は非表示
      });

      const linesStart = [`夫${startAge}`, maxChangeYears === 0 ? '現在' : ''];
      linesStart.push(`妻${ageWife + maxChangeYears}`);
      block2.ticks.push({ edgeIndex: 0, labelLines: linesStart });

      block2.ticks.push({ edgeIndex: 1, labelLines: [`夫${endAge}`, `妻${ageWife + maxChangeYears + duration2}`] });
    }

    // Block 2 (65歳以降): 繰り下げ受給を含む最適化（損益分岐点探索）
    const block2_65plus = {
      segments: [] as Segment[],
      ticks: [] as Tick[],
      optimizedPattern: null as 'A' | 'B' | null,
      optimizedAmount: 0,
      switchAge: null as number | null,
      breakEvenAge: null as number | null
    };
    const startAge65 = 65;
    const endAge100 = 100;
    const maxDeferralAge = 75;

    // 基準額（A）: 障害年金総額
    const disabilityBasic = calculateDisabilityBasicPension(levelHusband, 0);
    const disabilityEmployee = calculateDisabilityEmployeePension(levelHusband, 0, 0, avgStdMonthlyHusband, monthsHusband, useMinashi300Husband);
    const oldAgeEmployeeAt65 = calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband);
    // 障害厚生と老齢厚生の高い方を採用
    const selectedEmployeePension = Math.max(disabilityEmployee, oldAgeEmployeeAt65);
    const disabilityTotal = disabilityBasic + selectedEmployeePension;

    // 老齢基礎年金と老齢厚生年金の基準額
    const oldAgeBasicBase = calculateOldAgeBasicPension();
    const oldAgeEmployeeBase = calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband);

    // 65歳から75歳まで1年刻みで探索
    let switchAge: number | null = null;
    let switchAmount = 0;

    for (let age = startAge65; age <= maxDeferralAge; age++) {
      // 繰り下げ月数と増額率を計算（1ヶ月あたり+0.7%）
      const deferralMonths = (age - startAge65) * 12;
      const multiplier = 1 + (deferralMonths * 0.007);

      // 老齢年金総額（B）
      const oldAgeBasic = oldAgeBasicBase * multiplier;
      const oldAgeEmployee = oldAgeEmployeeBase * multiplier;
      const oldAgeTotal = oldAgeBasic + oldAgeEmployee;

      // 老齢年金が障害年金を上回る最初の年齢を見つける
      if (oldAgeTotal > disabilityTotal) {
        switchAge = age;
        switchAmount = oldAgeTotal;
        break;
      }
    }

    // 最適化パターンを決定
    if (switchAge !== null) {
      block2_65plus.optimizedPattern = 'B';
      block2_65plus.optimizedAmount = switchAmount;
      block2_65plus.switchAge = switchAge;
      block2_65plus.breakEvenAge = switchAge;

      // タイムラインを分割
      const durationBeforeSwitch = switchAge - startAge65;
      const durationAfterSwitch = endAge100 - switchAge;

      // 65歳〜切り替え年齢まで: 障害年金
      if (durationBeforeSwitch > 0) {
        const startAges: string[] = [`夫${startAge65}`, `妻${ageWife + (startAge65 - ageHusband)}`];
        const endAges: string[] = [`夫${switchAge}`, `妻${ageWife + (switchAge - ageHusband)}`];

        block2_65plus.segments.push({
          label: '障害年金',
          years: durationBeforeSwitch,
          widthYears: widen(durationBeforeSwitch),
          className: 'ring-1 ring-white/20',
          style: { backgroundColor: getGradientColor('sky', 0) },
          amountYear: disabilityTotal,
          startAge: startAge65,
          endAge: switchAge,
          startAges,
          endAges: undefined // 最後のセグメントではないので終了年齢は非表示
        });
      }

      // 切り替え年齢〜100歳まで: 老齢年金（繰下げ）
      if (durationAfterSwitch > 0) {
        const deferralMonths = (switchAge - startAge65) * 12;
        const multiplier = 1 + (deferralMonths * 0.007);
        const switchAmountFinal = (oldAgeBasicBase + oldAgeEmployeeBase) * multiplier;

        const startAges: string[] = [`夫${switchAge}`, `妻${ageWife + (switchAge - ageHusband)}`];
        const endAges: string[] = [`夫${endAge100}`, `妻${ageWife + (endAge100 - ageHusband)}`];

        block2_65plus.segments.push({
          label: `${switchAge}歳繰下げ`,
          years: durationAfterSwitch,
          widthYears: widen(durationAfterSwitch),
          className: 'ring-1 ring-white/20',
          style: { backgroundColor: getGradientColor('sky', 1) },
          amountYear: switchAmountFinal,
          startAge: switchAge,
          endAge: endAge100,
          startAges,
          endAges // 最後のセグメントなので終了年齢を表示
        });
      }
    } else {
      // 切り替えポイントが見つからなかった場合: 一生涯障害年金
      block2_65plus.optimizedPattern = 'A';
      block2_65plus.optimizedAmount = disabilityTotal;
      block2_65plus.switchAge = null;
      block2_65plus.breakEvenAge = null;

      const duration = endAge100 - startAge65;
      const startAges: string[] = [`夫${startAge65}`, `妻${ageWife + (startAge65 - ageHusband)}`];
      const endAges: string[] = [`夫${endAge100}`, `妻${ageWife + (endAge100 - ageHusband)}`];

      block2_65plus.segments.push({
        label: '障害年金（継続）',
        years: duration,
        widthYears: widen(duration),
        className: 'ring-1 ring-white/20',
        style: { backgroundColor: getGradientColor('sky', 0) },
        amountYear: disabilityTotal,
        startAge: startAge65,
        endAge: endAge100,
        startAges,
        endAges // 最後のセグメントなので終了年齢を表示
      });
    }

    // Ticks生成
    let tickIndex = 0;
    block2_65plus.ticks.push({ edgeIndex: tickIndex++, labelLines: [`夫${startAge65}`] });

    if (block2_65plus.switchAge !== null && block2_65plus.segments.length > 1) {
      // 切り替えポイントがある場合
      const seg1Years = block2_65plus.segments[0].years;
      const switchAge = block2_65plus.switchAge;
      const labels = [`夫${switchAge}`, `⤴ ${switchAge}歳で老齢年金の方が高くなるため切替`];
      block2_65plus.ticks.push({
        posYears: seg1Years,
        labelLines: labels
      });
    }

    block2_65plus.ticks.push({ edgeIndex: block2_65plus.segments.length, labelLines: [`夫${endAge100}`] });

    const pensionTypes = ['障害基礎年金', '障害厚生年金'];
    if (eligibleChildren > 0) pensionTypes.push('子の加算');
    if (spouseBonus > 0) pensionTypes.push('配偶者加給年金');

    return {
      total,
      basicPension,
      employeePension,
      pensionTypes,
      block1: maxChangeYears > 0 ? block1 : null,
      block2,
      block2_65plus,
      ageAfterChange: startAge
    };
  }, [levelHusband, childrenAges, ageHusband, ageWife, avgStdMonthlyHusband, monthsHusband, useMinashi300Husband]);

  // ... (Single case logic omitted for brevity but structure is ready for extension if needed)

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-amber-500/30 pb-20">
      <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <h1 className="text-xl font-bold flex items-center gap-2">
              <span className="w-2 h-8 bg-amber-500 rounded-full"></span>
              障害年金シミュレーター
            </h1>
            <Link
              href="/simulators/disability-pension/rules"
              className="text-base text-slate-400 hover:text-amber-400 transition-colors flex items-center gap-2 px-4 py-2 rounded-lg bg-slate-800/50 border border-slate-700 hover:border-amber-500/50"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5">
                <path strokeLinecap="round" strokeLinejoin="round" d="M11.25 11.25l.041-.02a.75.75 0 011.063.852l-.708 2.836a.75.75 0 001.063.853l.041-.021M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9-3.75h.008v.008H12V8.25z" />
              </svg>
              障害年金について
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
              <li>障害等級、子の加算、配偶者加給年金を考慮しています。</li>
              <li>65歳以降の老齢年金との選択は考慮していません（障害年金継続として計算）。</li>
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
            onClear={() => {
              setSpouseType('none');
              setChildrenCount(null);
              setChildrenAges([]);
              setLevelWife(2);
              setAvgStdMonthlyWife(300000);
              setMonthsWife(120);
              setUseMinashi300Wife(true);
              setLevelHusband(2);
              setAvgStdMonthlyHusband(450000);
              setMonthsHusband(180);
              setUseMinashi300Husband(true);
            }}
          >
            <div className="space-y-6">
              <div>
                <Label>子の人数</Label>
                <Select
                  value={childrenCount ?? ''}
                  onChange={(e) => setChildrenCount(e.target.value ? Number(e.target.value) : null)}
                  options={[{ value: '', label: '--' }, ...Array.from({ length: 6 }, (_, i) => ({ value: i, label: `${i}人` }))]}
                />
              </div>
              {childrenCount !== null && childrenCount > 0 && (
                <div className="grid grid-cols-3 gap-2">
                  {Array.from({ length: childrenCount }).map((_, i) => (
                    <div key={i}>
                      <Label>{i + 1}人目の年齢</Label>
                      <Select
                        value={childrenAges[i] ?? 0}
                        onChange={(e) => { const newAges = [...childrenAges]; newAges[i] = Number(e.target.value); setChildrenAges(newAges); }}
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
                        <Label>障害等級</Label>
                        <Select
                          value={levelWife}
                          onChange={(e) => setLevelWife(Number(e.target.value) as DisabilityLevel)}
                          options={[{ value: 1, label: '1級' }, { value: 2, label: '2級' }, { value: 3, label: '3級' }]}
                        />
                      </div>
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
                        <Label>
                          厚生年金加入月数
                          <span className="text-[10px] font-normal text-slate-500 ml-2">（一度でも厚生年金に加入していた方は月数を記入ください）</span>
                        </Label>
                        <Input value={monthsWife} onChange={(e) => setMonthsWife(Number(e.target.value))} />
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
                        <Label>障害等級</Label>
                        <Select
                          value={levelHusband}
                          onChange={(e) => setLevelHusband(Number(e.target.value) as DisabilityLevel)}
                          options={[{ value: 1, label: '1級' }, { value: 2, label: '2級' }, { value: 3, label: '3級' }]}
                        />
                      </div>
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
                        <Label>
                          厚生年金加入月数
                          <span className="text-[10px] font-normal text-slate-500 ml-2">（一度でも厚生年金に加入していた方は月数を記入ください）</span>
                        </Label>
                        <Input value={monthsHusband} onChange={(e) => setMonthsHusband(Number(e.target.value))} />
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

          {spouseType === 'couple' && (
            <>
              {/* 妻が障害状態になった場合 */}
              <section>
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-rose-500/10 flex items-center justify-center border border-rose-500/30">
                    <span className="text-2xl">👩</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-100">妻の受給額</h2>
                    <p className="text-sm text-slate-400 mt-0.5">妻が障害状態になった場合</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <PeriodCard
                    title="加算あり期間"
                    amount={timelineDataWife.total}
                    period={timelineDataWife.block1 ? `${ageWife}歳 - ${timelineDataWife.ageAfterChange}歳` : '---'}
                    colorClass="border-amber-500/30"
                    icon="🏥"
                    pensionTypes={timelineDataWife.pensionTypes}
                  />
                  {timelineDataWife.block2.segments.length > 0 && (
                    <PeriodCard
                      title="加算終了後"
                      amount={timelineDataWife.basicPension + calculateDisabilityEmployeePension(levelWife, 0, 0, avgStdMonthlyWife, monthsWife, true)}
                      period={`${timelineDataWife.ageAfterChange}歳 - 65歳`}
                      colorClass="border-sky-500/30"
                      icon="💼"
                      pensionTypes={['障害基礎年金', '障害厚生年金']}
                    />
                  )}
                  {timelineDataWife.block2_65plus.segments.length > 0 && (
                    <PeriodCard
                      title="65歳以降（最適給付）"
                      amount={timelineDataWife.block2_65plus.optimizedAmount}
                      period="65歳 - 100歳"
                      colorClass="border-emerald-500/30"
                      icon="✨"
                      pensionTypes={timelineDataWife.block2_65plus.optimizedPattern === 'A'
                        ? ['障害基礎年金', '障害厚生年金']
                        : timelineDataWife.block2_65plus.switchAge
                          ? [`老齢基礎年金（${timelineDataWife.block2_65plus.switchAge}歳繰下げ）`, `老齢厚生年金（${timelineDataWife.block2_65plus.switchAge}歳繰下げ）`]
                          : ['老齢基礎年金', '老齢厚生年金']}
                    />
                  )}
                </div>

                {timelineDataWife.block1 && (
                  <>
                    <TimelineBlock
                      title="💊 ① 加算あり期間（子・配偶者）"
                      color="amber"
                      segments={timelineDataWife.block1.segments}
                      ticks={timelineDataWife.block1.ticks}
                      blockNumber={1}
                      hasLogic={true}
                    />
                    <CalculationLogic
                      color="amber"
                      details={[
                        { label: `障害基礎年金（${levelWife}級）`, value: `${(calculateDisabilityBasicPension(levelWife, 0) / 10000).toFixed(1)}万円` },
                        { label: '　79.5万円 × 等級倍率（1級1.25, 2級1.0）', value: levelWife === 1 ? '79.5万円 × 1.25 = 99.4万円' : '79.5万円 × 1.0 = 79.5万円' },
                        { label: '子の加算', value: `${((calculateDisabilityBasicPension(levelWife, calculateEligibleChildrenCount(childrenAges)) - calculateDisabilityBasicPension(levelWife, 0)) / 10000).toFixed(1)}万円` },
                        { label: '障害厚生年金', value: `${(calculateDisabilityEmployeePension(levelWife, 0, 0, avgStdMonthlyWife, monthsWife, true) / 10000).toFixed(1)}万円` },
                        { label: '　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000 × 等級倍率', value: `${(avgStdMonthlyWife / 10000).toFixed(1)}万 × ${monthsWife}月 × 5.481/1000 × ${levelWife === 1 ? '1.25' : '1.0'} = ${(calculateDisabilityEmployeePension(levelWife, 0, 0, avgStdMonthlyWife, monthsWife, true) / 10000).toFixed(1)}万円` },
                        { label: '配偶者加給年金（条件満たす場合）', value: `${((ageHusband < 65 ? SPOUSE_BONUS : 0) / 10000).toFixed(1)}万円` },
                      ]}
                    />
                  </>
                )}

                {timelineDataWife.block2.segments.length > 0 && (
                  <>
                    <div className="mt-8">
                      <TimelineBlock
                        title="💼 ② 加算終了後 〜"
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
                        { label: '障害基礎年金', value: `${(calculateDisabilityBasicPension(levelWife, 0) / 10000).toFixed(1)}万円` },
                        { label: '障害厚生年金', value: `${(calculateDisabilityEmployeePension(levelWife, 0, 0, avgStdMonthlyWife, monthsWife, true) / 10000).toFixed(1)}万円` },
                      ]}
                    />
                  </>
                )}

                {timelineDataWife.block2_65plus.segments.length > 0 && (
                  <>
                    <div className="mt-8">
                      <TimelineBlock
                        title={`✨ ${timelineDataWife.block2.segments.length > 0 ? '③' : '②'} 65歳以降（最適給付）${timelineDataWife.block2_65plus.breakEvenAge ? ` [損益分岐点: ${timelineDataWife.block2_65plus.breakEvenAge}歳]` : ' [障害年金の方が有利]'}`}
                        color="sky"
                        segments={timelineDataWife.block2_65plus.segments}
                        ticks={timelineDataWife.block2_65plus.ticks}
                        blockNumber={2}
                        hasLogic={true}
                      />
                    </div>
                    <CalculationLogic
                      color="sky"
                      details={[
                        { label: '65歳以降の受給イメージ', value: '' },
                        {
                          label: timelineDataWife.block2_65plus.optimizedPattern === 'A'
                            ? '　障害年金の方が有利（老齢年金への切替不要）'
                            : `　${timelineDataWife.block2_65plus.switchAge}歳で老齢年金の方が高くなるため切替`,
                          value: ''
                        },
                        timelineDataWife.block2_65plus.optimizedPattern === 'A' ? [
                          { label: '障害基礎年金', value: `${(calculateDisabilityBasicPension(levelWife, 0) / 10000).toFixed(1)}万円` },
                          { label: '障害厚生年金', value: `${(calculateDisabilityEmployeePension(levelWife, 0, 0, avgStdMonthlyWife, monthsWife, useMinashi300Wife) / 10000).toFixed(1)}万円` },
                          { label: '　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000 × 等級倍率', value: `${(avgStdMonthlyWife / 10000).toFixed(1)}万 × ${monthsWife}月 × 5.481/1000 × ${levelWife === 1 ? '1.25' : '1.0'} = ${(calculateDisabilityEmployeePension(levelWife, 0, 0, avgStdMonthlyWife, monthsWife, useMinashi300Wife) / 10000).toFixed(1)}万円` },
                        ] : (() => {
                          const switchAge = timelineDataWife.block2_65plus.switchAge!;
                          const deferralMonths = (switchAge - 65) * 12;
                          const multiplier = 1 + (deferralMonths * 0.007);
                          const multiplierPercent = ((multiplier - 1) * 100).toFixed(1);
                          return [
                            { label: `老齢基礎年金（${switchAge}歳繰下げ +${multiplierPercent}%）`, value: `${(calculateOldAgeBasicPension() * multiplier / 10000).toFixed(1)}万円` },
                            { label: `　79.5万円 × ${multiplier.toFixed(3)}`, value: `${(calculateOldAgeBasicPension() * multiplier / 10000).toFixed(1)}万円` },
                            { label: `老齢厚生年金（${switchAge}歳繰下げ +${multiplierPercent}%）`, value: `${(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife) * multiplier / 10000).toFixed(1)}万円` },
                            { label: `　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000 × ${multiplier.toFixed(3)}`, value: `${(avgStdMonthlyWife / 10000).toFixed(1)}万 × ${monthsWife}月 × 5.481/1000 × ${multiplier.toFixed(3)} = ${(calculateOldAgeEmployeePension(avgStdMonthlyWife, monthsWife) * multiplier / 10000).toFixed(1)}万円` },
                          ];
                        })(),
                      ].flat()}
                    />
                  </>
                )}
              </section>

              {/* 夫が障害状態になった場合 */}
              <section className="pt-12 border-t border-slate-800">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center border border-emerald-500/30">
                    <span className="text-2xl">👨</span>
                  </div>
                  <div>
                    <h2 className="text-2xl font-bold text-slate-100">夫の受給額</h2>
                    <p className="text-sm text-slate-400 mt-0.5">夫が障害状態になった場合</p>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
                  <PeriodCard
                    title="加算あり期間"
                    amount={timelineDataHusband.total}
                    period={timelineDataHusband.block1 ? `${ageHusband}歳 - ${timelineDataHusband.ageAfterChange}歳` : '---'}
                    colorClass="border-amber-500/30"
                    icon="🏥"
                    pensionTypes={timelineDataHusband.pensionTypes}
                  />
                  {timelineDataHusband.block2.segments.length > 0 && (
                    <PeriodCard
                      title="加算終了後"
                      amount={timelineDataHusband.basicPension + calculateDisabilityEmployeePension(levelHusband, 0, 0, avgStdMonthlyHusband, monthsHusband, true)}
                      period={`${timelineDataHusband.ageAfterChange}歳 - 65歳`}
                      colorClass="border-sky-500/30"
                      icon="💼"
                      pensionTypes={['障害基礎年金', '障害厚生年金']}
                    />
                  )}
                  {timelineDataHusband.block2_65plus.segments.length > 0 && (
                    <PeriodCard
                      title="65歳以降（最適給付）"
                      amount={timelineDataHusband.block2_65plus.optimizedAmount}
                      period="65歳 - 100歳"
                      colorClass="border-emerald-500/30"
                      icon="✨"
                      pensionTypes={timelineDataHusband.block2_65plus.optimizedPattern === 'A'
                        ? ['障害基礎年金', '障害厚生年金']
                        : timelineDataHusband.block2_65plus.switchAge
                          ? [`老齢基礎年金（${timelineDataHusband.block2_65plus.switchAge}歳繰下げ）`, `老齢厚生年金（${timelineDataHusband.block2_65plus.switchAge}歳繰下げ）`]
                          : ['老齢基礎年金', '老齢厚生年金']}
                    />
                  )}
                </div>

                {timelineDataHusband.block1 && (
                  <>
                    <TimelineBlock
                      title="💊 ① 加算あり期間（子・配偶者）"
                      color="amber"
                      segments={timelineDataHusband.block1.segments}
                      ticks={timelineDataHusband.block1.ticks}
                      blockNumber={1}
                      hasLogic={true}
                    />
                    <CalculationLogic
                      color="amber"
                      details={[
                        { label: `障害基礎年金（${levelHusband}級）`, value: `${(calculateDisabilityBasicPension(levelHusband, 0) / 10000).toFixed(1)}万円` },
                        { label: '　79.5万円 × 等級倍率（1級1.25, 2級1.0）', value: levelHusband === 1 ? '79.5万円 × 1.25 = 99.4万円' : '79.5万円 × 1.0 = 79.5万円' },
                        { label: '子の加算', value: `${((calculateDisabilityBasicPension(levelHusband, calculateEligibleChildrenCount(childrenAges)) - calculateDisabilityBasicPension(levelHusband, 0)) / 10000).toFixed(1)}万円` },
                        { label: '障害厚生年金', value: `${(calculateDisabilityEmployeePension(levelHusband, 0, 0, avgStdMonthlyHusband, monthsHusband, true) / 10000).toFixed(1)}万円` },
                        { label: '　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000 × 等級倍率', value: `${(avgStdMonthlyHusband / 10000).toFixed(1)}万 × ${monthsHusband}月 × 5.481/1000 × ${levelHusband === 1 ? '1.25' : '1.0'} = ${(calculateDisabilityEmployeePension(levelHusband, 0, 0, avgStdMonthlyHusband, monthsHusband, true) / 10000).toFixed(1)}万円` },
                        { label: '配偶者加給年金（条件満たす場合）', value: `${((ageWife < 65 ? SPOUSE_BONUS : 0) / 10000).toFixed(1)}万円` },
                      ]}
                    />
                  </>
                )}

                {timelineDataHusband.block2.segments.length > 0 && (
                  <>
                    <div className="mt-8">
                      <TimelineBlock
                        title="💼 ② 加算終了後 〜"
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
                        { label: '障害基礎年金', value: `${(calculateDisabilityBasicPension(levelHusband, 0) / 10000).toFixed(1)}万円` },
                        { label: '障害厚生年金', value: `${(calculateDisabilityEmployeePension(levelHusband, 0, 0, avgStdMonthlyHusband, monthsHusband, true) / 10000).toFixed(1)}万円` },
                      ]}
                    />
                  </>
                )}

                {timelineDataHusband.block2_65plus.segments.length > 0 && (
                  <>
                    <div className="mt-8">
                      <TimelineBlock
                        title={`✨ ${timelineDataHusband.block2.segments.length > 0 ? '③' : '②'} 65歳以降（最適給付）${timelineDataHusband.block2_65plus.breakEvenAge ? ` [損益分岐点: ${timelineDataHusband.block2_65plus.breakEvenAge}歳]` : ' [障害年金の方が有利]'}`}
                        color="sky"
                        segments={timelineDataHusband.block2_65plus.segments}
                        ticks={timelineDataHusband.block2_65plus.ticks}
                        blockNumber={2}
                        hasLogic={true}
                      />
                    </div>
                    <CalculationLogic
                      color="sky"
                      details={[
                        { label: '65歳以降の受給イメージ', value: '' },
                        {
                          label: timelineDataHusband.block2_65plus.optimizedPattern === 'A'
                            ? '　障害年金の方が有利（老齢年金への切替不要）'
                            : `　${timelineDataHusband.block2_65plus.switchAge}歳で老齢年金の方が高くなるため切替`,
                          value: ''
                        },
                        timelineDataHusband.block2_65plus.optimizedPattern === 'A' ? [
                          { label: '障害基礎年金', value: `${(calculateDisabilityBasicPension(levelHusband, 0) / 10000).toFixed(1)}万円` },
                          { label: '障害厚生年金', value: `${(calculateDisabilityEmployeePension(levelHusband, 0, 0, avgStdMonthlyHusband, monthsHusband, useMinashi300Husband) / 10000).toFixed(1)}万円` },
                          { label: '　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000 × 等級倍率', value: `${(avgStdMonthlyHusband / 10000).toFixed(1)}万 × ${monthsHusband}月 × 5.481/1000 × ${levelHusband === 1 ? '1.25' : '1.0'} = ${(calculateDisabilityEmployeePension(levelHusband, 0, 0, avgStdMonthlyHusband, monthsHusband, useMinashi300Husband) / 10000).toFixed(1)}万円` },
                        ] : (() => {
                          const switchAge = timelineDataHusband.block2_65plus.switchAge!;
                          const deferralMonths = (switchAge - 65) * 12;
                          const multiplier = 1 + (deferralMonths * 0.007);
                          const multiplierPercent = ((multiplier - 1) * 100).toFixed(1);
                          return [
                            { label: `老齢基礎年金（${switchAge}歳繰下げ +${multiplierPercent}%）`, value: `${(calculateOldAgeBasicPension() * multiplier / 10000).toFixed(1)}万円` },
                            { label: `　79.5万円 × ${multiplier.toFixed(3)}`, value: `${(calculateOldAgeBasicPension() * multiplier / 10000).toFixed(1)}万円` },
                            { label: `老齢厚生年金（${switchAge}歳繰下げ +${multiplierPercent}%）`, value: `${(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband) * multiplier / 10000).toFixed(1)}万円` },
                            { label: `　平均標準報酬月額 × 厚生年金加入月数 × 5.481/1000 × ${multiplier.toFixed(3)}`, value: `${(avgStdMonthlyHusband / 10000).toFixed(1)}万 × ${monthsHusband}月 × 5.481/1000 × ${multiplier.toFixed(3)} = ${(calculateOldAgeEmployeePension(avgStdMonthlyHusband, monthsHusband) * multiplier / 10000).toFixed(1)}万円` },
                          ];
                        })(),
                      ].flat()}
                    />
                  </>
                )}
              </section>
            </>
          )}
        </div>
      </div>
    </main>
  );
}
