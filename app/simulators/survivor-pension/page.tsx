'use client';

import React, { useMemo, useState, useLayoutEffect, useRef, useEffect } from 'react';
import Link from 'next/link';

/* ===================== 定数 ===================== */
const KISO_BASE = 831_700; // 遺族基礎の基準額（年）
const CHILD_ADD_1_2 = 239_300; // 子1・2人目の加算（年）
const CHILD_ADD_3P = 79_800; // 子3人目以降の加算（年）
const CHUKOREI_KASAN = 623_800; // 中高齢寡婦加算（年）
const COEF_POST2003 = 5.481 / 1000; // 老齢厚生の乗率（簡易）
const MIN_MONTHS = 300; // 老齢厚生の最低みなし月数

const MIN_SEG_PX = 72; // セグメント最小幅（可読性確保）
const BAR_HEIGHT = 96; // h-24 相当
const OLD_AGE_END = 100; // 老齢年金は100歳まで表示する前提

/** 型 **/
type PolicyMode = 'current' | 'revised2028';
// 老齢年金開始年齢（このシミュレーターでは 60〜75 歳の範囲で使用）
type OldAgeStart = number;

type Segment = {
  years: number;
  widthYears?: number;
  className: string;
  label: string;
  amountYear?: number;
};
// ⚠️ 年齢バーのズレ防止のため、px指定を優先。edgeIndex があれば TimelineBlock 側で px に解決する。
type Tick = {
  posYears?: number;
  posPx?: number;
  edgeIndex?: number;
  labelLines: string[];
};
type Geometry = { used: number; edgesRaw: number[]; totalYears: number; rawW: number[] };

type BreakdownItem = { label: string; annual: number; formula?: string };

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

/* ===================== 年金ロジック（簡易） ===================== */
function proportionAnnual(avgStdMonthly: number | null, months: number | null, useMinashi300: boolean = true) {
  // 0 → 0、1〜299 → みなし300（チェック時）または入力値そのまま（未チェック時）、300+ → そのまま
  if (months === null || months <= 0 || avgStdMonthly === null || avgStdMonthly <= 0) return 0;
  const m = useMinashi300 && months > 0 && months < MIN_MONTHS ? MIN_MONTHS : months;
  return avgStdMonthly * COEF_POST2003 * m;
}
function kisoAnnualByCount(count: number) {
  if (count <= 0) return 0;
  if (count === 1) return KISO_BASE + CHILD_ADD_1_2;
  if (count === 2) return KISO_BASE + CHILD_ADD_1_2 * 2;
  return KISO_BASE + CHILD_ADD_1_2 * 2 + (count - 2) * CHILD_ADD_3P;
}
function deriveChildren(childrenAges: (number | null)[]) {
  const eligible = childrenAges.filter((a): a is number => a !== null && a < 18).sort((a, b) => a - b);
  return {
    eligibleCount: eligible.length,
    youngest: eligible[0],
    secondYoungest: eligible[1],
    eligibleAges: eligible,
  } as { eligibleCount: number; youngest?: number; secondYoungest?: number; eligibleAges: number[] };
}
function adjustOldAge(baseAt65: number, startAge: OldAgeStart | null) {
  if (startAge === null) return baseAt65;
  const diffYears = startAge - 65;
  const months = Math.abs(diffYears) * 12;
  const rate = diffYears < 0 ? 1 - 0.004 * months : 1 + 0.007 * months; // 繰上げ/繰下げの概算
  return Math.round(baseAt65 * rate);
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
      const box = boxRef.current,
        t = textRef.current;
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

/* ===================== 幾何（共有） ===================== */
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
          <div className="font-semibold">✅ 同時にもらえる組み合わせ</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              老齢基礎 ＋ （老齢厚生 <span className="opacity-70">または</span> 遺族厚生）の
              <span className="underline">高い方</span>（老齢開始後）
            </li>
          </ul>
          <div className="font-semibold mt-3">❌ 同時にもらえない（どちらか選択）</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              （妻）
              <span className="font-medium">中高齢寡婦加算を伴う遺族年金</span> と{' '}
              <span className="font-medium">老齢年金（60〜64の繰上げ）</span> は
              <span className="underline">同時不可</span>。60歳を選択したら、60到達で加算は終了し老齢へ切替。
            </li>
            <li>厚生系（老齢厚生 と 遺族厚生）は高い方のみを採用。</li>
          </ul>
          <div className="text-xs opacity-80 mt-2">
            ※ 改正2028モード（試作）では「子のいない配偶者の遺族厚生は原則5年有期／中高齢寡婦加算は使わない」という前提で簡易表示しています。
          </div>
          <div className="text-xs opacity-80 mt-1">
            ※ 表示は「子がいる期間」→「子が0後（妻/夫）〜老齢開始まで」→「老齢開始後（妻/夫）」の順。
          </div>
        </div>
      </div>
    </Accordion>
    </div>
  );
}

