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
    totalIncome: number; // pension + workIncome
    totalTarget: number; // baseExpense + educationCost
    shortfall: number; // 不足額
};

type ScenarioResult = {
    title: string;
    data: YearlyData[];
    totalShortfall: number; // 総不足額（累積）
    exemptedHousingLoan: number; // 団信による免除額（参考）
    monthlyShortfallMax: number; // 最大月額不足
    hasShortfall: boolean;
};

/* ===================== UI Components ===================== */

// SVGハッチングパターン定義
const SVGPatterns = () => (
    <svg width="0" height="0" className="absolute">
        <defs>
            <pattern id="diagonalHatchRed" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                <path d="M -1,4 H 9" stroke="rgba(244, 63, 94, 0.3)" strokeWidth="2" />
            </pattern>
            <pattern id="diagonalHatchOrange" patternUnits="userSpaceOnUse" width="8" height="8" patternTransform="rotate(45)">
                <path d="M -1,4 H 9" stroke="rgba(249, 115, 22, 0.3)" strokeWidth="2" />
            </pattern>
        </defs>
    </svg>
);

function StackedBlockChart({
    data,
    maxAmount,
    colorTheme = 'emerald',
    height = 300
}: {
    data: YearlyData[];
    maxAmount: number;
    colorTheme?: 'emerald' | 'sky' | 'amber' | 'rose';
    height?: number;
}) {
    const width = 800;
    const padding = { top: 20, right: 50, bottom: 30, left: 50 };
    const graphWidth = width - padding.left - padding.right;
    const graphHeight = height - padding.top - padding.bottom;

    // X軸のスケール計算
    const minAge = data[0]?.age || 0;
    const maxAge = data[data.length - 1]?.age || 100;
    const ageRange = maxAge - minAge;
    const getX = (age: number) => ((age - minAge) / ageRange) * graphWidth;

    // Y軸のスケール計算
    const displayMaxY = Math.max(maxAmount, 5000000); // 最低でも500万円レンジ
    const getY = (amount: number) => graphHeight - (amount / displayMaxY) * graphHeight;

    // パスの生成
    const createAreaPath = (getValue: (d: YearlyData) => number, baselineValue: (d: YearlyData) => number = () => 0) => {
        let path = `M 0,${getY(baselineValue(data[0]))}`;
        data.forEach(d => {
            path += ` L ${getX(d.age)},${getY(getValue(d))}`;
        });
        data.slice().reverse().forEach(d => {
            path += ` L ${getX(d.age)},${getY(baselineValue(d))}`;
        });
        path += ' Z';
        return path;
    };

    // 収入エリア (Layer A: Pension + Work)
    const incomePath = createAreaPath(d => d.totalIncome);
    
    // 年金のみエリア (Workを除いた部分、可視化のために薄く表示など)
    const pensionPath = createAreaPath(d => d.pension);

    // 支出ライン (Layer B & C Top Line)
    const expenseLinePath = (() => {
        let path = `M 0,${getY(data[0].totalTarget)}`;
        data.forEach(d => {
            path += ` L ${getX(d.age)},${getY(d.totalTarget)}`;
        });
        return path;
    })();

    // 収入カラー設定
    const colors = {
        emerald: { fill: '#10b981', stroke: '#059669', bg: 'bg-emerald-900/20' },
        sky: { fill: '#0ea5e9', stroke: '#0284c7', bg: 'bg-sky-900/20' },
        amber: { fill: '#f59e0b', stroke: '#d97706', bg: 'bg-amber-900/20' },
        rose: { fill: '#f43f5e', stroke: '#e11d48', bg: 'bg-rose-900/20' },
    }[colorTheme];

    return (
        <div className={`relative w-full overflow-hidden rounded-xl border border-slate-700 ${colors.bg}`}>
            <SVGPatterns />
            <svg viewBox={`0 0 ${width} ${height}`} className="w-full h-auto">
                <g transform={`translate(${padding.left},${padding.top})`}>
                    {/* グリッド線 (Y軸) */}
                    {[0, 0.25, 0.5, 0.75, 1].map(tick => {
                        const y = graphHeight * (1 - tick);
                        const val = displayMaxY * tick;
                        return (
                            <g key={tick}>
                                <line x1="0" y1={y} x2={graphWidth} y2={y} stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
                                <text x="-10" y={y + 4} textAnchor="end" fontSize="10" fill="#94a3b8">
                                    {(val / 10000).toFixed(0)}万
                                </text>
                            </g>
                        );
                    })}

                    {/* グリッド線 (X軸 - 10年ごと) */}
                    {Array.from({ length: Math.ceil(ageRange / 10) + 1 }).map((_, i) => {
                        const age = minAge + i * 10;
                        if (age > maxAge) return null;
                        const x = getX(age);
                        return (
                            <g key={age}>
                                <line x1={x} y1={0} x2={x} y2={graphHeight} stroke="#334155" strokeDasharray="4 4" strokeWidth="1" />
                                <text x={x} y={graphHeight + 15} textAnchor="middle" fontSize="10" fill="#94a3b8">
                                    {age}歳
                                </text>
                            </g>
                        );
                    })}

                    {/* Layer C: 教育費エリア (Total Target) - 最背面 */}
                    {/* 全体を「教育費不足」カラー(濃い赤/ハッチング)で描画 */}
                    <path d={createAreaPath(d => d.totalTarget)} fill="url(#diagonalHatchRed)" opacity="0.8" />

                    {/* Layer B: 生活費エリア (Base Expense) */}
                    {/* 生活費エリアを「生活費不足」カラー(少し薄い赤/オレンジ)で上書き */}
                    <path d={createAreaPath(d => d.baseExpense)} fill="url(#diagonalHatchOrange)" opacity="0.6" />

                    {/* Layer A: 収入エリア (Total Income) */}
                    {/* 収入エリアを緑で上書き。これにより、収入でカバーできている部分は緑になる */}
                    <path d={incomePath} fill={colors.fill} stroke={colors.stroke} strokeWidth="2" fillOpacity="0.9" />
                    
                    {/* 年金部分の境界線（オプション: 就労収入との内訳を示す） */}
                    <path d={pensionPath} fill="none" stroke="white" strokeWidth="1" strokeDasharray="4 4" opacity="0.5" />

                    {/* 支出ライン (強調) */}
                    <path d={expenseLinePath} fill="none" stroke="#f43f5e" strokeWidth="2" strokeLinecap="round" />
                    <path d={createAreaPath(d => d.baseExpense)} fill="none" stroke="#f97316" strokeWidth="1" strokeDasharray="2 2" opacity="0.7" />

                    {/* ラベル */}
                    <text x={10} y={getY(data[0].totalIncome) - 10} fill={colors.fill} fontSize="12" fontWeight="bold">収入（年金+就労）</text>
                    <text x={graphWidth - 10} y={getY(data[data.length-1].totalTarget) - 10} textAnchor="end" fill="#f43f5e" fontSize="12" fontWeight="bold">必要生活費+教育費</text>
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
    const [expenseRatioDisability, setExpenseRatioDisability] = useState(120); // 医療・介護を考慮した一般的な増加率（約120%）
    // 就労収入調整率（リスク調整）
    const [workIncomeRatio, setWorkIncomeRatio] = useState(90); // デフォルト90%（共働きで就労継続を想定）
    
    const [scenarios, setScenarios] = useState<{
        husbandDeath: ScenarioResult;
        wifeDeath: ScenarioResult;
        husbandDisability: ScenarioResult;
        wifeDisability: ScenarioResult;
        singleDeath: ScenarioResult;
        singleDisability: ScenarioResult;
    } | null>(null);

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

    // 時系列計算ロジック
    useEffect(() => {
        if (!profile) return;

        const { basicInfo } = profile;
        const currentExpenseMonthly = profile.monthlyLivingExpense || 0;
        const currentExpenseAnnual = currentExpenseMonthly * 12;

        // 教育費の簡易推定 (年齢別月額)
        const getEducationCost = (age: number): number => {
            if (age < 6) return 15000 * 12;
            if (age < 12) return 20000 * 12;
            if (age < 15) return 30000 * 12;
            if (age < 18) return 40000 * 12;
            if (age < 22) return 80000 * 12;
            return 0;
        };

        const calculateScenario = (
            type: 'survivor' | 'disability',
            targetPerson: 'husband' | 'wife' | 'single'
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

            for (let i = 0; i <= years; i++) {
                const currentAge = startAge + i;
                const spouseAge = spouseStartAge > 0 ? spouseStartAge + i : 0;
                
                let pension = 0;

                const childrenCurrentAges = basicInfo.childrenAges.map(age => age + i);
                const eligibleChildren18 = childrenCurrentAges.filter(age => age < 18).length;
                const eligibleChildrenDisability = calculateEligibleChildrenCount(childrenCurrentAges, 2);

                if (type === 'survivor') {
                    if (basicInfo.spouseType === 'couple') {
                        if (targetPerson === 'husband') {
                            let kiso = 0;
                            if (eligibleChildren18 > 0) {
                                kiso = kisoAnnualByCount(eligibleChildren18);
                            }
                            const kousei = proportionAnnual(basicInfo.avgStdMonthlyHusband, basicInfo.monthsHusband, basicInfo.useMinashi300Husband) * 0.75;
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
                            const kousei = proportionAnnual(basicInfo.avgStdMonthlyWife, basicInfo.monthsWife, basicInfo.useMinashi300Wife) * 0.75;
                            pension = kiso + kousei;
                        }
                    } else {
                         const kousei = proportionAnnual(basicInfo.avgStdMonthly, basicInfo.employeePensionMonths, basicInfo.useMinashi300) * 0.75;
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
                const baseExpense = Math.round(currentExpenseAnnual * (expenseRatio / 100));
                
                let educationCost = 0;
                if (basicInfo.childrenAges.length > 0) {
                    educationCost = childrenCurrentAges.reduce((sum, age) => sum + getEducationCost(age), 0);
                }

                const totalIncome = pension + workIncome;
                const totalTarget = baseExpense + educationCost;
                const shortfall = Math.max(0, totalTarget - totalIncome);

                totalShortfall += shortfall;
                monthlyShortfallMax = Math.max(monthlyShortfallMax, shortfall / 12);

                data.push({
                    age: currentAge,
                    year: i,
                    pension,
                    workIncome,
                    baseExpense,
                    educationCost,
                    totalIncome,
                    totalTarget,
                    shortfall
                });
            }

            return {
                title: type === 'survivor' ? 
                    (targetPerson === 'husband' ? '夫死亡時の収支' : (targetPerson === 'wife' ? '妻死亡時の収支' : '本人死亡時の収支')) :
                    (targetPerson === 'husband' ? '夫障害時の収支' : (targetPerson === 'wife' ? '妻障害時の収支' : '本人障害時の収支')),
                data,
                totalShortfall,
                exemptedHousingLoan: 0,
                monthlyShortfallMax,
                hasShortfall: totalShortfall > 10000
            };
        };

        setScenarios({
            husbandDeath: calculateScenario('survivor', 'husband'),
            wifeDeath: calculateScenario('survivor', 'wife'),
            husbandDisability: calculateScenario('disability', 'husband'),
            wifeDisability: calculateScenario('disability', 'wife'),
            singleDeath: calculateScenario('survivor', 'single'),
            singleDisability: calculateScenario('disability', 'single'),
        });

    }, [profile, expenseRatioSurvivor, expenseRatioDisability, workIncomeRatio]);

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
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">遺族生活費率: <span className="text-emerald-400 font-bold">{expenseRatioSurvivor}%</span></label>
                            <input
                                type="range" min="50" max="100" step="5"
                                value={expenseRatioSurvivor}
                                onChange={(e) => setExpenseRatioSurvivor(Number(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-emerald-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">一般的には60〜80%で設定されることが多く、共働き世帯の平均は約70%です。</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">障害生活費率: <span className="text-amber-400 font-bold">{expenseRatioDisability}%</span></label>
                            <input
                                type="range" min="80" max="150" step="5"
                                value={expenseRatioDisability}
                                onChange={(e) => setExpenseRatioDisability(Number(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-amber-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">治療・介護費を含めると110〜130%程度が一般値で、介護が長期化するケースではさらに上振れします。</p>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-slate-400 mb-2">遺族/配偶者の就労率: <span className="text-sky-400 font-bold">{workIncomeRatio}%</span></label>
                            <input
                                type="range" min="0" max="100" step="10"
                                value={workIncomeRatio}
                                onChange={(e) => setWorkIncomeRatio(Number(e.target.value))}
                                className="w-full h-2 bg-slate-800 rounded-lg appearance-none cursor-pointer accent-sky-500"
                            />
                            <p className="text-xs text-slate-500 mt-1">共働き世帯では40〜60%が現実的なラインとされ、デフォルトの50%は育児・介護を踏まえた平均値です。</p>
                        </div>
                    </div>
                </div>

                {scenarios && (
                    <div className="space-y-16">
                        {profile.basicInfo.spouseType === 'couple' ? (
                            <>
                                <ScenarioSection
                                    result={scenarios.husbandDeath}
                                    color="emerald"
                                    icon="💀"
                                    description="夫が死亡した場合、残された妻と子の生活費不足額"
                                />
                                <ScenarioSection
                                    result={scenarios.husbandDisability}
                                    color="amber"
                                    icon="🏥"
                                    description="夫が障害状態になった場合、収入減と支出増による不足額"
                                />
                                <ScenarioSection
                                    result={scenarios.wifeDeath}
                                    color="emerald"
                                    icon="💀"
                                    description="妻が死亡した場合、残された夫と子の生活費不足額"
                                />
                                <ScenarioSection
                                    result={scenarios.wifeDisability}
                                    color="amber"
                                    icon="🏥"
                                    description="妻が障害状態になった場合、家事代行費等の支出増も考慮が必要"
                                />
                            </>
                        ) : (
                            <>
                                <ScenarioSection
                                    result={scenarios.singleDeath}
                                    color="emerald"
                                    icon="💀"
                                    description="死亡時の整理資金や、親族への遺族年金"
                                />
                                <ScenarioSection
                                    result={scenarios.singleDisability}
                                    color="amber"
                                    icon="🏥"
                                    description="障害状態での就労不能リスクと生活費不足"
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

function ScenarioSection({ result, color, icon, description }: { result: ScenarioResult; color: 'emerald' | 'sky' | 'amber' | 'rose'; icon: string; description: string }) {
    const maxAmount = Math.max(
        ...result.data.map(d => Math.max(d.totalIncome, d.totalTarget))
    );

    const shortfallText = (result.totalShortfall / 10000).toFixed(0);

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
                    <div className="text-xs text-slate-400 mb-1">生涯の必要保障額目安</div>
                    <div className={`text-3xl font-bold ${result.hasShortfall ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {result.hasShortfall ? `${shortfallText}万円` : '不足なし'}
                    </div>
                    {result.hasShortfall && (
                        <div className="text-xs text-rose-400/70 mt-1">
                            月あたり最大不足: {(result.monthlyShortfallMax / 10000).toFixed(1)}万円
                        </div>
                    )}
                </div>
            </div>

            <div className="mb-6">
                <div className="flex items-center gap-6 mb-2 text-xs font-medium justify-end px-4">
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-rose-500/50 border border-rose-500 relative overflow-hidden">
                            <svg viewBox="0 0 10 10" className="absolute inset-0 w-full h-full"><path d="M-2,12 L12,-2" stroke="white" strokeWidth="2" opacity="0.5" /></svg>
                        </span>
                        <span className="text-rose-400">教育費不足</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className="w-3 h-3 rounded-full bg-orange-500/50 border border-orange-500 relative overflow-hidden">
                             <svg viewBox="0 0 10 10" className="absolute inset-0 w-full h-full"><path d="M-2,12 L12,-2" stroke="white" strokeWidth="2" opacity="0.5" /></svg>
                        </span>
                        <span className="text-orange-400">生活費不足</span>
                    </div>
                    <div className="flex items-center gap-1.5">
                        <span className={`w-3 h-3 rounded-full bg-${color}-500`}></span>
                        <span className={`text-${color}-400`}>公的年金 + 就労収入</span>
                    </div>
                </div>
                <StackedBlockChart
                    data={result.data}
                    maxAmount={maxAmount}
                    colorTheme={color}
                    height={300}
                />
            </div>
        </section>
    );
}
