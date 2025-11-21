'use client';

import React, { useMemo, useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react';
import Link from 'next/link';

/* ===================== 定数 ===================== */
// 障害基礎年金（令和7年4月分から）
const BASE_1_LEVEL = 1_039_625; // 1級の基本額（年）
const BASE_2_LEVEL = 831_700; // 2級の基本額（年）
const CHILD_ADD_1_2 = 239_300; // 子1・2人目の加算（年）
const CHILD_ADD_3P = 79_800; // 子3人目以降の加算（年）

// 障害厚生年金
const COEF_BEFORE_2003 = 7.125 / 1000; // 2003年3月以前の係数
const COEF_AFTER_2003 = 5.481 / 1000; // 2003年4月以降の係数
const MIN_MONTHS = 300; // みなし300月
const SPOUSE_ADD = 224_700; // 配偶者加給年金額（年）
const MIN_LEVEL3 = 623_800; // 3級の最低保障額（年）

// 老齢年金（簡易値）
const OLD_AGE_BASIC_AT_65 = 780_000; // 老齢基礎年金（65歳時、年額）
const OLD_AGE_END = 100; // 老齢年金表示終了年齢

// タイムライン表示用の定数
const MIN_SEG_PX = 72; // セグメント最小幅（可読性確保）
const BAR_HEIGHT = 128; // バーの高さ（テキストを大きくするため増加）

/** 型 **/
type DisabilityLevel = 1 | 2 | 3;

type BreakdownItem = {
  label: string;
  annual: number;
  formula?: string;
};

// タイムライン表示用の型
type Segment = {
  years: number;
  widthYears?: number;
  className: string;
  label: string;
  amountYear?: number;
};

type Tick = {
  posYears?: number;
  posPx?: number;
  edgeIndex?: number;
  labelLines: string[];
};

type Geometry = {
  used: number;
  edgesRaw: number[];
  totalYears: number;
  rawW: number[];
};

/* ===================== 金額表示ユーティリティ ===================== */
function formatYearMonthMan(annual: number) {
  const annualRounded = Math.round(annual / 1000) * 1000; // 千円丸め
  const manY = annualRounded / 10000; // 万円
  const manYStr = Number.isInteger(manY) ? String(manY) : manY.toFixed(1).replace(/\.0$/, '');
  const monthlyRounded = Math.round(annual / 12 / 100) * 100;
  const manM = monthlyRounded / 10000;
  const manMStr = manM.toFixed(1);
  return `${manYStr}万円/年 (約${manMStr}万円/月)`;
}

function floorYen(n: number) {
  return Math.floor(n);
}

function formatExactYen(n: number) {
  return floorYen(n).toLocaleString('ja-JP') + '円';
}

function formatExactYearMonth(n: number) {
  return `${formatExactYen(n)} ／ 月額 ${formatExactYen(Math.floor(n / 12))}`;
}

/* ===================== AutoFit（1行を縮小） ===================== */
function AutoFitLine({
  text,
  maxRem = 1.0,
  minScale = 0.4,
  className = '',
  align = 'left',
}: {
  text: string;
  maxRem?: number;
  minScale?: number;
  className?: string;
  align?: 'center' | 'left';
}) {
  const boxRef = useRef<HTMLDivElement>(null);
  const textRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const resize = () => {
      const box = boxRef.current;
      const t = textRef.current;
      if (!box || !t) return;
      t.style.transform = 'scale(1)';
      const bw = box.clientWidth - 6;
      const tw = t.scrollWidth;
      const next = Math.max(minScale, Math.min(1, bw > 0 ? bw / tw : 1));
      t.style.transform = `scale(${next})`;
    };
    resize();
    const ro = new ResizeObserver(resize);
    if (boxRef.current) ro.observe(boxRef.current);
    if (textRef.current) ro.observe(textRef.current);
    return () => ro.disconnect();
  }, [minScale, text]);
  if (!text) return null;
  return (
    <div ref={boxRef} className={'px-1 overflow-hidden ' + className} style={{ lineHeight: 1 }}>
      <div
        ref={textRef}
        className={`origin-left font-semibold whitespace-nowrap ${
          align === 'left' ? 'text-left' : 'text-center'
        } max-w-full`}
        style={{ fontSize: `${maxRem}rem` }}
      >
        {text}
      </div>
    </div>
  );
}

/* ===================== 日付・年齢計算ユーティリティ ===================== */
// 日付文字列（YYYY/MM/DD）からDateオブジェクトを生成
function parseDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.length !== 10) return null;
  const [year, month, day] = dateStr.split('/').map(Number);
  if (!year || !month || !day) return null;
  const date = new Date(year, month - 1, day);
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) {
    return null;
  }
  return date;
}

