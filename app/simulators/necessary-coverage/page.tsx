'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
    kisoAnnualByCount,
    proportionAnnual,
    CHUKOREI_KASAN,
    calculateEligibleChildrenCount,
    calculateDisabilityBasicPension,
    calculateDisabilityEmployeePension,
    DisabilityLevel,
    KISO_BASE_ANNUAL,
    CHILD_ADDITION_1_2,
    CHILD_ADDITION_3_PLUS,
    SPOUSE_BONUS,
} from '../../utils/pension-calc';

/* ===================== 型定義 ===================== */
type CustomerProfileBasicInfo = {
    childrenCount: number | undefined;
    childrenAges: number[];
    spouseType?: 'couple' | 'none';
    ageWife: number;
    oldAgeStartWife: number;
    avgStdMonthlyWife: number;
    annualIncomeWife?: number;
    monthsWife: number;
    useMinashi300Wife: boolean;
    ageHusband: number;
    oldAgeStartHusband: number;
    avgStdMonthlyHusband: number;
    annualIncomeHusband?: number;
    monthsHusband: number;
    useMinashi300Husband: boolean;
    age: number;
    oldAgeStart: number;
    hasEmployeePension: boolean;
    employeePensionMonths: number;
    avgStdMonthly: number;
    annualIncome?: number;
    useMinashi300: boolean;
};

type CustomerProfile = {
    monthlyLivingExpense: number;
    details: Record<string, unknown>;
    basicInfo: CustomerProfileBasicInfo;
    danshinHolder?: ('husband' | 'wife')[];
};

type YearlyData = {
    age: number; // 本人（または配偶者）の年齢
    year: number; // 経過年数
    pension: number; // 公的年金（年額）
    workIncome: number; // 就労収入（手取り調整後・年額）
    baseExpense: number; // 基本生活費（年額）
    educationCost: number; // 教育費（年額）
    reserveTarget: number; // 老後・予備費積立（年額）
    baseIncome: number; // pension + workIncome
    totalIncome: number; // 収入合計（年金＋就労＋分配済み貯蓄/給付）
    totalTarget: number; // baseExpense + educationCost + reserveTarget
    baseShortfall: number;
    shortfall: number; // 不足額
    sicknessAnnual: number;
    savingsAnnual: number;
    monthsActive: number; // 65歳までにカウントする月数
    grayArea: number; // 不要な支出（住宅ローン＋生活費削減分）
    childAllowanceMonthly: number; // 児童手当合計額（月額）
    childSupportAllowanceMonthly: number; // 児童扶養手当合計額（月額）
};

type ScenarioResult = {
    title: string;
    data: YearlyData[];
    totalShortfall: number; // 貯蓄控除前の総不足額
    netShortfall: number; // 控除後
    sicknessDeduction: number;
    savingsApplied: number;
    exemptedHousingLoan: number; // 団信による免除額（参考）
    monthlyShortfallMax: number; // 最大月額不足
    hasShortfall: boolean;
    category: 'survivor' | 'disability';
    activeMonths: number;
    targetActiveTotal: number;
};

const SAVINGS_OPTIONS_MAN = Array.from({ length: 101 }, (_, i) => i * 50); // 0〜5000万円を50万円刻み
const RETIREMENT_AGE = 65;
const RESERVE_RATIO = 0.1; // 基本生活費の10%を老後・予備費として積み立てる想定

/* ===================== 児童手当・児童扶養手当の計算関数 ===================== */

/**
 * 児童手当の計算（月額）
 * 0歳〜3歳未満: 第1・2子 15,000円、第3子以降 30,000円
 * 3歳〜18歳の年度末まで: 第1・2子 10,000円、第3子以降 30,000円
 */
function calculateChildAllowance(childrenAges: number[]): number {
    if (childrenAges.length === 0) return 0;
    
    // 年齢が上の子から数える（降順ソート）
    const sortedAges = [...childrenAges].sort((a, b) => b - a);
    let total = 0;
    
    sortedAges.forEach((age, index) => {
        const childNumber = index + 1; // 1人目、2人目、3人目...
        
        if (age < 3) {
            // 0歳〜3歳未満
            if (childNumber <= 2) {
                total += 15000;
            } else {
                total += 30000;
            }
        } else if (age < 19) {
            // 3歳〜18歳の年度末まで
            if (childNumber <= 2) {
                total += 10000;
            } else {
                total += 30000;
            }
        }
        // 19歳以上は支給なし
    });
    
    return total;
}

/**
 * 児童扶養手当の計算（月額）
 * 年収 160万円未満: 全部支給（1人目 43,070円、2人目以降加算 10,170円）
 * 年収 160万円以上 365万円未満: 一部支給の中間値（1人目 28,850円、2人目以降加算 8,275円）
 * 年収 365万円以上: 支給停止（0円）
 */
function calculateChildSupportAllowance(
    childrenAges: number[],
    survivorAnnualIncome: number
): number {
    if (childrenAges.length === 0) return 0;
    
    // 18歳の年度末までの子をカウント
    const eligibleChildren = childrenAges.filter(age => age < 19).length;
    if (eligibleChildren === 0) return 0;
    
    const annualIncomeYen = survivorAnnualIncome; // 年収（円）
    
    if (annualIncomeYen < 1600000) {
        // 全部支給
        const firstChild = 43070;
        const additionalChildren = (eligibleChildren - 1) * 10170;
        return firstChild + additionalChildren;
    } else if (annualIncomeYen < 3650000) {
        // 一部支給（中間値）
        const firstChild = 28850;
        const additionalChildren = (eligibleChildren - 1) * 8275;
        return firstChild + additionalChildren;
    } else {
        // 支給停止
        return 0;
    }
}

/* ===================== UI Components ===================== */

// SVGハッチングパターン定義
const SVGPatterns = () => (
    <svg width="0" height="0" className="absolute">
        <defs>
            <pattern id="shortfallHatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                <path d="M -1,4 H 9" stroke="rgba(248, 113, 113, 0.5)" strokeWidth="2" />
            </pattern>
        </defs>
    </svg>
);