/* ===================== 共通ヘルパー ===================== */
function childLabels(childrenAges: number[], childrenCount: number, offsetYears: number, capAt18 = false): string[] {
  const lines: string[] = [];
  const n = Math.max(0, Math.min(childrenCount, childrenAges.length));
  for (let i = 0; i < n; i++) {
    const a = childrenAges[i] ?? 0;
    const now = a + offsetYears;
    lines.push(`子${capAt18 ? Math.min(18, now) : now}`);
  }
  return lines;
}
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
  color: 'emerald' | 'sky';
  segments: Segment[];
  ticks: Tick[];
  breakdown?: BreakdownItem[];
}) {
  const border = color === 'emerald' ? 'border-emerald-500/40' : 'border-sky-500/40';
  const bg = color === 'emerald' ? 'bg-emerald-900/20' : 'bg-sky-900/20';
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

/* ========== 子がいる期間 ========== */
function deriveChildPhases(childrenAges: number[]): { years: number; count: number }[] {
  const remain = childrenAges.map((a) => Math.max(0, 18 - a)).sort((a, b) => a - b); // 小→大
  if (remain.length === 0) return [];
  const cuts = [0, ...remain];
  const phases: { years: number; count: number }[] = [];
  for (let i = 0; i < cuts.length - 1; i++) {
    const years = cuts[i + 1] - cuts[i];
    const count = remain.length - i;
    if (years > 0) phases.push({ years, count });
  }
  return phases;
}

function TimelineChildren({
  color,
  holderLabel,
  holderAge,
  childrenCount,
  koseiNow,
  childrenAges,
  oldAgeStart,
}: {
  color: 'emerald' | 'sky';
  holderLabel: '妻' | '夫';
  holderAge: number;
  childrenCount: number;
  koseiNow: number;
  childrenAges: number[];
  oldAgeStart: OldAgeStart;
}) {
  const phases = deriveChildPhases(childrenAges.slice(0, childrenCount));
  if (phases.length === 0) return null;

  const epiPortion = Math.max(0, koseiNow || 0);

  // フェーズごとの色パレット（同じセグメント内だけ段階的に変える）
  const emeraldPalette = ['bg-emerald-500/80', 'bg-emerald-400/80', 'bg-emerald-300/80'];
  const skyPalette     = ['bg-sky-500/80',     'bg-sky-400/80',     'bg-sky-300/80'];

  const palette = color === 'emerald' ? emeraldPalette : skyPalette;

  const segs: Segment[] = phases.map((p, idx) => {
    const paletteIndex = Math.min(idx, palette.length - 1); // 3フェーズ目以降は一番薄い色で固定
    return {
      label: epiPortion > 0 ? '遺族年金（基礎＋厚生）' : '遺族年金（基礎のみ）',
      years: p.years,
      widthYears: widenYears(p.years),
      className: `${palette[paletteIndex]} ring-1 ring-white/20`,
      amountYear: kisoAnnualByCount(p.count) + epiPortion,
    };
  });


  const edgesYears = segmentEdgesYears(segs);
  const ticks: Tick[] = edgesYears.map((_, idx) => ({
    edgeIndex: idx,
    labelLines: [
      `${holderLabel}${holderAge + edgesYears[idx]}`,
      ...childLabels(
        childrenAges,
        childrenCount,
        edgesYears[idx],
        idx === edgesYears.length - 1,
      ),
    ],
  }));

  const breakdown = phases.flatMap((p, idx) => {
    const base = kisoAnnualByCount(p.count);
    const epi = epiPortion;
    return [
      {
        label: `フェーズ${idx + 1}（子${p.count}人）：遺族基礎`,
        annual: base,
        formula: '831,700 + 子1,2:各239,300 / 子3以降:各79,800',
      },
      {
        label: `フェーズ${idx + 1}（子${p.count}人）：遺族厚生`,
        annual: epi,
        formula: '平均標準報酬 × 5.481/1000 × max(月数,300) × 0.75',
      },
      {
        label: `フェーズ${idx + 1}（子${p.count}人）：合計`,
        annual: base + epi,
      },
    ];
  });

  // ⚠️ 注意喚起：本来の遺族年金の残り年数（末っ子が18歳になるまで）と、
  // 老齢開始を早めることで削られる年数
  let notice: string | undefined;

  // 末っ子が18歳になるまでの年数（＝各子の「18−年齢」の最大値）
  const remainingUntilAll18 = childrenAges
    .slice(0, childrenCount)
    .reduce((max, a) => Math.max(max, Math.max(0, 18 - a)), 0);

  if (remainingUntilAll18 > 0) {
    const childEndAge = holderAge + remainingUntilAll18; // 全員18歳になる時点での本人年齢
    if (oldAgeStart < childEndAge) {
      const remainingSurvivorYears = remainingUntilAll18;          // 本来もらえる年数
      const lostYears = childEndAge - oldAgeStart;                 // 老齢開始で削られる年数
      notice = `⚠️ 遺族年金はあと${remainingSurvivorYears}年ですが、老齢を${oldAgeStart}歳で開始すると${lostYears}年受給できません。`;
    }
  }

  // 👉 タイトル直下には「注意喚起だけ」を出す。通常説明文は出さない。
  const sublines = notice ? [notice] : undefined;

  return (
    <TimelineBlock
      title="子がいる期間"
      sublines={sublines}
      color={color}
      segments={segs}
      ticks={ticks}
      breakdown={breakdown}
    />
  );
}

/* ========== 子0後（妻）〜老齢開始まで：1セクション連結 ========== */
function TimelineWifeAfterChild_Combined({
  holderAge,
  yearsUntilChildEnd,
  koseiAnnual,
  chukoreiAfterAnnual,
  oldAgeStart,
  childrenCount,
  childrenAges,
  mode,
}: {
  holderAge: number;
  yearsUntilChildEnd: number;
  koseiAnnual: number;
  chukoreiAfterAnnual: number; // 現行モード専用（改正2028モードでは使用しない）
  oldAgeStart: OldAgeStart;
  childrenCount: number;
  childrenAges: number[];
  mode: PolicyMode;
}) {
  const childEndAge = holderAge + yearsUntilChildEnd;
  const totalUntilOld = Math.max(0, oldAgeStart - childEndAge);
  if (totalUntilOld <= 0) return null;

  // ---- 改正2028モード：子のない配偶者は遺族厚生「最長5年」＋中高齢寡婦加算は廃止扱い ----
  // NOTE: 中高齢寡婦加算はこのモードでは使わない（有期5年の遺族厚生のみに限定する簡易シミュレーション）。
  if (mode === 'revised2028') {
    const segs: Segment[] = [];
    const payYears = Math.min(5, totalUntilOld);

    if (payYears > 0) {
      if (koseiAnnual > 0) {
        segs.push({
          label: '遺族年金（厚生・有期5年）',
          years: payYears,
          widthYears: widenYears(payYears),
          className: 'bg-emerald-500/80 ring-1 ring-white/20',
          amountYear: koseiAnnual,
        });
      } else {
        segs.push({
          label: '支給なし',
          years: payYears,
          widthYears: widenYears(payYears),
          className: 'bg-slate-800/40 ring-1 ring-white/10',
          amountYear: 0,
        });
      }
    }

    const blank = totalUntilOld - payYears;
    if (blank > 0) {
      segs.push({
        label: '支給なし（改正後 無給期間）',
        years: blank,
        widthYears: widenYears(blank),
        className: 'bg-slate-800/40 ring-1 ring-white/10',
        amountYear: 0,
      });
    }

    const edgesYears = segmentEdgesYears(segs);
    const ticks: Tick[] = edgesYears.map((_, idx) => ({
      edgeIndex: idx,
      labelLines: [
        `妻${childEndAge + edgesYears[idx]}`,
        ...childLabels(
          childrenAges.slice(0, childrenCount).map((a) => a + yearsUntilChildEnd),
          childrenCount,
          edgesYears[idx],
          true,
        ),
      ],
    }));

    const breakdown: BreakdownItem[] =
      koseiAnnual > 0
        ? [
            {
              label: '遺族厚生（有期5年部分）',
              annual: koseiAnnual,
              formula: '平均標準報酬 × 5.481/1000 × max(月数,300) × 0.75',
            },
          ]
        : [];

    const sublines = [
      `妻${childEndAge}→${oldAgeStart}歳（改正案：子のいない配偶者の遺族厚生は最長5年・簡易シミュレーション）`,
    ];

    return (
      <TimelineBlock
        title="子が0になったあと（妻）〜老齢開始まで"
        color="emerald"
        segments={segs}
        ticks={ticks}
        breakdown={breakdown}
        sublines={sublines}
      />
    );
  }

  // ---- 現行モード：中高齢寡婦加算＋遺族厚生 → 65歳以降は遺族厚生のみ ----
  // 区間A：子0→min(65, 老齢開始) で中高齢＋遺族厚生
  const boundA = Math.min(65, oldAgeStart);
  const yearsA = Math.max(0, boundA - childEndAge);

  // 区間B：65→老齢開始 で遺族厚生のみ（加算終了）
  const startB = Math.max(65, childEndAge);
  const yearsB = Math.max(0, oldAgeStart - startB);

  if (yearsA <= 0 && yearsB <= 0) return null;

  const segs: Segment[] = [];
  if (yearsA > 0) {
    const hasKosei = koseiAnnual > 0;
    const hasChukorei = chukoreiAfterAnnual > 0;
    const amountA = (hasKosei ? koseiAnnual : 0) + (hasChukorei ? chukoreiAfterAnnual : 0);

    let labelA: string;
    if (!hasKosei && !hasChukorei) {
      labelA = '支給なし';
    } else if (hasChukorei && hasKosei) {
      labelA = '中高齢寡婦加算（＋遺族厚生）';
    } else if (hasKosei) {
      labelA = '遺族年金（厚生のみ）';
    } else {
      // 理論上ほぼ発生しないがガード
      labelA = '中高齢寡婦加算のみ';
    }

    segs.push({
      label: labelA,
      years: yearsA,
      widthYears: widenYears(yearsA),
      className: 'bg-emerald-500/80 ring-1 ring-white/20',
      amountYear: amountA,
    });
  }
  if (yearsB > 0) {
    const hasKosei = koseiAnnual > 0;

    segs.push({
      label: hasKosei ? '遺族年金（厚生のみ）' : '支給なし',
      years: yearsB,
      widthYears: widenYears(yearsB),
      className: 'bg-emerald-400/70 ring-1 ring-white/20',
      amountYear: hasKosei ? koseiAnnual : 0,
    });
  }

  const edgesYears = segmentEdgesYears(segs);
  const tickAges: number[] = [];
  tickAges.push(childEndAge);
  if (yearsA > 0 && yearsB > 0) tickAges.push(boundA); // 65到達
  tickAges.push(oldAgeStart);

  const ticks: Tick[] = tickAges.map((age, i) => ({
    edgeIndex: i, // edges[0]=0, edges[1]=A終端, edges[2]=B終端
    labelLines: [
      `妻${age}`,
      ...childLabels(
        childrenAges.slice(0, childrenCount).map((a) => a + yearsUntilChildEnd),
        childrenCount,
        0,
        true,
      ),
    ],
  }));

  const breakdown: BreakdownItem[] = [
    ...(yearsA > 0
      ? ([
          {
            label: '中高齢寡婦加算',
            annual: chukoreiAfterAnnual,
            formula: '定額 623,800／年（該当期間のみ）',
          },
          {
            label: '遺族厚生（該当期間）',
            annual: koseiAnnual,
            formula: '平均標準報酬 × 5.481/1000 × max(月数,300) × 0.75',
          },
        ] as BreakdownItem[])
      : []),
    ...(yearsB > 0
      ? ([
          {
            label: '遺族厚生（加算終了後）',
            annual: koseiAnnual,
            formula: '平均標準報酬 × 5.481/1000 × max(月数,300) × 0.75',
          },
        ] as BreakdownItem[])
      : []),
  ];

  return (
    <TimelineBlock
      title="子が0になったあと（妻）〜老齢開始まで"
      color="emerald"
      segments={segs}
      ticks={ticks}
      breakdown={breakdown}
    />
  );
}

/* ========== 子0後（夫）〜老齢開始まで（改正5年を内包） ========== */
function TimelineHusbandAfterChild_Pre({
  holderAge,
  yearsUntilChildEnd,
  koseiEligibleAnnual,
  oldAgeStart,
  childrenCount,
  childrenAges,
  mode,
}: {
  holderAge: number;
  yearsUntilChildEnd: number;
  koseiEligibleAnnual: number;
  oldAgeStart: OldAgeStart;
  childrenCount: number;
  childrenAges: number[];
  mode: PolicyMode;
}) {
  const childEndAge = holderAge + yearsUntilChildEnd;
  const totalUntilOld = Math.max(0, oldAgeStart - childEndAge);
  if (totalUntilOld <= 0) return null;

  const segs: Segment[] = [];

  if (mode === 'revised2028') {
    // 改正後：子なし遺族厚生は最長5年まで
    const payYears = Math.min(5, totalUntilOld);

    if (payYears > 0) {
      if (koseiEligibleAnnual > 0) {
        segs.push({
          label: '遺族年金（厚生・有期5年）',
          years: payYears,
          widthYears: widenYears(payYears),
          className: 'bg-sky-500/75 ring-1 ring-white/20',
          amountYear: koseiEligibleAnnual,
        });
      } else {
        segs.push({
          label: '支給なし',
          years: payYears,
          widthYears: widenYears(payYears),
          className: 'bg-slate-800/40 ring-1 ring-white/10',
          amountYear: 0,
        });
      }
    }

    const blank = totalUntilOld - payYears;
    if (blank > 0) {
      segs.push({
        label: '支給なし（改正後 無給期間）',
        years: blank,
        widthYears: widenYears(blank),
        className: 'bg-slate-800/40 ring-1 ring-white/10',
        amountYear: 0,
      });
    }
  } else {
    // 現行：60歳未満は支給なし、60歳〜老齢開始までは遺族厚生
    let cursor = childEndAge;

    // 〜60歳までは無給（55〜59は受給権のみで支給なし）
    const to60 = Math.min(60, oldAgeStart);
    if (cursor < to60) {
      const y = to60 - cursor;
      if (y > 0) {
        segs.push({
          label: '支給なし（現行 60歳未満）',
          years: y,
          widthYears: widenYears(y),
          className: 'bg-slate-800/40 ring-1 ring-white/10',
          amountYear: 0,
        });
      }
      cursor = to60;
    }

    // 60歳〜老齢開始は遺族厚生（厚生実績があれば）
    if (cursor < oldAgeStart) {
      const y = oldAgeStart - cursor;
      if (y > 0) {
        if (koseiEligibleAnnual > 0) {
          segs.push({
            label: '遺族年金（厚生）',
            years: y,
            widthYears: widenYears(y),
            className: 'bg-sky-500/75 ring-1 ring-white/20',
            amountYear: koseiEligibleAnnual,
          });
        } else {
          segs.push({
            label: '支給なし',
            years: y,
            widthYears: widenYears(y),
            className: 'bg-slate-800/40 ring-1 ring-white/10',
            amountYear: 0,
          });
        }
      }
    }
  }

  const edgesYears = segmentEdgesYears(segs);
  const ticks: Tick[] = edgesYears.map((_, idx) => ({
    edgeIndex: idx,
    labelLines: [
      `夫${childEndAge + edgesYears[idx]}`,
      ...childLabels(
        childrenAges.slice(0, childrenCount).map((a) => a + yearsUntilChildEnd),
        childrenCount,
        edgesYears[idx],
        true,
      ),
    ],
  }));

  const breakdown: BreakdownItem[] =
    koseiEligibleAnnual > 0
      ? [
          {
            label: '遺族厚生（該当部分）',
            annual: koseiEligibleAnnual,
            formula: '平均標準報酬 × 5.481/1000 × max(月数,300) × 0.75',
          },
        ]
      : [];

  return (
    <TimelineBlock
      title="子が0になったあと（夫）〜老齢開始まで"
      sublines={[`夫${childEndAge}→${oldAgeStart}歳`]}
      color="sky"
      segments={segs}
      ticks={ticks}
      breakdown={breakdown}
    />
  );
}


/* ========== 老齢開始後（共通） ========== */
function TimelineOldAgeCommon({
  title,
  color,
  oldAgeStart,
  oldAgeBasicAt65,
  oldAgeEpiAt65,
  koseiAnnual,
}: {
  title: string;
  color: 'emerald' | 'sky';
  oldAgeStart: OldAgeStart;
  oldAgeBasicAt65: number;
  oldAgeEpiAt65: number;
  koseiAnnual: number;
}) {
  const oldAdjBasic = adjustOldAge(oldAgeBasicAt65, oldAgeStart);
  const oldAdjEpi = adjustOldAge(oldAgeEpiAt65, oldAgeStart);

  // ✅ 老齢基礎 ＋ max(老齢厚生, 遺族厚生)
  const choose = oldAdjBasic + Math.max(oldAdjEpi, koseiAnnual);

  // 老齢開始年齢 → 100歳 まで描画
  const yearsDraw = Math.max(1, OLD_AGE_END - oldAgeStart);

  const segs: Segment[] = [
    {
      label: '老齢（基礎＋厚生の高い方）',
      years: yearsDraw,
      className:
        color === 'emerald'
          ? 'bg-emerald-300/70 ring-1 ring-white/15'
          : 'bg-sky-300/70 ring-1 ring-white/15',
      amountYear: choose,
    },
  ];

  const edgesYears = segmentEdgesYears(segs);
  const person = title.includes('妻') ? '妻' : '夫';

  const ticks: Tick[] = [
    { edgeIndex: 0, labelLines: [`${person}${oldAgeStart}`] },
    { edgeIndex: edgesYears.length - 1, labelLines: [`${person}${OLD_AGE_END}`] },
  ];

  const breakdown: BreakdownItem[] = [
    {
      label: '老齢（基礎）',
      annual: oldAdjBasic,
      formula: '65歳時額 × {繰上げ/繰下げ率}（繰上げ: 月▲0.4%／繰下げ: 月＋0.7%）',
    },
    {
      label: '老齢（厚生）',
      annual: oldAdjEpi,
      formula: '平均標準報酬 × 5.481/1000 × 加入月数（みなし300）',
    },
    {
      label: '遺族厚生',
      annual: koseiAnnual,
      formula: '平均標準報酬 × 5.481/1000 × max(月数,300) × 0.75',
    },
    {
      label: '選択結果（基礎＋厚生 か 遺族厚生の高い方）',
      annual: choose,
      formula: '老齢基礎 と {老齢厚生 or 遺族厚生} の高い方を合算',
    },
  ];

  return (
    <TimelineBlock
      title={`老齢開始後（${person}）`}
      color={color}
      segments={segs}
      ticks={ticks}
      breakdown={breakdown}
    />
  );
}

/* ===================== 折りたたみパネル ===================== */
function CollapsiblePanel({
  title,
  children,
  defaultOpen = true,
}: {
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="rounded-2xl border border-slate-700 bg-slate-900/60">
      <div className="relative flex items-center justify-between px-6 md:px-10 py-4">
        <h2 className="text-lg font-semibold">{title}</h2>
        <button
          onClick={() => setOpen((v) => !v)}
          className="absolute right-4 top-4 md:right-6 md:top-4 inline-flex h-8 w-8 items-center justify-center rounded-md border border-slate-600/60 bg-slate-800 hover:bg-slate-700"
          aria-label={open ? '格納する' : '展開する'}
        >
          <span className="text-xl leading-none select-none">{open ? '−' : '+'}</span>
        </button>
      </div>
      {open && <div className="px-6 md:px-10 pb-8">{children}</div>}
    </div>
  );
}

/* ===================== ページ本体 ===================== */
export default function Page() {
  const [mode, setMode] = useState<PolicyMode>('current');
  // 妻
  const [ageWife, setAgeWife] = useState<number | null>(null);
  const [oldAgeStartWife, setOldAgeStartWife] = useState<OldAgeStart | null>(null);
  const [avgStdMonthlyWife, setAvgStdMonthlyWife] = useState<number | null>(null);
  const [monthsWife, setMonthsWife] = useState<number | null>(null);
  const [useMinashi300Wife, setUseMinashi300Wife] = useState(true); // デフォルトはチェック済み（制度通り）
  // 夫
  const [ageHusband, setAgeHusband] = useState<number | null>(null);
  const [oldAgeStartHusband, setOldAgeStartHusband] = useState<OldAgeStart | null>(null);
  const [avgStdMonthlyHusband, setAvgStdMonthlyHusband] = useState<number | null>(null);
  const [monthsHusband, setMonthsHusband] = useState<number | null>(null);
  const [useMinashi300Husband, setUseMinashi300Husband] = useState(true); // デフォルトはチェック済み（制度通り）
  // 子
  const [childrenCount, setChildrenCount] = useState<number | null>(null);
  const [childrenAges, setChildrenAges] = useState<(number | null)[]>([]);
  
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
            
            // 妻の年齢（既存値がnullまたは0の場合のみ読み込む）
            setAgeWife((prev) => {
              if ((prev === null || prev === 0) && basicInfo.ageWife !== undefined && basicInfo.ageWife !== null && basicInfo.ageWife !== 0) {
                return basicInfo.ageWife;
              }
              return prev;
            });
            
            // 夫の年齢（既存値がnullまたは0の場合のみ読み込む）
            setAgeHusband((prev) => {
              if ((prev === null || prev === 0) && basicInfo.ageHusband !== undefined && basicInfo.ageHusband !== null && basicInfo.ageHusband !== 0) {
                return basicInfo.ageHusband;
              }
              return prev;
            });
            
            // 老齢開始年齢（妻・夫それぞれ、既存値がnullまたは0の場合のみ読み込む）
            setOldAgeStartWife((prev) => {
              if ((prev === null || prev === 0) && basicInfo.oldAgeStartWife !== undefined && basicInfo.oldAgeStartWife !== null && basicInfo.oldAgeStartWife !== 0) {
                return basicInfo.oldAgeStartWife as OldAgeStart;
              }
              return prev;
            });
            setOldAgeStartHusband((prev) => {
              if ((prev === null || prev === 0) && basicInfo.oldAgeStartHusband !== undefined && basicInfo.oldAgeStartHusband !== null && basicInfo.oldAgeStartHusband !== 0) {
                return basicInfo.oldAgeStartHusband as OldAgeStart;
              }
              return prev;
            });
            
            // 厚生年金加入情報（妻・夫それぞれ、既存値がnullまたは0の場合のみ読み込む）
            // 妻の情報
            setMonthsWife((prev) => {
              if ((prev === null || prev === 0) && basicInfo.monthsWife !== undefined && basicInfo.monthsWife !== null && basicInfo.monthsWife !== 0) {
                return basicInfo.monthsWife;
              }
              return prev;
            });
            setAvgStdMonthlyWife((prev) => {
              if ((prev === null || prev === 0) && basicInfo.avgStdMonthlyWife !== undefined && basicInfo.avgStdMonthlyWife !== null && basicInfo.avgStdMonthlyWife !== 0) {
                return basicInfo.avgStdMonthlyWife;
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
            
            // 夫の情報
            setMonthsHusband((prev) => {
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
            setAvgStdMonthlyHusband((prev) => {
              if ((prev === null || prev === 0) && basicInfo.avgStdMonthlyHusband !== undefined && basicInfo.avgStdMonthlyHusband !== null && basicInfo.avgStdMonthlyHusband !== 0) {
                return basicInfo.avgStdMonthlyHusband;
              }
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
  
  useEffect(() => {
    if (childrenCount === null) return;
    setChildrenAges((prev) => {
      const arr = prev.slice(0, childrenCount);
      while (arr.length < childrenCount) arr.push(null);
      return arr;
    });
  }, [childrenCount]);
  const { youngest } = useMemo(() => deriveChildren(childrenAges), [childrenAges]);
  const yearsUntilYoungest18 = useMemo(
    () => (youngest === undefined ? 0 : Math.max(0, 18 - youngest)),
    [youngest],
  );

  // 事前計算
  const koseiForWifeEligible = useMemo(
    () => proportionAnnual(avgStdMonthlyHusband, monthsHusband, useMinashi300Husband) * 0.75,
    [avgStdMonthlyHusband, monthsHusband, useMinashi300Husband],
  );
  const koseiForWifeNow = koseiForWifeEligible;
  const koseiForHusbandEligible = useMemo(
    () => proportionAnnual(avgStdMonthlyWife, monthsWife, useMinashi300Wife) * 0.75,
    [avgStdMonthlyWife, monthsWife, useMinashi300Wife],
  );
 // Case8 バグ修正版：夫は「子がいる期間は年齢に関係なく遺族厚生が支給」
// 子0になった後は「60歳以上で支給」
const koseiForHusbandNow = useMemo(() => {
  // 子が1人でもいる → 年齢に関係なく支給（55歳でも支給される）
  if (childrenCount > 0) {
    return koseiForHusbandEligible;
  }

  // 子0 → 60歳から支給（55〜59歳は無給）
  return ageHusband >= 60 ? koseiForHusbandEligible : 0;
}, [koseiForHusbandEligible, ageHusband, childrenCount]);
  // 妻の中高齢寡婦加算（現行モード専用）
  const chukoreiAfterChildCurrent = useMemo(() => {
    // NOTE: 中高齢寡婦加算は遺族厚生の受給権がある妻のみ対象。
    if (koseiForWifeEligible <= 0) return 0;

    const childEndAge = ageWife + yearsUntilYoungest18;
    const chukoreiStartAge = 40;
    const chukoreiEndAge = 65;

    // 妻が子0後に中高齢寡婦加算を受けられる可能性がある区間：
    // max(childEndAge, 40) 〜 min(oldAgeStartWife, 65)
    const rangeStart = Math.max(childEndAge, chukoreiStartAge);
    const rangeEnd = Math.min(oldAgeStartWife || 65, chukoreiEndAge);

    if (rangeEnd <= rangeStart) {
      // 一度も条件を満たさない
      return 0;
    }

    // NOTE: 本来は40歳到達前後でセグメントを分けるべきだが、
    // セグメント数を増やさないため「該当期間が1年以上でもあれば全期間を寡婦加算あり」として扱う簡易表示。
    return CHUKOREI_KASAN;
  }, [ageWife, yearsUntilYoungest18, oldAgeStartWife, koseiForWifeEligible]);

  // NOTE: 改正2028モードでは中高齢寡婦加算は使わない（実質廃止扱いの簡易シミュレーション）
  const chukoreiAfterChild =
    mode === 'current'
      ? chukoreiAfterChildCurrent
      : 0;

  return (
    <main className="p-6 lg:p-10 max-w-6xl mx-auto text-slate-100">
      <div className="flex items-center justify-between mb-4">
        <h1 className="text-2xl font-bold">遺族年金シミュレーター（夫・妻 同時比較）</h1>
        <Link
          href="/simulators/customer-profile"
          className="inline-flex items-center justify-center w-10 h-10 rounded-full border border-slate-600 bg-slate-800 hover:bg-slate-700 text-xl font-bold"
          title="Customer Profileを開く"
        >
          +
        </Link>
      </div>
      <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4 items-start">
        <RulesSummary />
        <Link
          href="/simulators/survivor-pension/rules"
          className="inline-flex items-center gap-2 rounded-md border border-sky-700/50 bg-sky-900/20 px-3 py-2 text-sm text-sky-200 underline hover:bg-sky-900/30"
        >
          📘 遺族年金について（解説ページ）
        </Link>
        <div className="text-sm opacity-80 flex items-center">
          <span className="mr-2">制度モード：</span>
          <select
            className="flex-1 rounded-md bg-slate-800 border border-slate-600 px-2 py-1 text-sm"
            value={mode}
            onChange={(e) => setMode(e.target.value as PolicyMode)}
          >
            <option value="current">現行（〜2027）</option>
            <option value="revised2028">改正2028（試作）</option>
          </select>
        </div>
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
            setOldAgeStartWife(null);
            setAvgStdMonthlyWife(null);
            setMonthsWife(null);
            setUseMinashi300Wife(true);
            setAgeHusband(null);
            setOldAgeStartHusband(null);
            setAvgStdMonthlyHusband(null);
            setMonthsHusband(null);
            setUseMinashi300Husband(true);
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
                    (oldAgeStartWife !== null && basicInfo.oldAgeStartWife !== undefined && oldAgeStartWife === basicInfo.oldAgeStartWife) ||
                    (oldAgeStartHusband !== null && basicInfo.oldAgeStartHusband !== undefined && oldAgeStartHusband === basicInfo.oldAgeStartHusband) ||
                    (monthsWife !== null && basicInfo.monthsWife !== undefined && monthsWife === basicInfo.monthsWife) ||
                    (monthsHusband !== null && basicInfo.monthsHusband !== undefined && monthsHusband === basicInfo.monthsHusband);
                  
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
            setValue={(n) => {
              if (n === null) {
                setChildrenCount(null);
                return;
              }
              const next = Math.max(0, Math.min(5, n));
              setChildrenCount(next);
              setChildrenAges((prev) => {
                const arr = prev.slice(0, next);
                while (arr.length < next) arr.push(null);
                return arr;
              });
            }}
            options={[
              { value: null, label: '--' },
              ...Array.from({ length: 6 }, (_, i) => ({ value: i, label: `${i}人` })),
            ]}
          />
          {childrenCount !== null && childrenCount > 0 && (
            <div className="mt-3 space-y-2">
              {Array.from({ length: childrenCount }).map((_, i) => (
                <div key={i} className="grid grid-cols-[auto,1fr] items-center gap-2">
                  <span className="text-xs opacity-80">子{i + 1}</span>
                  <SelectAge
                    value={childrenAges[i] ?? null}
                    setValue={(v) => {
                      setChildrenAges((prev) => {
                        const next = prev.slice();
                        next[i] = v;
                        return next;
                      });
                    }}
                    min={0}
                    max={19}
                  />
                </div>
              ))}
              <Hint>※各子が18歳になる年度末まで要件（簡易）。</Hint>
            </div>
          )}
        </Card>

        <Card className="p-6">
          <div className="font-semibold mb-2">妻のステータス</div>
          <Label>年齢</Label>
          <SelectAge value={ageWife} setValue={setAgeWife} min={18} max={100} />
          <div className="mt-3">
            <Label>老齢年金開始年齢</Label>
            <SelectSimple
              value={oldAgeStartWife}
              setValue={(v) => setOldAgeStartWife(v as OldAgeStart | null)}
              options={[
                { value: null, label: '--' },
                ...Array.from({ length: 75 - 60 + 1 }, (_, i) => {
                  const v = (60 + i) as OldAgeStart;
                  return { value: v, label: String(v) };
                }),
              ]}
            />
          </div>
          <div className="mt-4">
            <Label>平均標準報酬月額</Label>
            <SelectYenStep value={avgStdMonthlyWife} setValue={setAvgStdMonthlyWife} />
          </div>
          <div className="mt-3">
            <Label>厚生年金の加入月数（妻）</Label>
            <InputNumber value={monthsWife} setValue={setMonthsWife} min={0} />
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
            <Hint>※厚生年金に加入していた人は、1〜299月は300月として扱われます（遺族年金の制度）。チェックを外すと、入力値そのまま計算します。</Hint>
          </div>
        </Card>

        <Card className="p-6">
          <div className="font-semibold mb-2">夫のステータス</div>
          <Label>年齢</Label>
          <SelectAge value={ageHusband} setValue={setAgeHusband} min={18} max={100} />
          <div className="mt-3">
            <Label>老齢年金開始年齢</Label>
            <SelectSimple
              value={oldAgeStartHusband}
              setValue={(v) => setOldAgeStartHusband(v as OldAgeStart | null)}
              options={[
                { value: null, label: '--' },
                ...Array.from({ length: 75 - 60 + 1 }, (_, i) => {
                  const v = (60 + i) as OldAgeStart;
                  return { value: v, label: String(v) };
                }),
              ]}
            />
          </div>

          <div className="mt-4">
            <Label>平均標準報酬月額</Label>
            <SelectYenStep value={avgStdMonthlyHusband} setValue={setAvgStdMonthlyHusband} />
          </div>
          <div className="mt-3">
            <Label>厚生年金の加入月数（夫）</Label>
            <InputNumber value={monthsHusband} setValue={setMonthsHusband} min={0} />
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
            <Hint>※厚生年金に加入していた人は、1〜299月は300月として扱われます（遺族年金の制度）。チェックを外すと、入力値そのまま計算します。</Hint>
          </div>
        </Card>
          </div>
        </Accordion>
      </section>

      {/* 結果（縦並び） */}
      <section className="grid grid-cols-1 gap-10">
        {/* 入力が不完全な場合のメッセージ */}
        {((ageWife === null || ageHusband === null || childrenCount === null) && 
          (oldAgeStartWife === null || oldAgeStartHusband === null || 
           avgStdMonthlyWife === null || avgStdMonthlyHusband === null ||
           monthsWife === null || monthsHusband === null)) ? (
          <div className="p-4 bg-amber-900/20 border border-amber-700/50 rounded-lg">
            <p className="text-sm text-amber-200">上記の入力項目を入力してください。</p>
          </div>
        ) : null}
        
        {/* 妻受給・夫受給 */}
        {(ageWife !== null && ageHusband !== null && childrenCount !== null && 
          oldAgeStartWife !== null && oldAgeStartHusband !== null &&
          avgStdMonthlyWife !== null && avgStdMonthlyHusband !== null &&
          monthsWife !== null && monthsHusband !== null) && (
          <>
            <CollapsiblePanel title="夫が亡くなった場合（受給者：妻）" defaultOpen={true}>
              <TimelineChildren
                color="emerald"
                holderLabel="妻"
                holderAge={ageWife}
                childrenCount={childrenCount}
                koseiNow={koseiForWifeNow}
                childrenAges={childrenAges}
                oldAgeStart={oldAgeStartWife}
              />
              <TimelineWifeAfterChild_Combined
                holderAge={ageWife}
                yearsUntilChildEnd={yearsUntilYoungest18}
                koseiAnnual={koseiForWifeEligible}
                chukoreiAfterAnnual={chukoreiAfterChild}
                oldAgeStart={oldAgeStartWife}
                childrenCount={childrenCount}
                childrenAges={childrenAges}
                mode={mode}
              />
              <TimelineOldAgeCommon
                title="妻"
                color="emerald"
                oldAgeStart={oldAgeStartWife}
                oldAgeBasicAt65={780_000}
                oldAgeEpiAt65={400_000}
                koseiAnnual={koseiForWifeEligible}
              />
            </CollapsiblePanel>

            <CollapsiblePanel title="妻が亡くなった場合（受給者：夫）" defaultOpen={true}>
              <TimelineChildren
                color="sky"
                holderLabel="夫"
                holderAge={ageHusband}
                childrenCount={childrenCount}
                koseiNow={koseiForHusbandNow}
                childrenAges={childrenAges}
                oldAgeStart={oldAgeStartHusband}
              />
              <TimelineHusbandAfterChild_Pre
                holderAge={ageHusband}
                yearsUntilChildEnd={yearsUntilYoungest18}
                koseiEligibleAnnual={koseiForHusbandEligible}
                oldAgeStart={oldAgeStartHusband}
                childrenCount={childrenCount}
                childrenAges={childrenAges}
                mode={mode}
              />
              <TimelineOldAgeCommon
                title="夫"
                color="sky"
                oldAgeStart={oldAgeStartHusband}
                oldAgeBasicAt65={780_000}
                oldAgeEpiAt65={400_000}
                koseiAnnual={koseiForHusbandEligible}
              />
            </CollapsiblePanel>
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
function InputNumber({ value, setValue, min }: { value: number | null; setValue: (n: number | null) => void; min?: number }) {
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
      value={value === null || value === 0 ? '--' : String(value)}
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
      value={value || 0}
      onChange={(e) => setValue(parseInt(e.target.value, 10) || null)}
    >
      <option value={0}>--</option>
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