// 現在の年齢を計算
function calculateAge(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const monthDiff = today.getMonth() - birthDate.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

// 65歳までの残り年数を計算
function calculateYearsUntil65(birthDate: Date | null): number | null {
  if (!birthDate) return null;
  const today = new Date();
  const age65 = new Date(birthDate.getFullYear() + 65, birthDate.getMonth(), birthDate.getDate());
  const diffTime = age65.getTime() - today.getTime();
  const diffYears = diffTime / (1000 * 60 * 60 * 24 * 365.25);
  return Math.max(0, Math.ceil(diffYears));
}

// 1985年4月2日以降生まれかチェック
function isBornAfter1985April2(birthDate: Date | null): boolean {
  if (!birthDate) return false;
  const threshold = new Date(1985, 3, 2); // 1985年4月2日
  return birthDate >= threshold;
}

// 年月文字列（YYYY/MM）から月数を計算（開始年月から終了年月まで）
function calculateMonthsBetween(startDateStr: string, endDateStr: string): number {
  if (!startDateStr || !endDateStr) return 0;
  const [startYear, startMonth] = startDateStr.split('/').map(Number);
  const [endYear, endMonth] = endDateStr.split('/').map(Number);
  if (!startYear || !startMonth || !endYear || !endMonth) return 0;
  
  const start = new Date(startYear, startMonth - 1, 1);
  const end = new Date(endYear, endMonth, 0); // その月の最後の日
  
  // 開始月と終了月を含む月数を計算
  const months = (endYear - startYear) * 12 + (endMonth - startMonth) + 1;
  return Math.max(0, months);
}

// 年月から2003年3月以前と以降に分割
function splitMonthsBy2003(startDateStr: string, endDateStr: string): {
  monthsBefore2003: number;
  monthsAfter2003: number;
} {
  if (!startDateStr || !endDateStr) return { monthsBefore2003: 0, monthsAfter2003: 0 };
  
  const [startYear, startMonth] = startDateStr.split('/').map(Number);
  const [endYear, endMonth] = endDateStr.split('/').map(Number);
  
  if (!startYear || !startMonth || !endYear || !endMonth) {
    return { monthsBefore2003: 0, monthsAfter2003: 0 };
  }
  
  const splitYear = 2003;
  const splitMonth = 3; // 2003年3月
  
  // 開始日が2003年4月以降の場合
  if (startYear > splitYear || (startYear === splitYear && startMonth >= 4)) {
    const monthsAfter = calculateMonthsBetween(startDateStr, endDateStr);
    return { monthsBefore2003: 0, monthsAfter2003: monthsAfter };
  }
  
  // 終了日が2003年3月以前の場合
  if (endYear < splitYear || (endYear === splitYear && endMonth <= splitMonth)) {
    const monthsBefore = calculateMonthsBetween(startDateStr, endDateStr);
    return { monthsBefore2003: monthsBefore, monthsAfter2003: 0 };
  }
  
  // 期間が分割される場合
  const monthsBefore = calculateMonthsBetween(startDateStr, '2003/3');
  const monthsAfter = calculateMonthsBetween('2003/4', endDateStr);
  
  return { monthsBefore2003: monthsBefore, monthsAfter2003: monthsAfter };
}

// 子の年齢から加算対象人数を計算
function calculateEligibleChildrenCount(childrenAges: (number | null)[], disabilityLevel: DisabilityLevel): number {
  // 18歳到達年度末まで = 18歳になった年度の3月31日まで（実際には19歳未満）
  // 20歳未満の障害1・2級の子 = 20歳の誕生日前日まで（障害等級1・2級の場合のみ）
  
  return childrenAges.filter((age): age is number => {
    if (age === null) return false;
    // 18歳到達年度末までの子（19歳未満）
    if (age < 19) return true;
    
    // 20歳未満の障害1・2級の子（障害等級が1級または2級の場合のみ）
    if (age >= 19 && age < 20 && (disabilityLevel === 1 || disabilityLevel === 2)) return true;
    
    return false;
  }).length;
}

/* ===================== 障害年金ロジック ===================== */
function calculateDisabilityBasicPension(level: DisabilityLevel, eligibleChildrenCount: number): number {
  const base = level === 1 ? BASE_1_LEVEL : BASE_2_LEVEL;

  let childAdd = 0;
  if (eligibleChildrenCount >= 1) childAdd += CHILD_ADD_1_2;
  if (eligibleChildrenCount >= 2) childAdd += CHILD_ADD_1_2;
  if (eligibleChildrenCount >= 3) {
    childAdd += (eligibleChildrenCount - 2) * CHILD_ADD_3P;
  }

  return base + childAdd;
}

/* ===================== 老齢年金ロジック ===================== */
// 老齢年金の繰上げ・繰下げ調整
function adjustOldAge(baseAt65: number, startAge: number): number {
  const diffYears = startAge - 65;
  const months = Math.abs(diffYears) * 12;
  // 繰上げ: 月▲0.4% / 繰下げ: 月＋0.7%
  const rate = diffYears < 0 ? 1 - 0.004 * months : 1 + 0.007 * months;
  return Math.round(baseAt65 * rate);
}

// 老齢厚生年金の報酬比例部分を計算（障害厚生年金と同じロジック）
function calculateOldAgeEmployeeProportion(
  periods: Array<{
    startDate: string;
    endDate: string;
    avgStdMonthlyBefore2003: number;
    avgStdAmountAfter2003: number;
  }>
): number {
  let totalProportion = 0;
  
  periods.forEach((period) => {
    if (period.startDate && period.endDate) {
      const { monthsBefore2003: mb, monthsAfter2003: ma } = splitMonthsBy2003(
        period.startDate,
        period.endDate
      );
      
      if (mb > 0) {
        totalProportion += (period.avgStdMonthlyBefore2003 || 0) * COEF_BEFORE_2003 * mb;
      }
      if (ma > 0) {
        totalProportion += (period.avgStdAmountAfter2003 || 0) * COEF_AFTER_2003 * ma;
      }
    }
  });

  // 300ヶ月特例適用
  let totalMonths = 0;
  periods.forEach((period) => {
    if (period.startDate && period.endDate) {
      const { monthsBefore2003: mb, monthsAfter2003: ma } = splitMonthsBy2003(
        period.startDate,
        period.endDate
      );
      totalMonths += mb + ma;
    }
  });

  if (totalMonths > 0 && totalMonths < MIN_MONTHS) {
    const shortage = MIN_MONTHS - totalMonths;
    const lastPeriod = periods[periods.length - 1];
    if (lastPeriod) {
      totalProportion += (lastPeriod.avgStdAmountAfter2003 || 0) * COEF_AFTER_2003 * shortage;
    }
  }

  return Math.max(0, totalProportion);
}

function calculateDisabilityEmployeePension(
  level: DisabilityLevel,
  avgStdMonthlyBefore2003: number,
  monthsBefore2003: number,
  avgStdAmountAfter2003: number,
  monthsAfter2003: number,
  hasSpouse: boolean
): number {
  // 報酬比例部分の計算
  // みなし300月：合計が300月未満の場合、不足月数を2003年4月以降の期間に割り振る（最低保障の特例）
  const totalMonths = monthsBefore2003 + monthsAfter2003;
  let monthsBefore = monthsBefore2003;
  let monthsAfter = monthsAfter2003;
  
  // 合計が0の場合（厚生年金に加入していない場合）、年金は受給できない
  if (totalMonths === 0) {
    return 0;
  }
  
  // 合計が300ヶ月未満の場合、不足月数を2003年4月以降の期間に割り振る
  if (totalMonths > 0 && totalMonths < MIN_MONTHS) {
    const shortage = MIN_MONTHS - totalMonths;
    monthsAfter = monthsAfter2003 + shortage;
  }

  const before2003 = (avgStdMonthlyBefore2003 || 0) * COEF_BEFORE_2003 * monthsBefore;
  const after2003 = (avgStdAmountAfter2003 || 0) * COEF_AFTER_2003 * monthsAfter;
  const proportion = before2003 + after2003;

  // 等級別の年金額
  let annual = 0;
  if (level === 1) {
    annual = proportion * 1.25;
    if (hasSpouse) annual += SPOUSE_ADD;
  } else if (level === 2) {
    annual = proportion;
    if (hasSpouse) annual += SPOUSE_ADD;
  } else if (level === 3) {
    annual = Math.max(proportion, MIN_LEVEL3);
  }

  return Math.max(0, annual);
}

/* ===================== 幾何（共有） ===================== */
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
        delta = 0;
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

/* ===================== Bars ===================== */
function PensionSegmentsBar({ segments, geometry }: { segments: Segment[]; geometry: Geometry }) {
  return (
    <div className="relative" style={{ width: geometry.used, height: BAR_HEIGHT }}>
      <div
        className="relative flex overflow-visible rounded-2xl border border-white/15"
        style={{ width: geometry.used, height: BAR_HEIGHT }}
      >
        {segments.map((s, i) => {
          const w = geometry.rawW[i];
          if (w <= 1) return null; // ゴミ幅除去
          const showText = w >= MIN_SEG_PX;
          const amountText = s.amountYear !== undefined ? formatYearMonthMan(s.amountYear) : '';
          const titleText = `${s.label}：${s.years}年`;
          return (
            <div
              key={i}
              className={`${s.className} ring-1 ring-white/15 relative flex flex-col justify-center items-stretch px-2 overflow-hidden`}
              style={{ width: w }}
              title={titleText}
            >
              {showText && (
                <>
                  <AutoFitLine text={amountText} maxRem={1.4} minScale={0.35} className="text-white font-bold" align="left" />
                  <AutoFitLine
                    text={titleText}
                    maxRem={1.0}
                    minScale={0.35}
                    className="text-white/90 mt-1"
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

// ヘルパー関数
function segmentEdgesYears(segments: { years: number }[]): number[] {
  const edges: number[] = [0];
  for (const s of segments) edges.push(edges[edges.length - 1] + (s.years || 0));
  return edges;
}

const widenYears = (y: number) => (y > 0 && y <= 3 ? 4 : y);

/* ===================== TimelineBlock ===================== */
function TimelineBlock({
  title,
  sublines,
  color,
  segments,
  ticks,
  breakdown,
}: {
  title: string;
  sublines?: string[];
  color: 'emerald' | 'sky' | 'amber';
  segments: Segment[];
  ticks: Tick[];
  breakdown?: BreakdownItem[];
}) {
  const border = color === 'emerald' ? 'border-emerald-500/40' : color === 'sky' ? 'border-sky-500/40' : 'border-amber-500/40';
  const bg = color === 'emerald' ? 'bg-emerald-900/20' : color === 'sky' ? 'bg-sky-900/20' : 'bg-amber-900/20';
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
      <div className="text-base font-semibold mb-1">{title}</div>
      {sublines && sublines.length > 0 && (
        <div className="mb-3 space-y-0.5">
          {sublines.map((line, i) => (
            <div key={i} className="text-xs opacity-90 leading-5 whitespace-pre-wrap">
              {line}
            </div>
          ))}
        </div>
      )}
      <div ref={measureRef} className="w-full h-0 overflow-hidden" />
      <PensionSegmentsBar segments={segments} geometry={geometry} />
      {breakdown && breakdown.length > 0 && (
        <Accordion title="年金額の内訳">
          <ul className="space-y-2">
            {breakdown.map((b, i) => (
              <li
                key={i}
                className="grid [grid-template-columns:1fr_minmax(220px,max-content)] items-start gap-3"
              >
                <div className="opacity-85 leading-tight whitespace-normal break-words">
                  <div>{b.label}</div>
                  {b.formula && (
                    <div className="text-[11px] opacity-75 mt-0.5 font-mono">{b.formula}</div>
                  )}
                </div>
                <div className="text-right font-mono tabular-nums whitespace-nowrap">
                  {formatExactYearMonth(b.annual)}
                </div>
              </li>
            ))}
          </ul>
        </Accordion>
      )}
      <AgeTicksBar ticks={ticksResolved} geometry={geometry} />
    </div>
  );
}

/* ===================== アコーディオン ===================== */
function Accordion({ title, children, defaultOpen = false, onClear }: { title: string; children: React.ReactNode; defaultOpen?: boolean; onClear?: () => void }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="mt-2">
      <div className="flex items-center gap-2">
        <button
          onClick={() => setOpen((v) => !v)}
          className="flex-1 text-left text-sm flex items-center justify-between px-3 py-2 rounded-md border border-slate-700 bg-slate-900/40 hover:bg-slate-900/60"
        >
          <span>{title}</span>
          <span className="text-xs opacity-80">{open ? '−' : '+'}</span>
        </button>
        {onClear && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onClear();
            }}
            className="px-3 py-2 text-xs rounded-md border border-slate-700 bg-slate-900/40 hover:bg-slate-900/60 text-slate-300 hover:text-slate-100"
            title="すべての入力値をクリア"
          >
            クリア
          </button>
        )}
      </div>
      {open && (
        <div className="text-sm px-3 py-2 border border-t-0 border-slate-700 rounded-b-md bg-slate-900/40">
          {children}
        </div>
      )}
    </div>
  );
}

/* ===================== 結果表示ブロック ===================== */
function ResultBlock({
  title,
  color,
  annual,
  breakdown,
  sublines,
}: {
  title: string;
  color: 'emerald' | 'sky' | 'amber';
  annual: number;
  breakdown: BreakdownItem[];
  sublines?: string[];
}) {
  const border = color === 'emerald' ? 'border-emerald-500/40' : color === 'sky' ? 'border-sky-500/40' : 'border-amber-500/40';
  const bg = color === 'emerald' ? 'bg-emerald-900/20' : color === 'sky' ? 'bg-sky-900/20' : 'bg-amber-900/20';

  return (
    <div className={`rounded-2xl ${border} ${bg} p-8 md:p-10 mb-8`}>
      <div className="text-base font-semibold mb-1">{title}</div>
      {sublines && sublines.length > 0 && (
        <div className="mb-3 space-y-0.5">
          {sublines.map((line, i) => (
            <div key={i} className="text-xs opacity-90 leading-5 whitespace-pre-wrap">
              {line}
            </div>
          ))}
        </div>
      )}

      <div className="mt-6 mb-4">
        <div className="text-2xl md:text-3xl font-bold text-center">
          {formatYearMonthMan(annual)}
        </div>
        <div className="text-sm text-center opacity-80 mt-2">
          詳細: {formatExactYearMonth(annual)}
        </div>
      </div>

      {breakdown && breakdown.length > 0 && (
        <Accordion title="年金額の内訳">
          <ul className="space-y-2">
            {breakdown.map((b, i) => (
              <li
                key={i}
                className="grid [grid-template-columns:1fr_minmax(220px,max-content)] items-start gap-3"
              >
                <div className="opacity-85 leading-tight whitespace-normal break-words">
                  <div>{b.label}</div>
                  {b.formula && (
                    <div className="text-[11px] opacity-75 mt-0.5 font-mono">{b.formula}</div>
                  )}
                </div>
                <div className="text-right font-mono tabular-nums whitespace-nowrap">
                  {formatExactYearMonth(b.annual)}
                </div>
              </li>
            ))}
          </ul>
        </Accordion>
      )}
    </div>
  );
}

/* ===================== 併給ルールまとめ（表示用） ===================== */
function RulesSummary() {
  const currentDate = new Date().toLocaleDateString('ja-JP', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  return (
    <div className="-mt-2">
      <Accordion title="🧩 このシミュレーターの前提" defaultOpen={false}>
        <div className="space-y-3">
        <div className="p-3 bg-amber-900/20 border border-amber-700/50 rounded-lg text-sm">
          <div className="font-semibold text-amber-200 mb-2">⚠️ 重要なお知らせ</div>
          <ul className="list-disc pl-5 space-y-1 text-xs opacity-90">
            <li>
              こちらの情報は（
              <a 
                href="https://www.nenkin.go.jp/" 
                target="_blank" 
                rel="noopener noreferrer"
                className="underline text-amber-300 hover:text-amber-200"
              >
                {currentDate}
              </a>
              ）の情報を元に構成されています。シミュレーターに表示された金額をお約束するものではございません。
            </li>
            <li>詳しい年金額は年金機構にご確認ください</li>
          </ul>
        </div>
        
        <div className="space-y-2">
          <div className="font-semibold">✅ 障害基礎年金の受給要件</div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>
              初診日が国民年金加入期間中、または20歳前、または60歳以上65歳未満の国内居住期間中
            </li>
            <li>障害認定日において、障害等級1級または2級に該当</li>
            <li>
              保険料納付要件：初診日の前々月までの被保険者期間で、納付済み＋免除期間が3分の2以上、または直近1年間に未納なし
            </li>
          </ul>
          <div className="font-semibold mt-3">✅ 障害厚生年金の受給要件</div>
          <ul className="list-disc pl-5 space-y-1 text-sm">
            <li>初診日が厚生年金被保険者期間中</li>
            <li>障害認定日において、障害等級1級・2級・3級に該当</li>
            <li>保険料納付要件：障害基礎年金と同様</li>
          </ul>
          <div className="text-xs opacity-80 mt-2">
            ※ 実際の受給には、初診日証明や診断書などの書類が必要です。個別の事情により異なる場合があります。
          </div>
        </div>
      </div>
    </Accordion>
    </div>
  );
}

/* ===================== タイムライン表示 ===================== */
function TimelineDisplay({
  age,
  disabilityTotal,
  disabilityBreakdown,
  color = 'emerald',
}: {
  age: number;
  disabilityTotal: number;
  disabilityBreakdown: BreakdownItem[];
  color?: 'emerald' | 'sky';
}) {
  const segments: Segment[] = useMemo(() => {
    const items: Segment[] = [];
    
    // 障害年金の期間（現在〜65歳）
    const yearsUntil65 = Math.max(0, 65 - age);
    if (yearsUntil65 > 0 && disabilityTotal > 0) {
      const bgColor = color === 'emerald' ? 'bg-emerald-600/80' : 'bg-sky-600/80';
      items.push({
        years: yearsUntil65,
        widthYears: widenYears(yearsUntil65),
        className: bgColor,
        label: '障害年金',
        amountYear: disabilityTotal,
      });
    }
    
    return items;
  }, [age, disabilityTotal, color]);

  const ticks: Tick[] = useMemo(() => {
    const items: Tick[] = [];
    const edges = segmentEdgesYears(segments);
    
    // 現在年齢
    items.push({
      edgeIndex: 0,
      labelLines: [`${age}歳`, '現在'],
    });
    
    // 65歳（障害年金終了）
    const yearsUntil65 = Math.max(0, 65 - age);
    if (yearsUntil65 > 0) {
      const idx = edges.findIndex((e) => Math.abs(e - yearsUntil65) < 0.1);
      if (idx >= 0) {
        items.push({
          edgeIndex: idx,
          labelLines: ['65歳', '支給終了'],
        });
      }
    }
    
    return items;
  }, [age, segments]);

  if (segments.length === 0) return null;

  return (
    <TimelineBlock
      title="障害年金の支給期間"
      color={color}
      segments={segments}
      ticks={ticks}
      breakdown={disabilityBreakdown}
    />
  );
}

/* ===================== ページ本体 ===================== */
export default function Page() {
  // 子の年齢
  const [childrenCount, setChildrenCount] = useState<number | null>(null);
  const [childrenAges, setChildrenAges] = useState<(number | null)[]>([]);
  
  // 妻のステータス
  const [ageWife, setAgeWife] = useState<number | null>(null);
  const [levelWife, setLevelWife] = useState<DisabilityLevel | null>(null);
  const [avgStdMonthlyWife, setAvgStdMonthlyWife] = useState<number | null>(null);
  const [employeePensionMonthsWife, setEmployeePensionMonthsWife] = useState<number | null>(null);
  const [useMinashi300Wife, setUseMinashi300Wife] = useState(false);
  
  // 夫のステータス
  const [ageHusband, setAgeHusband] = useState<number | null>(null);
  const [levelHusband, setLevelHusband] = useState<DisabilityLevel | null>(null);
  const [avgStdMonthlyHusband, setAvgStdMonthlyHusband] = useState<number | null>(null);
  const [employeePensionMonthsHusband, setEmployeePensionMonthsHusband] = useState<number | null>(null);
  const [useMinashi300Husband, setUseMinashi300Husband] = useState(false);


  // Customer Profileから基本情報を読み込む（既存値優先）
  useEffect(() => {
    const loadCustomerProfile = () => {
      if (typeof window !== 'undefined') {
        const savedBasic = localStorage.getItem('customer-profile-basic');
        if (savedBasic) {
          try {
            const basicInfo = JSON.parse(savedBasic);
            
            // 子の人数（既存値がnullまたはundefinedの場合のみ読み込む）
            setChildrenCount((prev) => {
              if ((prev === null || prev === undefined) && basicInfo.childrenCount !== undefined && basicInfo.childrenCount !== null) {
                return basicInfo.childrenCount;
              }
              return prev;
            });
            
            // 子の年齢（既存値が空の場合のみ読み込む）
            setChildrenAges((prev) => {
              if (prev.length === 0 && basicInfo.childrenAges && basicInfo.childrenAges.length > 0) {
                return [...basicInfo.childrenAges];
              }
              return prev;
            });
            
            // 妻の情報（既存値がnullまたは0の場合のみ読み込む）
            setAgeWife((prev) => {
              if ((prev === null || prev === 0) && basicInfo.ageWife !== undefined && basicInfo.ageWife !== null && basicInfo.ageWife !== 0) {
                return basicInfo.ageWife;
              }
              return prev;
            });
            setAvgStdMonthlyWife((prev) => {
              if ((prev === null || prev === 0) && basicInfo.avgStdMonthlyWife !== undefined && basicInfo.avgStdMonthlyWife !== null && basicInfo.avgStdMonthlyWife !== 0) {
                return basicInfo.avgStdMonthlyWife;
              }
              return prev;
            });
            setEmployeePensionMonthsWife((prev) => {
              if ((prev === null || prev === 0) && basicInfo.monthsWife !== undefined && basicInfo.monthsWife !== null && basicInfo.monthsWife !== 0) {
                return basicInfo.monthsWife;
              }
              return prev;
            });
            setUseMinashi300Wife((prev) => {
              // Customer Profileの値を常に優先（undefinedでない限り）
              if (basicInfo.useMinashi300Wife !== undefined) {
                return basicInfo.useMinashi300Wife;
              }
              // Customer Profileに値がない場合のみ、既存値を維持
              return prev;
            });
            
            // 夫の情報（既存値がnullまたは0の場合のみ読み込む）
            setAgeHusband((prev) => {
              if ((prev === null || prev === 0) && basicInfo.ageHusband !== undefined && basicInfo.ageHusband !== null && basicInfo.ageHusband !== 0) {
                return basicInfo.ageHusband;
              }
              return prev;
            });
            setAvgStdMonthlyHusband((prev) => {
              if ((prev === null || prev === 0) && basicInfo.avgStdMonthlyHusband !== undefined && basicInfo.avgStdMonthlyHusband !== null && basicInfo.avgStdMonthlyHusband !== 0) {
                return basicInfo.avgStdMonthlyHusband;
              }
              return prev;
            });
            setEmployeePensionMonthsHusband((prev) => {
              if ((prev === null || prev === 0) && basicInfo.monthsHusband !== undefined && basicInfo.monthsHusband !== null && basicInfo.monthsHusband !== 0) {
                return basicInfo.monthsHusband;
              }
              return prev;
            });
            setUseMinashi300Husband((prev) => {
              // Customer Profileの値を常に優先（undefinedでない限り）
              if (basicInfo.useMinashi300Husband !== undefined) {
                return basicInfo.useMinashi300Husband;
              }
              // Customer Profileに値がない場合のみ、既存値を維持
              return prev;
            });
          } catch (e) {
            console.error('Failed to load customer profile basic info:', e);
          }
        }
      }
    };

    // 初回読み込み
    loadCustomerProfile();

    // Customer Profileの変更を監視（同じウィンドウ内の変更も検知）
    // カスタムイベントリスナー（同じウィンドウ内の変更を検知）
    const handleStorageChange = () => {
      // 少し遅延させてから読み込み（localStorageの更新を確実に取得）
      setTimeout(() => {
        loadCustomerProfile();
      }, 100);
    };
    
    window.addEventListener('customer-profile-updated', handleStorageChange);
    
    // storageイベント（別ウィンドウでの変更を検知）
    const handleStorage = (e: StorageEvent) => {
      if (e.key === 'customer-profile-basic') {
        loadCustomerProfile();
      }
    };
    window.addEventListener('storage', handleStorage);
    
    // ページフォーカス時の再読み込み（Customer Profileページから戻ってきたとき）
    const handleFocus = () => {
      loadCustomerProfile();
    };
    window.addEventListener('focus', handleFocus);
    
    // visibilitychangeイベント（ページが表示されたとき）
    const handleVisibilityChange = () => {
      if (!document.hidden) {
        loadCustomerProfile();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      window.removeEventListener('customer-profile-updated', handleStorageChange);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, []); // 初回のみ設定


  // 子の人数が変更されたときに年齢配列を更新
  useEffect(() => {
    if (childrenCount === null) return;
    setChildrenAges((prev) => {
      if (prev.length < childrenCount) {
        // 子が増えた場合、年齢nullで追加
        return [...prev, ...Array(childrenCount - prev.length).fill(null)];
      } else if (prev.length > childrenCount) {
        // 子が減った場合、配列を縮小
        return prev.slice(0, childrenCount);
      }
      return prev;
    });
  }, [childrenCount]);

  // 妻の子の加算対象人数を計算
  const eligibleChildrenCountWife = useMemo(() => {
    if (levelWife === null) return 0;
    return calculateEligibleChildrenCount(childrenAges, levelWife);
  }, [childrenAges, levelWife]);

  // 夫の子の加算対象人数を計算
  const eligibleChildrenCountHusband = useMemo(() => {
    if (levelHusband === null) return 0;
    return calculateEligibleChildrenCount(childrenAges, levelHusband);
  }, [childrenAges, levelHusband]);

  // 妻が障害になった場合の計算
  // 障害基礎年金
  const basicPensionWife = useMemo(() => {
    if (levelWife === null || levelWife === 3) return 0; // 3級は基礎年金なし
    return calculateDisabilityBasicPension(levelWife, eligibleChildrenCountWife);
  }, [levelWife, eligibleChildrenCountWife]);
  
  // 夫が障害になった場合の計算
  // 障害基礎年金
  const basicPensionHusband = useMemo(() => {
    if (levelHusband === null || levelHusband === 3) return 0; // 3級は基礎年金なし
    return calculateDisabilityBasicPension(levelHusband, eligibleChildrenCountHusband);
  }, [levelHusband, eligibleChildrenCountHusband]);

  // 妻が障害になった場合の障害厚生年金の計算
  const employeePensionWife = useMemo(() => {
    if (avgStdMonthlyWife === null || employeePensionMonthsWife === null || levelWife === null) {
      return 0;
    }
    
    // 加入月数の決定（みなし300月チェックボックスの状態に応じて）
    let months = employeePensionMonthsWife;
    if (useMinashi300Wife && months > 0 && months < MIN_MONTHS) {
      months = MIN_MONTHS;
    }
    
    // 合計が0の場合、年金は受給できない
    if (months === 0) {
      return 0;
    }
    
    // 2003年4月以降の係数で計算（簡略化：すべて2003年4月以降として扱う）
    const totalProportion = (avgStdMonthlyWife || 0) * COEF_AFTER_2003 * months;
    
    // 300ヶ月特例：合計が300ヶ月未満の場合、不足月数を2003年4月以降に割り振る
    let finalProportion = totalProportion;
    if (!useMinashi300Wife && months > 0 && months < MIN_MONTHS) {
      const shortage = MIN_MONTHS - months;
      finalProportion += (avgStdMonthlyWife || 0) * COEF_AFTER_2003 * shortage;
    }
    
    // 等級別の年金額（妻が障害の場合、配偶者（夫）が入力されており65歳未満の場合は加算）
    let annual = 0;
    const hasSpouseWife = ageHusband !== null && ageHusband < 65 && ageHusband >= 0;
    if (levelWife === 1) {
      annual = finalProportion * 1.25;
      if (hasSpouseWife) annual += SPOUSE_ADD;
    } else if (levelWife === 2) {
      annual = finalProportion;
      if (hasSpouseWife) annual += SPOUSE_ADD;
    } else if (levelWife === 3) {
      annual = Math.max(finalProportion, MIN_LEVEL3);
    }
    
    return Math.max(0, annual);
  }, [avgStdMonthlyWife, employeePensionMonthsWife, useMinashi300Wife, levelWife, ageHusband]);

  const totalWife = basicPensionWife + employeePensionWife;

  // 夫が障害になった場合の障害厚生年金の計算
  const employeePensionHusband = useMemo(() => {
    if (avgStdMonthlyHusband === null || employeePensionMonthsHusband === null || levelHusband === null) {
      return 0;
    }
    
    // 加入月数の決定（みなし300月チェックボックスの状態に応じて）
    let months = employeePensionMonthsHusband;
    if (useMinashi300Husband && months > 0 && months < MIN_MONTHS) {
      months = MIN_MONTHS;
    }
    
    // 合計が0の場合、年金は受給できない
    if (months === 0) {
      return 0;
    }
    
    // 2003年4月以降の係数で計算（簡略化：すべて2003年4月以降として扱う）
    const totalProportion = (avgStdMonthlyHusband || 0) * COEF_AFTER_2003 * months;
    
    // 300ヶ月特例：合計が300ヶ月未満の場合、不足月数を2003年4月以降に割り振る
    let finalProportion = totalProportion;
    if (!useMinashi300Husband && months > 0 && months < MIN_MONTHS) {
      const shortage = MIN_MONTHS - months;
      finalProportion += (avgStdMonthlyHusband || 0) * COEF_AFTER_2003 * shortage;
    }
    
    // 等級別の年金額（夫が障害の場合、配偶者（妻）が入力されており65歳未満の場合は加算）
    let annual = 0;
    const hasSpouseHusband = ageWife !== null && ageWife < 65 && ageWife >= 0;
    if (levelHusband === 1) {
      annual = finalProportion * 1.25;
      if (hasSpouseHusband) annual += SPOUSE_ADD;
    } else if (levelHusband === 2) {
      annual = finalProportion;
      if (hasSpouseHusband) annual += SPOUSE_ADD;
    } else if (levelHusband === 3) {
      annual = Math.max(finalProportion, MIN_LEVEL3);
    }
    
    return Math.max(0, annual);
  }, [avgStdMonthlyHusband, employeePensionMonthsHusband, useMinashi300Husband, levelHusband, ageWife]);

  const totalHusband = basicPensionHusband + employeePensionHusband;

  // 妻が障害になった場合の内訳
  const breakdownBasicWife: BreakdownItem[] = useMemo(() => {
    if (levelWife === null || levelWife === 3) return [];
    const items: BreakdownItem[] = [];
    const base = levelWife === 1 ? BASE_1_LEVEL : BASE_2_LEVEL;
    items.push({
      label: `障害基礎年金（${levelWife}級）`,
      annual: base,
      formula: levelWife === 1 ? '1,039,625円（1級）' : '831,700円（2級）',
    });

    if (eligibleChildrenCountWife >= 1) {
      items.push({
        label: `子の加算（第1子）`,
        annual: CHILD_ADD_1_2,
        formula: '239,300円',
      });
    }
    if (eligibleChildrenCountWife >= 2) {
      items.push({
        label: `子の加算（第2子）`,
        annual: CHILD_ADD_1_2,
        formula: '239,300円',
      });
    }
    if (eligibleChildrenCountWife >= 3) {
      const additional = (eligibleChildrenCountWife - 2) * CHILD_ADD_3P;
      items.push({
        label: `子の加算（第3子以降×${eligibleChildrenCountWife - 2}人）`,
        annual: additional,
        formula: `${eligibleChildrenCountWife - 2}人 × 79,800円`,
      });
    }

    return items;
  }, [levelWife, eligibleChildrenCountWife]);

  // 夫が障害になった場合の内訳
  const breakdownBasicHusband: BreakdownItem[] = useMemo(() => {
    if (levelHusband === null || levelHusband === 3) return [];
    const items: BreakdownItem[] = [];
    const base = levelHusband === 1 ? BASE_1_LEVEL : BASE_2_LEVEL;
    items.push({
      label: `障害基礎年金（${levelHusband}級）`,
      annual: base,
      formula: levelHusband === 1 ? '1,039,625円（1級）' : '831,700円（2級）',
    });

    if (eligibleChildrenCountHusband >= 1) {
      items.push({
        label: `子の加算（第1子）`,
        annual: CHILD_ADD_1_2,
        formula: '239,300円',
      });
    }
    if (eligibleChildrenCountHusband >= 2) {
      items.push({
        label: `子の加算（第2子）`,
        annual: CHILD_ADD_1_2,
        formula: '239,300円',
      });
    }
    if (eligibleChildrenCountHusband >= 3) {
      const additional = (eligibleChildrenCountHusband - 2) * CHILD_ADD_3P;
      items.push({
        label: `子の加算（第3子以降×${eligibleChildrenCountHusband - 2}人）`,
        annual: additional,
        formula: `${eligibleChildrenCountHusband - 2}人 × 79,800円`,
      });
    }

    return items;
  }, [levelHusband, eligibleChildrenCountHusband]);

  // 妻が障害になった場合の障害厚生年金の内訳
  const breakdownEmployeeWife: BreakdownItem[] = useMemo(() => {
    if (avgStdMonthlyWife === null || employeePensionMonthsWife === null || levelWife === null) {
      return [];
    }

    // 加入月数の決定（みなし300月チェックボックスの状態に応じて）
    let months = employeePensionMonthsWife;
    let shortageApplied = 0;
    if (useMinashi300Wife && months > 0 && months < MIN_MONTHS) {
      months = MIN_MONTHS;
    } else if (!useMinashi300Wife && months > 0 && months < MIN_MONTHS) {
      shortageApplied = MIN_MONTHS - months;
    }

    // 合計が0の場合（厚生年金に加入していない場合）、内訳は空
    if (months === 0 && shortageApplied === 0) {
      return [];
    }

    const items: BreakdownItem[] = [];

    // 報酬比例部分（2003年4月以降として計算）
    const actualMonths = useMinashi300Wife && employeePensionMonthsWife > 0 && employeePensionMonthsWife < MIN_MONTHS 
      ? MIN_MONTHS 
      : employeePensionMonthsWife;
    const proportion = (avgStdMonthlyWife || 0) * COEF_AFTER_2003 * actualMonths;
    
    if (proportion > 0) {
      items.push({
        label: '報酬比例部分（2003年4月以降）',
        annual: proportion,
        formula: `平均標準報酬月額 ${(avgStdMonthlyWife || 0).toLocaleString('ja-JP')}円 × 5.481/1,000 × ${actualMonths}月`,
      });
    }

    // 300ヶ月特例適用の表示
    if (shortageApplied > 0) {
      const addedAmount = (avgStdMonthlyWife || 0) * COEF_AFTER_2003 * shortageApplied;
      items.push({
        label: '300ヶ月特例適用（不足月数の割り振り）',
        annual: addedAmount,
        formula: `不足月数${shortageApplied}ヶ月 × 平均標準報酬月額 ${(avgStdMonthlyWife || 0).toLocaleString('ja-JP')}円 × 5.481/1,000`,
      });
    }

    // 等級別の年金額
    const totalProportion = proportion + (shortageApplied > 0 ? (avgStdMonthlyWife || 0) * COEF_AFTER_2003 * shortageApplied : 0);
    if (totalProportion > 0) {
      if (levelWife === 1) {
        items.push({
          label: `等級調整（${levelWife}級は1.25倍）`,
          annual: totalProportion * 1.25,
          formula: `報酬比例 ${totalProportion.toLocaleString('ja-JP')}円 × 1.25`,
        });
      } else if (levelWife === 2) {
        items.push({
          label: `報酬比例部分（${levelWife}級）`,
          annual: totalProportion,
        });
      } else if (levelWife === 3) {
        const adjusted = Math.max(totalProportion, MIN_LEVEL3);
        if (adjusted === MIN_LEVEL3 && totalProportion < MIN_LEVEL3) {
          items.push({
            label: `最低保障額適用（3級）`,
            annual: MIN_LEVEL3,
            formula: `報酬比例 ${totalProportion.toLocaleString('ja-JP')}円 < 最低保障額 ${MIN_LEVEL3.toLocaleString('ja-JP')}円`,
          });
        } else {
          items.push({
            label: `報酬比例部分（${levelWife}級）`,
            annual: totalProportion,
          });
        }
      }
    }

    // 妻が障害の場合、配偶者（夫）が入力されており65歳未満なら加算
    const hasSpouseWife = ageHusband !== null && ageHusband < 65 && ageHusband >= 0;
    if (hasSpouseWife && (levelWife === 1 || levelWife === 2)) {
      items.push({
        label: '配偶者加給年金額',
        annual: SPOUSE_ADD,
        formula: '224,700円（65歳未満の配偶者がいる場合）',
      });
    }
    
    return items;
  }, [avgStdMonthlyWife, employeePensionMonthsWife, useMinashi300Wife, levelWife, ageHusband]);

  // 夫が障害になった場合の障害厚生年金の内訳
  const breakdownEmployeeHusband: BreakdownItem[] = useMemo(() => {
    if (avgStdMonthlyHusband === null || employeePensionMonthsHusband === null || levelHusband === null) {
      return [];
    }

    // 加入月数の決定（みなし300月チェックボックスの状態に応じて）
    let months = employeePensionMonthsHusband;
    let shortageApplied = 0;
    if (useMinashi300Husband && months > 0 && months < MIN_MONTHS) {
      months = MIN_MONTHS;
    } else if (!useMinashi300Husband && months > 0 && months < MIN_MONTHS) {
      shortageApplied = MIN_MONTHS - months;
    }

    // 合計が0の場合（厚生年金に加入していない場合）、内訳は空
    if (months === 0 && shortageApplied === 0) {
      return [];
    }

    const items: BreakdownItem[] = [];

    // 報酬比例部分（2003年4月以降として計算）
    const actualMonths = useMinashi300Husband && employeePensionMonthsHusband > 0 && employeePensionMonthsHusband < MIN_MONTHS 
      ? MIN_MONTHS 
      : employeePensionMonthsHusband;
    const proportion = (avgStdMonthlyHusband || 0) * COEF_AFTER_2003 * actualMonths;
    
    if (proportion > 0) {
      items.push({
        label: '報酬比例部分（2003年4月以降）',
        annual: proportion,
        formula: `平均標準報酬月額 ${(avgStdMonthlyHusband || 0).toLocaleString('ja-JP')}円 × 5.481/1,000 × ${actualMonths}月`,
      });
    }

    // 300ヶ月特例適用の表示
    if (shortageApplied > 0) {
      const addedAmount = (avgStdMonthlyHusband || 0) * COEF_AFTER_2003 * shortageApplied;
      items.push({
        label: '300ヶ月特例適用（不足月数の割り振り）',
        annual: addedAmount,
        formula: `不足月数${shortageApplied}ヶ月 × 平均標準報酬月額 ${(avgStdMonthlyHusband || 0).toLocaleString('ja-JP')}円 × 5.481/1,000`,
      });
    }

    // 等級別の年金額
    const totalProportion = proportion + (shortageApplied > 0 ? (avgStdMonthlyHusband || 0) * COEF_AFTER_2003 * shortageApplied : 0);
    if (totalProportion > 0) {
      if (levelHusband === 1) {
        items.push({
          label: `等級調整（${levelHusband}級は1.25倍）`,
          annual: totalProportion * 1.25,
          formula: `報酬比例 ${totalProportion.toLocaleString('ja-JP')}円 × 1.25`,
        });
      } else if (levelHusband === 2) {
        items.push({
          label: `報酬比例部分（${levelHusband}級）`,
          annual: totalProportion,
        });
      } else if (levelHusband === 3) {
        const adjusted = Math.max(totalProportion, MIN_LEVEL3);
        if (adjusted === MIN_LEVEL3 && totalProportion < MIN_LEVEL3) {
          items.push({
            label: `最低保障額適用（3級）`,
            annual: MIN_LEVEL3,
            formula: `報酬比例 ${totalProportion.toLocaleString('ja-JP')}円 < 最低保障額 ${MIN_LEVEL3.toLocaleString('ja-JP')}円`,
          });
        } else {
          items.push({
            label: `報酬比例部分（${levelHusband}級）`,
            annual: totalProportion,
          });
        }
      }
    }

    // 夫が障害の場合、配偶者（妻）が入力されており65歳未満なら加算
    const hasSpouseHusband = ageWife !== null && ageWife < 65 && ageWife >= 0;
    if (hasSpouseHusband && (levelHusband === 1 || levelHusband === 2)) {
      items.push({
        label: '配偶者加給年金額',
        annual: SPOUSE_ADD,
        formula: '224,700円（65歳未満の配偶者がいる場合）',
      });
    }
    
    return items;
  }, [avgStdMonthlyHusband, employeePensionMonthsHusband, useMinashi300Husband, levelHusband, ageWife]);

  return (
    <main className="p-6 lg:p-10 max-w-6xl mx-auto text-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">障害年金シミュレーター</h1>
        <Link
          href="/simulators/customer-profile"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-600 bg-slate-800 hover:bg-slate-700 text-xl font-bold"
          title="Customer Profileを開く"
        >
          +
        </Link>
      </div>
      <div className="mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        <RulesSummary />
        <Link
          href="/simulators/disability-pension/rules"
          className="inline-flex items-center gap-2 rounded-md border border-sky-700/50 bg-sky-900/20 px-3 py-2 text-sm text-sky-200 underline hover:bg-sky-900/30"
        >
          📘 障害年金について（解説ページ）
        </Link>
      </div>

      {/* 入力ブロック */}
      <section className="mb-8">
        <Accordion 
          title="基本情報" 
          defaultOpen={true}
          onClear={() => {
            setChildrenCount(null);
            setChildrenAges([]);
            setAgeWife(null);
            setLevelWife(null);
            setAvgStdMonthlyWife(null);
            setEmployeePensionMonthsWife(null);
            setUseMinashi300Wife(false);
            setAgeHusband(null);
            setLevelHusband(null);
            setAvgStdMonthlyHusband(null);
            setEmployeePensionMonthsHusband(null);
            setUseMinashi300Husband(false);
          }}
        >
          {/* 反映されている情報を表示 */}
          {(() => {
            const sourceInfo: string[] = [];
            if (typeof window !== 'undefined') {
              const savedBasic = localStorage.getItem('customer-profile-basic');
              if (savedBasic) {
                try {
                  const basicInfo = JSON.parse(savedBasic);
                  // Customer Profileから情報が読み込まれているかチェック
                  const hasDataFromProfile = 
                    (childrenCount !== null && basicInfo.childrenCount !== undefined && childrenCount === basicInfo.childrenCount) ||
                    (ageWife !== null && basicInfo.ageWife !== undefined && ageWife === basicInfo.ageWife) ||
                    (ageHusband !== null && basicInfo.ageHusband !== undefined && ageHusband === basicInfo.ageHusband) ||
                    (avgStdMonthlyWife !== null && basicInfo.avgStdMonthlyWife !== undefined && avgStdMonthlyWife === basicInfo.avgStdMonthlyWife) ||
                    (avgStdMonthlyHusband !== null && basicInfo.avgStdMonthlyHusband !== undefined && avgStdMonthlyHusband === basicInfo.avgStdMonthlyHusband) ||
                    (employeePensionMonthsWife !== null && basicInfo.monthsWife !== undefined && employeePensionMonthsWife === basicInfo.monthsWife) ||
                    (employeePensionMonthsHusband !== null && basicInfo.monthsHusband !== undefined && employeePensionMonthsHusband === basicInfo.monthsHusband);
                  
                  if (hasDataFromProfile) {
                    if (basicInfo.spouseType === 'couple') {
                      sourceInfo.push('Customer Profile（妻・夫の情報）');
                    } else if (basicInfo.spouseType === 'none') {
                      sourceInfo.push('Customer Profile（本人の情報）');
                    } else {
                      sourceInfo.push('Customer Profile');
                    }
                  }
                } catch (e) {
                  // エラーは無視
                }
              }
            }
            if (sourceInfo.length > 0) {
              return (
                <div className="p-3 bg-sky-900/20 border border-sky-700/50 rounded-lg text-sm mb-4">
                  <div className="font-semibold text-sky-200 mb-1">反映されている情報</div>
                  <div className="text-xs opacity-80">{sourceInfo.join('、')}から読み込まれています</div>
                </div>
              );
            }
            return null;
          })()}
          
          <div className="grid gap-6 md:grid-cols-4">
            <Card className="p-6">
              <Label>子の人数</Label>
              <SelectSimple
                value={childrenCount}
                setValue={setChildrenCount}
                options={[
                  { value: null, label: '--' },
                  ...Array.from({ length: 6 }, (_, i) => ({ value: i, label: `${i}人` })),
                ]}
              />
              <Hint>※ 18歳到達年度末までの子、または20歳未満の障害1・2級の子</Hint>
              {childrenCount !== null && childrenCount > 0 && (
                <div className="mt-3 space-y-2">
                  <Label className="text-xs opacity-70">子の年齢</Label>
                  {Array.from({ length: childrenCount }, (_, i) => (
                    <div key={i} className="grid grid-cols-[auto,1fr] items-center gap-2">
                      <span className="text-xs opacity-80">子{i + 1}</span>
                      {i < 2 ? (
                        <SelectSimple
                          value={childrenAges[i] ?? null}
                          setValue={(v) => {
                            const newAges = [...childrenAges];
                            newAges[i] = v ?? null;
                            setChildrenAges(newAges);
                          }}
                          options={[
                            { value: null, label: '--' },
                            ...Array.from({ length: 19 }, (_, j) => {
                              const ageValue = j; // 0歳から18歳まで
                              return { value: ageValue, label: `${ageValue}歳` };
                            }),
                          ]}
                        />
                      ) : (
                        <InputNumber
                          value={childrenAges[i] ?? null}
                          setValue={(v) => {
                            const newAges = [...childrenAges];
                            newAges[i] = v;
                            setChildrenAges(newAges);
                          }}
                          min={0}
                        />
                      )}
                    </div>
                  ))}
                  {(eligibleChildrenCountWife > 0 || eligibleChildrenCountHusband > 0) && (
                    <Hint>加算対象: 妻{eligibleChildrenCountWife}人、夫{eligibleChildrenCountHusband}人</Hint>
                  )}
                </div>
              )}
            </Card>

            <Card className="p-6 border-r border-slate-700">
              <div className="font-semibold mb-2">妻のステータス</div>
              <Label>年齢</Label>
              <SelectAge value={ageWife} setValue={setAgeWife} min={18} max={100} />
              
              <div className="mt-3">
                <Label className="opacity-70 text-xs">障害等級</Label>
                <SelectSimple
                  value={levelWife}
                  setValue={setLevelWife}
                  options={[
                    { value: null, label: '--' },
                    { value: 1, label: '1級' },
                    { value: 2, label: '2級' },
                    { value: 3, label: '3級' },
                  ]}
                />
                <Hint>※ 3級は障害厚生年金のみ（障害基礎年金なし）</Hint>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <Label className="opacity-70 text-xs">平均標準報酬月額</Label>
                <SelectYenStep
                  value={avgStdMonthlyWife}
                  setValue={setAvgStdMonthlyWife}
                  min={50_000}
                  max={2_000_000}
                  step={10_000}
                />
                <Hint>※2003年4月以降の値として扱います</Hint>
              </div>

              <div className="mt-3">
                <Label className="opacity-70 text-xs">厚生年金加入月数</Label>
                <InputNumber
                  value={employeePensionMonthsWife}
                  setValue={setEmployeePensionMonthsWife}
                  min={0}
                />
              </div>

              <div className="mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMinashi300Wife}
                    onChange={(e) => setUseMinashi300Wife(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm">みなし300月</span>
                </label>
                <Hint>※チェックを入れると、1〜299月は300月として計算します。チェックを外すと、1〜299月は入力値そのまま計算します（300月未満の場合は300月特例が適用されます）。</Hint>
              </div>
            </Card>

            <Card className="p-6 pl-6">
              <div className="font-semibold mb-2">夫のステータス</div>
              <Label>年齢</Label>
              <SelectAge value={ageHusband} setValue={setAgeHusband} min={18} max={100} />
              
              <div className="mt-3">
                <Label className="opacity-70 text-xs">障害等級</Label>
                <SelectSimple
                  value={levelHusband}
                  setValue={setLevelHusband}
                  options={[
                    { value: null, label: '--' },
                    { value: 1, label: '1級' },
                    { value: 2, label: '2級' },
                    { value: 3, label: '3級' },
                  ]}
                />
                <Hint>※ 3級は障害厚生年金のみ（障害基礎年金なし）</Hint>
              </div>

              <div className="mt-4 pt-4 border-t border-slate-700">
                <Label className="opacity-70 text-xs">平均標準報酬月額</Label>
                <SelectYenStep
                  value={avgStdMonthlyHusband}
                  setValue={setAvgStdMonthlyHusband}
                  min={50_000}
                  max={2_000_000}
                  step={10_000}
                />
                <Hint>※2003年4月以降の値として扱います</Hint>
              </div>

              <div className="mt-3">
                <Label className="opacity-70 text-xs">厚生年金加入月数</Label>
                <InputNumber
                  value={employeePensionMonthsHusband}
                  setValue={setEmployeePensionMonthsHusband}
                  min={0}
                />
              </div>

              <div className="mt-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={useMinashi300Husband}
                    onChange={(e) => setUseMinashi300Husband(e.target.checked)}
                    className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-600 focus:ring-sky-500"
                  />
                  <span className="text-sm">みなし300月</span>
                </label>
                <Hint>※チェックを入れると、1〜299月は300月として計算します。チェックを外すと、1〜299月は入力値そのまま計算します（300月未満の場合は300月特例が適用されます）。</Hint>
              </div>
            </Card>
          </div>
        </Accordion>
      </section>

      {/* 結果表示 */}
      <section className="grid grid-cols-1 gap-10">
        {/* 入力が不完全な場合のメッセージ */}
        {(childrenCount === null || 
          (ageWife === null && ageHusband === null) ||
          ((ageWife !== null && (levelWife === null || avgStdMonthlyWife === null || employeePensionMonthsWife === null))) ||
          ((ageHusband !== null && (levelHusband === null || avgStdMonthlyHusband === null || employeePensionMonthsHusband === null)))) ? (
          <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
            <p className="text-sm text-amber-200">上記の入力項目を入力してください。</p>
          </div>
        ) : (
          <>
            {/* 妻が障害になった場合（妻の情報が入力されている場合のみ表示） */}
            {ageWife !== null && levelWife !== null && avgStdMonthlyWife !== null && employeePensionMonthsWife !== null && 
             totalWife > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4">妻が障害になった場合</h2>
                <TimelineDisplay
                  age={ageWife}
                  disabilityTotal={totalWife}
                  disabilityBreakdown={[...breakdownBasicWife, ...breakdownEmployeeWife]}
                  color="emerald"
                />
              </div>
            )}

            {/* 夫が障害になった場合（夫の情報が入力されている場合のみ表示） */}
            {ageHusband !== null && levelHusband !== null && avgStdMonthlyHusband !== null && employeePensionMonthsHusband !== null && 
             totalHusband > 0 && (
              <div>
                <h2 className="text-xl font-bold mb-4">夫が障害になった場合</h2>
                <TimelineDisplay
                  age={ageHusband}
                  disabilityTotal={totalHusband}
                  disabilityBreakdown={[...breakdownBasicHusband, ...breakdownEmployeeHusband]}
                  color="sky"
                />
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

/* ===================== 小UI ===================== */
function Card({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <div className={'bg-slate-900/60 border border-slate-700 rounded-xl ' + className}>{children}</div>;
}

function Label({ children, className = '' }: { children: React.ReactNode; className?: string }) {
  return <label className={'block text-sm ' + className}>{children}</label>;
}

function Hint({ children }: { children: React.ReactNode }) {
  return <p className="text-xs opacity-70 mt-1">{children}</p>;
}

function InputNumber({
  value,
  setValue,
  min,
}: {
  value: number | null;
  setValue: (n: number | null) => void;
  min?: number;
}) {
  // 全角数字を半角に変換
  const convertToHalfWidth = (str: string): string => {
    return str.replace(/[０-９]/g, (s) => {
      return String.fromCharCode(s.charCodeAt(0) - 0xFEE0);
    });
  };

  return (
    <input
      type="text"
      className="mt-1 w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
      value={value === null ? '--' : String(value)}
      onChange={(e) => {
        // 全角数字を半角に変換
        const converted = convertToHalfWidth(e.target.value);
        const v = converted.trim();
        if (v === '' || v === '--') {
          setValue(null);
        } else {
          const num = parseInt(v, 10);
          if (!isNaN(num)) {
            setValue(num);
          }
        }
      }}
      onBlur={(e) => {
        // 確定時にも全角→半角変換を適用
        const converted = convertToHalfWidth(e.target.value);
        if (converted !== e.target.value) {
          e.target.value = converted;
          const v = converted.trim();
          if (v === '' || v === '--') {
            setValue(null);
          } else {
            const num = parseInt(v, 10);
            if (!isNaN(num)) {
              setValue(num);
            }
          }
        }
      }}
      placeholder="--"
    />
  );
}

function SelectYenStep({
  value,
  setValue,
  min = 50_000,
  max = 2_000_000,
  step = 10_000,
}: {
  value: number | null;
  setValue: (n: number | null) => void;
  min?: number;
  max?: number;
  step?: number;
}) {
  const opts: number[] = [];
  for (let v = min; v <= max; v += step) opts.push(v);
  return (
    <select
      className="mt-1 w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
      value={value ?? ''}
      onChange={(e) => setValue(e.target.value === '' ? null : parseInt(e.target.value, 10))}
    >
      <option value="">--</option>
      {opts.map((v) => (
        <option key={v} value={v}>
          {v.toLocaleString('ja-JP')}円
        </option>
      ))}
    </select>
  );
}

function SelectAge({
  value,
  setValue,
  min = 0,
  max = 100,
}: {
  value: number | null;
  setValue: (n: number | null) => void;
  min?: number;
  max?: number;
}) {
  const ages: number[] = [];
  for (let a = min; a <= max; a++) ages.push(a);
  return (
    <select
      className="mt-1 w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
      value={value ?? ''}
      onChange={(e) => setValue(e.target.value === '' ? null : parseInt(e.target.value, 10))}
    >
      <option value="">--</option>
      {ages.map((a) => (
        <option key={a} value={a}>
          {a}
        </option>
      ))}
    </select>
  );
}

function SelectSimple<T extends number | string | null>({
  value,
  setValue,
  options,
}: {
  value: T;
  setValue: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <select
      className="mt-1 w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
      value={value === null ? '' : String(value)}
      onChange={(e) => {
        const raw = e.target.value;
        if (raw === '') {
          setValue(null as T);
        } else {
          const cast =
            typeof value === 'number' || (value === null && options[0]?.value !== null && typeof options[0].value === 'number')
              ? (parseInt(raw, 10) as unknown as T)
              : (raw as unknown as T);
          setValue(cast);
        }
      }}
    >
      {options.map((o) => (
        <option key={String(o.value)} value={String(o.value)}>
          {o.label}
        </option>
      ))}
    </select>
  );
}

// 日付入力（YYYY/MM/DD）
function InputDate({
  value,
  setValue,
}: {
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder="YYYY/MM/DD"
      className="mt-1 w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600 font-mono"
      value={value}
      onChange={(e) => {
        let v = e.target.value.replace(/[^0-9/]/g, '');
        // YYYY/MM/DD形式に自動フォーマット
        if (v.length >= 5 && v[4] !== '/') {
          v = v.slice(0, 4) + '/' + v.slice(4);
        }
        if (v.length >= 8 && v[7] !== '/') {
          v = v.slice(0, 7) + '/' + v.slice(7);
        }
        if (v.length > 10) v = v.slice(0, 10);
        setValue(v);
      }}
    />
  );
}

// 年月入力（YYYY/MM）
function InputYearMonth({
  value,
  setValue,
}: {
  value: string;
  setValue: (v: string) => void;
}) {
  return (
    <input
      type="text"
      placeholder="YYYY/MM"
      className="mt-1 w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600 font-mono"
      value={value}
      onChange={(e) => {
        let v = e.target.value.replace(/[^0-9/]/g, '');
        // YYYY/MM形式に自動フォーマット
        if (v.length >= 5 && v[4] !== '/') {
          v = v.slice(0, 4) + '/' + v.slice(4);
        }
        if (v.length > 7) v = v.slice(0, 7);
        setValue(v);
      }}
    />
  );
}

