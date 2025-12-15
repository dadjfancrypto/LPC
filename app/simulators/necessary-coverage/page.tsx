'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
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
    SPOUSE_BONUS,
    calculateOldAgeEmployeePension,
    calculateOldAgeBasicPension,
} from '../../utils/pension-calc';
import { calculateOldAgePensionAdjustment } from '../../utils/survivor-pension-logic';

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
    funeralCost: number; // 葬儀代（死亡時シナリオのみ）
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
 * 令和7年4月分から
 * 年収 160万円未満: 全部支給（1人目 46,690円、2人目以降加算 11,030円）
 * 年収 160万円以上 365万円未満: 一部支給の中間値（1人目 28,845円、2人目以降加算 8,270円）
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
        // 全部支給（令和7年4月分から）
        const firstChild = 46690; // 46,690円
        const additionalChildren = (eligibleChildren - 1) * 11030; // 11,030円
        return firstChild + additionalChildren;
    } else if (annualIncomeYen < 3650000) {
        // 一部支給（中間値：最大値と最小値の中間）
        // 第1子：46,680円～11,010円 → 中間値 28,845円
        // 第2子以降：11,020円～5,520円 → 中間値 8,270円
        const firstChild = 28845; // (46680 + 11010) / 2
        const additionalChildren = (eligibleChildren - 1) * 8270; // (11020 + 5520) / 2
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
            <pattern id="surplusHatch" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                <path d="M -1,4 H 9" stroke="rgba(96, 165, 250, 0.6)" strokeWidth="2" />
            </pattern>
        </defs>
    </svg>
);

