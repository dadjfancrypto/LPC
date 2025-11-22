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
};

/* ===================== UI Components ===================== */

function CupVisualization({ expenseMonthly, pensionMonthly, gapMonthly, pensionLabel = '公的年金', colorTheme = 'sky' }: { expenseMonthly: number; pensionMonthly: number; gapMonthly: number; pensionLabel?: string; colorTheme?: 'sky' | 'emerald' | 'rose' | 'amber' | 'slate'; }) {
    const totalHeight = 240;
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
            {/* メインのコップエリア */}
            <div className="relative" style={{ width: 180, height: totalHeight }}>
                {/* 必要生活費ライン（左側） */}
                <div
                    className="absolute left-0 top-0 bottom-0 w-full pointer-events-none"
                    style={{ height: expenseHeight, top: totalHeight - expenseHeight }}
                >
                    <div className="absolute -left-2 top-0 w-full border-t border-dashed border-slate-500/50 flex items-center">
                        <div className="absolute right-full mr-2 flex flex-col items-end">
                            <span className="text-[10px] text-slate-400 whitespace-nowrap">必要生活費</span>
                            <span className="text-sm font-bold text-slate-200 whitespace-nowrap">
                                {(expenseMonthly / 10000).toFixed(1)}<span className="text-[10px] font-normal">万円</span>
                            </span>
                        </div>
                    </div>
                </div>

                {/* コップ本体 */}
                <div
                    className={`absolute bottom-0 left-1/2 -translate-x-1/2 w-32 rounded-b-3xl border-b-4 border-l-2 border-r-2 ${colors.border} ${colors.bg} backdrop-blur-sm overflow-hidden transition-all duration-500`}
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
                                <div className="text-[10px] opacity-90 mb-0.5">{pensionLabel}</div>
                                <div className="text-lg leading-none">{(pensionMonthly / 10000).toFixed(1)}<span className="text-xs font-normal">万円</span></div>
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
                                <div className="text-[10px] opacity-80">不足</div>
                                <div className="text-xl leading-none">{(gapMonthly / 10000).toFixed(1)}<span className="text-xs font-normal">万円</span></div>
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
        const targetExpenseSurvivor = Math.round(currentExpense * (expenseRatioSurvivor / 100));
        const targetExpenseDisability = Math.round(currentExpense * (expenseRatioDisability / 100));

        const childrenAges = basicInfo.childrenAges ?? [];
        const eligibleChildrenForDisability = calculateEligibleChildrenCount(
            childrenAges.map((a) => (a == null ? null : a)),
            DISABILITY_LEVEL,
        );

        const makeResult = (annual: number | null, isDisability: boolean = false) => {
            const expenseToUse = isDisability ? targetExpenseDisability : targetExpenseSurvivor;

            if (!annual || annual <= 0) {
                return {
                    pensionMonthly: 0,
                    gapMonthly: expenseToUse,
                    pensionAnnual: 0,
                    targetExpense: expenseToUse,
                };
            }
            const pensionMonthly = Math.floor(annual / 12);
            const gapMonthly = Math.max(0, expenseToUse - pensionMonthly);
            return { pensionMonthly, gapMonthly, pensionAnnual: annual, targetExpense: expenseToUse };
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
            const emp = calculateDisabilityEmployeePension(
                level, 0, 0, basicInfo.avgStdMonthlyHusband || 0, basicInfo.monthsHusband || 0, true
            );
            husbandDisabilityAnnual = basic + emp;
        }

        let wifeDisabilityAnnual = 0;
        if (basicInfo.spouseType === 'couple') {
            const level = DISABILITY_LEVEL;
            const basic = calculateDisabilityBasicPension(level, eligibleChildrenForDisability);
            const emp = calculateDisabilityEmployeePension(
                level, 0, 0, basicInfo.avgStdMonthlyWife || 0, basicInfo.monthsWife || 0, true
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
            targetExpense: targetExpenseSurvivor,
            husbandDeath: makeResult(husbandDeathAnnual, false),
            wifeDeath: makeResult(wifeDeathAnnual, false),
            singleDeath: makeResult(singleDeathAnnual, false),
            husbandDisability: makeResult(husbandDisabilityAnnual, true),
            wifeDisability: makeResult(wifeDisabilityAnnual, true),
            singleDisability: makeResult(singleDisabilityAnnual, true),
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
                        必要保障額シミュレーター
                    </h1>
                    <Link href="/" className="text-sm text-slate-400 hover:text-white transition-colors">
                        TOPへ戻る
                    </Link>
                </div>
            </div>

            <div className="max-w-5xl mx-auto px-6 py-10">
                <p className="text-slate-400 mb-10 max-w-2xl">
                    万が一の際に必要な生活費と、公的年金（遺族年金・障害年金）の差額を可視化します。
                    不足分（ギャップ）が、民間保険などで準備すべき必要保障額となります。
                </p>

                {/* 設定パネル */}
                <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 mb-12 backdrop-blur-sm">
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
                        </div>
                    </div>
                </div>

                {/* 結果表示エリア */}
                {scenarios && (
                    <div className="space-y-12">
                        {/* 夫婦の場合 */}
                        {profile.basicInfo.spouseType === 'couple' && (
                            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
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