function StackedAreaChart({
    data,
    currentSalaryMonthly,
    retirementAge = RETIREMENT_AGE,
    salaryLabel,
    showAllowancesToggle = false
}: {
    data: YearlyData[];
    currentSalaryMonthly: number; // 事故発生前の現在の月額給料（手取り）
    retirementAge?: number;
    salaryLabel?: string;
    showAllowancesToggle?: boolean; // 児童手当・児童扶養手当の表示/非表示
}) {
    // 65歳未満（現役期間）のみに限定
    const filtered = data
        .filter((entry) => entry.age < retirementAge)
        .map((entry) => {
            // Layer 1: 遺族年金（濃い緑）
            const pensionMonthly = Math.min(entry.pension / 12, currentSalaryMonthly);
            
            // Layer 2: 児童手当・児童扶養手当（薄緑、トグルで表示/非表示）
            const allowancesMonthly = showAllowancesToggle 
                ? Math.min((entry.childAllowanceMonthly || 0) + (entry.childSupportAllowanceMonthly || 0), currentSalaryMonthly - pensionMonthly)
                : 0;
            
            // Layer 3: 不要な支出（グレー）
            const remainingAfterPensionAndAllowances = currentSalaryMonthly - pensionMonthly - allowancesMonthly;
            const grayAreaMonthly = Math.min(Math.max(0, (entry.grayArea || 0) / 12), Math.max(0, remainingAfterPensionAndAllowances));
            
            // Layer 4: 真の不足額（赤）または Layer 5: 余剰額（青）
            // 不足額計算は常に手当を含めて計算（表示/非表示は見た目のみ）
            const totalAllowancesMonthly = (entry.childAllowanceMonthly || 0) + (entry.childSupportAllowanceMonthly || 0);
            const totalIncomeMonthly = pensionMonthly + totalAllowancesMonthly;
            const targetMonthly = currentSalaryMonthly - grayAreaMonthly; // 給料 - 不要額
            const shortfallMonthly = Math.max(0, targetMonthly - totalIncomeMonthly); // 不足額
            const surplusMonthly = Math.max(0, totalIncomeMonthly - targetMonthly); // 余剰額

            return {
                ...entry,
                pensionMonthly,
                allowancesMonthly,
                grayAreaMonthly,
                shortfallMonthly,
                surplusMonthly,
            };
        });

    if (!filtered.length || currentSalaryMonthly <= 0) {
    return (
            <div className="h-48 flex items-center justify-center rounded-2xl border border-slate-800 bg-slate-950/40 text-sm text-slate-500">
                表示できる期間がありません
                        </div>
        );
    }

    const startAge = filtered[0].age;
    const maxAgeInFiltered = filtered[filtered.length - 1].age;

    // 変化点を抽出してステップチャートの「段差」を作る
    const keyAges = new Set<number>();
    keyAges.add(startAge);
    // データの変化点を検出して追加
    for (let i = 1; i < filtered.length; i++) {
        const prev = filtered[i - 1];
        const curr = filtered[i];

        // 表示される数値（ラベル）が変わるタイミングを変化点とする
        // これにより、見た目が同じブロックは結合される
        const formatVal = (v: number) => (v / 10000).toFixed(1);

        const prevPension = formatVal(prev.pensionMonthly);
        const currPension = formatVal(curr.pensionMonthly);
        const prevAllowances = formatVal(prev.allowancesMonthly);
        const currAllowances = formatVal(curr.allowancesMonthly);
        const prevGray = formatVal(prev.grayAreaMonthly);
        const currGray = formatVal(curr.grayAreaMonthly);
        const prevShortfall = formatVal(prev.shortfallMonthly);
        const currShortfall = formatVal(curr.shortfallMonthly);
        const prevSurplus = formatVal(prev.surplusMonthly || 0);
        const currSurplus = formatVal(curr.surplusMonthly || 0);

        if (
            prevPension !== currPension ||
            prevAllowances !== currAllowances ||
            prevGray !== currGray ||
            prevShortfall !== currShortfall ||
            prevSurplus !== currSurplus
        ) {
            keyAges.add(curr.age);
        }
    }
    // 最後の年齢の翌年（終了点）も追加したいが、データ範囲内での描画にするため
    // 最後のデータの年齢 + 1 を「終了」として扱う
    const endAge = maxAgeInFiltered + 1;
    keyAges.add(endAge);

    const sortedKeyAges = Array.from(keyAges).sort((a, b) => a - b);

    // 表示用データポイント作成
    // 各区間の開始年齢とその時点のデータを持つ
    const displayPoints = sortedKeyAges.slice(0, -1).map((age) => {
        const matchedEntry = filtered.find((entry) => entry.age === age) ?? filtered[filtered.length - 1];
        const nextAge = sortedKeyAges.find(a => a > age) ?? endAge;
        return {
            age: matchedEntry.age,
            endAge: nextAge,
            pensionMonthly: matchedEntry.pensionMonthly,
            allowancesMonthly: matchedEntry.allowancesMonthly,
            grayAreaMonthly: matchedEntry.grayAreaMonthly,
            shortfallMonthly: matchedEntry.shortfallMonthly,
            surplusMonthly: matchedEntry.surplusMonthly || 0,
        };
    });

    // 描画エリア設定
    const width = 820;
    const height = 320;
    const padding = { top: 40, right: 40, bottom: 40, left: 60 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    const minAge = startAge;
    const maxAge = endAge;
    const ageRange = Math.max(maxAge - minAge, 1);
    const getX = (age: number) => ((age - minAge) / ageRange) * graphWidth;

    // Y軸は現在の月額給料に固定（満水基準）+ 10万円の余裕
    const maxAmount = Math.max(currentSalaryMonthly + 100000, 1);
    const getY = (value: number) => graphHeight - (value / maxAmount) * graphHeight;

    const incomeColor = '#10B981'; // Emerald-500
    const incomeStroke = '#059669'; // Emerald-600
    const grayAreaColor = '#94a3b8'; // Slate-400
    const grayAreaStroke = '#64748b'; // Slate-500
    const shortfallColor = '#EF4444'; // Red-500
    const shortfallStroke = '#B91C1C'; // Red-700

    // ラベルを表示するための最小視覚的高さ（金額換算）
    // 5万円分の高さがあれば2行ラベル（約25-30px）が収まると仮定
    const MIN_VISUAL_AMOUNT = 50000;



    return (
        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
            <SVGPatterns />
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                <g transform={`translate(${padding.left},${padding.top})`}>

                    {/* Y軸のグリッド */}
                    {[0, 0.5, 1.0].map((tick) => {
                        const y = graphHeight * (1 - tick);
                        const val = maxAmount * tick;
                        return (
                            <g key={tick}>
                                <line x1="0" y1={y} x2={graphWidth} y2={y} stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
                                <text x="-10" y={y + 4} textAnchor="end" fontSize="10" fill="#64748b">
                                    {(val / 10000).toFixed(1)}万円
                                </text>
                            </g>
                        );
                    })}

                    {/* 満水基準ライン（30万円の位置） - 強調表示 */}
                    {(() => {
                        const fullWaterAmount = 300000; // 30万円
                        const fullWaterY = getY(fullWaterAmount);
                        return (
                            <>
                                <line
                                    x1={0}
                                    y1={fullWaterY}
                                    x2={graphWidth}
                                    y2={fullWaterY}
                                    stroke="#EF4444" // Red-500
                                    strokeWidth="2"
                                />
                                <text
                                    x="-10"
                                    y={fullWaterY + 4}
                                    textAnchor="end"
                                    fontSize="12"
                                    fill="#EF4444" // Red-500
                                    fontWeight="bold"
                                >
                                    30万円
                                </text>
                            </>
                        );
                    })()}

                    {/* X軸のグリッドとラベル（変化点のみ） */}
                    {sortedKeyAges.map((age, idx) => {
                        const x = getX(age);

                        // 表示判定：最初、最後、または「遺族年金（濃い緑）」が変化したタイミングのみ表示
                        let showLabel = false;
                        if (idx === 0) showLabel = true;
                        else if (idx === sortedKeyAges.length - 1) showLabel = true;
                        else {
                            const currentBlock = displayPoints[idx];
                            const prevBlock = displayPoints[idx - 1];
                            // 1万円以上の遺族年金変化がある場合のみラベルを表示
                            if (currentBlock && prevBlock) {
                                if (Math.abs(currentBlock.pensionMonthly - prevBlock.pensionMonthly) > 10000) {
                                    showLabel = true;
                                }
                            }
                        }

                        return (
                            <g key={age}>
                                <line x1={x} y1={0} x2={x} y2={graphHeight} stroke="#1e293b" strokeDasharray="2 2" strokeWidth="1" />
                                {showLabel && (
                                    <text x={x} y={graphHeight + 20} textAnchor="middle" fontSize="10" fill="#94a3b8">
                                        {age}歳
                                    </text>
                                )}
                            </g>
                        );
                    })}

                    {/* ブロック状の積層描画（階段状） */}
                    {displayPoints.map((entry, idx) => {
                        const currentX = getX(entry.age);
                        const nextX = getX(entry.endAge);
                        const width = Math.max(nextX - currentX, 0);

                        if (width <= 0) return null;

                        const baseY = getY(0);
                        // incomeYは後で計算するのでここでは宣言しない

                        // 視覚的な高さを計算（ラベル表示用に最小高さを確保）
                        // Layer 1: 遺族年金（濃い緑）
                        let visualPensionAmount = entry.pensionMonthly;
                        
                        // Layer 2: 児童手当・児童扶養手当（薄緑、トグルで表示/非表示）
                        let visualAllowancesAmount = entry.allowancesMonthly > 0 
                            ? Math.max(entry.allowancesMonthly, MIN_VISUAL_AMOUNT) 
                            : 0;
                        
                        // Layer 3: 不要な支出（グレー）
                        let visualGrayAmount = entry.grayAreaMonthly > 0 
                            ? Math.max(entry.grayAreaMonthly, MIN_VISUAL_AMOUNT) 
                            : 0;
                        
                        // Layer 4: 真の不足額（赤）
                        let visualShortfallAmount = entry.shortfallMonthly > 0 
                            ? Math.max(entry.shortfallMonthly, MIN_VISUAL_AMOUNT) 
                            : 0;
                        
                        // Layer 5: 余剰額（青）- 満水基準ラインの上に表示
                        // 余剰額が0より大きい場合は、最小視覚的高さを確保して表示
                        let visualSurplusAmount = entry.surplusMonthly > 0 
                            ? Math.max(entry.surplusMonthly, MIN_VISUAL_AMOUNT) 
                            : 0;

                        // 合計が満水基準（maxAmount）を超えないように調整
                        // 優先順位: 不足（赤） > 不要（グレー） > 手当（薄緑） > 年金（濃い緑）
                        // 余剰額は満水基準ラインの上に表示されるため、調整計算には含めない
                        const totalVisual = visualPensionAmount + visualAllowancesAmount + visualGrayAmount + visualShortfallAmount;
                        const overflow = totalVisual - maxAmount;

                        if (overflow > 0) {
                            // まず年金を削る
                            const reducePension = Math.min(visualPensionAmount, overflow);
                            visualPensionAmount -= reducePension;
                            let remainingOverflow = overflow - reducePension;

                            // まだあふれているなら手当を削る
                            if (remainingOverflow > 0) {
                                const reduceAllowances = Math.min(visualAllowancesAmount, remainingOverflow);
                                visualAllowancesAmount -= reduceAllowances;
                                remainingOverflow -= reduceAllowances;
                            }

                            // まだあふれているなら不要を削る
                            if (remainingOverflow > 0) {
                                const reduceGray = Math.min(visualGrayAmount, remainingOverflow);
                                visualGrayAmount -= reduceGray;
                                // 理論上、不足（赤）は削らない（ユーザー要望の最小サイズ優先）
                            }
                        }

                        // 積み上げ座標の計算（調整後の視覚的な高さを使用）
                        const pensionY = getY(visualPensionAmount);
                        const allowancesY = getY(visualPensionAmount + visualAllowancesAmount);
                        const grayY = getY(visualPensionAmount + visualAllowancesAmount + visualGrayAmount);
                        const shortfallY = getY(visualPensionAmount + visualAllowancesAmount + visualGrayAmount + visualShortfallAmount);
                        
                        // 余剰額のY座標（満水基準ライン30万円の上に表示）
                        const fullWaterAmount = 300000; // 30万円
                        const fullWaterY = getY(fullWaterAmount);
                        // 余剰額は満水基準ラインの上に表示（Y座標が小さいほど上）
                        const surplusY = fullWaterY - (visualSurplusAmount / maxAmount) * graphHeight;

                        // ラベル表示判定（幅が十分ある場合のみ）
                        const showPensionLabel = width > 40 && entry.pensionMonthly > 10000;
                        const showAllowancesLabel = width > 40 && entry.allowancesMonthly > 10000;
                        const showSurplusLabel = width > 40 && entry.surplusMonthly > 10000;

                        return (
                            <g key={`${entry.age}-${idx}`}>
                                {/* Layer 1: 遺族年金（濃い緑） */}
                                <rect
                                    x={currentX}
                                    y={pensionY}
                                    width={width}
                                    height={Math.max(baseY - pensionY, 0)}
                                    fill={incomeColor}
                                    stroke={incomeStroke}
                                    strokeWidth="1"
                                />
                                {showPensionLabel && (
                                    <text
                                        x={currentX + width / 2}
                                        y={pensionY + (baseY - pensionY) / 2}
                                        textAnchor="middle"
                                        dominantBaseline="central"
                                        fontSize="10"
                                        fill="white"
                                        fontWeight="bold"
                                        style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                    >
                                        <tspan x={currentX + width / 2} dy="-0.6em">遺族年金</tspan>
                                        <tspan x={currentX + width / 2} dy="1.2em">{(entry.pensionMonthly / 10000).toFixed(1)}万円</tspan>
                                    </text>
                                )}

                                {/* Layer 2: 児童手当・児童扶養手当（薄緑、トグルで表示/非表示） */}
                                {visualAllowancesAmount > 0 && (
                                    <g>
                                        <rect
                                            x={currentX}
                                            y={allowancesY}
                                            width={width}
                                            height={Math.max(pensionY - allowancesY, 0)}
                                            fill="#86EFAC" // emerald-300 (薄緑)
                                            stroke="#6EE7B7" // emerald-400
                                            strokeWidth="1"
                                        />
                                        {showAllowancesLabel && (
                                            <text
                                                x={currentX + width / 2}
                                                y={allowancesY + (pensionY - allowancesY) / 2}
                                                textAnchor="middle"
                                                dominantBaseline="central"
                                                fontSize="10"
                                                fill="white"
                                                fontWeight="bold"
                                                style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                            >
                                                <tspan x={currentX + width / 2} dy="-0.6em">児童手当等</tspan>
                                                <tspan x={currentX + width / 2} dy="1.2em">{(entry.allowancesMonthly / 10000).toFixed(1)}万円</tspan>
                                            </text>
                                        )}
                                    </g>
                                )}

                                {/* Layer 3: 不要な支出（グレー） */}
                                {entry.grayAreaMonthly > 0 && (
                                    <g>
                                        <rect
                                            x={currentX}
                                            y={grayY}
                                            width={width}
                                            height={Math.max(allowancesY - grayY, 0)}
                                            fill={grayAreaColor}
                                            stroke={grayAreaStroke}
                                            strokeWidth="1"
                                        />
                                        {width > 30 && (
                                            <text
                                                x={currentX + width / 2}
                                                y={grayY + (allowancesY - grayY) / 2}
                                                textAnchor="middle"
                                                dominantBaseline="central"
                                                fontSize="10"
                                                fill="white"
                                                fontWeight="bold"
                                                style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                            >
                                                <tspan x={currentX + width / 2} dy="-0.6em">不要額</tspan>
                                                <tspan x={currentX + width / 2} dy="1.2em">{(entry.grayAreaMonthly / 10000).toFixed(1)}万円</tspan>
                                            </text>
                                        )}
                                    </g>
                                )}

                                {/* Layer 4: 真の不足額（赤） */}
                                {entry.shortfallMonthly > 0 && (
                                    <g>
                                        <rect
                                            x={currentX}
                                            y={shortfallY}
                                            width={width}
                                            height={Math.max(grayY - shortfallY, 0)}
                                            fill="url(#shortfallHatch)"
                                            stroke={shortfallStroke}
                                            strokeWidth="1"
                                        />
                                        {width > 30 && (
                                            <text
                                                x={currentX + width / 2}
                                                y={shortfallY + (grayY - shortfallY) / 2}
                                                textAnchor="middle"
                                                dominantBaseline="central"
                                                fontSize="10"
                                                fill="white"
                                                fontWeight="bold"
                                                style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                            >
                                                <tspan x={currentX + width / 2} dy="-0.6em">不足額</tspan>
                                                <tspan x={currentX + width / 2} dy="1.2em">{(entry.shortfallMonthly / 10000).toFixed(1)}万円</tspan>
                                            </text>
                                        )}
                                    </g>
                                )}

                                {/* Layer 5: 余剰額（青）- 満水基準ライン30万円の上に表示 */}
                                {entry.surplusMonthly > 0 && visualSurplusAmount > 0 && (
                                    <g>
                                        {(() => {
                                            const fullWaterAmount = 300000; // 30万円
                                            const fullWaterY = getY(fullWaterAmount);
                                            // 余剰額の高さを計算（満水基準ラインから上方向）
                                            // 実際の余剰額を基準に計算（visualSurplusAmountは最小視覚的高さに調整されているため）
                                            const actualSurplusAmount = entry.surplusMonthly;
                                            const surplusHeight = (actualSurplusAmount / maxAmount) * graphHeight;
                                            // 最小視覚的高さを確保（5万円分の高さ）
                                            const minSurplusHeight = (MIN_VISUAL_AMOUNT / maxAmount) * graphHeight;
                                            const finalSurplusHeight = Math.max(surplusHeight, minSurplusHeight);
                                            
                                            // rectYが0以上になるように調整（グラフの範囲内に収める）
                                            const rectY = Math.max(0, fullWaterY - finalSurplusHeight);
                                            // rectHeightも調整（fullWaterYを超えないように）
                                            const rectHeight = Math.max(0, Math.min(finalSurplusHeight, fullWaterY - rectY));
                                            
                                            // rectHeightが0より大きい場合のみ描画
                                            if (rectHeight <= 0) return null;
                                            
    return (
                                                <>
                                                    <rect
                                                        x={currentX}
                                                        y={rectY}
                                                        width={width}
                                                        height={rectHeight}
                                                        fill="#60A5FA" // blue-400
                                                        stroke="#3B82F6" // blue-500
                                                        strokeWidth="1"
                                                        opacity="0.8"
                                                    />
                                                    {showSurplusLabel && (
                                                        <text
                                                            x={currentX + width / 2}
                                                            y={rectY + rectHeight / 2}
                                                            textAnchor="middle"
                                                            dominantBaseline="central"
                                                            fontSize="10"
                                                            fill="white"
                                                            fontWeight="bold"
                                                            style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                                        >
                                                            <tspan x={currentX + width / 2} dy="-0.6em">余剰額</tspan>
                                                            <tspan x={currentX + width / 2} dy="1.2em">{(entry.surplusMonthly / 10000).toFixed(1)}万円</tspan>
                                                        </text>
                                                    )}
                                                </>
                                            );
                                        })()}
                                    </g>
                                )}
                            </g>
                        );
                    })}


                </g>
            </svg>
        </div>
    );
}

/* ===================== ページ本体 ===================== */
export default function NecessaryCoveragePage() {
    const [profile, setProfile] = useState<CustomerProfile | null>(null);
    // 生活費調整率
    const [expenseRatioSurvivor, setExpenseRatioSurvivor] = useState(70); // 一般的な生活費圧縮率（約70%）
    const [expenseRatioDisability, setExpenseRatioDisability] = useState(110); // 医療・介護を考慮した一般的な増加率（約110%）
    // 就労収入調整率（リスク調整）
    const [workIncomeRatio, setWorkIncomeRatio] = useState(90); // デフォルト90%（共働きで就労継続を想定）
    const [currentSavingsMan, setCurrentSavingsMan] = useState(0); // 既存の貯蓄・保険（万円）
    const [showSavingsInfo, setShowSavingsInfo] = useState(false);
    // 各シナリオごとのグラフ表示期間設定
    const [displayPeriodModes, setDisplayPeriodModes] = useState<Record<string, 'child19' | 'child23' | 'retirement' | 'custom'>>({
        husbandDeath: 'child23',
        wifeDeath: 'child23',
        husbandDisability: 'child23',
        wifeDisability: 'child23',
        singleDeath: 'child23',
        singleDisability: 'child23',
    });
    const [customEndAges, setCustomEndAges] = useState<Record<string, number>>({
        husbandDeath: 65,
        wifeDeath: 65,
        husbandDisability: 65,
        wifeDisability: 65,
        singleDeath: 65,
        singleDisability: 65,
    });

    const [scenarios, setScenarios] = useState<{
        husbandDeath: ScenarioResult;
        wifeDeath: ScenarioResult;
        husbandDisability: ScenarioResult;
        wifeDisability: ScenarioResult;
        singleDeath: ScenarioResult;
        singleDisability: ScenarioResult;
    } | null>(null);
    const currentSavingsYen = Math.max(0, Math.round(currentSavingsMan * 10000));

    const sicknessAllowanceTotal = useMemo(() => {
        if (!profile) return 0;
        const allowanceMonths = 18; // 傷病手当金は最長1年6カ月
        const approxTakeHome = Math.max(profile.monthlyLivingExpense, 0);
        return Math.round(approxTakeHome * 0.67 * allowanceMonths);
    }, [profile]);

    // localStorageから読み込み
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('customer-profile');
            const savedBasic = localStorage.getItem('customer-profile-basic');

            if (saved && savedBasic) {
                try {
                    const parsed = JSON.parse(saved);
                    const parsedBasic = JSON.parse(savedBasic);
                    setProfile({ ...parsed, basicInfo: parsedBasic });
                } catch (e) {
                    console.error('Failed to load profile', e);
                }
            }
        }
    }, []);

    // profileが読み込まれたときに各シナリオのcustomEndAgeを初期化
    useEffect(() => {
        if (!profile) return;
        const currentAge = profile.basicInfo.spouseType === 'couple'
            ? (profile.basicInfo.ageHusband || profile.basicInfo.ageWife || 0)
            : (profile.basicInfo.age || 0);
        const oldAgeStart = profile.basicInfo.spouseType === 'couple'
            ? (profile.basicInfo.oldAgeStartHusband || profile.basicInfo.oldAgeStartWife || 65)
            : (profile.basicInfo.oldAgeStart || 65);

        const scenarioKeys = ['husbandDeath', 'wifeDeath', 'husbandDisability', 'wifeDisability', 'singleDeath', 'singleDisability'];
        const newCustomEndAges = { ...customEndAges };
        
        scenarioKeys.forEach((key) => {
            const mode = displayPeriodModes[key];
            if (mode !== 'custom') {
                if (mode === 'child19' && profile.basicInfo.childrenAges.length > 0) {
                    const youngestChild = Math.min(...profile.basicInfo.childrenAges);
                    newCustomEndAges[key] = currentAge + (19 - youngestChild);
                } else if (mode === 'child23' && profile.basicInfo.childrenAges.length > 0) {
                    const youngestChild = Math.min(...profile.basicInfo.childrenAges);
                    newCustomEndAges[key] = currentAge + (23 - youngestChild);
                } else if (mode === 'retirement') {
                    newCustomEndAges[key] = oldAgeStart;
                }
            }
        });
        
        setCustomEndAges(newCustomEndAges);
    }, [profile, displayPeriodModes]);

    // 時系列計算ロジック
    useEffect(() => {
        if (!profile) return;

        const { basicInfo } = profile;
        const currentExpenseMonthly = profile.monthlyLivingExpense || 0;
        const currentExpenseAnnual = currentExpenseMonthly * 12;
        // 住宅ローン月額（顧客プロフィールから取得）
        const housingLoanMonthly = (profile.details?.housingLoan as number) || 0;
        const housingLoanAnnual = housingLoanMonthly * 12;

        // 教育費の簡易推定 (年齢別月額)
        const getEducationCost = (age: number): number => {
            if (age < 6) return 15000 * 12;
            if (age < 12) return 20000 * 12;
            if (age < 15) return 30000 * 12;
            if (age < 18) return 40000 * 12;
            if (age < 23) return 80000 * 12;
            return 0;
        };

        const calculateScenario = (
            type: 'survivor' | 'disability',
            targetPerson: 'husband' | 'wife' | 'single',
            endAge: number
        ): ScenarioResult => {
            const data: YearlyData[] = [];
            const startAge = targetPerson === 'wife' ? basicInfo.ageHusband : (targetPerson === 'husband' ? basicInfo.ageWife : basicInfo.age);
            // 配偶者（遺族）の開始年齢
            const spouseStartAge = targetPerson === 'husband' ? basicInfo.ageWife : (targetPerson === 'wife' ? basicInfo.ageHusband : 0);

            // 遺族の年収（ターゲットが夫なら、妻の収入を使う）
            let survivorBaseIncome = 0;
            if (targetPerson === 'husband') survivorBaseIncome = (basicInfo.annualIncomeWife || (basicInfo.avgStdMonthlyWife * 12)) || 0;
            else if (targetPerson === 'wife') survivorBaseIncome = (basicInfo.annualIncomeHusband || (basicInfo.avgStdMonthlyHusband * 12)) || 0;

            if (type === 'disability') {
                if (targetPerson === 'husband') survivorBaseIncome = (basicInfo.annualIncomeWife || (basicInfo.avgStdMonthlyWife * 12)) || 0;
                else if (targetPerson === 'wife') survivorBaseIncome = (basicInfo.annualIncomeHusband || (basicInfo.avgStdMonthlyHusband * 12)) || 0;
                else survivorBaseIncome = 0;
            }

            const maxAge = 100;
            const years = maxAge - startAge;

            let totalShortfall = 0;
            let monthlyShortfallMax = 0;
            let activeMonthsSum = 0;
            const reserveFundAnnual = Math.round(currentExpenseAnnual * RESERVE_RATIO);

            for (let i = 0; i <= years; i++) {
                const currentAge = startAge + i;
                const spouseAge = spouseStartAge > 0 ? spouseStartAge + i : 0;

                let pension = 0;

                const childrenCurrentAges = basicInfo.childrenAges.map(age => age + i);
                const eligibleChildren18 = childrenCurrentAges.filter(age => age < 19).length;
                const eligibleChildrenDisability = calculateEligibleChildrenCount(childrenCurrentAges, 2);

                if (type === 'survivor') {
        if (basicInfo.spouseType === 'couple') {
                        if (targetPerson === 'husband') {
                            let kiso = 0;
                            if (eligibleChildren18 > 0) {
                                kiso = kisoAnnualByCount(eligibleChildren18);
                            }
                            const kousei = proportionAnnual(basicInfo.avgStdMonthlyHusband, basicInfo.monthsHusband, basicInfo.useMinashi300Husband);
            let chukorei = 0;
                            if (eligibleChildren18 === 0 && currentAge >= 40 && currentAge < 65) {
                chukorei = CHUKOREI_KASAN;
            }
                            if (currentAge >= 65) {
                                pension = kousei + KISO_BASE_ANNUAL;
                            } else {
                                pension = kiso + kousei + chukorei;
                            }
                        }
                        else if (targetPerson === 'wife') {
                            let kiso = 0;
                            if (eligibleChildren18 > 0) {
                                kiso = kisoAnnualByCount(eligibleChildren18);
                            }
                            const kousei = proportionAnnual(basicInfo.avgStdMonthlyWife, basicInfo.monthsWife, basicInfo.useMinashi300Wife);
                            pension = kiso + kousei;
                        }
                    } else {
                        const kousei = proportionAnnual(basicInfo.avgStdMonthly, basicInfo.employeePensionMonths, basicInfo.useMinashi300);
                        pension = kousei;
                    }

                } else {
                    const level = 2;
                    const kiso = calculateDisabilityBasicPension(level, eligibleChildrenDisability);
                    const spouseBonus = (spouseAge > 0 && spouseAge < 65) ? SPOUSE_BONUS : 0;

                    let kousei = 0;
                    if (targetPerson === 'husband') {
                        kousei = calculateDisabilityEmployeePension(level, spouseBonus, 0, basicInfo.avgStdMonthlyHusband, basicInfo.monthsHusband, true);
                    } else if (targetPerson === 'wife') {
                        kousei = calculateDisabilityEmployeePension(level, spouseBonus, 0, basicInfo.avgStdMonthlyWife, basicInfo.monthsWife, true);
                    } else {
                        kousei = calculateDisabilityEmployeePension(level, 0, 0, basicInfo.avgStdMonthly, basicInfo.employeePensionMonths, false);
                    }
                    pension = kiso + kousei;
                }

                let workIncome = 0;
                // 就労収入：昇給率は考慮せず、現在の給料ベースで一定（フラット）に推移させる
                if (type === 'survivor') {
                    if (currentAge < 65) {
                        workIncome = survivorBaseIncome * (workIncomeRatio / 100);
                    }
                } else {
                    if (spouseAge > 0 && spouseAge < 65) {
                        workIncome = survivorBaseIncome * (workIncomeRatio / 100);
                    }
                }

                const expenseRatio = type === 'survivor' ? expenseRatioSurvivor : expenseRatioDisability;
                // 遺族シナリオでは団信により住宅ローンが免除されるため控除、障害シナリオでは控除しない
                const expenseBase = type === 'survivor'
                    ? currentExpenseAnnual - housingLoanAnnual  // 遺族: 住宅ローンを控除
                    : currentExpenseAnnual;  // 障害: 住宅ローンを含む
                const baseExpense = Math.round(expenseBase * (expenseRatio / 100));

                let educationCost = 0;
                if (basicInfo.childrenAges.length > 0) {
                    educationCost = childrenCurrentAges.reduce((sum, age) => sum + getEducationCost(age), 0);
                }

                // 児童手当・児童扶養手当の計算（遺族シナリオのみ）
                let childAllowanceMonthly = 0;
                let childSupportAllowanceMonthly = 0;
                if (type === 'survivor') {
                    // 児童手当（全国共通・定額）
                    childAllowanceMonthly = calculateChildAllowance(childrenCurrentAges);
                    
                    // 児童扶養手当（ひとり親・所得制限あり）
                    // 遺族となる配偶者の年収を使用
                    const survivorAnnualIncome = survivorBaseIncome;
                    childSupportAllowanceMonthly = calculateChildSupportAllowance(
                        childrenCurrentAges,
                        survivorAnnualIncome
                    );
                }

                // ターゲット（死亡/障害者）の事故前の手取り年収を計算（これが満水ターゲットになる）
                let targetAnnualIncome = 0;
                if (targetPerson === 'husband') {
                    const gross = basicInfo.annualIncomeHusband || (basicInfo.avgStdMonthlyHusband * 12);
                    targetAnnualIncome = gross * 0.8;
                } else if (targetPerson === 'wife') {
                    const gross = basicInfo.annualIncomeWife || (basicInfo.avgStdMonthlyWife * 12);
                    targetAnnualIncome = gross * 0.8;
                } else {
                    const gross = basicInfo.annualIncome || (basicInfo.avgStdMonthly * 12);
                    targetAnnualIncome = gross * 0.8;
                }

                // 遺族シナリオの場合、緑色のエリア（確保済み収入）は「遺族年金のみ」とする指示のため、就労収入を含めない
                const baseIncome = type === 'survivor' ? pension : (pension + workIncome);
                let totalTarget = 0;
                let grayArea = 0;

                if (type === 'survivor') {
                    // 遺族シナリオ: 「収入保障（給与填補）ベース」
                    // ターゲット = 事故前の手取り年収 - 不要な支出（グレーエリア）

                    // 1. 住宅ローン（団信で消える）
                    const housingLoan = housingLoanAnnual;

                    // 2. 夫の生活費（浮くお金）
                    // 計算式: (現在の生活費 - 住宅ローン) * (1 - 遺族生活費率)
                    const livingExpenseBase = Math.max(0, currentExpenseAnnual - housingLoanAnnual);
                    const survivorRatio = expenseRatioSurvivor / 100;
                    const deceasedLivingExpense = livingExpenseBase * (1 - survivorRatio);

                    grayArea = housingLoan + deceasedLivingExpense;

                    // 必要保障額（ターゲット）は、手取り年収からグレーエリアを引いたもの
                    totalTarget = Math.max(0, targetAnnualIncome - grayArea);
                } else {
                    // 障害シナリオ: 「生活費保障（生存保障）ベース」
                    // ターゲット = 必要生活費 + 教育費 + 予備費
                    totalTarget = baseExpense + educationCost + reserveFundAnnual;
                    grayArea = 0;
                }

                // 不足額計算：児童手当・児童扶養手当を含めた収入で計算
                // （トグルの表示/非表示に関わらず、常に手当を含めて計算）
                const allowancesMonthly = (childAllowanceMonthly + childSupportAllowanceMonthly) * 12; // 年額換算
                const totalIncomeWithAllowances = baseIncome + allowancesMonthly;
                const baseShortfall = Math.max(0, totalTarget - totalIncomeWithAllowances);

                // グラフ表示期間に合わせて、endAgeまでの期間のみをカウント
                const monthsActive = currentAge < endAge 
                    ? Math.max(0, Math.min(12, (endAge - currentAge) * 12))
                    : 0;
                activeMonthsSum += monthsActive;
                if (monthsActive > 0) {
                    monthlyShortfallMax = Math.max(monthlyShortfallMax, baseShortfall / 12);
                }

                data.push({
                    age: currentAge,
                    year: i,
                    pension,
                    workIncome,
                    baseExpense,
                    educationCost,
                    reserveTarget: reserveFundAnnual,
                    baseIncome,
                    totalIncome: baseIncome,
                    totalTarget,
                    baseShortfall,
                    shortfall: baseShortfall,
                    sicknessAnnual: 0,
                    savingsAnnual: 0,
                    monthsActive,
                    grayArea,
                    childAllowanceMonthly,
                    childSupportAllowanceMonthly
                });
            }

            const weightedEntries = data.map((entry) => ({
                entry,
                weight: entry.baseShortfall * (entry.monthsActive / 12),
            }));
            const weightedShortfallTotal = weightedEntries.reduce((sum, item) => sum + item.weight, 0);

            // 傷病手当金は収入面（グラフの緑の面）には組み込むが、最終保障総額の計算からは除外
            const sicknessDeduction = type === 'disability'
                ? Math.min(sicknessAllowanceTotal, weightedShortfallTotal)
                : 0;
            // 最終保障総額の計算から傷病手当金の控除を削除：貯蓄のみを控除
            const savingsApplied = Math.min(currentSavingsYen, weightedShortfallTotal);

            const distributeAllowance = (total: number) =>
                weightedEntries.map((item) => (weightedShortfallTotal > 0 ? (item.weight / weightedShortfallTotal) * total : 0));

            const sicknessDistribution = distributeAllowance(sicknessDeduction);
            const savingsDistribution = distributeAllowance(savingsApplied);

            weightedEntries.forEach((item, idx) => {
                const entry = item.entry;
                const sicknessAnnual = sicknessDistribution[idx];
                const savingsAnnual = savingsDistribution[idx];
                // 児童手当・児童扶養手当を含めた収入で計算（常に含める）
                const allowancesAnnual = ((entry.childAllowanceMonthly || 0) + (entry.childSupportAllowanceMonthly || 0)) * 12;
                const adjustedIncome = Math.min(entry.totalTarget, entry.baseIncome + allowancesAnnual + sicknessAnnual + savingsAnnual);
                entry.totalIncome = adjustedIncome;
                entry.shortfall = Math.max(0, entry.totalTarget - adjustedIncome);
                entry.sicknessAnnual = sicknessAnnual;
                entry.savingsAnnual = savingsAnnual;
            });

            const targetActiveTotal = data.reduce((sum, entry) => sum + entry.totalTarget * (entry.monthsActive / 12), 0);
            totalShortfall = weightedShortfallTotal;
            // 最終保障総額 = 総不足額 - 既存貯蓄・保険総額（傷病手当金の控除は削除）
            const netShortfall = Math.max(0, weightedShortfallTotal - savingsApplied);
            const activeShortfalls = data.filter(d => d.monthsActive > 0).map(d => d.shortfall / 12);
            monthlyShortfallMax = activeShortfalls.length ? Math.max(...activeShortfalls) : 0;

            // 団信による住宅ローン免除額（遺族シナリオのみ、65歳までの期間）
            const exemptedHousingLoan = type === 'survivor'
                ? housingLoanAnnual * (activeMonthsSum / 12)  // 遺族: 65歳までの住宅ローン免除額
                : 0;  // 障害: 団信は適用されない

        return {
                title: type === 'survivor' ?
                    (targetPerson === 'husband' ? '夫死亡時の収支' : (targetPerson === 'wife' ? '妻死亡時の収支' : '本人死亡時の収支')) :
                    (targetPerson === 'husband' ? '夫障害時の収支' : (targetPerson === 'wife' ? '妻障害時の収支' : '本人障害時の収支')),
                data,
                totalShortfall,
                netShortfall,
                sicknessDeduction,
                savingsApplied,
                exemptedHousingLoan,
                monthlyShortfallMax,
                hasShortfall: netShortfall > 10000,
                category: type,
                activeMonths: activeMonthsSum,
                targetActiveTotal
            };
        };

        // 各シナリオごとのendAgeを計算
        const getEndAge = (scenarioKey: string) => {
            return customEndAges[scenarioKey] || 65;
        };

        setScenarios({
            husbandDeath: calculateScenario('survivor', 'husband', getEndAge('husbandDeath')),
            wifeDeath: calculateScenario('survivor', 'wife', getEndAge('wifeDeath')),
            husbandDisability: calculateScenario('disability', 'husband', getEndAge('husbandDisability')),
            wifeDisability: calculateScenario('disability', 'wife', getEndAge('wifeDisability')),
            singleDeath: calculateScenario('survivor', 'single', getEndAge('singleDeath')),
            singleDisability: calculateScenario('disability', 'single', getEndAge('singleDisability')),
        });

    }, [profile, expenseRatioSurvivor, expenseRatioDisability, workIncomeRatio, currentSavingsYen, sicknessAllowanceTotal, customEndAges]);

    if (!profile) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-200">
                <div className="text-center">読み込み中...</div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500/30 pb-20">
            <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <span className="w-2 h-8 bg-rose-500 rounded-full"></span>
                        必要保障額シミュレーション
                    </h1>
                    <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                        TOPへ戻る
                    </Link>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-6 py-10">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-10 shadow-lg">
                    <h2 className="text-lg font-bold mb-6 flex items-center gap-2">
                        <span>⚙️</span> シミュレーション条件設定
                    </h2>

                    {/* 現在の生活費を表示 */}
                    <div className="mb-6 p-4 bg-slate-950/60 border border-slate-800 rounded-xl">
                        <div className="flex items-center justify-between">
                        <div>
                                <p className="text-xs text-slate-400 mb-1">現在の生活費（顧客プロフィールより）</p>
                                <p className="text-2xl font-bold text-white">
                                    {profile.monthlyLivingExpense ? `${(profile.monthlyLivingExpense / 10000).toFixed(1)}万円/月` : '未設定'}
                                </p>
                            </div>
                            <div className="text-right">
                                <p className="text-xs text-slate-400 mb-1">年額換算</p>
                                <p className="text-lg font-semibold text-slate-300">
                                    {profile.monthlyLivingExpense ? `${(profile.monthlyLivingExpense * 12 / 10000).toFixed(0)}万円/年` : '未設定'}
                                </p>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                遺族生活費率: <span className="text-emerald-400 font-bold">{expenseRatioSurvivor}%</span>
                            </label>
                            <input
                                type="range" min="50" max="100" step="5"
                                value={expenseRatioSurvivor}
                                onChange={(e) => setExpenseRatioSurvivor(Number(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <div className="mt-3 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                                <p className="text-xs text-slate-400 mb-1">調整後の遺族生活費（月額）</p>
                                <p className="text-xl font-bold text-emerald-400">
                                    {profile.monthlyLivingExpense
                                        ? `${(profile.monthlyLivingExpense * (expenseRatioSurvivor / 100) / 10000).toFixed(1)}万円/月`
                                        : '未設定'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {profile.monthlyLivingExpense
                                        ? `現在の生活費から ${expenseRatioSurvivor >= 100 ? '+' : ''}${((expenseRatioSurvivor / 100 - 1) * 100).toFixed(0)}%`
                                        : ''}
                                </p>
                        </div>
                            <p className="text-xs text-slate-500 mt-2">一般的には60〜80%で設定されることが多く、共働き世帯の平均は約70%です。</p>
                            </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                障害生活費率: <span className="text-amber-400 font-bold">{expenseRatioDisability}%</span>
                            </label>
                            <input
                                type="range" min="80" max="150" step="5"
                                value={expenseRatioDisability}
                                onChange={(e) => setExpenseRatioDisability(Number(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <div className="mt-3 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                                <p className="text-xs text-slate-400 mb-1">調整後の障害生活費（月額）</p>
                                <p className="text-xl font-bold text-amber-400">
                                    {profile.monthlyLivingExpense
                                        ? `${(profile.monthlyLivingExpense * (expenseRatioDisability / 100) / 10000).toFixed(1)}万円/月`
                                        : '未設定'}
                                </p>
                                <p className="text-xs text-slate-500 mt-1">
                                    {profile.monthlyLivingExpense
                                        ? `現在の生活費から ${expenseRatioDisability >= 100 ? '+' : ''}${((expenseRatioDisability / 100 - 1) * 100).toFixed(0)}%`
                                        : ''}
                                </p>
                        </div>
                            <p className="text-xs text-slate-500 mt-2">治療・介護費を含めると110〜130%程度が一般値で、介護が長期化するケースではさらに上振れします。</p>
                </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">
                                遺族/配偶者の就労率: <span className="text-sky-400 font-bold">{workIncomeRatio}%</span>
                            </label>
                            <input
                                type="range" min="0" max="100" step="10"
                                value={workIncomeRatio}
                                onChange={(e) => setWorkIncomeRatio(Number(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                            />
                            <div className="mt-3 p-3 bg-slate-950/60 border border-slate-800 rounded-lg">
                                <p className="text-xs text-slate-400 mb-1">調整後の配偶者就労収入（月額）</p>
                                {profile?.basicInfo?.spouseType === 'couple' ? (
                                    <p className="text-base font-bold text-sky-400 whitespace-nowrap overflow-x-auto">
                                        夫死亡時（妻）: {profile.basicInfo.annualIncomeWife || profile.basicInfo.avgStdMonthlyWife * 12
                                            ? `${((profile.basicInfo.annualIncomeWife || profile.basicInfo.avgStdMonthlyWife * 12) * (workIncomeRatio / 100) / 12 / 10000).toFixed(1)}万円/月`
                                            : '未設定'} | 妻死亡時（夫）: {profile.basicInfo.annualIncomeHusband || profile.basicInfo.avgStdMonthlyHusband * 12
                                                ? `${((profile.basicInfo.annualIncomeHusband || profile.basicInfo.avgStdMonthlyHusband * 12) * (workIncomeRatio / 100) / 12 / 10000).toFixed(1)}万円/月`
                                                : '未設定'}
                                    </p>
                                ) : (
                                    <p className="text-xl font-bold text-sky-400">
                                        {profile?.basicInfo?.annualIncome || profile?.basicInfo?.avgStdMonthly * 12
                                            ? `${((profile.basicInfo.annualIncome || profile.basicInfo.avgStdMonthly * 12) * (workIncomeRatio / 100) / 12 / 10000).toFixed(1)}万円/月`
                                            : '未設定'}
                                    </p>
                                )}
                                <p className="text-xs text-slate-500 mt-1">
                                    就労率 {workIncomeRatio}% を適用
                                </p>
                                        </div>
                            <p className="text-xs text-slate-500 mt-2">共働き世帯では40〜60%が現実的なラインとされ、デフォルトの90%は「現状維持に近い働き方」を想定しています。</p>
                                        </div>

                        <div className="md:col-span-3 space-y-3">
                            <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
                                <label className="block text-sm font-medium text-slate-400">現在の貯蓄・既存保険総額</label>
                                <button
                                    type="button"
                                    onClick={() => setShowSavingsInfo((prev) => !prev)}
                                    className="inline-flex items-center gap-2 text-sm font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                                >
                                    <span role="img" aria-label="hint">💡</span>
                                    入力しなくても問題ありません。
                                    <span className={`text-xs transition-transform ${showSavingsInfo ? 'rotate-180' : ''}`}>⌃</span>
                                </button>
                                        </div>
                            <div className="relative">
                                <select
                                    value={currentSavingsMan}
                                    onChange={(e) => setCurrentSavingsMan(Number(e.target.value))}
                                    className="w-full rounded-xl px-4 py-3 bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-100 font-mono text-lg appearance-none"
                                >
                                    {SAVINGS_OPTIONS_MAN.map((option) => (
                                        <option key={option} value={option}>
                                            {option.toLocaleString()}万円
                                        </option>
                                    ))}
                                </select>
                                <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-sm text-slate-500">
                                    ▼
                                </span>
                                        </div>
                            {showSavingsInfo && (
                                <div className="rounded-xl border border-slate-800 bg-slate-950/60 p-4 text-xs leading-relaxed space-y-2 animate-fade-in">
                                    <p className="text-slate-300 font-semibold">【現在の貯蓄・既存保険総額】について</p>
                                    <p className="text-slate-400">この項目は、お客様の<strong className="text-white font-semibold">「今の備え（貯金や学資保険、既存の死亡保険など）」</strong>をシミュレーションに反映させ、<strong className="text-emerald-300">本当に必要な保険額</strong>を正確に計算するためにあります。</p>
                                    <p className="text-slate-400"><strong className="text-white">入力しなくても問題ありません。</strong></p>
                                    <ul className="text-slate-400 space-y-1 pl-4 list-disc">
                                        <li>入力しない場合（0万円のまま）は、「貯蓄が全くない状態で、公的年金とご家族の収入だけで生活した場合の<strong className="text-rose-300">最大の不足額</strong>」として算出します。</li>
                                        <li>FPとしての責任として、お客様が<strong className="text-white">「保険で確保したい」</strong>金額を優先し、あえて貯蓄を入れずに計算することも可能です。後ほどFPにご相談の際に、貯蓄の使い道を一緒に検討します。</li>
                                    </ul>
                            </div>
                        )}
                                        </div>
                                        </div>
                                    </div>

                {scenarios && (
                    <div className="space-y-16">
                        {profile.basicInfo.spouseType === 'couple' ? (
                            <>
                                <ScenarioSection
                                    result={scenarios.husbandDeath}
                                    profile={profile}
                                    color="emerald"
                                    icon="💀"
                                    description="夫が死亡した場合、家庭から夫の収入がなくなる。公的保障による補填額を確認します"
                                    scenarioKey="husbandDeath"
                                    displayPeriodModes={displayPeriodModes}
                                    setDisplayPeriodModes={setDisplayPeriodModes}
                                    customEndAges={customEndAges}
                                    setCustomEndAges={setCustomEndAges}
                                />
                                <ScenarioSection
                                    result={scenarios.husbandDisability}
                                    profile={profile}
                                    color="amber"
                                    icon="🏥"
                                    description="夫が障害状態になった場合、収入減と支出増による不足額"
                                    scenarioKey="husbandDisability"
                                    displayPeriodModes={displayPeriodModes}
                                    setDisplayPeriodModes={setDisplayPeriodModes}
                                    customEndAges={customEndAges}
                                    setCustomEndAges={setCustomEndAges}
                                />
                                <ScenarioSection
                                    result={scenarios.wifeDeath}
                                    profile={profile}
                                    color="emerald"
                                    icon="💀"
                                    description="妻が死亡した場合、残された夫と子の生活費不足額"
                                    scenarioKey="wifeDeath"
                                    displayPeriodModes={displayPeriodModes}
                                    setDisplayPeriodModes={setDisplayPeriodModes}
                                    customEndAges={customEndAges}
                                    setCustomEndAges={setCustomEndAges}
                                />
                                <ScenarioSection
                                    result={scenarios.wifeDisability}
                                    profile={profile}
                                    color="amber"
                                    icon="🏥"
                                    description="妻が障害状態になった場合、家事代行費等の支出増も考慮が必要"
                                    scenarioKey="wifeDisability"
                                    displayPeriodModes={displayPeriodModes}
                                    setDisplayPeriodModes={setDisplayPeriodModes}
                                    customEndAges={customEndAges}
                                    setCustomEndAges={setCustomEndAges}
                                />
                            </>
                        ) : (
                            <>
                                <ScenarioSection
                                    result={scenarios.singleDeath}
                                    profile={profile}
                                    color="emerald"
                                    icon="💀"
                                    description="死亡時の整理資金や、親族への遺族年金"
                                    scenarioKey="singleDeath"
                                    displayPeriodModes={displayPeriodModes}
                                    setDisplayPeriodModes={setDisplayPeriodModes}
                                    customEndAges={customEndAges}
                                    setCustomEndAges={setCustomEndAges}
                                />
                                <ScenarioSection
                                    result={scenarios.singleDisability}
                                    profile={profile}
                                    color="amber"
                                    icon="🏥"
                                    description="障害状態での就労不能リスクと生活費不足"
                                    scenarioKey="singleDisability"
                                    displayPeriodModes={displayPeriodModes}
                                    setDisplayPeriodModes={setDisplayPeriodModes}
                                    customEndAges={customEndAges}
                                    setCustomEndAges={setCustomEndAges}
                                />
                            </>
                        )}
                    </div>
                )}

                <div className="mt-16 flex justify-center gap-4">
                    <Link
                        href="/simulators/customer-profile"
                        className="px-8 py-3 rounded-full bg-slate-900 border border-slate-800 hover:border-sky-500/50 hover:bg-slate-800 transition-all text-sky-400 font-bold flex items-center gap-2"
                    >
                        <span>👤</span> プロフィール設定に戻る
                    </Link>
                </div>
            </div>
        </main>
    );
}

function ScenarioSection({
    result,
    profile,
    color,
    icon,
    description,
    scenarioKey,
    displayPeriodModes,
    setDisplayPeriodModes,
    customEndAges,
    setCustomEndAges,
}: {
    result: ScenarioResult;
    profile: CustomerProfile;
    color: 'emerald' | 'sky' | 'amber' | 'rose';
    icon: string;
    description: string;
    scenarioKey: string;
    displayPeriodModes: Record<string, 'child19' | 'child23' | 'retirement' | 'custom'>;
    setDisplayPeriodModes: React.Dispatch<React.SetStateAction<Record<string, 'child19' | 'child23' | 'retirement' | 'custom'>>>;
    customEndAges: Record<string, number>;
    setCustomEndAges: React.Dispatch<React.SetStateAction<Record<string, number>>>;
}) {
    const displayPeriodMode = displayPeriodModes[scenarioKey] || 'child23';
    const customEndAge = customEndAges[scenarioKey] || 65;
    const calculatedEndAge = customEndAge;
    const headline = result.category === 'survivor' ? 'あなたに必要な死亡保障総額' : 'あなたに必要な所得補償総額';
    const activeMonths = Math.max(result.activeMonths, 0);
    
    // トグルボタンの状態管理（各シナリオごとに独立）
    const [showAllowancesToggle, setShowAllowancesToggle] = useState(false);
    
    // 児童手当・児童扶養手当の合計額を計算（最初のデータから取得）
    const firstDataEntry = result.data.length > 0 ? result.data[0] : null;
    const childAllowanceTotal = firstDataEntry ? (firstDataEntry.childAllowanceMonthly || 0) : 0;
    const childSupportAllowanceTotal = firstDataEntry ? (firstDataEntry.childSupportAllowanceMonthly || 0) : 0;

    // 事故発生前の現在の月額給料（手取り）を計算
    // 生き残った配偶者の給料を満水基準とする
    // 手取りは年収の約80%と仮定
    let currentSalaryMonthly = 0;
    const husbandAnnual =
        profile.basicInfo.annualIncomeHusband ||
        (profile.basicInfo.avgStdMonthlyHusband ? profile.basicInfo.avgStdMonthlyHusband * 12 : 0) ||
        0;
    const wifeAnnual =
        profile.basicInfo.annualIncomeWife ||
        (profile.basicInfo.avgStdMonthlyWife ? profile.basicInfo.avgStdMonthlyWife * 12 : 0) ||
        0;
    const singleAnnual =
        profile.basicInfo.annualIncome ||
        (profile.basicInfo.avgStdMonthly ? profile.basicInfo.avgStdMonthly * 12 : 0) ||
        0;

    const isHusbandScenario = result.title.includes('夫死亡') || result.title.includes('夫障害');
    const isWifeScenario = result.title.includes('妻死亡') || result.title.includes('妻障害');

    if (isHusbandScenario) {
        currentSalaryMonthly = (husbandAnnual * 0.8) / 12;
    } else if (isWifeScenario) {
        currentSalaryMonthly = (wifeAnnual * 0.8) / 12;
    } else {
        currentSalaryMonthly = (singleAnnual * 0.8) / 12;
    }

    // ラベル生成
    let salaryLabelText = '現在の月額給料（満水基準）';
    if (isHusbandScenario) {
        salaryLabelText = '家庭から亡くなる夫の給料（満水基準）';
    } else if (isWifeScenario) {
        salaryLabelText = '家庭から亡くなる妻の給料（満水基準）';
    } else if (result.title.includes('本人死亡') || result.title.includes('本人障害')) {
        salaryLabelText = '家庭から亡くなる本人の給料（満水基準）';
    }

    // 総保障不足額 = 時系列グラフの赤字総面積 - 既存貯蓄・保険総額（右下ボックスと同じ計算式）
    const netShortfall = result.netShortfall;
    const shortfallText = (netShortfall / 10000).toFixed(0);
    const sicknessDeduction = result.sicknessDeduction;
    const savingsApplied = result.savingsApplied;
    const deductionMessages: string[] = [];
    if (sicknessDeduction > 0) {
        deductionMessages.push(`傷病手当金 ${(sicknessDeduction / 10000).toFixed(0)}万円`);
    }
    if (savingsApplied > 0) {
        deductionMessages.push(`貯蓄から ${(savingsApplied / 10000).toFixed(0)}万円 控除`);
    }

    // ラジオボタン選択時にcustomEndAgeを更新する関数
    const handlePeriodModeChange = (mode: 'child19' | 'child23' | 'retirement') => {
        setDisplayPeriodModes(prev => ({ ...prev, [scenarioKey]: mode }));
        if (!profile) return;
        
        const currentAge = profile.basicInfo.spouseType === 'couple'
            ? (profile.basicInfo.ageHusband || profile.basicInfo.ageWife || 0)
            : (profile.basicInfo.age || 0);
        const oldAgeStart = profile.basicInfo.spouseType === 'couple'
            ? (profile.basicInfo.oldAgeStartHusband || profile.basicInfo.oldAgeStartWife || 65)
            : (profile.basicInfo.oldAgeStart || 65);

        let newEndAge = 65;
        if (mode === 'child19' && profile.basicInfo.childrenAges.length > 0) {
            const youngestChild = Math.min(...profile.basicInfo.childrenAges);
            newEndAge = currentAge + (19 - youngestChild);
        } else if (mode === 'child23' && profile.basicInfo.childrenAges.length > 0) {
            const youngestChild = Math.min(...profile.basicInfo.childrenAges);
            newEndAge = currentAge + (23 - youngestChild);
        } else if (mode === 'retirement') {
            newEndAge = oldAgeStart;
        }
        setCustomEndAges(prev => ({ ...prev, [scenarioKey]: newEndAge }));
    };

    return (
        <section className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div>
                    <h3 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                        <span className="text-2xl">{icon}</span>
                        {result.title}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">{description}</p>
                </div>
                <div className="text-right bg-slate-950/50 px-6 py-3 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400 mb-1">{headline}</div>
                    <div className={`text-3xl font-bold ${netShortfall > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {netShortfall > 0 ? `${shortfallText}万円` : '不足なし'}
                    </div>
                    {netShortfall > 0 && (
                        <div className="text-xs text-rose-400/70 mt-1">
                            月あたり最大不足: {(result.monthlyShortfallMax / 10000).toFixed(1)}万円
                        </div>
                    )}
                    {deductionMessages.length > 0 && (
                        <div className="text-[11px] text-slate-500 mt-2">
                            {deductionMessages.join(' / ')} を控除済み
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-6">
                <div className="flex flex-wrap items-center gap-4 mb-2 text-xs font-medium justify-end px-4">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }}></span>
                        <span className="text-emerald-300">遺族年金</span>
                    </div>
                    {showAllowancesToggle && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#86EFAC' }}></span>
                            <span className="text-emerald-200">児童手当・児童扶養手当</span>
                        </div>
                    )}
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-slate-500/30 border border-slate-400/50"></span>
                        <span className="text-slate-400">不要額（住宅ローン・故人の生活費）: {(result.data.length > 0 ? (result.data[0].grayArea || 0) / 120000 : 0).toFixed(1)}万円</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-rose-500/80 border border-rose-400"></span>
                        <span className="text-rose-200">不足額（給料との差）</span>
                    </div>
                    {result.data.some(d => {
                        const totalIncomeMonthly = (d.pension || 0) / 12 + (d.childAllowanceMonthly || 0) + (d.childSupportAllowanceMonthly || 0);
                        const targetMonthly = currentSalaryMonthly - (d.grayArea || 0) / 12;
                        return totalIncomeMonthly > targetMonthly;
                    }) && (
                        <div className="flex items-center gap-1.5">
                            <span className="w-3 h-3 rounded-full bg-blue-500/80 border border-blue-400"></span>
                            <span className="text-blue-200">余剰額</span>
                        </div>
                    )}
                </div>
                <StackedAreaChart
                    data={result.data}
                    currentSalaryMonthly={currentSalaryMonthly}
                    retirementAge={calculatedEndAge}
                    salaryLabel={salaryLabelText}
                    showAllowancesToggle={showAllowancesToggle}
                />
            </div>

            {/* トグルボタンと説明文（グラフ表示期間の直上） */}
            <div className="mb-4 flex items-center gap-4">
                {/* トグルボタン */}
                <div className="flex items-center gap-2">
                    <label className="flex items-center gap-2 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={showAllowancesToggle}
                            onChange={(e) => setShowAllowancesToggle(e.target.checked)}
                            className="w-5 h-5 text-emerald-500 rounded focus:ring-2 focus:ring-emerald-500"
                        />
                        <span className="text-sm font-medium text-slate-300">児童手当</span>
                    </label>
                </div>

                {/* 開閉式説明文 */}
                <div className="flex-1">
                    <details className="group">
                        <summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-300 list-none">
                            <span className="flex items-center gap-1">
                                公的給付の内訳
                                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                            </span>
                        </summary>
                        <div className="mt-2 p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 space-y-1">
                            <div>児童手当合計額: {(childAllowanceTotal / 10000).toFixed(1)}万円/月</div>
                            <div>児童扶養手当合計額: {(childSupportAllowanceTotal / 10000).toFixed(1)}万円/月</div>
                        </div>
                    </details>
                </div>
            </div>

            {/* グラフ表示期間選択 */}
            <div className="mt-6 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
                <label className="block text-sm font-medium text-slate-300 mb-3">
                    グラフ表示期間
                </label>
                <div className="space-y-2">
                    {/* 最初の3つを横並び */}
                    <div className="flex flex-nowrap gap-2">
                        <label className="flex items-center gap-1.5 p-2 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                            <input
                                type="radio"
                                name={`displayPeriod-${result.title}`}
                                value="child19"
                                checked={displayPeriodMode === 'child19'}
                                onChange={() => handlePeriodModeChange('child19')}
                                className="w-4 h-4 text-emerald-500 accent-emerald-500"
                            />
                            <span className="text-xs text-slate-300">最下子19歳まで</span>
                        </label>
                        <label className="flex items-center gap-1.5 p-2 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                            <input
                                type="radio"
                                name={`displayPeriod-${result.title}`}
                                value="child23"
                                checked={displayPeriodMode === 'child23'}
                                onChange={() => handlePeriodModeChange('child23')}
                                className="w-4 h-4 text-emerald-500 accent-emerald-500"
                            />
                            <span className="text-xs text-slate-300">最下子23歳まで</span>
                        </label>
                        <label className="flex items-center gap-1.5 p-2 bg-slate-800/50 border border-slate-700 rounded-lg cursor-pointer hover:bg-slate-800 transition-colors">
                            <input
                                type="radio"
                                name={`displayPeriod-${result.title}`}
                                value="retirement"
                                checked={displayPeriodMode === 'retirement'}
                                onChange={() => handlePeriodModeChange('retirement')}
                                className="w-4 h-4 text-emerald-500 accent-emerald-500"
                            />
                            <span className="text-xs text-slate-300">老齢年金開始まで</span>
                        </label>
                    </div>

                    {/* スライドバーを常に表示 */}
                    <div className="mt-2 p-4 bg-slate-950/60 border border-slate-800 rounded-lg">
                        <label className="block text-sm font-medium text-slate-400 mb-2">
                            表示終了年齢: <span className="text-emerald-400 font-bold">{customEndAge}歳</span>
                        </label>
                        <input
                            type="range"
                            min={profile?.basicInfo?.spouseType === 'couple'
                                ? Math.max(profile.basicInfo.ageHusband || 0, profile.basicInfo.ageWife || 0)
                                : (profile?.basicInfo?.age || 30)}
                            max="75"
                            step="1"
                            value={customEndAge}
                            onChange={(e) => {
                                const newAge = Number(e.target.value);
                                setCustomEndAges(prev => ({ ...prev, [scenarioKey]: newAge }));
                                setDisplayPeriodModes(prev => ({ ...prev, [scenarioKey]: 'custom' }));
                            }}
                            className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                        />
                    </div>
                </div>
            </div>

            {savingsApplied > 0 && (
                <p className="text-[11px] text-slate-500 text-right mt-4">※貯蓄・保険 ({(savingsApplied / 10000).toFixed(0)}万円) を必要保障額から控除済み</p>
            )}
        </section>
    );
}
