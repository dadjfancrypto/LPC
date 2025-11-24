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
} from '../../utils/pension-calc';

/* ===================== 型定義 ===================== */
type CustomerProfileBasicInfo = {
    childrenCount: number | undefined;
    childrenAges: number[];
    spouseType?: 'couple' | 'none';
    ageWife: number;
    oldAgeStartWife: number;
    avgStdMonthlyWife: number;
    monthsWife: number;
    useMinashi300Wife: boolean;
    ageHusband: number;
    oldAgeStartHusband: number;
    avgStdMonthlyHusband: number;
    monthsHusband: number;
    useMinashi300Husband: boolean;
    age: number;
    oldAgeStart: number;
    hasEmployeePension: boolean;
    employeePensionMonths: number;
    avgStdMonthly: number;
    useMinashi300: boolean;
};

type CustomerProfile = {
    monthlyLivingExpense: number;
    details: Record<string, unknown>;
    basicInfo: CustomerProfileBasicInfo;
    danshinHolder?: ('husband' | 'wife')[];
};

/* ===================== UI Components ===================== */

function CupVisualization({ expenseMonthly, pensionMonthly, gapMonthly, pensionLabel = '公的年金', colorTheme = 'sky', exemptedAmount = 0 }: { expenseMonthly: number; pensionMonthly: number; gapMonthly: number; pensionLabel?: string; colorTheme?: 'sky' | 'emerald' | 'rose' | 'amber' | 'slate'; exemptedAmount?: number; }) {
    const totalHeight = 320;
    const maxAmount = Math.max(expenseMonthly, pensionMonthly) * 1.2;
    const scale = maxAmount > 0 ? totalHeight / maxAmount : 0;

    const expenseHeight = expenseMonthly * scale;
    const pensionHeight = Math.min(pensionMonthly, expenseMonthly) * scale;
    const overflowHeight = Math.max(0, pensionMonthly - expenseMonthly) * scale;

    const colors = {
        sky: { border: 'border-sky-400/50', bg: 'bg-sky-900/20', water: 'bg-sky-500' },
        emerald: { border: 'border-emerald-400/50', bg: 'bg-emerald-900/20', water: 'bg-emerald-500' },
        rose: { border: 'border-rose-400/50', bg: 'bg-rose-900/20', water: 'bg-rose-500' },
        amber: { border: 'border-amber-400/50', bg: 'bg-amber-900/20', water: 'bg-amber-500' },
        slate: { border: 'border-slate-400/50', bg: 'bg-slate-900/20', water: 'bg-slate-500' },
    }[colorTheme];

    return (
        <div className="flex flex-col items-center justify-center py-4 relative">
            {/* 団信メッセージ */}
            {exemptedAmount > 0 && (
                <div className="absolute -top-2 left-0 right-0 flex justify-center z-20 pointer-events-none">
                    <div className="bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-4 py-1.5 rounded-full text-sm font-bold backdrop-blur-md shadow-lg animate-pulse flex items-center gap-1.5 whitespace-nowrap">
                        <span className="text-base">✨</span> 団信適用: 住宅ローン{(exemptedAmount / 10000).toFixed(1)}万円免除
                    </div>
                </div>
            )}

            {/* メインのコップエリア */}
            <div className="relative" style={{ width: 340, height: totalHeight }}>
                {/* 必要生活費ライン（左側） */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-full pointer-events-none"
                    style={{ height: expenseHeight, top: totalHeight - expenseHeight }}
                >
                    {/* 天井のライン（点線） */}
                    <div className="absolute left-12 right-12 top-0 border-t border-dashed border-slate-500/50" />

                    {/* 左側の寸法線エリア */}
                    <div className="absolute left-0 top-0 bottom-0 w-[60px]">
                        {/* 縦線 */}
                        <div className="absolute right-4 top-0 bottom-0 w-px bg-slate-500/60">
                            {/* 上端のヒゲ */}
                            <div className="absolute -left-1 top-0 w-3 h-px bg-slate-500/60" />
                            {/* 下端のヒゲ */}
                            <div className="absolute -left-1 bottom-0 w-3 h-px bg-slate-500/60" />
                        </div>

                        {/* ラベル（横書き・寸法線の上端付近） */}
                        <div className="absolute right-6 top-0 -translate-y-1/2 flex flex-col items-end whitespace-nowrap">
                            <span className="text-[10px] text-slate-400 leading-none mb-1">必要生活費</span>
                            <span className="text-lg font-bold text-slate-200 leading-none">
                                {(expenseMonthly / 10000).toFixed(1)}<span className="text-xs font-normal ml-0.5">万円</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* コップ本体 */}
                <div
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-56 rounded-b-[3rem] border-b-4 border-l-2 border-r-2 ${colors.border} ${colors.bg} backdrop-blur-sm overflow-hidden transition-all duration-500`}
                    style={{ height: totalHeight }}
                >
                    {/* 水（年金） */}
                    <div
                        className={`absolute bottom-0 left-0 right-0 ${colors.water} opacity-80 transition-all duration-1000 ease-out flex items-center justify-center shadow-[0_0_20px_rgba(0,0,0,0.3)_inset]`}
                        style={{ height: pensionHeight }}
                    >
                        {/* 水面のエフェクト（簡易的） */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-white/30" />

                        {pensionMonthly > 0 && pensionHeight > 40 && (
                            <div className="text-white font-bold text-center drop-shadow-md z-10">
                                <div className="text-xs opacity-90 mb-0.5">{pensionLabel}</div>
                                <div className="text-3xl leading-none">{(pensionMonthly / 10000).toFixed(1)}<span className="text-sm font-normal">万円</span></div>
                            </div>
                        )}
                    </div>

                    {/* 不足エリア（空洞部分） */}
                    {gapMonthly > 0 && (
                        <div
                            className="absolute left-0 right-0 flex flex-col items-center justify-center z-0"
                            style={{ bottom: pensionHeight, height: Math.max(0, expenseHeight - pensionHeight) }}
                        >
                            <div className="text-rose-400 font-bold text-center animate-pulse">
                                <div className="text-xs opacity-80">不足</div>
                                <div className="text-3xl leading-none">{(gapMonthly / 10000).toFixed(1)}<span className="text-sm font-normal">万円</span></div>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            {/* オーバーフロー（カバー済）表示 */}
            {overflowHeight > 0 && (
                <div className="absolute -right-4 top-10 bg-emerald-500/20 border border-emerald-500/50 text-emerald-300 px-3 py-1 rounded-full text-xs font-bold backdrop-blur-md shadow-lg animate-bounce">
                    全額カバー (+{((pensionMonthly - expenseMonthly) / 10000).toFixed(1)}万円)
                </div>
            )}
        </div>
    );
}

function ScenarioCard({
    title,
    children,
    className = ""
}: {
    title: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`bg-slate-900/40 border border-slate-800 rounded-3xl p-6 backdrop-blur-sm ${className}`}>
            <h3 className="text-lg font-bold text-slate-200 mb-6 text-center flex items-center justify-center gap-2">
                {title}
            </h3>
            {children}
        </div>
    );
}

/* ===================== ページ本体 ===================== */
export default function NecessaryCoveragePage() {
    const [profile, setProfile] = useState<CustomerProfile | null>(null);
    const [expenseRatioSurvivor, setExpenseRatioSurvivor] = useState(70);
    const [expenseRatioDisability, setExpenseRatioDisability] = useState(110);

    const DISABILITY_LEVEL: DisabilityLevel = 2;
    const SPOUSE_BONUS = 239300; // 配偶者加給年金額（令和7年度）

    // localStorageから読み込み
    useEffect(() => {
        if (typeof window !== 'undefined') {
            const saved = localStorage.getItem('customer-profile');
            const savedBasic = localStorage.getItem('customer-profile-basic');

            if (saved && savedBasic) {
                try {
                    const parsed = JSON.parse(saved);
                    const parsedBasic = JSON.parse(savedBasic);
                    // eslint-disable-next-line react-hooks/set-state-in-effect
                    setProfile({ ...parsed, basicInfo: parsedBasic });
                } catch (e) {
                    console.error('Failed to load profile', e);
                }
            }
        }
    }, []);

    // 計算ロジック
    const scenarios = useMemo(() => {
        if (!profile) return null;

        const { basicInfo } = profile;
        const currentExpense = profile.monthlyLivingExpense || 0;
        const housingLoan = (profile.details?.housingLoan as number) || 0;
        const danshinHolder = profile.danshinHolder || ['husband'];

        const childrenAges = basicInfo.childrenAges ?? [];
        const eligibleChildrenForDisability = calculateEligibleChildrenCount(
            childrenAges.filter((a): a is number => a != null),
            DISABILITY_LEVEL,
        );

        const makeResult = (annual: number | null, isDisability: boolean = false, targetPerson: 'husband' | 'wife' | 'single' | null = null) => {
            let exemptedAmount = 0;

            // 団信適用判定（死亡時のみ、かつ対象者が団信加入者の場合）
            if (!isDisability && targetPerson) {
                if (targetPerson === 'husband' && danshinHolder.includes('husband')) {
                    exemptedAmount = housingLoan;
                } else if (targetPerson === 'wife' && danshinHolder.includes('wife')) {
                    exemptedAmount = housingLoan;
                }
            }

            const ratio = isDisability ? expenseRatioDisability : expenseRatioSurvivor;
            // 住宅ローン分を引いてから、生活費率を掛ける
            const expenseToUse = Math.round(Math.max(0, currentExpense - exemptedAmount) * (ratio / 100));

            if (!annual || annual <= 0) {
                return {
                    pensionMonthly: 0,
                    gapMonthly: expenseToUse,
                    pensionAnnual: 0,
                    targetExpense: expenseToUse,
                    exemptedAmount,
                };
            }
            const pensionMonthly = Math.floor(annual / 12);
            const gapMonthly = Math.max(0, expenseToUse - pensionMonthly);
            return { pensionMonthly, gapMonthly, pensionAnnual: annual, targetExpense: expenseToUse, exemptedAmount };
        };

        // --- 夫死亡時 ---
        let husbandDeathAnnual = 0;
        if (basicInfo.spouseType === 'couple') {
            const eligibleChildren = childrenAges.filter((age) => age < 18).length;
            const kiso = eligibleChildren > 0 ? kisoAnnualByCount(eligibleChildren) : 0;
            const avgStd = basicInfo.avgStdMonthlyHusband || 0;
            const months = basicInfo.monthsHusband || 0;
            const useMinashi = basicInfo.useMinashi300Husband;
            const kosei = proportionAnnual(avgStd, months, useMinashi);
            let chukorei = 0;
            const wifeAge = basicInfo.ageWife || 0;
            if (eligibleChildren === 0 && wifeAge >= 40 && wifeAge < 65) {
                chukorei = CHUKOREI_KASAN;
            }
            husbandDeathAnnual = kiso + kosei + chukorei;
        }

        // --- 妻死亡時 ---
        let wifeDeathAnnual = 0;
        if (basicInfo.spouseType === 'couple') {
            const eligibleChildren = childrenAges.filter((age) => age < 18).length;
            const kiso = eligibleChildren > 0 ? kisoAnnualByCount(eligibleChildren) : 0;
            const avgStd = basicInfo.avgStdMonthlyWife || 0;
            const months = basicInfo.monthsWife || 0;
            const useMinashi = basicInfo.useMinashi300Wife;
            const kosei = proportionAnnual(avgStd, months, useMinashi);
            wifeDeathAnnual = kiso + kosei;
        }

        // --- 本人死亡時 ---
        let singleDeathAnnual = 0;
        if (basicInfo.spouseType === 'none') {
            const avgStd = basicInfo.avgStdMonthly || 0;
            const months = basicInfo.employeePensionMonths || 0;
            const useMinashi = basicInfo.useMinashi300;
            const kosei = proportionAnnual(avgStd, months, useMinashi);
            singleDeathAnnual = kosei;
        }

        // --- 障害年金 ---
        let husbandDisabilityAnnual = 0;
        if (basicInfo.spouseType === 'couple') {
            const level = DISABILITY_LEVEL;
            const basic = calculateDisabilityBasicPension(level, eligibleChildrenForDisability);
            // 配偶者加給年金: 妻が65歳未満なら加算
            const spouseBonus = (basicInfo.ageWife < 65) ? SPOUSE_BONUS : 0;
            const emp = calculateDisabilityEmployeePension(
                level, spouseBonus, 0, basicInfo.avgStdMonthlyHusband || 0, basicInfo.monthsHusband || 0, true
            );
            husbandDisabilityAnnual = basic + emp;
        }

        let wifeDisabilityAnnual = 0;
        if (basicInfo.spouseType === 'couple') {
            const level = DISABILITY_LEVEL;
            const basic = calculateDisabilityBasicPension(level, eligibleChildrenForDisability);
            // 配偶者加給年金: 夫が65歳未満なら加算
            const spouseBonus = (basicInfo.ageHusband < 65) ? SPOUSE_BONUS : 0;
            const emp = calculateDisabilityEmployeePension(
                level, spouseBonus, 0, basicInfo.avgStdMonthlyWife || 0, basicInfo.monthsWife || 0, true
            );
            wifeDisabilityAnnual = basic + emp;
        }

        let singleDisabilityAnnual = 0;
        if (basicInfo.spouseType === 'none') {
            const level = DISABILITY_LEVEL;
            const basic = calculateDisabilityBasicPension(level, eligibleChildrenForDisability);
            const emp = calculateDisabilityEmployeePension(
                level, 0, 0, basicInfo.avgStdMonthly || 0, basicInfo.employeePensionMonths || 0, false
            );
            singleDisabilityAnnual = basic + emp;
        }

        return {
            targetExpense: Math.round(currentExpense * (expenseRatioSurvivor / 100)), // 参考値として残す
            husbandDeath: makeResult(husbandDeathAnnual, false, 'husband'),
            wifeDeath: makeResult(wifeDeathAnnual, false, 'wife'),
            singleDeath: makeResult(singleDeathAnnual, false, 'single'),
            husbandDisability: makeResult(husbandDisabilityAnnual, true, 'husband'),
            wifeDisability: makeResult(wifeDisabilityAnnual, true, 'wife'),
            singleDisability: makeResult(singleDisabilityAnnual, true, 'single'),
        };
    }, [profile, expenseRatioSurvivor, expenseRatioDisability, DISABILITY_LEVEL]);

    if (!profile) {
        return (
            <div className="min-h-screen bg-slate-950 flex items-center justify-center p-6">
                <div className="text-center space-y-4">
                    <div className="w-16 h-16 bg-slate-900 rounded-full flex items-center justify-center mx-auto border border-slate-800">
                        <span className="text-2xl">⚠️</span>
                    </div>
                    <h2 className="text-xl font-bold text-slate-200">プロフィールデータがありません</h2>
                    <p className="text-slate-400">まずは基本情報を設定してください。</p>
                    <Link href="/simulators/customer-profile" className="inline-block px-6 py-2 bg-sky-600 hover:bg-sky-500 text-white rounded-full transition-colors">
                        プロフィール設定へ
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-rose-500/30 pb-20">
            {/* ヘッダー */}
            <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
                <div className="max-w-5xl mx-auto px-6 py-4 flex items-center justify-between">
                    <h1 className="text-xl font-bold flex items-center gap-2">
                        <span className="w-2 h-8 bg-rose-500 rounded-full"></span>
                        必要保障額
                    </h1>
                    <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                        TOPへ戻る
                    </Link>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-10">
                <p className="text-slate-400 mb-10 max-w-4xl leading-relaxed">
                    万が一の際に必要な生活費と、公的年金（遺族年金・障害年金）の差額を可視化します。
                    不足分（ギャップ）が、民間保険などで準備すべき必要保障額となります。
                </p>

                {/* 設定パネル */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-12 backdrop-blur-sm">
                    <div className="flex flex-col items-center justify-center mb-8 pb-8 border-b border-slate-800/50">
                        <div className="text-sm text-slate-400 mb-2">現在の生活費（プロフィール設定）</div>
                        <div className="text-4xl font-bold text-white tracking-tight">
                            {(profile.monthlyLivingExpense / 10000).toFixed(0)}
                            <span className="text-lg font-normal text-slate-500 ml-1">万円/月</span>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-200 flex items-center gap-2">
                                    <span className="text-emerald-400">💀</span> 遺族生活費の目安
                                </h3>
                                <span className="text-2xl font-bold text-emerald-400 font-mono">{expenseRatioSurvivor}%</span>
                            </div>
                            <input
                                type="range"
                                min="50"
                                max="100"
                                step="5"
                                value={expenseRatioSurvivor}
                                onChange={(e) => setExpenseRatioSurvivor(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <p className="text-xs text-slate-500 mt-2">現在の生活費に対する割合（一般的に70%程度と言われています）</p>

                            <div className="mt-6 p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-slate-400">シミュレーション上の生活費</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">現在より <span className="text-emerald-400 font-bold">{((profile.monthlyLivingExpense - Math.round(profile.monthlyLivingExpense * (expenseRatioSurvivor / 100))) / 10000).toFixed(1)}万円</span> 減少</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-emerald-400">
                                        {(Math.round(profile.monthlyLivingExpense * (expenseRatioSurvivor / 100)) / 10000).toFixed(1)}
                                        <span className="text-xs text-emerald-500/70 ml-1">万円</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        <div>
                            <div className="flex items-center justify-between mb-4">
                                <h3 className="font-bold text-slate-200 flex items-center gap-2">
                                    <span className="text-amber-400">🏥</span> 障害生活費の目安
                                </h3>
                                <span className="text-2xl font-bold text-amber-400 font-mono">{expenseRatioDisability}%</span>
                            </div>
                            <input
                                type="range"
                                min="80"
                                max="150"
                                step="5"
                                value={expenseRatioDisability}
                                onChange={(e) => setExpenseRatioDisability(parseInt(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <p className="text-xs text-slate-500 mt-2">現在の生活費に対する割合（治療費や介護費用で増加する可能性があります）</p>

                            <div className="mt-6 p-4 rounded-xl bg-slate-950/50 border border-slate-800 flex items-center justify-between">
                                <div>
                                    <div className="text-xs text-slate-400">シミュレーション上の生活費</div>
                                    <div className="text-[10px] text-slate-500 mt-0.5">現在より <span className="text-amber-400 font-bold">{((Math.round(profile.monthlyLivingExpense * (expenseRatioDisability / 100)) - profile.monthlyLivingExpense) / 10000).toFixed(1)}万円</span> 増加</div>
                                </div>
                                <div className="text-right">
                                    <div className="text-2xl font-bold text-amber-400">
                                        {(Math.round(profile.monthlyLivingExpense * (expenseRatioDisability / 100)) / 10000).toFixed(1)}
                                        <span className="text-xs text-amber-500/70 ml-1">万円</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                {/* 結果表示エリア */}
                {scenarios && (
                    <div className="space-y-12">
                        {/* 夫婦の場合 */}
                        {profile.basicInfo.spouseType === 'couple' && (
                            <div className="grid grid-cols-1 gap-12">
                                {/* 妻の生活を守る */}
                                <ScenarioCard title="妻の生活を守る" className="border-t-4 border-t-emerald-500">
                                    <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800">
                                        <div className="flex flex-col items-center px-2">
                                            <div className="text-sm font-bold text-slate-400 mb-4">夫死亡時</div>
                                            <CupVisualization
                                                expenseMonthly={scenarios.husbandDeath.targetExpense}
                                                pensionMonthly={scenarios.husbandDeath.pensionMonthly}
                                                gapMonthly={scenarios.husbandDeath.gapMonthly}
                                                pensionLabel="遺族年金"
                                                colorTheme="emerald"
                                                exemptedAmount={scenarios.husbandDeath.exemptedAmount}
                                            />
                                        </div>
                                        <div className="flex flex-col items-center px-2">
                                            <div className="text-sm font-bold text-slate-400 mb-4">妻障害時</div>
                                            <CupVisualization
                                                expenseMonthly={scenarios.wifeDisability.targetExpense}
                                                pensionMonthly={scenarios.wifeDisability.pensionMonthly}
                                                gapMonthly={scenarios.wifeDisability.gapMonthly}
                                                pensionLabel="障害年金"
                                                colorTheme="amber"
                                            // 障害時は団信免除なし
                                            />
                                        </div>
                                    </div>
                                </ScenarioCard>

                                {/* 夫の生活を守る */}
                                <ScenarioCard title="夫の生活を守る" className="border-t-4 border-t-sky-500">
                                    <div className="grid grid-cols-2 gap-4 divide-x divide-slate-800">
                                        <div className="flex flex-col items-center px-2">
                                            <div className="text-sm font-bold text-slate-400 mb-4">妻死亡時</div>
                                            <CupVisualization
                                                expenseMonthly={scenarios.wifeDeath.targetExpense}
                                                pensionMonthly={scenarios.wifeDeath.pensionMonthly}
                                                gapMonthly={scenarios.wifeDeath.gapMonthly}
                                                pensionLabel="遺族年金"
                                                colorTheme="emerald"
                                                exemptedAmount={scenarios.wifeDeath.exemptedAmount}
                                            />
                                        </div>
                                        <div className="flex flex-col items-center px-2">
                                            <div className="text-sm font-bold text-slate-400 mb-4">夫障害時</div>
                                            <CupVisualization
                                                expenseMonthly={scenarios.husbandDisability.targetExpense}
                                                pensionMonthly={scenarios.husbandDisability.pensionMonthly}
                                                gapMonthly={scenarios.husbandDisability.gapMonthly}
                                                pensionLabel="障害年金"
                                                colorTheme="amber"
                                            />
                                        </div>
                                    </div>
                                </ScenarioCard>
                            </div>
                        )}

                        {/* 独身の場合 */}
                        {profile.basicInfo.spouseType === 'none' && (
                            <div className="max-w-2xl mx-auto">
                                <ScenarioCard title="本人の生活を守る" className="border-t-4 border-t-sky-500">
                                    <div className="grid grid-cols-2 gap-8 divide-x divide-slate-800">
                                        <div className="flex flex-col items-center px-4">
                                            <div className="text-sm font-bold text-slate-400 mb-4">死亡時</div>
                                            <CupVisualization
                                                expenseMonthly={scenarios.singleDeath.targetExpense}
                                                pensionMonthly={scenarios.singleDeath.pensionMonthly}
                                                gapMonthly={scenarios.singleDeath.gapMonthly}
                                                pensionLabel="遺族年金"
                                                colorTheme="emerald"
                                            />
                                            <p className="text-xs text-slate-500 mt-4 text-center">
                                                ※独身の場合、遺族年金は遺族（父母など）に支給されます。
                                            </p>
                                        </div>
                                        <div className="flex flex-col items-center px-4">
                                            <div className="text-sm font-bold text-slate-400 mb-4">障害時</div>
                                            <CupVisualization
                                                expenseMonthly={scenarios.singleDisability.targetExpense}
                                                pensionMonthly={scenarios.singleDisability.pensionMonthly}
                                                gapMonthly={scenarios.singleDisability.gapMonthly}
                                                pensionLabel="障害年金"
                                                colorTheme="amber"
                                            />
                                        </div>
                                    </div>
                                </ScenarioCard>
                            </div>
                        )}
                    </div>
                )}

                {/* ナビゲーション */}
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