function StackedAreaChart({
    data,
    currentSalaryMonthly,
    retirementAge = RETIREMENT_AGE,
    salaryLabel,
    showAllowancesToggle = false,
    profile,
    scenarioType
}: {
    data: YearlyData[];
    currentSalaryMonthly: number; // 事故発生前の現在の月額給料（手取り）
    retirementAge?: number;
    salaryLabel?: string;
    showAllowancesToggle?: boolean; // 児童手当・児童扶養手当の表示/非表示
    profile?: CustomerProfile; // 顧客プロフィール（家族構成表示用）
    scenarioType?: 'husbandDeath' | 'wifeDeath' | 'singleDeath' | 'husbandDisability' | 'wifeDisability' | 'singleDisability'; // シナリオタイプ
}) {
    // 65歳未満（現役期間）のみに限定
    const filtered = data
        .filter((entry) => entry.age < retirementAge)
        .map((entry) => {
            // Layer 1: 遺族年金（濃い緑）
            // 0万円の場合でも年金は表示される
            const pensionMonthly = currentSalaryMonthly > 0 
                ? Math.min(entry.pension / 12, currentSalaryMonthly)
                : entry.pension / 12;
            
            // Layer 2: 児童手当・児童扶養手当（薄緑、トグルで表示/非表示）
            // 0万円の場合でも手当は表示される
            const allowancesMonthly = showAllowancesToggle 
                ? (currentSalaryMonthly > 0 
                    ? Math.min((entry.childAllowanceMonthly || 0) + (entry.childSupportAllowanceMonthly || 0), currentSalaryMonthly - pensionMonthly)
                    : (entry.childAllowanceMonthly || 0) + (entry.childSupportAllowanceMonthly || 0))
                : 0;
            
            // Layer 3: 不要な支出（グレー）
            // grayAreaMonthlyの計算は表示用のallowancesMonthlyに依存せず、常に手当を含めない計算をする
            const remainingAfterPension = currentSalaryMonthly - pensionMonthly;
            const grayAreaMonthly = Math.min(Math.max(0, (entry.grayArea || 0) / 12), Math.max(0, remainingAfterPension));
            
            // Layer 4: 真の不足額（赤）または Layer 5: 余剰額（青）
            // 不足額計算は常に手当を含めて計算（表示/非表示は見た目のみ）
            const totalAllowancesMonthly = (entry.childAllowanceMonthly || 0) + (entry.childSupportAllowanceMonthly || 0);
            const totalIncomeMonthly = pensionMonthly + totalAllowancesMonthly;
            const targetMonthly = currentSalaryMonthly - grayAreaMonthly; // 給料 - 浮く支出
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

    if (!filtered.length) {
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
    // 障害シナリオでは夫と妻の年齢も表示されるため、ラベルが多くなる可能性があるので、高さを調整
    // 遺族シナリオでも子が複数いる場合はラベルが多くなる可能性があるので、高さを調整
    const hasManyLabels = profile && scenarioType && (
        (scenarioType.includes('Disability') || scenarioType.includes('disability')) ||
        (profile.basicInfo.childrenAges && profile.basicInfo.childrenAges.length > 1)
    );
    const width = 820;
    const height = hasManyLabels ? 520 : 480; // ラベルが多い場合は高さを増やす
    const padding = { top: 40, right: 40, bottom: hasManyLabels ? 80 : 40, left: 60 }; // ラベルが多い場合は下の余白を増やす
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    const minAge = startAge;
    const maxAge = endAge;
    const ageRange = Math.max(maxAge - minAge, 1);
    const getX = (age: number) => ((age - minAge) / ageRange) * graphWidth;

    // Y軸は現在の月額給料に固定（満水基準）+ 10万円の余裕
    // 0万円の場合でも、年金や手当がある場合は最低値を設定
    const maxPensionMonthly = data.length > 0 ? Math.max(...data.map(d => (d.pension || 0) / 12 + (d.childAllowanceMonthly || 0) + (d.childSupportAllowanceMonthly || 0))) : 0;
    const baseSalary = currentSalaryMonthly > 0 ? currentSalaryMonthly : Math.max(maxPensionMonthly, 200000 / 12);
    const maxAmount = Math.max(baseSalary + 100000, 1);
    const getY = (value: number) => graphHeight - (value / maxAmount) * graphHeight;

    // 障害年金シナリオの場合はオレンジ、遺族年金シナリオの場合は緑
    const isDisability = scenarioType && (scenarioType.includes('Disability') || scenarioType.includes('disability'));
    const incomeColor = isDisability ? '#F59E0B' : '#10B981'; // Amber-500 for disability, Emerald-500 for survivor
    const incomeStroke = isDisability ? '#D97706' : '#059669'; // Amber-600 for disability, Emerald-600 for survivor
    const grayAreaColor = '#94a3b8'; // Slate-400
    const grayAreaStroke = '#64748b'; // Slate-500
    const shortfallColor = '#EF4444'; // Red-500
    const shortfallStroke = '#B91C1C'; // Red-700

    // ラベルを表示するための最小視覚的高さ（金額換算）
    // 4万円分の高さがあれば2行ラベル（約25-30px）が収まると仮定
    const MIN_VISUAL_AMOUNT = 40000;



    return (
        <div className="bg-slate-950/40 border border-slate-800 rounded-2xl p-4">
            <SVGPatterns />
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                <g transform={`translate(${padding.left},${padding.top})`}>

                    {/* Y軸のグリッド */}
                    {(() => {
                        const ticks = [0, 0.5, 1.0];
                        const tenManYen = 100000; // 10万円
                        const tenManYenTick = tenManYen / maxAmount;
                        if (tenManYenTick > 0 && tenManYenTick < 1) {
                            ticks.push(tenManYenTick);
                        }
                        ticks.sort((a, b) => a - b);
                        return ticks.map((tick) => {
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
                        });
                    })()}

                    {/* 満水基準ライン（currentSalaryMonthlyの位置） - 強調表示 */}
                    {(() => {
                        const fullWaterAmount = currentSalaryMonthly; // 満水基準（月収）
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
                                    {(fullWaterAmount / 10000).toFixed(1)}万円
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

                        // 家族構成ラベルを生成
                        const familyLabels: string[] = [];
                        if (profile && scenarioType) {
                            const yearsSinceStart = age - startAge;
                            const childrenAges = profile.basicInfo.childrenAges || [];
                            
                            if (scenarioType === 'husbandDeath') {
                                // 夫死亡シナリオ：妻と子供を表示
                                const wifeAge = idx === 0 ? (profile.basicInfo.ageWife || 0) + yearsSinceStart : (profile.basicInfo.ageWife || 0) + yearsSinceStart - 1;
                                familyLabels.push(`妻${wifeAge}`);
                                childrenAges.forEach((childAge) => {
                                    const currentChildAge = idx === 0 ? childAge + yearsSinceStart : childAge + yearsSinceStart - 1;
                                    familyLabels.push(`子${currentChildAge}`);
                                });
                            } else if (scenarioType === 'husbandDisability') {
                                // 夫障害シナリオ：夫、妻と子供を表示
                                const husbandAge = (profile.basicInfo.ageHusband || 0) + yearsSinceStart;
                                familyLabels.push(`夫${husbandAge}`);
                                const wifeAge = (profile.basicInfo.ageWife || 0) + yearsSinceStart;
                                familyLabels.push(`妻${wifeAge}`);
                                childrenAges.forEach((childAge) => {
                                    const currentChildAge = childAge + yearsSinceStart;
                                    familyLabels.push(`子${currentChildAge}`);
                                });
                            } else if (scenarioType === 'wifeDeath') {
                                // 妻死亡シナリオ：夫と子供を表示
                                const husbandAge = idx === 0 ? (profile.basicInfo.ageHusband || 0) + yearsSinceStart : (profile.basicInfo.ageHusband || 0) + yearsSinceStart - 1;
                                familyLabels.push(`夫${husbandAge}`);
                                childrenAges.forEach((childAge) => {
                                    const currentChildAge = idx === 0 ? childAge + yearsSinceStart : childAge + yearsSinceStart - 1;
                                    familyLabels.push(`子${currentChildAge}`);
                                });
                            } else if (scenarioType === 'wifeDisability') {
                                // 妻障害シナリオ：妻、夫と子供を表示
                                const wifeAge = (profile.basicInfo.ageWife || 0) + yearsSinceStart;
                                familyLabels.push(`妻${wifeAge}`);
                                const husbandAge = (profile.basicInfo.ageHusband || 0) + yearsSinceStart;
                                familyLabels.push(`夫${husbandAge}`);
                                childrenAges.forEach((childAge) => {
                                    const currentChildAge = childAge + yearsSinceStart;
                                    familyLabels.push(`子${currentChildAge}`);
                                });
                            } else if (scenarioType === 'singleDeath') {
                                // 独身死亡シナリオ：子供のみ表示
                                childrenAges.forEach((childAge) => {
                                    const currentChildAge = idx === 0 ? childAge + yearsSinceStart : childAge + yearsSinceStart - 1;
                                    familyLabels.push(`子${currentChildAge}`);
                                });
                            } else if (scenarioType === 'singleDisability') {
                                // 独身障害シナリオ：本人と子供を表示
                                const selfAge = (profile.basicInfo.age || profile.basicInfo.ageHusband || 0) + yearsSinceStart;
                                familyLabels.push(`本人${selfAge}`);
                                childrenAges.forEach((childAge) => {
                                    const currentChildAge = childAge + yearsSinceStart;
                                    familyLabels.push(`子${currentChildAge}`);
                                });
                            }
                        }

                        return (
                            <g key={age}>
                                <line x1={x} y1={0} x2={x} y2={graphHeight} stroke="#1e293b" strokeDasharray="2 2" strokeWidth="1" />
                                {showLabel && familyLabels.length > 0 && (
                                    <>
                                        {familyLabels.map((label, labelIdx) => (
                                            <text 
                                                key={labelIdx}
                                                x={x} 
                                                y={graphHeight + 15 + (labelIdx * 12)} 
                                                textAnchor="middle" 
                                                fontSize="10" 
                                                fill="#94a3b8"
                                            >
                                                {label}
                                            </text>
                                        ))}
                                    </>
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
                        
                        // Layer 4: 真の不足額（赤）
                        let visualShortfallAmount = entry.shortfallMonthly > 0 
                            ? Math.max(entry.shortfallMonthly, MIN_VISUAL_AMOUNT) 
                            : 0;
                        
                        // Layer 3: 不要な支出（グレー）
                        // 不足額レイヤーが最小サイズ（4万円）で表示される場合、グレーレイヤーを満水基準から4万円を引いた値までに制限
                        const maxGrayAmount = visualShortfallAmount >= MIN_VISUAL_AMOUNT
                            ? currentSalaryMonthly - MIN_VISUAL_AMOUNT
                            : currentSalaryMonthly;
                        let visualGrayAmount = entry.grayAreaMonthly > 0 
                            ? Math.min(Math.max(entry.grayAreaMonthly, MIN_VISUAL_AMOUNT), maxGrayAmount)
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
                        
                        // 余剰額のY座標（満水基準ラインの上に表示）
                        const fullWaterAmount = currentSalaryMonthly; // 満水基準（月収）
                        const fullWaterY = getY(fullWaterAmount);
                        
                        // 不足額レイヤーが最小サイズ（4万円）で表示される場合、グレーレイヤーの上端を満水基準から4万円を引いた値までに制限
                        const maxGrayTopAmount = visualShortfallAmount >= MIN_VISUAL_AMOUNT
                            ? currentSalaryMonthly - MIN_VISUAL_AMOUNT
                            : currentSalaryMonthly;
                        const maxGrayTopY = getY(maxGrayTopAmount);
                        const calculatedGrayY = getY(visualPensionAmount + visualAllowancesAmount + visualGrayAmount);
                        const grayY = Math.min(calculatedGrayY, maxGrayTopY);
                        
                        // 不足額は基準ライン（fullWaterY）から下に向かって表示
                        // 不足額 = （基準ライン）-（公的年金＋児童手当＋浮く支出）
                        // つまり、不足額は基準ラインより下に表示されるべき
                        const shortfallY = fullWaterY; // 基準ラインの位置から開始
                        // 余剰額は満水基準ラインの上に表示（Y座標が小さいほど上）
                        const surplusY = fullWaterY - (visualSurplusAmount / maxAmount) * graphHeight;
                        
                        // 浮く支出が30万円を超えているかどうか
                        const grayAreaExceedsFullWater = entry.grayAreaMonthly > fullWaterAmount;
                        
                        // 余剰額レイヤーと浮く支出レイヤー（30万円超）が両方存在する場合、同じ位置に合わせる
                        let sharedRectY: number | null = null;
                        let sharedRectHeight: number | null = null;
                        
                        // 余剰額の高さを計算
                        let finalSurplusHeight = 0;
                        if (entry.surplusMonthly > 0 && visualSurplusAmount > 0) {
                            const actualSurplusAmount = entry.surplusMonthly;
                            const surplusHeight = (actualSurplusAmount / maxAmount) * graphHeight;
                            const minSurplusHeight = (MIN_VISUAL_AMOUNT / maxAmount) * graphHeight;
                            finalSurplusHeight = Math.max(surplusHeight, minSurplusHeight);
                        }
                        
                        // 浮く支出（30万円超）の高さを計算
                        let finalGrayAreaExcessHeight = 0;
                        if (grayAreaExceedsFullWater) {
                            const grayAreaExcess = entry.grayAreaMonthly - fullWaterAmount;
                            const grayAreaExcessHeight = (grayAreaExcess / maxAmount) * graphHeight;
                            const minGrayAreaExcessHeight = (MIN_VISUAL_AMOUNT / maxAmount) * graphHeight;
                            finalGrayAreaExcessHeight = Math.max(grayAreaExcessHeight, minGrayAreaExcessHeight);
                        }
                        
                        // 不足額の高さを計算（基準ラインから下に向かって）
                        // 不足額 = （基準ライン）-（公的年金＋児童手当＋浮く支出）
                        // 不足額は基準ラインより下に表示されるべき
                        let shortfallHeight = 0;
                        if (entry.shortfallMonthly > 0 && visualShortfallAmount > 0) {
                            const actualShortfallAmount = entry.shortfallMonthly;
                            const shortfallHeightCalc = (actualShortfallAmount / maxAmount) * graphHeight;
                            const minShortfallHeight = (MIN_VISUAL_AMOUNT / maxAmount) * graphHeight;
                            shortfallHeight = Math.max(shortfallHeightCalc, minShortfallHeight);
                        }
                        
                        // 余剰額、浮く支出（30万円超）のいずれかが存在する場合、高さは最大値を使用
                        // 不足額は基準ラインより下に表示されるため、この計算には含めない
                        if (finalSurplusHeight > 0 || finalGrayAreaExcessHeight > 0) {
                            // すべての高さの最大値を使用
                            const maxHeight = Math.max(
                                finalSurplusHeight > 0 ? finalSurplusHeight : 0,
                                finalGrayAreaExcessHeight > 0 ? finalGrayAreaExcessHeight : 0
                            );
                            sharedRectY = Math.max(0, fullWaterY - maxHeight);
                            sharedRectHeight = Math.max(0, Math.min(maxHeight, fullWaterY - sharedRectY));
                        }

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
                                        fontSize="12"
                                        fill="white"
                                        fontWeight="bold"
                                        style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                    >
                                        <tspan x={currentX + width / 2} dy="-0.6em">
                                            {scenarioType && (scenarioType.includes('Disability') || scenarioType.includes('disability')) ? '障害基礎年金' : '遺族年金'}
                                        </tspan>
                                        <tspan x={currentX + width / 2} dy="1.2em">{(entry.pensionMonthly / 10000).toFixed(1)}万円</tspan>
                                    </text>
                                )}

                                {/* Layer 2: 児童手当・児童扶養手当（薄緑、トグルで表示/非表示） / 障害厚生年金（障害シナリオでは常に表示） */}
                                {visualAllowancesAmount > 0 && (
                                    <g>
                                        <rect
                                            x={currentX}
                                            y={allowancesY}
                                            width={width}
                                            height={Math.max(pensionY - allowancesY, 0)}
                                            fill={scenarioType && (scenarioType.includes('Disability') || scenarioType.includes('disability')) ? "#F59E0B" : "#34D399"} // amber-500 for disability, emerald-400 for survivor
                                            stroke={scenarioType && (scenarioType.includes('Disability') || scenarioType.includes('disability')) ? "#D97706" : "#6EE7B7"} // amber-600 for disability, emerald-400 for survivor
                                            strokeWidth="1"
                                        />
                                        {showAllowancesLabel && (
                                            <text
                                                x={currentX + width / 2}
                                                y={allowancesY + (pensionY - allowancesY) / 2}
                                                textAnchor="middle"
                                                dominantBaseline="central"
                                                fontSize="12"
                                                fill="white"
                                                fontWeight="bold"
                                                style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                            >
                                                <tspan x={currentX + width / 2} dy="-0.6em">
                                                    {scenarioType && (scenarioType.includes('Disability') || scenarioType.includes('disability')) ? '障害厚生年金' : '児童手当'}
                                                </tspan>
                                                <tspan x={currentX + width / 2} dy="1.2em">{(entry.allowancesMonthly / 10000).toFixed(1)}万円</tspan>
                                            </text>
                    )}
                                    </g>
                                )}

                                {/* Layer 3: 不要な支出（グレー） */}
                                {entry.grayAreaMonthly > 0 && (() => {
                                    const fullWaterAmount = currentSalaryMonthly; // 満水基準（月収）
                                    const fullWaterY = getY(fullWaterAmount);
                                    
                                    // 不足額レイヤーが最小サイズ（4万円）で表示される場合、グレーレイヤーを満水基準から4万円を引いた値までに制限
                                    const maxGrayY = visualShortfallAmount >= MIN_VISUAL_AMOUNT
                                        ? getY(currentSalaryMonthly - MIN_VISUAL_AMOUNT)
                                        : fullWaterY;
                                    
                                    // 浮く支出レイヤーの下端を正しく計算
                                    // showAllowancesToggleがfalseの時、allowancesYはpensionYと同じ値になる可能性がある
                                    const grayAreaBottomY = showAllowancesToggle ? allowancesY : pensionY;
                                    
                                    // 満水基準を超えているかどうか
                                    const grayAreaExceedsFullWater = entry.grayAreaMonthly > fullWaterAmount;
                                    
                                    if (grayAreaExceedsFullWater) {
                                        // 30万円までの部分
                                        const grayAreaHeightToFullWater = Math.max(fullWaterY - grayY, 0);
                                        
                                        // 30万円を超えた部分は、余剰額レイヤーと同じ位置（sharedRectY）を使用
                                        // sharedRectYが計算されている場合はそれを使用、そうでない場合は同じ計算ロジックで計算
                                        let grayAreaExcessY: number;
                                        let grayAreaExcessRectHeight: number;
                                        
                                        if (sharedRectY !== null && sharedRectHeight !== null) {
                                            // 余剰額レイヤーと同じ位置と高さを使用
                                            grayAreaExcessY = sharedRectY;
                                            grayAreaExcessRectHeight = sharedRectHeight;
                                        } else {
                                            // sharedRectYがnullの場合でも、同じ計算ロジックで計算
                                            // 浮く支出（30万円超）の高さを計算
                                            const grayAreaExcess = entry.grayAreaMonthly - fullWaterAmount;
                                            const grayAreaExcessHeight = (grayAreaExcess / maxAmount) * graphHeight;
                                            const minGrayAreaExcessHeight = (MIN_VISUAL_AMOUNT / maxAmount) * graphHeight;
                                            const finalGrayAreaExcessHeight = Math.max(grayAreaExcessHeight, minGrayAreaExcessHeight);
                                            
                                            // 余剰額レイヤーと同じ計算ロジックで位置を決定
                                            grayAreaExcessY = Math.max(0, fullWaterY - finalGrayAreaExcessHeight);
                                            grayAreaExcessRectHeight = Math.max(0, Math.min(finalGrayAreaExcessHeight, fullWaterY - grayAreaExcessY));
                                        }
                                        
                                        return (
                                            <g>
                                                {/* 30万円までの部分 */}
                                                {grayAreaHeightToFullWater > 0 && (
                                                    <rect
                                                        x={currentX}
                                                        y={grayY}
                                                        width={width}
                                                        height={grayAreaHeightToFullWater}
                                                        fill={grayAreaColor}
                                                        stroke={grayAreaStroke}
                                                        strokeWidth="1"
                                                        opacity="0.5"
                                                    />
                                                )}
                                                {/* 30万円を超えた部分（余剰額レイヤーと同じ位置） */}
                                                {grayAreaExcessRectHeight > 0 && (
                                                    <rect
                                                        x={currentX}
                                                        y={grayAreaExcessY}
                                                        width={width}
                                                        height={grayAreaExcessRectHeight}
                                                        fill={grayAreaColor}
                                                        stroke={grayAreaStroke}
                                                        strokeWidth="1"
                                                        opacity="0.5"
                                                    />
                                                )}
                                                {width > 30 && (
                                                    <text
                                                        x={currentX + width / 2}
                                                        y={grayY + grayAreaHeightToFullWater / 2}
                                                        textAnchor="middle"
                                                        dominantBaseline="central"
                                                        fontSize="12"
                                                        fill="white"
                                                        fontWeight="bold"
                                                        style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                                    >
                                                        <tspan x={currentX + width / 2} dy="-0.6em">浮く支出</tspan>
                                                        <tspan x={currentX + width / 2} dy="1.2em">{(entry.grayAreaMonthly / 10000).toFixed(1)}万円</tspan>
                                                    </text>
            )}
                                            </g>
    );
                                    } else {
                                        // 30万円以下の場合
                                        // グレーレイヤーの上端は不足額レイヤーの下端と同じ位置
                                        // 不足額レイヤーの下端 = fullWaterY + shortfallHeight（Y座標系では下方向が大きい値）
                                        const grayAreaTopY = fullWaterY + shortfallHeight;
                                        // Y座標系では下方向が大きい値なので、grayAreaBottomY - grayAreaTopYが正の値になる
                                        const grayAreaHeight = Math.max(grayAreaBottomY - grayAreaTopY, 0);
                                        const grayAreaCenterY = grayAreaTopY + grayAreaHeight / 2;
                                        
                                        return (
                                            <g>
                                                <rect
                                                    x={currentX}
                                                    y={grayAreaTopY}
                                                    width={width}
                                                    height={grayAreaHeight}
                                                    fill={grayAreaColor}
                                                    stroke={grayAreaStroke}
                                                    strokeWidth="1"
                                                    opacity="0.5"
                                                />
                                                {width > 30 && (
                                                    <text
                                                        x={currentX + width / 2}
                                                        y={grayAreaCenterY}
                                                        textAnchor="middle"
                                                        dominantBaseline="central"
                                                        fontSize="12"
                                                        fill="white"
                                                        fontWeight="bold"
                                                        style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                                    >
                                                        <tspan x={currentX + width / 2} dy="-0.6em">浮く支出</tspan>
                                                        <tspan x={currentX + width / 2} dy="1.2em">{(entry.grayAreaMonthly / 10000).toFixed(1)}万円</tspan>
                                                    </text>
                                                )}
                                            </g>
                                        );
                                    }
                                })()}

                                {/* Layer 4: 真の不足額（赤） */}
                                {entry.shortfallMonthly > 0 && shortfallHeight > 0 && (() => {
                                    // 不足額は基準ライン（fullWaterY）から下に向かって表示
                                    // 不足額 = （基準ライン）-（公的年金＋児童手当＋浮く支出）
                                    const shortfallRectY = fullWaterY; // 基準ラインの位置から開始
                                    const shortfallRectHeight = shortfallHeight; // 不足額の高さ
                                    
    return (
                                        <g>
                                            <rect
                                                x={currentX}
                                                y={shortfallRectY}
                                                width={width}
                                                height={shortfallRectHeight}
                                                fill="url(#shortfallHatch)"
                                                stroke={shortfallStroke}
                                                strokeWidth="1"
                                            />
                                            {width > 30 && (
                                                <text
                                                    x={currentX + width / 2}
                                                    y={shortfallRectY + shortfallRectHeight / 2}
                                                    textAnchor="middle"
                                                    dominantBaseline="central"
                                                    fontSize="12"
                                                    fill="white"
                                                    fontWeight="bold"
                                                    style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                                >
                                                    <tspan x={currentX + width / 2} dy="-0.6em">不足額</tspan>
                                                    <tspan x={currentX + width / 2} dy="1.2em">{(entry.shortfallMonthly / 10000).toFixed(1)}万円</tspan>
                                                </text>
                                            )}
                                        </g>
                                    );
                                })()}

                                {/* Layer 5: 余剰額（青）- 満水基準ラインの上に表示 */}
                                {entry.surplusMonthly > 0 && finalSurplusHeight > 0 && (() => {
                                    // 余剰額は基準ライン（fullWaterY）から上に向かって表示
                                    // 余剰額 = （公的年金＋児童手当＋浮く支出）-（基準ライン）
                                    // 余剰額は基準ラインより上に表示されるべき
                                    const surplusRectY = sharedRectY !== null ? sharedRectY : Math.max(0, fullWaterY - finalSurplusHeight);
                                    const surplusRectHeight = sharedRectHeight !== null ? sharedRectHeight : finalSurplusHeight;
                                    
                                    if (surplusRectHeight <= 0) return null;
                                    
                                    return (
                                        <g>
                                            <rect
                                                x={currentX}
                                                y={surplusRectY}
                                                width={width}
                                                height={surplusRectHeight}
                                                fill="url(#surplusHatch)"
                                            />
                                            {/* 上辺のみの枠線 */}
                                            <line
                                                x1={currentX}
                                                y1={surplusRectY}
                                                x2={currentX + width}
                                                y2={surplusRectY}
                                                stroke="#3B82F6"
                                                strokeWidth="1"
                                            />
                                            {showSurplusLabel && (
                                                <text
                                                    x={currentX + width / 2}
                                                    y={surplusRectY + surplusRectHeight / 2}
                                                    textAnchor="middle"
                                                    dominantBaseline="central"
                                                    fontSize="12"
                                                    fill="white"
                                                    fontWeight="bold"
                                                    style={{ textShadow: '0px 1px 2px rgba(0,0,0,0.5)' }}
                                                >
                                                    <tspan x={currentX + width / 2} dy="-0.6em">余剰額</tspan>
                                                    <tspan x={currentX + width / 2} dy="1.2em">{(entry.surplusMonthly / 10000).toFixed(1)}万円</tspan>
                                                </text>
                                            )}
                                        </g>
                                    );
                                })()}
                            </g>
                        );
                    })}


                </g>
            </svg>
        </div>
    );
}

/* ===================== PDF出力関数（ブラウザの印刷機能を使用） ===================== */
function exportToPDF(elementId: string, filename: string) {
    const element = document.getElementById(elementId);
    if (!element) {
        console.error(`Element with id "${elementId}" not found`);
        alert('PDF出力対象の要素が見つかりませんでした。');
        return;
    }

    // 印刷用のスタイルを追加
    const printStyle = document.createElement('style');
    printStyle.id = 'pdf-print-style';
    printStyle.textContent = `
        @media print {
            @page {
                size: A4 portrait;
                margin: 10mm;
            }
            body * {
                visibility: hidden;
            }
            #${elementId}, #${elementId} * {
                visibility: visible;
            }
            #${elementId} {
                position: absolute;
                left: 0;
                top: 0;
                width: 100%;
                page-break-after: always;
            }
            /* 不要な要素を非表示 */
            button, .no-print {
                display: none !important;
            }
        }
    `;
    document.head.appendChild(printStyle);

    // 印刷前に要素を表示
    const originalDisplay = element.style.display;
    element.style.display = 'block';

    // 印刷ダイアログを開く
    window.print();

    // 印刷後にスタイルを削除
    setTimeout(() => {
        element.style.display = originalDisplay;
        const styleEl = document.getElementById('pdf-print-style');
        if (styleEl) {
            styleEl.remove();
        }
    }, 1000);
}

/* ===================== 複数セクションを個別ページとして出力 ===================== */
function exportMultipleToPDF(elementIds: string[], filename: string) {
    // 全ての要素が存在するか確認
    const elements = elementIds.map(id => document.getElementById(id)).filter(el => el !== null);
    if (elements.length === 0) {
        alert('PDF出力対象の要素が見つかりませんでした。');
        return;
    }

    // 印刷用のスタイルを追加
    const printStyle = document.createElement('style');
    printStyle.id = 'pdf-print-style-multiple';
    const elementSelectors = elementIds.map(id => `#${id}, #${id} *`).join(', ');
    printStyle.textContent = `
        @media print {
            @page {
                size: A4 portrait;
                margin: 10mm;
                /* URLとヘッダー/フッターを非表示 */
                marks: none;
            }
            @page:first {
                margin: 10mm;
                marks: none;
            }
            @page:left {
                margin: 10mm;
                marks: none;
            }
            @page:right {
                margin: 10mm;
                marks: none;
            }
            body {
                margin: 0;
                padding: 0;
            }
            body * {
                visibility: hidden;
            }
            ${elementSelectors} {
                visibility: visible;
            }
            ${elementIds.map(id => `#${id}`).join(', ')} {
                position: relative;
                width: 100%;
                max-width: 100%;
                margin: 0 auto;
                page-break-before: always;
                page-break-after: always;
                page-break-inside: avoid;
                break-inside: avoid;
                min-height: calc(100vh - 20mm);
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
            }
            /* 最初の要素は改ページ前を削除 */
            ${elementIds[0] ? `#${elementIds[0]}` : ''} {
                page-break-before: auto;
            }
            /* 最後の要素は改ページ後を削除（空白ページを防ぐ） */
            ${elementIds[elementIds.length - 1] ? `#${elementIds[elementIds.length - 1]}` : ''} {
                page-break-after: auto;
            }
            /* 不要な要素を非表示 */
            button, .no-print {
                display: none !important;
            }
            /* 空のページを削除 */
            @page:blank {
                display: none;
            }
        }
    `;
    document.head.appendChild(printStyle);

    // 印刷前に要素を表示
    elements.forEach(el => {
        if (el) {
            el.style.display = 'block';
        }
    });

    // 印刷設定の案内を表示
    const shouldPrint = confirm('PDF出力を開始します。\n\n印刷ダイアログが開いたら、以下の設定を行ってください：\n\n1. 「その他の設定」を開く\n2. 「ヘッダーとフッター」のチェックを外す（URLを非表示にするため）\n3. 「送信先」で「PDFに保存」を選択\n\n準備ができたら「OK」をクリックしてください。');
    
    if (!shouldPrint) {
        // キャンセルされた場合はスタイルを削除して終了
        elements.forEach(el => {
            if (el) {
                el.style.display = '';
            }
        });
        const styleEl = document.getElementById('pdf-print-style-multiple');
        if (styleEl) {
            styleEl.remove();
        }
        return;
    }

    // 印刷ダイアログを開く
    window.print();

    // 印刷後にスタイルを削除
    setTimeout(() => {
        elements.forEach(el => {
            if (el) {
                el.style.display = '';
            }
        });
        const styleEl = document.getElementById('pdf-print-style-multiple');
        if (styleEl) {
            styleEl.remove();
        }
    }, 1000);
}

/* ===================== ページ本体 ===================== */
export default function NecessaryCoveragePage() {
    const [profile, setProfile] = useState<CustomerProfile | null>(null);
    // 生活費調整率
    const [expenseRatioSurvivor, setExpenseRatioSurvivor] = useState(80); // 遺族の生活費率（現在の生活費の何%になるか、デフォルト80%）
    const [expenseRatioDisability, setExpenseRatioDisability] = useState(110); // 医療・介護を考慮した一般的な増加率（約110%）
    // 就労収入調整率（リスク調整）
    const [workIncomeRatio, setWorkIncomeRatio] = useState(90); // デフォルト90%（共働きで就労継続を想定）
    const [currentSavingsMan, setCurrentSavingsMan] = useState(0); // 既存の貯蓄・保険（万円）
    const [showSavingsInfo, setShowSavingsInfo] = useState(false);
    const [educationCourse, setEducationCourse] = useState<'public' | 'private_uni' | 'private_hs' | 'private_jhs'>('public'); // 教育費コース
    const [showEducationCourse, setShowEducationCourse] = useState(false); // 教育費コースのアコーディオン
    const [showPublicCourse, setShowPublicCourse] = useState(false); // すべて公立コースのアコーディオン
    const [showPrivateUniCourse, setShowPrivateUniCourse] = useState(false); // 大学のみ私立コースのアコーディオン
    const [showPrivateHsCourse, setShowPrivateHsCourse] = useState(false); // 高校から私立コースのアコーディオン
    const [showPrivateJhsCourse, setShowPrivateJhsCourse] = useState(false); // 中学から私立コースのアコーディオン
    const [showDeathSettings, setShowDeathSettings] = useState(false); // 死亡時シナリオの条件設定のアコーディオン
    const [showDisabilitySettings, setShowDisabilitySettings] = useState(false); // 障害時シナリオの条件設定のアコーディオン
    const [funeralCost, setFuneralCost] = useState<2000000 | 750000 | 0>(2000000); // 葬儀代：一般的な葬儀200万円、家族葬75万円、0は選択なし
    // 各シナリオごとのグラフ表示期間設定
    const [displayPeriodModes, setDisplayPeriodModes] = useState<Record<string, 'child19' | 'child23' | 'retirement' | 'custom'>>({
        husbandDeath: 'child23',
        wifeDeath: 'child23',
        husbandDisability: 'retirement',
        wifeDisability: 'retirement',
        singleDeath: 'child23',
        singleDisability: 'retirement',
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
        const currentAge = (profile.basicInfo.spouseType !== undefined && profile.basicInfo.spouseType === 'couple')
            ? (profile.basicInfo.ageHusband || profile.basicInfo.ageWife || 0)
            : (profile.basicInfo.age || 0);

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
                    // 障害シナリオの場合、障害を受ける人のoldAgeStartを使用
                    // 遺族シナリオの場合、遺族（残された人）のoldAgeStartを使用
                    let oldAgeStart = 65;
                    if (key === 'husbandDisability') {
                        oldAgeStart = profile.basicInfo.oldAgeStartHusband || 65;
                    } else if (key === 'wifeDisability') {
                        oldAgeStart = profile.basicInfo.oldAgeStartWife || 65;
                    } else if (key === 'singleDisability') {
                        oldAgeStart = profile.basicInfo.oldAgeStart || 65;
                    } else if (key === 'husbandDeath') {
                        oldAgeStart = profile.basicInfo.oldAgeStartWife || 65;
                    } else if (key === 'wifeDeath') {
                        oldAgeStart = profile.basicInfo.oldAgeStartHusband || 65;
                    } else if (key === 'singleDeath') {
                        oldAgeStart = profile.basicInfo.oldAgeStart || 65;
                    }
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
            // 障害シナリオの場合、障害を受ける人の年齢を使用
            // 遺族シナリオの場合、遺族（残された人）の年齢を使用
            const startAge = type === 'disability'
                ? (targetPerson === 'husband' ? basicInfo.ageHusband : (targetPerson === 'wife' ? basicInfo.ageWife : basicInfo.age))
                : (targetPerson === 'wife' ? basicInfo.ageHusband : (targetPerson === 'husband' ? basicInfo.ageWife : basicInfo.age));
            
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
            
            // 教育費を固定値（初期年齢の値）にする（変動させないため）
            const initialChildrenAges = basicInfo.childrenAges;
            const fixedEducationCostAnnual = initialChildrenAges.length > 0
                ? initialChildrenAges.reduce((sum, age) => sum + getEducationCost(age), 0)
                : 0;

            for (let i = 0; i <= years; i++) {
                const currentAge = startAge + i;
                const spouseAge = spouseStartAge > 0 ? spouseStartAge + i : 0;

                let pension = 0;

                const childrenCurrentAges = basicInfo.childrenAges.map(age => age + i);
                const eligibleChildren18 = childrenCurrentAges.filter(age => age < 19).length;
                const eligibleChildrenDisability = calculateEligibleChildrenCount(childrenCurrentAges, 2);

                if (type === 'survivor') {
        if (basicInfo.spouseType !== undefined && basicInfo.spouseType === 'couple') {
                        if (targetPerson === 'husband') {
                            // 遺族（妻）の老齢年金開始年齢を取得
                            const oldAgeStart = basicInfo.oldAgeStartWife || 65;
                            let kiso = 0;
                            if (eligibleChildren18 > 0) {
                                kiso = kisoAnnualByCount(eligibleChildren18);
                            }
                            const survivorKousei = proportionAnnual(basicInfo.avgStdMonthlyHusband, basicInfo.monthsHusband, basicInfo.useMinashi300Husband);
            let chukorei = 0;
                            if (eligibleChildren18 === 0 && currentAge >= 40 && currentAge < oldAgeStart) {
                chukorei = CHUKOREI_KASAN;
            }
                            if (currentAge >= oldAgeStart) {
                                // 老齢年金開始後：老齢基礎年金（繰上げ・繰下げ調整済み）+ max(遺族厚生年金, 自身の老齢厚生年金（繰上げ・繰下げ調整済み）)
                                const ownKouseiBase = calculateOldAgeEmployeePension(basicInfo.avgStdMonthlyWife, basicInfo.monthsWife);
                                const ownKisoBase = calculateOldAgeBasicPension();
                                const adjustedOwnKiso = calculateOldAgePensionAdjustment(ownKisoBase, oldAgeStart);
                                const adjustedOwnKousei = calculateOldAgePensionAdjustment(ownKouseiBase, oldAgeStart);
                                const maxKousei = Math.max(survivorKousei, adjustedOwnKousei);
                                pension = adjustedOwnKiso + maxKousei;
                            } else {
                                // 老齢年金開始前：遺族基礎年金（子がいる場合）+ 遺族厚生年金 + 中高齢寡婦加算（条件を満たす場合）
                                pension = kiso + survivorKousei + chukorei;
                            }
                        }
                        else if (targetPerson === 'wife') {
                            // 遺族（夫）の老齢年金開始年齢を取得
                            const oldAgeStart = basicInfo.oldAgeStartHusband || 65;
                            let kiso = 0;
                            if (eligibleChildren18 > 0) {
                                kiso = kisoAnnualByCount(eligibleChildren18);
                            }
                            const survivorKousei = proportionAnnual(basicInfo.avgStdMonthlyWife, basicInfo.monthsWife, basicInfo.useMinashi300Wife);
                            if (currentAge >= oldAgeStart) {
                                // 老齢年金開始後：老齢基礎年金（繰上げ・繰下げ調整済み）+ max(遺族厚生年金, 自身の老齢厚生年金（繰上げ・繰下げ調整済み）)
                                const ownKouseiBase = calculateOldAgeEmployeePension(basicInfo.avgStdMonthlyHusband, basicInfo.monthsHusband);
                                const ownKisoBase = calculateOldAgeBasicPension();
                                const adjustedOwnKiso = calculateOldAgePensionAdjustment(ownKisoBase, oldAgeStart);
                                const adjustedOwnKousei = calculateOldAgePensionAdjustment(ownKouseiBase, oldAgeStart);
                                const maxKousei = Math.max(survivorKousei, adjustedOwnKousei);
                                pension = adjustedOwnKiso + maxKousei;
                            } else {
                                // 老齢年金開始前：遺族基礎年金（子がいる場合）+ 遺族厚生年金
                            pension = kiso + survivorKousei;
                        }
                        }
                    } else if (basicInfo.spouseType !== undefined && basicInfo.spouseType === 'none') {
                        // シングルマザー/ファザー家庭：親が死亡した場合、子に遺族基礎年金と遺族厚生年金が支給される
                        let kiso = 0;
                        if (eligibleChildren18 > 0) {
                            kiso = kisoAnnualByCount(eligibleChildren18);
                        }
                        const kousei = proportionAnnual(basicInfo.avgStdMonthly, basicInfo.employeePensionMonths, basicInfo.useMinashi300);
                        pension = kiso + kousei;
        }

                } else {
                    const level = 2;
                    const kiso = calculateDisabilityBasicPension(level, eligibleChildrenDisability);
                    const spouseBonus = (spouseAge > 0 && spouseAge < 65) ? SPOUSE_BONUS : 0;

                    let kousei = 0;
                    if (targetPerson === 'husband') {
                        const disabilityKousei = calculateDisabilityEmployeePension(level, spouseBonus, 0, basicInfo.avgStdMonthlyHusband, basicInfo.monthsHusband, basicInfo.useMinashi300Husband);
                        if (currentAge >= 65) {
                            // 65歳以降：障害厚生年金と老齢厚生年金（65歳時点）の最大値を取る
                            const oldAgeKouseiAt65 = calculateOldAgeEmployeePension(basicInfo.avgStdMonthlyHusband, basicInfo.monthsHusband);
                            kousei = Math.max(disabilityKousei, oldAgeKouseiAt65);
                        } else {
                            kousei = disabilityKousei;
                        }
                    } else if (targetPerson === 'wife') {
                        const disabilityKousei = calculateDisabilityEmployeePension(level, spouseBonus, 0, basicInfo.avgStdMonthlyWife, basicInfo.monthsWife, basicInfo.useMinashi300Wife);
                        if (currentAge >= 65) {
                            // 65歳以降：障害厚生年金と老齢厚生年金（65歳時点）の最大値を取る
                            const oldAgeKouseiAt65 = calculateOldAgeEmployeePension(basicInfo.avgStdMonthlyWife, basicInfo.monthsWife);
                            kousei = Math.max(disabilityKousei, oldAgeKouseiAt65);
                        } else {
                            kousei = disabilityKousei;
                        }
                    } else {
                        const disabilityKousei = calculateDisabilityEmployeePension(level, 0, 0, basicInfo.avgStdMonthly, basicInfo.employeePensionMonths, basicInfo.useMinashi300);
                        if (currentAge >= 65) {
                            // 65歳以降：障害厚生年金と老齢厚生年金（65歳時点）の最大値を取る
                            const oldAgeKouseiAt65 = calculateOldAgeEmployeePension(basicInfo.avgStdMonthly, basicInfo.employeePensionMonths);
                            kousei = Math.max(disabilityKousei, oldAgeKouseiAt65);
                        } else {
                            kousei = disabilityKousei;
                        }
                    }
                    pension = kiso + kousei;
                }

                let workIncome = 0;
                // 就労収入：昇給率は考慮せず、現在の給料ベースで一定（フラット）に推移させる
                if (type === 'survivor') {
                    // 遺族シナリオ：就労率を適用
                    if (currentAge < 65) {
                        workIncome = survivorBaseIncome * (workIncomeRatio / 100);
                    }
                } else {
                    // 障害シナリオ：就労率は適用せず、配偶者の就労収入は100%として計算
                    if (spouseAge > 0 && spouseAge < 65) {
                        workIncome = survivorBaseIncome; // 障害シナリオでは就労率を適用しない
                    }
                }

                const expenseRatio = type === 'survivor' ? expenseRatioSurvivor : expenseRatioDisability;
                // 遺族シナリオでは団信加入者の場合のみ住宅ローンが免除されるため控除、障害シナリオでは控除しない
                const hasDanshin = profile.danshinHolder && (
                    (targetPerson === 'husband' && profile.danshinHolder.includes('husband')) ||
                    (targetPerson === 'wife' && profile.danshinHolder.includes('wife'))
                );
                const expenseBase = type === 'survivor' && hasDanshin
                    ? currentExpenseAnnual - housingLoanAnnual  // 遺族: 団信加入者の場合のみ住宅ローンを控除
                    : currentExpenseAnnual;  // 遺族（団信なし）・障害: 住宅ローンを含む
                const baseExpense = Math.round(expenseBase * (expenseRatio / 100));

                // 教育費は固定値（初期年齢の値）を使用（変動させないため）
                const educationCost = fixedEducationCostAnnual;

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

                    // 団信加入者のチェック
                    const hasDanshin = profile.danshinHolder && (
                        (targetPerson === 'husband' && profile.danshinHolder.includes('husband')) ||
                        (targetPerson === 'wife' && profile.danshinHolder.includes('wife'))
                    );

                    // 1. 住宅ローン（団信加入者の場合のみ浮く支出に含める）
                    // ダンシンあり = 死んだら住宅ローンが保険で支払われる = 浮く支出に含める
                    // ダンシンなし = 死んでも住宅ローンは残る = 浮く支出に含めない
                    const housingLoan = hasDanshin ? housingLoanAnnual : 0;

                    // 2. 生活費から住宅ローンと教育費を引いた残りの30%が浮く支出
                    // 教育費は浮かないので、浮く支出の計算から除外
                    // 計算式: (現在の生活費 - 住宅ローン（ダンシンありの場合のみ） - 教育費) * (1 - 遺族生活費率)
                    const livingExpenseBase = currentExpenseAnnual - (hasDanshin ? housingLoanAnnual : 0) - fixedEducationCostAnnual;
                    const survivorRatio = expenseRatioSurvivor / 100;
                    const deceasedLivingExpense = livingExpenseBase * (1 - survivorRatio);

                    // 3. 浮く支出 = 住宅ローン（ダンシンありの場合のみ）+ 生活費削減分
                    grayArea = housingLoan + deceasedLivingExpense;

                    // 必要保障額（ターゲット）は、手取り年収からグレーエリアを引いたもの
                    totalTarget = Math.max(0, targetAnnualIncome - grayArea);
                } else {
                    // 障害シナリオ: 「生活費保障（生存保障）ベース」
                    // ターゲット = 事故前の手取り年収（グラフの表示と一致させるため）
                    // 教育費は浮かないので、ターゲットから除外
                    totalTarget = targetAnnualIncome;
                    grayArea = 0;
                }

                // 不足額計算：児童手当・児童扶養手当を含めた収入で計算
                // （トグルの表示/非表示に関わらず、常に手当を含めて計算）
                const allowancesMonthly = (childAllowanceMonthly + childSupportAllowanceMonthly) * 12; // 年額換算
                const totalIncomeWithAllowances = baseIncome + allowancesMonthly;
                const baseShortfall = Math.max(0, totalTarget - totalIncomeWithAllowances);

                // グラフ表示期間に合わせて、endAgeまでの期間のみをカウント
                // currentAgeがendAge未満の場合、その年は12ヶ月
                // currentAgeがendAge以上の場合、その年は0ヶ月
                // ただし、currentAgeがendAgeと等しい場合、その年は0ヶ月（endAgeの年齢に達した時点で終了）
                const monthsActive = currentAge < endAge ? 12 : 0;
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

            // 傷病手当金は収入面（グラフの緑の面）には組み込むが、最終保障総額の計算からは除外
            // まず、傷病手当金を考慮しない不足額を計算
            // baseShortfallは年間の不足額、monthsActiveはその年の有効月数（12または0）
            // monthsActiveが12の場合、baseShortfallをそのまま加算
            // monthsActiveが0の場合、加算しない
            const activeEntries = data.filter(entry => entry.monthsActive > 0);
            const initialWeightedShortfallTotal = activeEntries.reduce((sum, entry) => sum + entry.baseShortfall, 0);
            
            
            const initialWeightedEntries = activeEntries.map((entry) => ({
                entry,
                weight: entry.baseShortfall,
            }));

            const sicknessDeduction = type === 'disability'
                ? Math.min(sicknessAllowanceTotal, initialWeightedShortfallTotal)
                : 0;
            // 最終保障総額の計算から傷病手当金の控除は削除：貯蓄のみを控除
            // 死亡時シナリオの場合、葬儀代を貯蓄から控除（葬儀代が選択されている場合のみ）
            const effectiveSavings = type === 'survivor' && funeralCost > 0
                ? Math.max(0, currentSavingsYen - funeralCost)
                : currentSavingsYen;
            const savingsApplied = Math.min(effectiveSavings, initialWeightedShortfallTotal);

            const distributeAllowance = (total: number) =>
                initialWeightedEntries.map((item) => (initialWeightedShortfallTotal > 0 ? (item.weight / initialWeightedShortfallTotal) * total : 0));

            const sicknessDistribution = distributeAllowance(sicknessDeduction);
            const savingsDistribution = distributeAllowance(savingsApplied);

            // 傷病手当金と貯蓄を考慮した収入で不足額を再計算
            initialWeightedEntries.forEach((item, idx) => {
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

            // 傷病手当金と貯蓄を考慮した後の不足額からweightedShortfallTotalを再計算
            const weightedEntries = data.map((entry) => ({
                entry,
                weight: entry.shortfall * (entry.monthsActive / 12),
            }));
            const weightedShortfallTotal = weightedEntries.reduce((sum, item) => sum + item.weight, 0);

            const targetActiveTotal = data.reduce((sum, entry) => sum + entry.totalTarget * (entry.monthsActive / 12), 0);
            totalShortfall = initialWeightedShortfallTotal;
            // 最終保障総額 = 総不足額（傷病手当金を考慮する前） - 既存貯蓄・保険総額
            // 傷病手当金は収入面（グラフの緑の面）には組み込むが、最終保障総額の計算からは除外
            // 死亡時シナリオの場合、葬儀代を不足額に加算（葬儀代が選択されている場合のみ）
            const netShortfall = Math.max(0, initialWeightedShortfallTotal - savingsApplied) + (type === 'survivor' && funeralCost > 0 ? funeralCost : 0);
            const activeShortfalls = data.filter(d => d.monthsActive > 0).map(d => d.shortfall / 12);
            monthlyShortfallMax = activeShortfalls.length ? Math.max(...activeShortfalls) : 0;

            // 団信による住宅ローン免除額（遺族シナリオで団信加入者の場合のみ、65歳までの期間）
            const hasDanshin = profile.danshinHolder && (
                (targetPerson === 'husband' && profile.danshinHolder.includes('husband')) ||
                (targetPerson === 'wife' && profile.danshinHolder.includes('wife'))
            );
            const exemptedHousingLoan = type === 'survivor' && hasDanshin
                ? housingLoanAnnual * (activeMonthsSum / 12)  // 遺族: 団信加入者の場合のみ65歳までの住宅ローン免除額
                : 0;  // 遺族（団信なし）・障害: 団信は適用されない

        return {
                title: type === 'survivor' ?
                    (targetPerson === 'husband' ? '夫死亡時の家計簿' : (targetPerson === 'wife' ? '妻死亡時の家計簿' : '本人死亡時の家計簿')) :
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
                targetActiveTotal,
                funeralCost: type === 'survivor' && funeralCost > 0 ? funeralCost : 0 // 死亡時シナリオのみ葬儀代を記録（選択されている場合のみ）
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

    }, [profile, expenseRatioSurvivor, expenseRatioDisability, workIncomeRatio, currentSavingsYen, sicknessAllowanceTotal, customEndAges, funeralCost]);

    if (!profile) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6 text-slate-200">
                <div className="text-center">読み込み中...</div>
            </div>
        );
    }

    return (
        <main id="necessary-coverage-page" className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500/30 pb-20">
            <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
                <div className="w-full max-w-[1920px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between mb-3">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <span className="w-2 h-8 bg-rose-500 rounded-full"></span>
                        必要保障額シミュレーション
                    </h1>
                    <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                        TOPへ戻る
                    </Link>
                    </div>
                    
                    {/* Navigation Links */}
                    <nav className="flex flex-wrap gap-3 mt-3">
                        <Link
                            href="/simulators/customer-profile"
                            className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-sky-400 hover:border-sky-500/50 hover:bg-slate-800/80 transition-all duration-300 text-sm font-medium"
                        >
                            基本情報設定
                        </Link>
                        <Link
                            href="/simulators/survivor-pension"
                            className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-slate-800/80 transition-all duration-300 text-sm font-medium"
                        >
                            遺族年金
                        </Link>
                        <Link
                            href="/simulators/disability-pension"
                            className="px-3 py-1.5 rounded-lg bg-slate-800/60 border border-slate-700 text-slate-300 hover:text-amber-400 hover:border-amber-500/50 hover:bg-slate-800/80 transition-all duration-300 text-sm font-medium"
                        >
                            障害年金
                        </Link>
                    </nav>
                </div>
            </div>

            <div className="w-full max-w-[1920px] mx-auto px-6 py-10">
                {scenarios && (
                    <div className="space-y-16">
                        {(profile.basicInfo.spouseType !== undefined && profile.basicInfo.spouseType === 'couple') ? (
                            <>
                                {/* 死亡時シナリオ用の条件設定 */}
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 pb-2 shadow-lg mb-4">
                                    <button
                                        onClick={() => setShowDeathSettings((prev) => !prev)}
                                        className="w-full flex items-center justify-between mb-2"
                                    >
                                        <h2 className="text-lg font-bold flex items-center gap-2">
                                            <span>⚙️</span> 死亡時シナリオの条件設定
                    </h2>
                                        <span className={`text-slate-400 transition-transform ${showDeathSettings ? 'rotate-180' : ''}`}>
                                            ⌃
                                        </span>
                                    </button>

                                    {showDeathSettings && (
                        <div>
                                            <div className="space-y-2">
                                                <div className="mb-1">
                                                    <label className="block text-sm font-medium text-slate-400 mb-1">
                                                        遺族の生活費率: <span className="text-emerald-400 font-bold">{expenseRatioSurvivor}%</span>
                            </label>
                            <input
                                type="range" min="50" max="100" step="5"
                                value={expenseRatioSurvivor}
                                onChange={(e) => setExpenseRatioSurvivor(Number(e.target.value))}
                                                        className="w-1/4 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                                                    <p className="text-xs text-slate-500 mt-1">現在の生活費を100%として、パートナーが亡くなった後の遺族の生活費が何%になるかを設定します。一般的には60〜80%程度です。</p>
                        </div>
                                                <div className="flex items-center gap-2 mb-1">
                                <label className="block text-sm font-medium text-slate-400">現在の貯蓄・既存保険総額</label>
                                <button
                                    type="button"
                                    onClick={() => setShowSavingsInfo((prev) => !prev)}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                                >
                                    <span role="img" aria-label="hint">💡</span>
                                    入力しなくても問題ありません。
                                    <span className={`text-xs transition-transform ${showSavingsInfo ? 'rotate-180' : ''}`}>⌃</span>
                                </button>
                                        </div>
                                                <div className="p-0 max-w-md bg-slate-950/60 border border-slate-800 rounded-lg">
                                                    <div className="px-[2px] py-0.5">
                            <div className="relative">
                                <select
                                    value={currentSavingsMan}
                                    onChange={(e) => setCurrentSavingsMan(Number(e.target.value))}
                                                                className="w-full rounded-xl px-2 py-1 bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-100 font-mono text-sm appearance-none"
                                >
                                    {SAVINGS_OPTIONS_MAN.map((option) => (
                                        <option key={option} value={option}>
                                            {option.toLocaleString()}万円
                                        </option>
                                    ))}
                                </select>
                                                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                                    ▼
                                </span>
                                                        </div>
                                                    </div>
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
                                    )}
                                    </div>

                                {/* 死亡シナリオ：2カラムで横並び */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="w-full">
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
                                            expenseRatioSurvivor={expenseRatioSurvivor}
                                            setExpenseRatioSurvivor={setExpenseRatioSurvivor}
                                            exportId="scenario-husband-death"
                                />
                                    </div>
                                    <div className="w-full">
                                <ScenarioSection
                                            result={scenarios.wifeDeath}
                                    profile={profile}
                                            color="emerald"
                                            icon="💀"
                                            description="妻が死亡した場合、家庭から妻の収入がなくなる。公的保障による補填額を確認します"
                                            scenarioKey="wifeDeath"
                                    displayPeriodModes={displayPeriodModes}
                                    setDisplayPeriodModes={setDisplayPeriodModes}
                                    customEndAges={customEndAges}
                                    setCustomEndAges={setCustomEndAges}
                                            expenseRatioSurvivor={expenseRatioSurvivor}
                                            setExpenseRatioSurvivor={setExpenseRatioSurvivor}
                                            exportId="scenario-wife-death"
                                        />
                                    </div>
                                </div>

                                {/* 死亡時シナリオの懸念点カード */}
                                <div id="concern-death" className="bg-emerald-950/20 border border-emerald-800/50 rounded-2xl p-6 shadow-lg">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-emerald-300">
                                        <span>⚠️</span> 懸念点
                                    </h3>
                                    <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                                        <div>
                                            <strong className="text-emerald-400">・教育費が継続してかかる</strong>：
                                            パートナーが亡くなっても、子供の教育費は継続してかかります。
                                            <div className="mt-2">
                                                <button
                                                    onClick={() => setShowEducationCourse((prev) => !prev)}
                                                    className="w-full flex items-center justify-between text-left"
                                                >
                                                    <label className="text-xs text-slate-400">教育費コース</label>
                                                    <span className={`text-xs text-slate-500 transition-transform ${showEducationCourse ? 'rotate-180' : ''}`}>▼</span>
                                                </button>
                                                {showEducationCourse && (
                                                    <div className="mt-2 p-3 bg-slate-950/60 border border-slate-800 rounded-lg space-y-3">
                                                        <div>
                                                            <label className="block text-xs text-slate-400 mb-2">コースを選択</label>
                                                            <select
                                                                value={educationCourse}
                                                                onChange={(e) => setEducationCourse(e.target.value as 'public' | 'private_uni' | 'private_hs' | 'private_jhs')}
                                                                className="w-full rounded-xl px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-100 text-sm"
                                                            >
                                                                <option value="public">すべて公立（約1,000万円）</option>
                                                                <option value="private_uni">大学のみ私立（約1,200万円）</option>
                                                                <option value="private_hs">高校から私立（約1,400万円）</option>
                                                                <option value="private_jhs">中学から私立（約1,800万円）</option>
                                                            </select>
                                                        </div>
                                                        <div className="text-xs text-slate-300 space-y-2">
                                                            <div>
                                                                <button
                                                                    onClick={() => setShowPublicCourse((prev) => !prev)}
                                                                    className="w-full flex items-center justify-between text-left"
                                                                >
                                                                    <strong className="text-emerald-400">すべて公立（約1,000万円）</strong>
                                                                    <span className={`text-xs text-slate-500 transition-transform ${showPublicCourse ? 'rotate-180' : ''}`}>▼</span>
                                                                </button>
                                                                {showPublicCourse && (
                                                                    <div className="text-slate-400 mt-1 space-y-1 pl-2">
                                                                        <div>小学校：約30万円/年（6年間で約180万円）</div>
                                                                        <div>中学校：約45万円/年（3年間で約135万円）</div>
                                                                        <div>高校：約50万円/年（3年間で約150万円）</div>
                                                                        <div>大学：約70万円/年（4年間で約280万円）</div>
                                                                        <div className="mt-1 font-semibold">合計：約745万円（入学金・その他含む約1,000万円）</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <button
                                                                    onClick={() => setShowPrivateUniCourse((prev) => !prev)}
                                                                    className="w-full flex items-center justify-between text-left"
                                                                >
                                                                    <strong className="text-emerald-400">大学のみ私立（約1,200万円）</strong>
                                                                    <span className={`text-xs text-slate-500 transition-transform ${showPrivateUniCourse ? 'rotate-180' : ''}`}>▼</span>
                                                                </button>
                                                                {showPrivateUniCourse && (
                                                                    <div className="text-slate-400 mt-1 space-y-1 pl-2">
                                                                        <div>小学校：約30万円/年（6年間で約180万円）</div>
                                                                        <div>中学校：約45万円/年（3年間で約135万円）</div>
                                                                        <div>高校：約50万円/年（3年間で約150万円）</div>
                                                                        <div>大学：約150万円/年（4年間で約600万円）</div>
                                                                        <div className="mt-1 font-semibold">合計：約1,065万円（入学金・その他含む約1,200万円）</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <button
                                                                    onClick={() => setShowPrivateHsCourse((prev) => !prev)}
                                                                    className="w-full flex items-center justify-between text-left"
                                                                >
                                                                    <strong className="text-emerald-400">高校から私立（約1,400万円）</strong>
                                                                    <span className={`text-xs text-slate-500 transition-transform ${showPrivateHsCourse ? 'rotate-180' : ''}`}>▼</span>
                                                                </button>
                                                                {showPrivateHsCourse && (
                                                                    <div className="text-slate-400 mt-1 space-y-1 pl-2">
                                                                        <div>小学校：約30万円/年（6年間で約180万円）</div>
                                                                        <div>中学校：約45万円/年（3年間で約135万円）</div>
                                                                        <div>高校：約100万円/年（3年間で約300万円）</div>
                                                                        <div>大学：約150万円/年（4年間で約600万円）</div>
                                                                        <div className="mt-1 font-semibold">合計：約1,215万円（入学金・その他含む約1,400万円）</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                            <div>
                                                                <button
                                                                    onClick={() => setShowPrivateJhsCourse((prev) => !prev)}
                                                                    className="w-full flex items-center justify-between text-left"
                                                                >
                                                                    <strong className="text-emerald-400">中学から私立（約1,800万円）</strong>
                                                                    <span className={`text-xs text-slate-500 transition-transform ${showPrivateJhsCourse ? 'rotate-180' : ''}`}>▼</span>
                                                                </button>
                                                                {showPrivateJhsCourse && (
                                                                    <div className="text-slate-400 mt-1 space-y-1 pl-2">
                                                                        <div>小学校：約30万円/年（6年間で約180万円）</div>
                                                                        <div>中学校：約130万円/年（3年間で約390万円）</div>
                                                                        <div>高校：約100万円/年（3年間で約300万円）</div>
                                                                        <div>大学：約150万円/年（4年間で約600万円）</div>
                                                                        <div className="mt-1 font-semibold">合計：約1,470万円（入学金・その他含む約1,800万円）</div>
                                                                    </div>
                                                                )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                        <ul className="space-y-2 pl-4 list-disc">
                                            <li>
                                                <strong className="text-emerald-400">葬式代で貯蓄が減る可能性</strong>：葬儀代と火葬式の費用がかかります。
                                                <div className="mt-2 ml-4 space-y-2">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={funeralCost === 2000000}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setFuneralCost(2000000);
                                                                } else {
                                                                    setFuneralCost(0);
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-700 rounded focus:ring-emerald-500 focus:ring-2"
                                                        />
                                                        <span className="text-xs text-slate-400">
                                                            一般的な葬儀（葬儀代＋火葬式）の平均相場：<strong className="text-emerald-300">約150万円〜300万円</strong>（平均：225万円）→ 中間値<strong className="text-emerald-300">200万円</strong>を保障に追加
                                                        </span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={funeralCost === 750000}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setFuneralCost(750000);
                                                                } else {
                                                                    setFuneralCost(0);
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-700 rounded focus:ring-emerald-500 focus:ring-2"
                                                        />
                                                        <span className="text-xs text-slate-400">
                                                            最近増えている家族葬（葬儀代＋火葬式）の相場：<strong className="text-emerald-300">約50万円〜100万円</strong>（平均：75万円）→ 中間値<strong className="text-emerald-300">75万円</strong>を保障に追加
                                                        </span>
                                                    </label>
                                                </div>
                                            </li>
                                            <li>
                                                <strong className="text-emerald-400">就労率が下がり給料が減る可能性</strong>：パートナーを失った悲しみや、子育て・家事の負担増により、就労率が想定より下がり、収入が減少する可能性があります。
                                                <div className="mt-2 ml-4">
                                                    <p className="text-sm text-emerald-300">
                                                        さらに、<strong className="text-white">今後のキャリアを諦めなければいけない</strong>などの就労に対するリスクも考慮する必要があります。昇進や転職の機会を失うことで、長期的な収入増加の機会が制限される可能性があります。
                                                    </p>
                                                </div>
                                                <div className="mt-3 ml-4">
                                                    <div className="flex items-center gap-0">
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
                                                        </div>
                                                        <div className="p-0 max-w-md bg-slate-950/60 border border-slate-800 rounded-lg ml-2">
                                                            <div className="px-[2px] py-0.5">
                                                                <p className="text-xs text-slate-400 mb-1">調整後の配偶者就労収入（月額）</p>
                                                            {(profile?.basicInfo?.spouseType !== undefined && profile?.basicInfo?.spouseType === 'couple') ? (
                                                                <p className="text-base font-bold text-sky-400 whitespace-nowrap overflow-x-auto">
                                                                    夫死亡時（妻）: {profile.basicInfo.annualIncomeWife || profile.basicInfo.avgStdMonthlyWife * 12
                                                                        ? `${((profile.basicInfo.annualIncomeWife || profile.basicInfo.avgStdMonthlyWife * 12) * (workIncomeRatio / 100) / 12 / 10000).toFixed(1)}万円/月`
                                                                        : '未設定'} | 妻死亡時（夫）: {profile.basicInfo.annualIncomeHusband || profile.basicInfo.avgStdMonthlyHusband * 12
                                                                            ? `${((profile.basicInfo.annualIncomeHusband || profile.basicInfo.avgStdMonthlyHusband * 12) * (workIncomeRatio / 100) / 12 / 10000).toFixed(1)}万円/月`
                                                                            : '未設定'}
                                                                </p>
                                                            ) : (
                                                                <p className="text-base font-bold text-sky-400">
                                                                    {profile?.basicInfo?.annualIncome || profile?.basicInfo?.avgStdMonthly * 12
                                                                        ? `${((profile.basicInfo.annualIncome || profile.basicInfo.avgStdMonthly * 12) * (workIncomeRatio / 100) / 12 / 10000).toFixed(1)}万円/月`
                                                                        : '未設定'}
                                                                </p>
                                                            )}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </div>
                                            </li>
                                            <li><strong className="text-emerald-400">外食や雑費が増える可能性</strong>：家事の負担増により、外食や家事代行サービスの利用が増え、生活費が想定より増加する可能性があります。</li>
                                        </ul>
                                        <p className="mt-4 text-emerald-300 font-semibold">
                                            これらの要因を考慮すると、実際に必要な保障額は上記の計算結果よりも<strong className="text-white">さらに大きくなる可能性が高い</strong>ことをご理解ください。
                                        </p>
                                    </div>
                                </div>

                                {/* 障害時シナリオ用の条件設定 */}
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 pb-2 shadow-lg mb-4">
                                    <button
                                        onClick={() => setShowDisabilitySettings((prev) => !prev)}
                                        className="w-full flex items-center justify-between mb-2"
                                    >
                                        <h2 className="text-lg font-bold flex items-center gap-2">
                                            <span>⚙️</span> 障害時シナリオの条件設定
                                        </h2>
                                        <span className={`text-slate-400 transition-transform ${showDisabilitySettings ? 'rotate-180' : ''}`}>
                                            ⌃
                                        </span>
                                    </button>
                                    
                                    {showDisabilitySettings && (
                                        <div>
                                            {/* 条件設定は空にする */}
                                        </div>
                                    )}
                                </div>

                                {/* 障害シナリオ：2カラムで横並び */}
                                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                                    <div className="w-full">
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
                                            exportId="scenario-husband-disability"
                                />
                                    </div>
                                    <div className="w-full">
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
                                            exportId="scenario-wife-disability"
                                />
                                    </div>
                                </div>

                                {/* 障害時シナリオの懸念点カード */}
                                <div id="concern-disability" className="bg-amber-950/20 border border-amber-800/50 rounded-2xl p-6 shadow-lg">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-300">
                                        <span>⚠️</span> 懸念点
                                    </h3>
                                    <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                                        {/* 生活費の増加を一番上に配置 */}
                                        <div>
                                            <strong className="text-amber-400 text-base">生活費の増加</strong>
                                            <p className="mt-2">
                                                障害により、治療費、介護費、リハビリ費用、家事代行費などが発生し、生活費が大幅に増加します。障害生活費率で調整していますが、実際にはさらに増える可能性があります。
                                            </p>
                                            
                                            {/* 現在の生活費と調整後の障害生活費を表示 */}
                                            <div className="max-w-md grid grid-cols-1 md:grid-cols-2 gap-0 my-3">
                                                <div className="p-0 bg-slate-950/60 border border-slate-800 rounded-l-xl border-r-0">
                                                    <div className="px-[2px] py-0.5">
                                                        <p className="text-xs text-slate-400 mb-0.5">現在の生活費（顧客プロフィールより）</p>
                                                        <p className="text-xl font-bold text-white">
                                                            {profile.monthlyLivingExpense ? `${(profile.monthlyLivingExpense / 10000).toFixed(1)}万円/月` : '未設定'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {profile.monthlyLivingExpense ? `年額 ${(profile.monthlyLivingExpense * 12 / 10000).toFixed(0)}万円` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="p-0 bg-amber-950/30 border border-amber-800/50 rounded-r-xl border-l-0">
                                                    <div className="px-[2px] py-0.5">
                                                        <p className="text-xs text-slate-400 mb-0.5">調整後の障害生活費（月額）</p>
                                                        <p className="text-xl font-bold text-amber-400">
                                                            {profile.monthlyLivingExpense
                                                                ? `${(profile.monthlyLivingExpense * (expenseRatioDisability / 100) / 10000).toFixed(1)}万円/月`
                                                                : '未設定'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {profile.monthlyLivingExpense
                                                                ? `現在の生活費から ${expenseRatioDisability >= 100 ? '+' : ''}${((expenseRatioDisability / 100 - 1) * 100).toFixed(0)}%`
                                                                : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="my-4">
                                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                                    障害生活費率: <span className="text-amber-400 font-bold">{expenseRatioDisability}%</span>
                                                </label>
                                                <input
                                                    type="range" min="80" max="150" step="5"
                                                    value={expenseRatioDisability}
                                                    onChange={(e) => setExpenseRatioDisability(Number(e.target.value))}
                                                    className="w-1/4 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                />
                                                <p className="text-xs text-slate-500 mt-2">治療・介護費を含めると110〜130%程度が一般値で、介護が長期化するケースではさらに上振れします。</p>
                                            </div>
                                        </div>

                                        {/* 厚生年金加入の場合、傷病手当金1.5年分の金額を表示 */}
                                        {(() => {
                                            const isCouple = profile.basicInfo.spouseType !== undefined && profile.basicInfo.spouseType === 'couple';
                                            let hasEmployeePension = false;
                                            let avgStdMonthly = 0;
                                            
                                            if (isCouple) {
                                                // 夫婦の場合、夫または妻が厚生年金に加入しているかチェック
                                                const husbandHasPension = (profile.basicInfo.monthsHusband || 0) > 0;
                                                const wifeHasPension = (profile.basicInfo.monthsWife || 0) > 0;
                                                // どちらかが厚生年金に加入している場合
                                                if (husbandHasPension || wifeHasPension) {
                                                    hasEmployeePension = true;
                                                    // 夫と妻の平均標準報酬月額の平均を計算
                                                    const husbandAvg = profile.basicInfo.avgStdMonthlyHusband || 0;
                                                    const wifeAvg = profile.basicInfo.avgStdMonthlyWife || 0;
                                                    avgStdMonthly = (husbandAvg + wifeAvg) / 2;
                                                }
                                            } else {
                                                // 独身の場合
                                                hasEmployeePension = profile.basicInfo.hasEmployeePension || (profile.basicInfo.employeePensionMonths || 0) > 0;
                                                avgStdMonthly = profile.basicInfo.avgStdMonthly || 0;
                                            }
                                            
                                            if (hasEmployeePension && avgStdMonthly > 0) {
                                                // 傷病手当金の計算
                                                // 標準報酬月額の2/3が1日あたりの金額、最長1.5年間（18ヶ月）支給
                                                const dailyAllowance = avgStdMonthly * (2 / 3) / 30; // 1日あたり
                                                const allowance1_5Years = dailyAllowance * 30 * 18; // 1.5年分（18ヶ月）
                                                const monthlyAllowance = allowance1_5Years / 18; // 月額
                                                
                                                return (
                                                    <div className="mt-4 p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg">
                                                        <p className="text-sm text-amber-300">
                                                            <strong className="text-amber-400">厚生年金加入の場合</strong>、傷病手当金が最長1.5年間（約<strong className="text-white">{(monthlyAllowance / 10000).toFixed(1)}万円/月</strong>）支給される可能性があります。
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

                                        <div className="mt-4">
                                            <strong className="text-amber-400 text-base">月収の不足</strong>
                                            <p className="mt-2">
                                                障害により就労不能または就労制限が発生し、月収が減少します。この不足額はシミュレーションで計算されています。
                                            </p>
                                        </div>

                                        <p className="mt-4 text-amber-300 font-semibold">
                                            これらの要因を考慮すると、<strong className="text-white">月収の不足額に加えて、生活費の増加分も考慮する必要があり</strong>、実際に必要な保障額は<strong className="text-white">さらに大きくなる可能性が高い</strong>ことをご理解ください。
                                        </p>
                                    </div>
                                </div>
                            </>
                        ) : (
                            <>
                                {/* 独身：死亡時シナリオ用の条件設定（遺族シナリオ非表示のため非表示） */}
                                {profile.basicInfo.spouseType !== 'none' && (
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 pb-2 shadow-lg mb-4">
                                    <button
                                        onClick={() => setShowDeathSettings((prev) => !prev)}
                                        className="w-full flex items-center justify-between mb-2"
                                    >
                                        <h2 className="text-lg font-bold flex items-center gap-2">
                                            <span>⚙️</span> 死亡時シナリオの条件設定
                    </h2>
                                        <span className={`text-slate-400 transition-transform ${showDeathSettings ? 'rotate-180' : ''}`}>
                                            ⌃
                                        </span>
                                    </button>

                                    {showDeathSettings && (
                        <div>
                                            <div className="space-y-2">
                                                <div className="mb-1">
                                                    <label className="block text-sm font-medium text-slate-400 mb-1">
                                                        遺族の生活費率: <span className="text-emerald-400 font-bold">{expenseRatioSurvivor}%</span>
                            </label>
                            <input
                                type="range" min="50" max="100" step="5"
                                value={expenseRatioSurvivor}
                                onChange={(e) => setExpenseRatioSurvivor(Number(e.target.value))}
                                                        className="w-1/4 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                                                    <p className="text-xs text-slate-500 mt-1">現在の生活費を100%として、本人が亡くなった後の遺族の生活費が何%になるかを設定します。一般的には60〜80%程度です。</p>
                        </div>
                                                <div className="flex items-center gap-2 mb-1">
                                <label className="block text-sm font-medium text-slate-400">現在の貯蓄・既存保険総額</label>
                                <button
                                    type="button"
                                    onClick={() => setShowSavingsInfo((prev) => !prev)}
                                                        className="inline-flex items-center gap-1 text-xs font-semibold text-amber-300 hover:text-amber-200 transition-colors"
                                >
                                    <span role="img" aria-label="hint">💡</span>
                                    入力しなくても問題ありません。
                                    <span className={`text-xs transition-transform ${showSavingsInfo ? 'rotate-180' : ''}`}>⌃</span>
                                </button>
                                        </div>
                                                <div className="p-0 max-w-md bg-slate-950/60 border border-slate-800 rounded-lg">
                                                    <div className="px-[2px] py-0.5">
                            <div className="relative">
                                <select
                                    value={currentSavingsMan}
                                    onChange={(e) => setCurrentSavingsMan(Number(e.target.value))}
                                                                className="w-full rounded-xl px-2 py-1 bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-100 font-mono text-sm appearance-none"
                                >
                                    {SAVINGS_OPTIONS_MAN.map((option) => (
                                        <option key={option} value={option}>
                                            {option.toLocaleString()}万円
                                        </option>
                                    ))}
                                </select>
                                                            <span className="pointer-events-none absolute right-2 top-1/2 -translate-y-1/2 text-xs text-slate-500">
                                    ▼
                                </span>
                                                        </div>
                                                    </div>
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
                                    )}
                                    </div>
                                )}

                                {/* 死亡シナリオ（独身の場合は非表示） */}
                                {profile.basicInfo.spouseType !== 'none' && (
                                    <>
                                        <ScenarioSection
                                            result={scenarios.singleDeath}
                                            profile={profile}
                                            color="emerald"
                                            icon="💀"
                                            description="本人が死亡した場合、家庭から本人の収入がなくなる。公的保障による補填額を確認します"
                                            scenarioKey="singleDeath"
                                            displayPeriodModes={displayPeriodModes}
                                            setDisplayPeriodModes={setDisplayPeriodModes}
                                            customEndAges={customEndAges}
                                            setCustomEndAges={setCustomEndAges}
                                            expenseRatioSurvivor={expenseRatioSurvivor}
                                            setExpenseRatioSurvivor={setExpenseRatioSurvivor}
                                            exportId="scenario-single-death"
                                        />

                                        {/* 死亡時シナリオの懸念点カード */}
                                        <div id="concern-single-death" className="bg-emerald-950/20 border border-emerald-800/50 rounded-2xl p-6 shadow-lg mb-6">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-emerald-300">
                                        <span>⚠️</span> 懸念点
                                    </h3>
                                    <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                                        <div>
                                            <strong className="text-emerald-400">・教育費が継続してかかる</strong>：
                                            本人が亡くなっても、子供の教育費は継続してかかります。
                                        </div>
                                        <ul className="space-y-2 pl-4 list-disc">
                                            <li>
                                                <strong className="text-emerald-400">葬式代で貯蓄が減る可能性</strong>：葬儀代と火葬式の費用がかかります。
                                                <div className="mt-2 ml-4 space-y-2">
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={funeralCost === 2000000}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setFuneralCost(2000000);
                                                                } else {
                                                                    setFuneralCost(0);
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-700 rounded focus:ring-emerald-500 focus:ring-2"
                                                        />
                                                        <span className="text-xs text-slate-400">
                                                            一般的な葬儀（葬儀代＋火葬式）の平均相場：<strong className="text-emerald-300">約150万円〜300万円</strong>（平均：225万円）→ 中間値<strong className="text-emerald-300">200万円</strong>を保障に追加
                                                        </span>
                                                    </label>
                                                    <label className="flex items-center gap-2 cursor-pointer">
                                                        <input
                                                            type="checkbox"
                                                            checked={funeralCost === 750000}
                                                            onChange={(e) => {
                                                                if (e.target.checked) {
                                                                    setFuneralCost(750000);
                                                                } else {
                                                                    setFuneralCost(0);
                                                                }
                                                            }}
                                                            className="w-4 h-4 text-emerald-500 bg-slate-800 border-slate-700 rounded focus:ring-emerald-500 focus:ring-2"
                                                        />
                                                        <span className="text-xs text-slate-400">
                                                            最近増えている家族葬（葬儀代＋火葬式）の相場：<strong className="text-emerald-300">約50万円〜100万円</strong>（平均：75万円）→ 中間値<strong className="text-emerald-300">75万円</strong>を保障に追加
                                                        </span>
                                                    </label>
                                                </div>
                                            </li>
                                            <li><strong className="text-emerald-400">外食や雑費が増える可能性</strong>：家事の負担増により、外食や家事代行サービスの利用が増え、生活費が想定より増加する可能性があります。</li>
                                        </ul>
                                        <p className="mt-4 text-emerald-300 font-semibold">
                                            これらの要因を考慮すると、実際に必要な保障額は上記の計算結果よりも<strong className="text-white">さらに大きくなる可能性が高い</strong>ことをご理解ください。
                                        </p>
                                    </div>
                                </div>
                                    </>
                                )}

                                {/* 独身：障害時シナリオ用の条件設定 */}
                                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 pb-4 shadow-lg mb-6">
                                    <button
                                        onClick={() => setShowDisabilitySettings((prev) => !prev)}
                                        className="w-full flex items-center justify-between mb-4"
                                    >
                                        <h2 className="text-lg font-bold flex items-center gap-2">
                                            <span>⚙️</span> 障害時シナリオの条件設定
                                        </h2>
                                        <span className={`text-slate-400 transition-transform ${showDisabilitySettings ? 'rotate-180' : ''}`}>
                                            ⌃
                                        </span>
                                    </button>
                                    
                                    {showDisabilitySettings && (
                                        <div>
                                            {/* 条件設定は空にする */}
                                        </div>
                                )}
                                </div>

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
                                    exportId="scenario-single-disability"
                                />

                                {/* 独身：障害時シナリオの懸念点カード */}
                                <div id="concern-single-disability" className="bg-amber-950/20 border border-amber-800/50 rounded-2xl p-6 shadow-lg">
                                    <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-amber-300">
                                        <span>⚠️</span> 懸念点
                                    </h3>
                                    <div className="space-y-3 text-sm text-slate-300 leading-relaxed">
                                        {/* 生活費の増加を一番上に配置 */}
                                        <div>
                                            <strong className="text-amber-400 text-base">生活費の増加</strong>
                                            <p className="mt-2">
                                                障害により、治療費、介護費、リハビリ費用、家事代行費などが発生し、生活費が大幅に増加します。障害生活費率で調整していますが、実際にはさらに増える可能性があります。
                                            </p>
                                            
                                            {/* 現在の生活費と調整後の障害生活費を表示 */}
                                            <div className="max-w-md grid grid-cols-1 md:grid-cols-2 gap-0 my-3">
                                                <div className="p-0 bg-slate-950/60 border border-slate-800 rounded-l-xl border-r-0">
                                                    <div className="px-[2px] py-0.5">
                                                        <p className="text-xs text-slate-400 mb-0.5">現在の生活費（顧客プロフィールより）</p>
                                                        <p className="text-xl font-bold text-white">
                                                            {profile.monthlyLivingExpense ? `${(profile.monthlyLivingExpense / 10000).toFixed(1)}万円/月` : '未設定'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {profile.monthlyLivingExpense ? `年額 ${(profile.monthlyLivingExpense * 12 / 10000).toFixed(0)}万円` : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                                <div className="p-0 bg-amber-950/30 border border-amber-800/50 rounded-r-xl border-l-0">
                                                    <div className="px-[2px] py-0.5">
                                                        <p className="text-xs text-slate-400 mb-0.5">調整後の障害生活費（月額）</p>
                                                        <p className="text-xl font-bold text-amber-400">
                                                            {profile.monthlyLivingExpense
                                                                ? `${(profile.monthlyLivingExpense * (expenseRatioDisability / 100) / 10000).toFixed(1)}万円/月`
                                                                : '未設定'}
                                                        </p>
                                                        <p className="text-xs text-slate-500 mt-0.5">
                                                            {profile.monthlyLivingExpense
                                                                ? `現在の生活費から ${expenseRatioDisability >= 100 ? '+' : ''}${((expenseRatioDisability / 100 - 1) * 100).toFixed(0)}%`
                                                                : ''}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>

                                            <div className="my-4">
                                                <label className="block text-sm font-medium text-slate-400 mb-2">
                                                    障害生活費率: <span className="text-amber-400 font-bold">{expenseRatioDisability}%</span>
                                                </label>
                                                <input
                                                    type="range" min="80" max="150" step="5"
                                                    value={expenseRatioDisability}
                                                    onChange={(e) => setExpenseRatioDisability(Number(e.target.value))}
                                                    className="w-1/4 h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                                                />
                                                <p className="text-xs text-slate-500 mt-2">治療・介護費を含めると110〜130%程度が一般値で、介護が長期化するケースではさらに上振れします。</p>
                                            </div>
                                        </div>

                                        {/* 厚生年金加入の場合、傷病手当金1.5年分の金額を表示 */}
                                        {(() => {
                                            // 独身シナリオなので、常にfalse
                                            const isCouple = false;
                                            let hasEmployeePension = false;
                                            let avgStdMonthly = 0;
                                            
                                            if (isCouple) {
                                                // 夫婦の場合、夫または妻が厚生年金に加入しているかチェック
                                                const husbandHasPension = (profile.basicInfo.monthsHusband || 0) > 0;
                                                const wifeHasPension = (profile.basicInfo.monthsWife || 0) > 0;
                                                // どちらかが厚生年金に加入している場合
                                                if (husbandHasPension || wifeHasPension) {
                                                    hasEmployeePension = true;
                                                    // 夫と妻の平均標準報酬月額の平均を計算
                                                    const husbandAvg = profile.basicInfo.avgStdMonthlyHusband || 0;
                                                    const wifeAvg = profile.basicInfo.avgStdMonthlyWife || 0;
                                                    avgStdMonthly = (husbandAvg + wifeAvg) / 2;
                                                }
                                            } else {
                                                // 独身の場合
                                                hasEmployeePension = profile.basicInfo.hasEmployeePension || (profile.basicInfo.employeePensionMonths || 0) > 0;
                                                avgStdMonthly = profile.basicInfo.avgStdMonthly || 0;
                                            }
                                            
                                            if (hasEmployeePension && avgStdMonthly > 0) {
                                                // 傷病手当金の計算
                                                // 標準報酬月額の2/3が1日あたりの金額、最長1.5年間（18ヶ月）支給
                                                const dailyAllowance = avgStdMonthly * (2 / 3) / 30; // 1日あたり
                                                const allowance1_5Years = dailyAllowance * 30 * 18; // 1.5年分（18ヶ月）
                                                const monthlyAllowance = allowance1_5Years / 18; // 月額
                                                
                                                return (
                                                    <div className="mt-4 p-3 bg-amber-950/30 border border-amber-800/50 rounded-lg">
                                                        <p className="text-sm text-amber-300">
                                                            <strong className="text-amber-400">厚生年金加入の場合</strong>、傷病手当金が最長1.5年間（約<strong className="text-white">{(monthlyAllowance / 10000).toFixed(1)}万円/月</strong>）支給される可能性があります。
                                                        </p>
                                                    </div>
                                                );
                                            }
                                            return null;
                                        })()}

                                        <div className="mt-4">
                                            <strong className="text-amber-400 text-base">月収の不足</strong>
                                            <p className="mt-2">
                                                障害により就労不能または就労制限が発生し、月収が減少します。この不足額はシミュレーションで計算されています。
                                            </p>
                                        </div>

                                        <p className="mt-4 text-amber-300 font-semibold">
                                            これらの要因を考慮すると、<strong className="text-white">月収の不足額に加えて、生活費の増加分も考慮する必要があり</strong>、実際に必要な保障額は<strong className="text-white">さらに大きくなる可能性が高い</strong>ことをご理解ください。
                                        </p>
                                    </div>
                                </div>
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
                    <button
                        onClick={() => {
                            if (!profile) return;
                            
                            const elementIds: string[] = [];
                            
                            if (profile.basicInfo.spouseType !== undefined && profile.basicInfo.spouseType === 'couple') {
                                // 夫婦の場合
                                elementIds.push(
                                    'scenario-husband-death',
                                    'scenario-wife-death',
                                    'concern-death',
                                    'scenario-husband-disability',
                                    'scenario-wife-disability',
                                    'concern-disability'
                                );
                            } else {
                                // 独身の場合
                                elementIds.push(
                                    'scenario-single-disability',
                                    'concern-single-disability'
                                );
                            }
                            
                            // 全てのセクションを1つの印刷ページとして出力
                            exportMultipleToPDF(elementIds, '必要保障額_個別.pdf');
                        }}
                        className="px-8 py-3 rounded-full bg-sky-600 hover:bg-sky-700 text-white font-bold flex items-center gap-2 transition-colors"
                    >
                        <span>📄</span> PDF出力
                    </button>
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
    expenseRatioSurvivor,
    setExpenseRatioSurvivor,
    exportId,
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
    expenseRatioSurvivor?: number;
    setExpenseRatioSurvivor?: React.Dispatch<React.SetStateAction<number>>;
    exportId?: string;
}) {
    const [isPeriodCardOpen, setIsPeriodCardOpen] = useState(false);
    const displayPeriodMode = displayPeriodModes[scenarioKey] || 'child23';
    const customEndAge = customEndAges[scenarioKey] || 65;
    const calculatedEndAge = customEndAge;
    const headline = result.category === 'survivor' ? 'あなたに必要な死亡保障総額' : 'あなたに必要な所得補償総額';
    const activeMonths = Math.max(result.activeMonths, 0);
    
    // トグルボタンの状態管理（各シナリオごとに独立）
    const [showAllowancesToggle, setShowAllowancesToggle] = useState(true);
    const [showGrayAreaCalculation, setShowGrayAreaCalculation] = useState(false);
    
    // 児童手当・児童扶養手当の合計額を計算（最初のデータから取得）
    const firstDataEntry = result.data.length > 0 ? result.data[0] : null;
    const childAllowanceTotal = firstDataEntry ? (firstDataEntry.childAllowanceMonthly || 0) : 0;
    const childSupportAllowanceTotal = firstDataEntry ? (firstDataEntry.childSupportAllowanceMonthly || 0) : 0;

    // 事故発生前の現在の月額給料を計算
    // 生き残った配偶者の給料を満水基準とする
    // 年収を12で割った値を月額給料とする
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
        currentSalaryMonthly = husbandAnnual / 12;
    } else if (isWifeScenario) {
        currentSalaryMonthly = wifeAnnual / 12;
    } else {
        currentSalaryMonthly = singleAnnual / 12;
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

    // 障害年金シナリオかどうかを判定
    const isDisabilityScenario = scenarioKey.includes('Disability') || scenarioKey.includes('disability');
    
    // 障害年金シナリオの場合は、障害厚生年金を常に表示（showAllowancesToggleを常にtrueにする）
    // useEffectで障害年金シナリオの場合にshowAllowancesToggleをtrueに設定
    React.useEffect(() => {
        if (isDisabilityScenario) {
            setShowAllowancesToggle(true);
        }
    }, [isDisabilityScenario]);

    // 総保障不足額 = グラフの不足額（月額）× 12ヶ月 × 表示期間の年数
    // グラフのデータから直接不足額を計算（表示期間の末まで）
    // 各年の不足額（月額）を合計する
    const activeEntries = result.data.filter(entry => entry.monthsActive > 0 && entry.age < calculatedEndAge);
    
    let totalShortfallFromGraph = 0;
    if (activeEntries.length > 0) {
        // 各エントリの不足額（月額）を計算（グラフの表示ロジックと同じ）
        activeEntries.forEach(entry => {
            const totalAllowancesMonthly = (entry.childAllowanceMonthly || 0) + (entry.childSupportAllowanceMonthly || 0);
            const totalIncomeMonthly = (entry.pension / 12) + totalAllowancesMonthly;
            const targetMonthly = result.category === 'disability' 
                ? (entry.totalTarget / 12) // 障害シナリオ：生活費ベース
                : (currentSalaryMonthly - (entry.grayArea || 0) / 12); // 遺族シナリオ：給料ベース
            const shortfallMonthly = Math.max(0, targetMonthly - totalIncomeMonthly);
            // 不足額（月額）× 12ヶ月 = 年額
            totalShortfallFromGraph += shortfallMonthly * 12;
        });
    }
    
    // 貯蓄を控除
    const netShortfall = Math.max(0, totalShortfallFromGraph - result.savingsApplied);
    const shortfallText = (netShortfall / 10000).toFixed(0);
    const sicknessDeduction = result.sicknessDeduction;
    const savingsApplied = result.savingsApplied;
    const funeralCost = result.funeralCost;
    const deductionMessages: string[] = [];
    if (sicknessDeduction > 0) {
        deductionMessages.push(`傷病手当金 ${(sicknessDeduction / 10000).toFixed(0)}万円`);
    }
    if (savingsApplied > 0) {
        deductionMessages.push(`貯蓄から ${(savingsApplied / 10000).toFixed(0)}万円 控除`);
    }
    if (funeralCost > 0) {
        deductionMessages.push(`葬儀代 ${(funeralCost / 10000).toFixed(0)}万円 を考慮済み`);
    }

    // ラジオボタン選択時にcustomEndAgeを更新する関数
    const handlePeriodModeChange = (mode: 'child19' | 'child23' | 'retirement') => {
        setDisplayPeriodModes(prev => ({ ...prev, [scenarioKey]: mode }));
        if (!profile) return;
        
        const currentAge = (profile.basicInfo.spouseType !== undefined && profile.basicInfo.spouseType === 'couple')
            ? (profile.basicInfo.ageHusband || profile.basicInfo.ageWife || 0)
            : (profile.basicInfo.age || 0);
        const oldAgeStart = (profile.basicInfo.spouseType !== undefined && profile.basicInfo.spouseType === 'couple')
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
        <section id={exportId} className="bg-slate-900/40 border border-slate-800 rounded-3xl p-6 md:p-8 backdrop-blur-sm">
            <div className="flex flex-col md:flex-row md:items-center justify-between mb-6 gap-4">
                <div className="flex-1">
                    <h3 className="text-xl font-bold text-slate-100 flex items-center gap-3">
                        <span className="text-2xl">{icon}</span>
                        {result.title}
                        {isHusbandScenario && (
                            <span className="text-xl font-bold text-slate-100">
                                （夫の月収: {(husbandAnnual / 12 / 10000).toFixed(1)}万円）
                            </span>
                        )}
                        {isWifeScenario && (
                            <span className="text-xl font-bold text-slate-100">
                                （妻の月収: {(wifeAnnual / 12 / 10000).toFixed(1)}万円）
                            </span>
                        )}
                    </h3>
                    <p className="text-slate-400 text-sm mt-1">{description}</p>
                </div>
                <div className="text-right bg-slate-950/50 px-6 py-3 rounded-xl border border-slate-800">
                    <div className="text-xs text-slate-400 mb-1">{headline}</div>
                    <div className={`text-3xl font-bold ${netShortfall > 0 ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {netShortfall > 0 ? `${shortfallText}万円` : '不足なし'}
                    </div>
                    {deductionMessages.length > 0 && (
                        <div className="text-[11px] text-slate-500 mt-2">
                            {deductionMessages.join(' / ')} を控除済み
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-6">
                <div className="flex flex-wrap items-center gap-4 mb-2 text-xs font-medium justify-end px-4">
                    {isDisabilityScenario ? (
                        <>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }}></span>
                                <span className="text-amber-300">障害基礎年金（子の加算含む）</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#F59E0B' }}></span>
                                <span className="text-amber-200">障害厚生年金</span>
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex items-center gap-1.5">
                                <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#10B981' }}></span>
                                <span className="text-emerald-300">遺族年金</span>
                            </div>
                            {showAllowancesToggle && (
                                <div className="flex items-center gap-1.5">
                                    <span className="w-3 h-3 rounded-full" style={{ backgroundColor: '#34D399' }}></span>
                                    <span className="text-emerald-200">児童手当・児童扶養手当</span>
                                </div>
                            )}
                        </>
                    )}
                    <div className="flex flex-col gap-1.5">
                        <button
                            onClick={() => setShowGrayAreaCalculation((prev) => !prev)}
                            className="flex items-center gap-1.5 text-left"
                        >
                        <span className="w-3 h-3 rounded-full bg-slate-500/30 border border-slate-400/50"></span>
                            <span className="text-slate-400 flex items-center gap-1">
                                浮く支出（住宅ローン・故人の生活費）: {(result.data.length > 0 ? (result.data[0].grayArea || 0) / 120000 : 0).toFixed(1)}万円
                                <span className={`text-xs transition-transform ${showGrayAreaCalculation ? 'rotate-180' : ''}`}>▼</span>
                            </span>
                        </button>
                        {showGrayAreaCalculation && result.category === 'survivor' && (() => {
                            // 遺族シナリオの場合のみ表示
                            const isHusbandScenario = result.title.includes('夫死亡');
                            const isWifeScenario = result.title.includes('妻死亡');
                            const targetPerson = isHusbandScenario ? 'husband' : (isWifeScenario ? 'wife' : 'single');
                            
                            // ダンシンのチェック
                            const hasDanshin = profile.danshinHolder && (
                                (targetPerson === 'husband' && profile.danshinHolder.includes('husband')) ||
                                (targetPerson === 'wife' && profile.danshinHolder.includes('wife'))
                            );
                            
                            // 住宅ローン月額
                            const housingLoanMonthly = (profile.details?.housingLoan as number) || 0;
                            const housingLoanAnnual = housingLoanMonthly * 12;
                            
                            // 現在の生活費
                            const currentExpenseMonthly = profile.monthlyLivingExpense || 0;
                            const currentExpenseAnnual = currentExpenseMonthly * 12;
                            
                            // 教育費を計算（固定値、初期年齢の値、変動させない）
                            const getEducationCost = (age: number): number => {
                                if (age < 6) return 15000 * 12;
                                if (age < 12) return 20000 * 12;
                                if (age < 15) return 30000 * 12;
                                if (age < 18) return 40000 * 12;
                                if (age < 23) return 80000 * 12;
                                return 0;
                            };
                            const initialChildrenAges = profile.basicInfo.childrenAges || [];
                            const fixedEducationCostAnnual = initialChildrenAges.length > 0
                                ? initialChildrenAges.reduce((sum, age) => sum + getEducationCost(age), 0)
                                : 0;
                            const fixedEducationCostMonthly = fixedEducationCostAnnual / 12;
                            
                            // 生活費から住宅ローンと教育費を引いた残り（教育費は浮かないので除外）
                            const livingExpenseBase = currentExpenseAnnual - (hasDanshin ? housingLoanAnnual : 0) - fixedEducationCostAnnual;
                            const survivorRatio = (expenseRatioSurvivor || 80) / 100;
                            const deceasedLivingExpense = livingExpenseBase * (1 - survivorRatio);
                            
                            return (
                                <div className="ml-4 mt-2 p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 space-y-2">
                                    <div className="font-semibold text-slate-200">浮く支出の計算方法</div>
                                    <div className="space-y-2 pl-2">
                                        {hasDanshin && (
                                            <div>
                                                <div>1. 住宅ローン（団信加入者の場合のみ浮く支出に含める）: {housingLoanMonthly > 0 ? `${(housingLoanMonthly / 10000).toFixed(1)}万円/月` : 'なし'}</div>
                                            </div>
                                        )}
                                        <div>
                                            <div>2. 生活費から住宅ローンと教育費を引いた残りの{100 - (expenseRatioSurvivor || 80)}%が浮く支出（教育費は浮かないので除外）</div>
                                            <div className="text-slate-400 text-[11px] pl-2 mt-1">
                                                現在の生活費: {currentExpenseMonthly > 0 ? `${(currentExpenseMonthly / 10000).toFixed(1)}万円/月` : '未設定'}
                                                {hasDanshin && housingLoanMonthly > 0 && (
                                                    <>（住宅ローン: {housingLoanMonthly > 0 ? `${(housingLoanMonthly / 10000).toFixed(1)}万円/月` : 'なし'}を控除）</>
                                                )}
                                                {fixedEducationCostMonthly > 0 && (
                                                    <>（教育費: ${(fixedEducationCostMonthly / 10000).toFixed(1)}万円/月を控除）</>
                                                )}
                                            </div>
                                            {expenseRatioSurvivor !== undefined && setExpenseRatioSurvivor && (
                                                <div className="mt-2">
                                                    <label className="block text-xs text-slate-400 mb-1">
                                                        遺族の生活費率: <span className="text-emerald-400 font-bold">{expenseRatioSurvivor}%</span>
                                                    </label>
                                                    <input
                                                        type="range" min="50" max="100" step="5"
                                                        value={expenseRatioSurvivor}
                                                        onChange={(e) => setExpenseRatioSurvivor(Number(e.target.value))}
                                                        className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                                                    />
                                                </div>
                                            )}
                                            <div className="text-slate-400 text-[11px] pl-2 mt-1">
                                                計算式: ({currentExpenseMonthly > 0 ? `${(currentExpenseMonthly / 10000).toFixed(1)}万円` : '現在の生活費'}{hasDanshin && housingLoanMonthly > 0 ? ` - ${(housingLoanMonthly / 10000).toFixed(1)}万円` : ''}{fixedEducationCostMonthly > 0 ? ` - ${(fixedEducationCostMonthly / 10000).toFixed(1)}万円` : ''}) × {100 - (expenseRatioSurvivor || 80)}% = {deceasedLivingExpense > 0 ? `${(deceasedLivingExpense / 12 / 10000).toFixed(1)}万円/月` : '0万円/月'}
                                            </div>
                                        </div>
                                        <div>3. 浮く支出 = {hasDanshin && housingLoanMonthly > 0 ? `住宅ローン(${(housingLoanMonthly / 10000).toFixed(1)}万円/月) + ` : ''}生活費削減分({(deceasedLivingExpense / 12 / 10000).toFixed(1)}万円/月) = {((hasDanshin ? housingLoanMonthly : 0) + deceasedLivingExpense / 12) > 0 ? `${(((hasDanshin ? housingLoanMonthly : 0) + deceasedLivingExpense / 12) / 10000).toFixed(1)}万円/月` : '0万円/月'}</div>
                                    </div>
                                </div>
                            );
                        })()}
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
                    profile={profile}
                    scenarioType={scenarioKey as 'husbandDeath' | 'wifeDeath' | 'singleDeath' | 'husbandDisability' | 'wifeDisability' | 'singleDisability'}
                />
            </div>

            {/* トグルボタンと説明文（グラフ表示期間の直上） */}
            <div className="mb-4 flex items-center gap-4">
                {/* チェックボタン（表示/非表示） - 遺族年金シナリオのみ表示 */}
                {!isDisabilityScenario && (
                    <div className="flex items-center gap-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={showAllowancesToggle}
                                onChange={(e) => setShowAllowancesToggle(e.target.checked)}
                                className="w-4 h-4 text-emerald-500 rounded focus:ring-2 focus:ring-emerald-500"
                            />
                            <span className="text-sm font-medium text-slate-400">児童手当</span>
                        </label>
                    </div>
                )}

                {/* 開閉式説明文 */}
                <div className="flex-1">
                    <details className="group">
                        <summary className="cursor-pointer text-sm font-medium text-slate-400 hover:text-slate-300 list-none">
                            <span className="flex items-center gap-1">
                                公的給付の内訳
                                <span className="text-xs transition-transform group-open:rotate-180">▼</span>
                            </span>
                        </summary>
                        {isDisabilityScenario ? (
                            <div className="mt-2 p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 space-y-2">
                                <div className="space-y-1">
                                    <div className="font-semibold text-amber-300">障害基礎年金（子の加算含む）+ 障害厚生年金</div>
                                    <div className="pl-2 text-[10px] text-slate-400 space-y-0.5">
                                        <div>【障害基礎年金（2級）】</div>
                                        <div>・基本額: 月額 66,200円</div>
                                        <div>・子の加算: 第1子・第2子 18,740円/月、第3子以降 6,250円/月</div>
                                        <div className="text-amber-300 mt-1">※子の加算は障害基礎年金に含まれます</div>
                                    </div>
                                    <div className="pl-2 text-[10px] text-slate-400 space-y-0.5 mt-2">
                                        <div>【障害厚生年金（2級）】</div>
                                        <div>・若年層（25歳夫婦）: 月額 50,000円（簡略化のため定額）</div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="mt-2 p-3 bg-slate-950/60 border border-slate-800 rounded-lg text-xs text-slate-300 space-y-2">
                                <div className="space-y-1">
                                    <div className="font-semibold text-emerald-300">遺族基礎年金 + 遺族厚生年金 + 児童手当・児童扶養手当</div>
                                    <div className="pl-2 text-[10px] text-slate-400 space-y-0.5">
                                        <div>【遺族基礎年金】</div>
                                        <div>・基本額: 月額 68,000円（年額 816,000円）</div>
                                        <div>・子の加算: 第1子・第2子 18,740円/月、第3子以降 6,250円/月</div>
                                        <div className="text-emerald-300 mt-1">※18歳到達年度末までの子がいる場合に支給</div>
                                    </div>
                                    <div className="pl-2 text-[10px] text-slate-400 space-y-0.5 mt-2">
                                        <div>【遺族厚生年金】</div>
                                        <div>・報酬比例部分: 故人の厚生年金加入期間と平均標準報酬月額に基づき計算</div>
                                        <div>・中高齢寡婦加算: 40歳以上65歳未満で子のいない妻に月額 49,200円</div>
                                    </div>
                                </div>
                                <div className="space-y-1 mt-2">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>児童手当合計額: {(childAllowanceTotal / 10000).toFixed(1)}万円/月</div>
                                        <a 
                                            href="https://www.cfa.go.jp/policies/kokoseido/jidouteate/annai/" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 underline text-[10px] flex-shrink-0"
                                        >
                                            参考
                                        </a>
                                    </div>
                                    <div className="pl-2 text-[10px] text-slate-400 space-y-0.5">
                                        <div>【支給額】</div>
                                        <div>・0歳〜3歳未満: 第1・2子 15,000円、第3子以降 30,000円</div>
                                        <div>・3歳〜18歳の年度末まで: 第1・2子 10,000円、第3子以降 30,000円</div>
                                    </div>
                                </div>
                                <div className="space-y-1">
                                    <div className="flex items-center justify-between gap-2">
                                        <div>児童扶養手当合計額: {(childSupportAllowanceTotal / 10000).toFixed(1)}万円/月</div>
                                        <a 
                                            href="https://www.cfa.go.jp/policies/hitori-oya/fuyou-teate" 
                                            target="_blank" 
                                            rel="noopener noreferrer"
                                            className="text-blue-400 hover:text-blue-300 underline text-[10px] flex-shrink-0"
                                        >
                                            参考
                                        </a>
                                    </div>
                                    <div className="pl-2 text-[10px] text-slate-400 space-y-0.5">
                                        <div>【所得制限】</div>
                                        <div>・年収160万円未満: 全部支給（1人目 46,690円、2人目以降加算 11,030円）</div>
                                        <div>・年収160万円以上365万円未満: 一部支給（1人目 28,845円、2人目以降加算 8,270円）</div>
                                        <div>・年収365万円以上: 支給停止</div>
                                    </div>
                                </div>
                            </div>
                        )}
                    </details>
                </div>
            </div>

            {/* グラフ表示期間選択 */}
            <div className="mt-6">
                <button
                    onClick={() => setIsPeriodCardOpen(!isPeriodCardOpen)}
                    className="w-full flex items-center justify-between p-4 bg-slate-900/50 border border-slate-700 rounded-lg hover:bg-slate-800/50 transition-colors"
                >
                    <label className="block text-sm font-medium text-slate-300 cursor-pointer">
                    グラフ表示期間
                </label>
                    <span className={`text-slate-400 transition-transform ${isPeriodCardOpen ? 'rotate-180' : ''}`}>
                        ⌃
                    </span>
                </button>
                {isPeriodCardOpen && (
                    <div className="mt-2 p-4 bg-slate-900/50 border border-slate-700 rounded-lg">
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
                            min={(profile?.basicInfo?.spouseType !== undefined && profile?.basicInfo?.spouseType === 'couple')
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
                )}
            </div>

            {savingsApplied > 0 && (
                <p className="text-[11px] text-slate-500 text-right mt-4">※貯蓄・保険 ({(savingsApplied / 10000).toFixed(0)}万円) を必要保障額から控除済み</p>
            )}
        </section>
    );
}
