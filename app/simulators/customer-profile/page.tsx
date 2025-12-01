'use client';

import React, { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import {
  EducationCourse,
  EDUCATION_COURSE_LABELS,
  calculateHouseholdEducationCost,
  CramSchoolOptions
} from '@/app/utils/education-costs';

// Customer Profileの型定義
type LivingExpenseDetail = {
  food: number; // 食費
  communication: number; // 通信費
  utilities: number; // 水道光熱費
  education: number; // 教育費
  housingLoan: number; // 住宅ローン
  rent: number; // 家賃
  dailyGoods: number; // 日用品
  entertainment: number; // 娯楽費
  lifeInsurance: number; // 生命保険料
  savings: number; // 貯蓄
};

type CustomerProfileBasicInfo = {
  // 子の情報
  childrenCount: number | undefined; // 子の人数（undefinedは「--」として表示）
  childrenAges: number[]; // 子の年齢（各子）

  // 本人の種類
  spouseType?: 'couple' | 'none'; // 種類（夫婦/独身、undefinedは「--」として表示）

  // 妻の情報（遺族年金シミュレーター用）
  ageWife: number; // 妻の年齢
  oldAgeStartWife: number; // 妻の老齢開始年齢（デフォルト65歳）
  annualIncomeWife?: number; // 妻の昨年の年収（額面）
  avgStdMonthlyWife: number; // 妻の平均標準報酬月額
  monthsWife: number; // 妻の加入月数（0、1〜299、300以上）
  useMinashi300Wife: boolean; // 妻のみなし300月チェックボックス

  // 夫の情報（遺族年金シミュレーター用）
  ageHusband: number; // 夫の年齢
  oldAgeStartHusband: number; // 夫の老齢開始年齢（デフォルト65歳）
  annualIncomeHusband?: number; // 夫の昨年の年収（額面）
  avgStdMonthlyHusband: number; // 夫の平均標準報酬月額
  monthsHusband: number; // 夫の加入月数（0、1〜299、300以上）
  useMinashi300Husband: boolean; // 夫のみなし300月チェックボックス

  // 本人の情報（独身の場合用）
  age: number; // 本人の年齢
  oldAgeStart: number; // 老齢開始年齢（デフォルト65歳）
  hasEmployeePension: boolean; // 厚生年金に加入していた
  employeePensionMonths: number; // 加入月数（0、1〜299、300以上）
  annualIncome?: number; // 本人の昨年の年収（額面）
  avgStdMonthly: number; // 平均標準報酬月額（2003年4月以降の値として扱う）
  useMinashi300: boolean; // 本人のみなし300月チェックボックス

  // 教育費コース
  educationCourse: EducationCourse;
  cramSchoolOptions: CramSchoolOptions;
};

type CustomerProfile = {
  monthlyLivingExpense: number; // 生活費（月額）
  details: LivingExpenseDetail;
  basicInfo: CustomerProfileBasicInfo; // 基本情報
  danshinHolder: ('husband' | 'wife')[]; // 団信加入者（デフォルトは['husband']）
  isLivingExpenseDetailed: boolean; // 生活費の内訳入力モードかどうか
};

type SavedPlan = {
  name: string;
  profile: CustomerProfile;
  savedAt: string;
};

type SavedPlans = {
  [key: string]: SavedPlan;
};

const STORAGE_KEY = 'customer-profile';
const STORAGE_KEY_BASIC = 'customer-profile-basic';
const STORAGE_KEY_PLANS = 'customer-profile-plans';
const STORAGE_KEY_CURRENT_PLAN = 'customer-profile-current-plan';

// 1万円単位の選択肢（10万円から100万円まで）
const TEN_THOUSAND_OPTIONS = Array.from({ length: 91 }, (_, i) => (i + 10) * 10_000);

// +1,000円〜+9,000円の調整選択肢
const ADJUSTMENT_OPTIONS = Array.from({ length: 9 }, (_, i) => (i + 1) * 1_000);

// 年収選択（50万円刻み、0〜1億円想定）
const ANNUAL_INCOME_OPTIONS = Array.from({ length: 201 }, (_, i) => i * 500_000);

// 費目のラベル定義
const EXPENSE_LABELS: Record<keyof LivingExpenseDetail, string> = {
  food: '食費',
  dailyGoods: '日用品',
  utilities: '水道光熱費',
  communication: '通信費',
  rent: '家賃・地代',
  housingLoan: '住宅ローン',
  education: '教育費',
  lifeInsurance: '保険料',
  entertainment: '娯楽・交際費',
  savings: '貯蓄・予備費',
};

// 世帯人数別平均目安（仮・総務省統計などを参考にした概算）
const AVERAGE_EXPENSES_BY_SIZE: Record<number, Record<keyof LivingExpenseDetail, number>> = {
  1: { // 単身
    food: 40000,
    dailyGoods: 8000,
    utilities: 12000,
    communication: 8000,
    rent: 70000,
    housingLoan: 0,
    education: 0,
    lifeInsurance: 10000,
    entertainment: 20000,
    savings: 30000,
  },
  2: { // 2人
    food: 65000,
    dailyGoods: 12000,
    utilities: 20000,
    communication: 15000,
    rent: 90000,
    housingLoan: 0,
    education: 0,
    lifeInsurance: 20000,
    entertainment: 30000,
    savings: 50000,
  },
  3: { // 3人
    food: 75000,
    dailyGoods: 15000,
    utilities: 25000,
    communication: 18000,
    rent: 100000,
    housingLoan: 0,
    education: 20000,
    lifeInsurance: 25000,
    entertainment: 35000,
    savings: 40000,
  },
  4: { // 4人以上
    food: 85000,
    dailyGoods: 18000,
    utilities: 30000,
    communication: 20000,
    rent: 120000,
    housingLoan: 0,
    education: 40000,
    lifeInsurance: 30000,
    entertainment: 40000,
    savings: 30000,
  }
};

// 生活費選択コンポーネント
function LivingExpenseSelector({
  value,
  setValue,
  details,
  setDetails,
  basicInfo,
  danshinHolder,
  setDanshinHolder,
  isDetailed,
  setIsDetailed,
}: {
  value: number;
  setValue: (v: number) => void;
  details: LivingExpenseDetail;
  setDetails: (d: LivingExpenseDetail) => void;
  basicInfo: CustomerProfileBasicInfo;
  danshinHolder: ('husband' | 'wife')[];
  setDanshinHolder: (h: ('husband' | 'wife')[]) => void;
  isDetailed: boolean;
  setIsDetailed: (b: boolean) => void;
}) {
  const [isAddition, setIsAddition] = useState(true);

  // 合計を計算する関数
  const calculateTotal = (currentDetails: LivingExpenseDetail) => {
    return Object.values(currentDetails).reduce((a, b) => a + b, 0);
  };



  // 世帯人数を計算
  const householdSize = useMemo(() => {
    let count = 1; // 本人
    if (basicInfo.spouseType === 'couple') count += 1; // 配偶者
    if (basicInfo.childrenCount) count += basicInfo.childrenCount; // 子供
    return count;
  }, [basicInfo.spouseType, basicInfo.childrenCount]);

  // 適用する平均値データを取得（4人以上は4人のデータを使用）
  const averageExpenses = AVERAGE_EXPENSES_BY_SIZE[Math.min(Math.max(householdSize, 1), 4)] || AVERAGE_EXPENSES_BY_SIZE[1];

  // 詳細項目の変更ハンドラ
  const handleDetailChange = (key: keyof LivingExpenseDetail, val: number) => {
    const newDetails = { ...details, [key]: val };
    setDetails(newDetails);
  };

  // モード切替時のハンドラ
  const handleModeChange = (detailed: boolean) => {
    setIsDetailed(detailed);
    if (detailed) {
      setValue(calculateTotal(details));
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <label className="block text-sm font-semibold text-slate-300 mb-2">生活費（月額）</label>

        {!isDetailed ? (
          <div className="relative">
            <select
              className="w-full appearance-none rounded-xl px-4 py-3 bg-slate-800/50 border border-slate-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-slate-100 font-mono text-lg"
              value={value || 0}
              onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
            >
              <option value={0}>-- 選択してください --</option>
              {TEN_THOUSAND_OPTIONS.map((v) => (
                <option key={v} value={v}>
                  {v.toLocaleString('ja-JP')}円
                </option>
              ))}
            </select>
            <div className="absolute inset-y-0 right-0 flex items-center px-4 pointer-events-none text-slate-400">
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        ) : (
          <div className="w-full rounded-xl px-4 py-3 bg-slate-800/50 border border-slate-700 text-slate-100 font-mono text-lg flex justify-between items-center">
            <span>合計</span>
            <span className="font-bold text-emerald-400">{value.toLocaleString('ja-JP')}円</span>
          </div>
        )}
      </div>

      {/* 詳細入力モード切替 */}
      <div className="flex items-center justify-between">
        <label className="flex items-center gap-3 cursor-pointer group">
          <div className={`w-5 h-5 rounded border flex items-center justify-center transition-colors ${isDetailed ? 'bg-sky-500 border-sky-500' : 'bg-slate-800 border-slate-600 group-hover:border-sky-500'}`}>
            {isDetailed && <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="3" d="M5 13l4 4L19 7"></path></svg>}
          </div>
          <input
            type="checkbox"
            className="hidden"
            checked={isDetailed}
            onChange={(e) => handleModeChange(e.target.checked)}
          />
          <span className="text-sm text-slate-300 group-hover:text-white transition-colors">内訳を詳細に入力する</span>
        </label>

        {/* 加算・減算切替 (詳細モード時のみ) */}
        {isDetailed && (
          <div className="flex bg-slate-800 rounded-lg p-1 gap-1">
            <button
              onClick={() => setIsAddition(true)}
              className={`px-3 py-1 text-xs rounded-md transition-all font-medium flex items-center gap-1 ${isAddition ? 'bg-emerald-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <span>＋</span> 加算
            </button>
            <button
              onClick={() => setIsAddition(false)}
              className={`px-3 py-1 text-xs rounded-md transition-all font-medium flex items-center gap-1 ${!isAddition ? 'bg-rose-600 text-white shadow-lg' : 'text-slate-400 hover:text-slate-200'}`}
            >
              <span>－</span> 減算
            </button>
          </div>
        )}
      </div>

      {/* 詳細入力フォーム */}
      {isDetailed && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-slate-800/50 animate-fade-in-up">
          {(Object.keys(EXPENSE_LABELS) as Array<keyof LivingExpenseDetail>).map((key) => (
            <div key={key} className="space-y-2">
              <label className="text-xs font-bold text-slate-400">{EXPENSE_LABELS[key]}</label>
              <div className="relative">
                <input
                  type="number"
                  className="w-full rounded-lg px-3 py-2 bg-slate-800/30 border border-slate-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-slate-100 text-right pr-8"
                  value={details[key] || 0}
                  onChange={(e) => handleDetailChange(key, parseInt(e.target.value) || 0)}
                  step={1000}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">円</span>
              </div>
              {key === 'education' && (
                <div className="space-y-0.5">
                  <p className="text-[10px] text-slate-500">※塾・習い事費用を含む</p>
                  <p className="text-[10px] text-slate-500">※月額目安: 小1.5〜3万 / 中2.5〜3万 / 高3.5〜4万</p>
                </div>
              )}

              {/* 団信選択UI (住宅ローンの場合のみ表示) */}
              {key === 'housingLoan' && (
                <div className="flex items-center gap-2 justify-end mt-2 animate-fade-in">
                  <span className="text-[10px] text-slate-400 font-bold">団信加入者:</span>
                  <div className="flex bg-slate-800 rounded-md p-0.5 border border-slate-700">
                    {(['husband', 'wife'] as const).map((holder) => {
                      const isSelected = danshinHolder.includes(holder);
                      return (
                        <button
                          key={holder}
                          onClick={() => {
                            if (isSelected) {
                              setDanshinHolder(danshinHolder.filter((h) => h !== holder));
                            } else {
                              setDanshinHolder([...danshinHolder, holder]);
                            }
                          }}
                          className={`px-3 py-1 text-[10px] rounded-sm transition-all ${isSelected
                            ? 'bg-emerald-600 text-white shadow-sm font-bold'
                            : 'text-slate-400 hover:text-slate-200 hover:bg-slate-700'
                            }`}
                        >
                          {holder === 'husband' ? '夫' : '妻'}
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* 教育費の再計算ボタン */}
              {key === 'education' && basicInfo.childrenCount !== undefined && basicInfo.childrenCount > 0 && (
                <div className="flex flex-col gap-2 mt-2 p-3 bg-slate-800/30 rounded-lg border border-slate-700/50">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-slate-400">コース: {EDUCATION_COURSE_LABELS[basicInfo.educationCourse]}</span>
                  </div>
                  <button
                    onClick={() => {
                      const cost = calculateHouseholdEducationCost(
                        basicInfo.educationCourse,
                        basicInfo.childrenAges,
                        basicInfo.cramSchoolOptions
                      );
                      handleDetailChange('education', cost);
                    }}
                    className="text-[10px] text-sky-400 hover:text-sky-300 flex items-center gap-1 transition-colors"
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.428 15.428a2 2 0 00-1.022-.547l-2.384-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" />
                    </svg>
                    <span>{EDUCATION_COURSE_LABELS[basicInfo.educationCourse]}で再計算</span>
                  </button>
                </div>
              )}

              {/* 加減算ボタン */}
              <div className="flex justify-end gap-2">
                {[10000, 5000, 1000].map((amount) => (
                  <button
                    key={amount}
                    onClick={() => handleDetailChange(key, (details[key] || 0) + (isAddition ? amount : -amount))}
                    className={`px-2 py-1 rounded border text-[10px] transition-all font-medium ${isAddition
                      ? 'bg-slate-800 border-slate-700 text-slate-400 hover:text-emerald-400 hover:border-emerald-500/50 hover:bg-emerald-500/10'
                      : 'bg-slate-800 border-slate-700 text-slate-400 hover:text-rose-400 hover:border-rose-500/50 hover:bg-rose-500/10'
                      }`}
                  >
                    {isAddition ? '+' : '-'}{amount.toLocaleString()}
                  </button>
                ))}
              </div>

              {/* 世帯平均目安 */}
              <div
                onClick={() => handleDetailChange(key, averageExpenses[key])}
                className="flex items-center gap-1 text-xs text-slate-500 hover:text-sky-400 transition-colors cursor-pointer w-fit ml-auto"
              >
                <span className="underline decoration-dotted decoration-slate-600 hover:decoration-sky-400">
                  平均目安({householdSize}人): {averageExpenses[key].toLocaleString()}円
                </span>
                <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// 基本情報入力コンポーネント
function BasicInfoInput({
  basicInfo,
  setBasicInfo,
}: {
  basicInfo: CustomerProfileBasicInfo;
  setBasicInfo: (info: CustomerProfileBasicInfo) => void;
}) {
  const getAnnualManValue = (annual?: number, avgMonthly?: number) => {
    if (annual && annual > 0) return Math.round(annual / 10000);
    if (avgMonthly && avgMonthly > 0) return Math.round((avgMonthly * 12) / 10000);
    return '';
  };

  const renderAnnualIncomeOptions = () =>
    ANNUAL_INCOME_OPTIONS.map((value) => (
      <option key={value} value={value / 10000}>
        {(value / 10000).toFixed(0)}万円
      </option>
    ));

  // 子の人数が変更されたときに年齢配列を更新
  useEffect(() => {
    if (basicInfo.childrenCount === undefined || basicInfo.childrenCount === 0) {
      if (basicInfo.childrenAges.length > 0) {
        setBasicInfo({
          ...basicInfo,
          childrenAges: [],
        });
      }
      return;
    }

    const currentCount = basicInfo.childrenAges.length;
    const targetCount = basicInfo.childrenCount;

    if (currentCount !== targetCount) {
      const newAges = [...basicInfo.childrenAges];
      if (currentCount < targetCount) {
        // 足りない分を追加
        for (let i = currentCount; i < targetCount; i++) {
          newAges.push(0);
        }
      } else {
        // 多い分を削除
        newAges.splice(targetCount);
      }
      setBasicInfo({
        ...basicInfo,
        childrenAges: newAges,
      });
    }
  }, [basicInfo.childrenCount, basicInfo.childrenAges, setBasicInfo, basicInfo]);

  const InputGroup = ({ label, children }: { label: React.ReactNode, children: React.ReactNode }) => (
    <div className="space-y-2">
      <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider">{label}</label>
      {children}
    </div>
  );

  const Select = ({ value, onChange, options, placeholder = "--" }: any) => (
    <div className="relative">
      <select
        className="w-full appearance-none rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-slate-100"
        value={value}
        onChange={onChange}
      >
        <option value="">{placeholder}</option>
        {options}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center px-3 pointer-events-none text-slate-400">
        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
      </div>
    </div>
  );

  return (
    <div className="space-y-8">
      {/* 家族構成 */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <InputGroup label="世帯タイプ">
          <Select
            value={basicInfo.spouseType || ''}
            onChange={(e: any) =>
              setBasicInfo({
                ...basicInfo,
                spouseType: e.target.value === '' ? undefined : (e.target.value as 'couple' | 'none'),
              })
            }
            options={
              <>
                <option value="couple">夫婦</option>
                <option value="none">独身</option>
              </>
            }
          />
        </InputGroup>

        <InputGroup label="子の人数">
          <Select
            value={basicInfo.childrenCount === undefined ? '' : basicInfo.childrenCount}
            onChange={(e: any) =>
              setBasicInfo({
                ...basicInfo,
                childrenCount: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
              })
            }
            options={Array.from({ length: 6 }, (_, i) => (
              <option key={i} value={i}>{i}人</option>
            ))}
          />
        </InputGroup>
      </div>

      {/* 子の年齢 */}
      {basicInfo.childrenCount !== undefined && basicInfo.childrenCount > 0 && (
        <div className="bg-slate-800/30 rounded-xl p-4 border border-slate-700/50">
          <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-4">子の年齢</label>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: basicInfo.childrenCount }, (_, i) => (
              <div key={i}>
                <label className="block text-xs text-slate-500 mb-1">{i + 1}人目</label>
                <Select
                  value={basicInfo.childrenAges[i] || 0}
                  onChange={(e: any) => {
                    const newAges = [...basicInfo.childrenAges];
                    const val = parseInt(e.target.value, 10);
                    newAges[i] = val;
                    setBasicInfo({ ...basicInfo, childrenAges: newAges });
                  }}
                  options={Array.from({ length: 19 }, (_, j) => (
                    <option key={j} value={j}>{j}歳</option>
                  ))}
                />
              </div>
            ))}
          </div>

          {/* 教育費コース設定 */}
          <div className="mt-6 pt-4 border-t border-slate-700/50">
            <label className="block text-xs font-bold text-slate-400 uppercase tracking-wider mb-2">教育費コース</label>
            <Select
              value={basicInfo.educationCourse}
              onChange={(e: any) => setBasicInfo({ ...basicInfo, educationCourse: e.target.value as EducationCourse })}
              options={Object.entries(EDUCATION_COURSE_LABELS).map(([key, label]) => (
                <option key={key} value={key}>{label}</option>
              ))}
            />
          </div>
        </div>
      )}

      {/* 妻と夫の情報（横並び） - 夫婦の場合のみ表示 */}
      {basicInfo.spouseType === 'couple' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 pt-4 border-t border-slate-800">
          {/* 妻の情報 */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-rose-400 font-bold border-b border-rose-500/20 pb-2">
              <span className="text-lg">👩</span> 妻の情報
            </div>

            <InputGroup label="年齢">
              <Select
                value={basicInfo.ageWife || 0}
                onChange={(e: any) => setBasicInfo({ ...basicInfo, ageWife: parseInt(e.target.value, 10) || 0 })}
                options={Array.from({ length: 100 - 18 + 1 }, (_, i) => (
                  <option key={18 + i} value={18 + i}>{18 + i}歳</option>
                ))}
              />
            </InputGroup>

            <InputGroup label="昨年の年収（額面）">
              <Select
                value={getAnnualManValue(basicInfo.annualIncomeWife, basicInfo.avgStdMonthlyWife)}
                onChange={(e: any) => {
                  const man = parseInt(e.target.value, 10);
                  const annualYen = !isNaN(man) && man > 0 ? man * 10000 : 0;
                  const avgMonthly = annualYen > 0 ? Math.round(annualYen / 12) : 0;
                  setBasicInfo({
                    ...basicInfo,
                    annualIncomeWife: annualYen > 0 ? annualYen : undefined,
                    avgStdMonthlyWife: avgMonthly,
                  });
                }}
                options={
                  <>
                    <option value="">--</option>
                    {renderAnnualIncomeOptions()}
                  </>
                }
              />
              <p className="text-[10px] text-slate-500">年収を入力すると標準報酬月額へ自動変換されます</p>
            </InputGroup>

            <InputGroup label={
              <div className="flex items-end gap-2">
                <span>厚生年金加入月数</span>
                <span className="text-[10px] font-normal text-slate-400 normal-case tracking-normal">※一度でも加入していた方は記入</span>
              </div>
            }>
              <input
                type="number"
                className="w-full rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-slate-100"
                value={basicInfo.monthsWife}
                onChange={(e) => setBasicInfo({ ...basicInfo, monthsWife: parseInt(e.target.value) || 0 })}
              />
            </InputGroup>

            <InputGroup label={<span className="invisible">オプション</span>}>
              <div className="space-y-1">
                <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-600 text-rose-500 focus:ring-rose-500 bg-slate-700"
                    checked={basicInfo.useMinashi300Wife}
                    onChange={(e) => setBasicInfo({ ...basicInfo, useMinashi300Wife: e.target.checked })}
                  />
                  <span className="text-sm text-slate-300">みなし300月を使用</span>
                </label>
                <p className="text-[10px] text-slate-500 ml-4">※現在厚生年金に加入している方はチェック</p>
              </div>
            </InputGroup>

            <InputGroup label="老齢年金開始年齢">
              <Select
                value={basicInfo.oldAgeStartWife || 65}
                onChange={(e: any) => setBasicInfo({ ...basicInfo, oldAgeStartWife: parseInt(e.target.value, 10) || 65 })}
                options={Array.from({ length: 16 }, (_, i) => (
                  <option key={60 + i} value={60 + i}>{60 + i}歳</option>
                ))}
              />
            </InputGroup>
          </div>

          {/* 夫の情報 */}
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-sky-400 font-bold border-b border-sky-500/20 pb-2">
              <span className="text-lg">👨</span> 夫の情報
            </div>

            <InputGroup label="年齢">
              <Select
                value={basicInfo.ageHusband || 0}
                onChange={(e: any) => setBasicInfo({ ...basicInfo, ageHusband: parseInt(e.target.value, 10) || 0 })}
                options={Array.from({ length: 100 - 18 + 1 }, (_, i) => (
                  <option key={18 + i} value={18 + i}>{18 + i}歳</option>
                ))}
              />
            </InputGroup>

            <InputGroup label="昨年の年収（額面）">
              <Select
                value={getAnnualManValue(basicInfo.annualIncomeHusband, basicInfo.avgStdMonthlyHusband)}
                onChange={(e: any) => {
                  const man = parseInt(e.target.value, 10);
                  const annualYen = !isNaN(man) && man > 0 ? man * 10000 : 0;
                  const avgMonthly = annualYen > 0 ? Math.round(annualYen / 12) : 0;
                  setBasicInfo({
                    ...basicInfo,
                    annualIncomeHusband: annualYen > 0 ? annualYen : undefined,
                    avgStdMonthlyHusband: avgMonthly,
                  });
                }}
                options={
                  <>
                    <option value="">--</option>
                    {renderAnnualIncomeOptions()}
                  </>
                }
              />
              <p className="text-[10px] text-slate-500">年収を入力すると標準報酬月額へ自動変換されます</p>
            </InputGroup>

            <InputGroup label={
              <div className="flex items-end gap-2">
                <span>厚生年金加入月数</span>
                <span className="text-[10px] font-normal text-slate-400 normal-case tracking-normal">※一度でも加入していた方は記入</span>
              </div>
            }>
              <input
                type="number"
                className="w-full rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-slate-100"
                value={basicInfo.monthsHusband}
                onChange={(e) => setBasicInfo({ ...basicInfo, monthsHusband: parseInt(e.target.value) || 0 })}
              />
            </InputGroup>

            <InputGroup label={<span className="invisible">オプション</span>}>
              <div className="space-y-1">
                <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
                  <input
                    type="checkbox"
                    className="w-4 h-4 rounded border-slate-600 text-sky-500 focus:ring-sky-500 bg-slate-700"
                    checked={basicInfo.useMinashi300Husband}
                    onChange={(e) => setBasicInfo({ ...basicInfo, useMinashi300Husband: e.target.checked })}
                  />
                  <span className="text-sm text-slate-300">みなし300月を使用</span>
                </label>
                <p className="text-[10px] text-slate-500 ml-4">※現在厚生年金に加入している方はチェック</p>
              </div>
            </InputGroup>

            <InputGroup label="老齢年金開始年齢">
              <Select
                value={basicInfo.oldAgeStartHusband || 65}
                onChange={(e: any) => setBasicInfo({ ...basicInfo, oldAgeStartHusband: parseInt(e.target.value, 10) || 65 })}
                options={Array.from({ length: 16 }, (_, i) => (
                  <option key={60 + i} value={60 + i}>{60 + i}歳</option>
                ))}
              />
            </InputGroup>
          </div>
        </div>
      )}

      {/* 独身の場合 */}
      {basicInfo.spouseType === 'none' && (
        <div className="pt-4 border-t border-slate-800">
          <div className="space-y-6">
            <div className="flex items-center gap-2 text-emerald-400 font-bold border-b border-emerald-500/20 pb-2">
              <span className="text-lg">👤</span> 本人の情報
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <InputGroup label="年齢">
                <Select
                  value={basicInfo.age || 0}
                  onChange={(e: any) => setBasicInfo({ ...basicInfo, age: parseInt(e.target.value) || 0 })}
                  options={Array.from({ length: 100 - 18 + 1 }, (_, i) => (
                    <option key={i + 18} value={i + 18}>{i + 18}歳</option>
                  ))}
                />
              </InputGroup>
              <InputGroup label="昨年の年収（額面）">
                <Select
                  value={getAnnualManValue(basicInfo.annualIncome, basicInfo.avgStdMonthly)}
                  onChange={(e: any) => {
                    const man = parseInt(e.target.value, 10);
                    const annualYen = !isNaN(man) && man > 0 ? man * 10000 : 0;
                    const avgMonthly = annualYen > 0 ? Math.round(annualYen / 12) : 0;
                    setBasicInfo({
                      ...basicInfo,
                      annualIncome: annualYen > 0 ? annualYen : undefined,
                      avgStdMonthly: avgMonthly,
                    });
                  }}
                  options={
                    <>
                      <option value="">--</option>
                      {renderAnnualIncomeOptions()}
                    </>
                  }
                />
                <p className="text-[10px] text-slate-500">年収を入力すると標準報酬月額へ自動変換されます</p>
              </InputGroup>
              <InputGroup label={
                <div className="flex items-end gap-2">
                  <span>厚生年金加入月数</span>
                  <span className="text-[10px] font-normal text-slate-400 normal-case tracking-normal">※一度でも加入していた方は記入</span>
                </div>
              }>
                <input
                  type="number"
                  className="w-full rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-100"
                  value={basicInfo.employeePensionMonths}
                  onChange={(e) => setBasicInfo({ ...basicInfo, employeePensionMonths: parseInt(e.target.value) || 0 })}
                />
              </InputGroup>

              <InputGroup label={<span className="invisible">オプション</span>}>
                <div className="space-y-1">
                  <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
                    <input
                      type="checkbox"
                      className="w-4 h-4 rounded border-slate-600 text-emerald-500 focus:ring-emerald-500 bg-slate-700"
                      checked={basicInfo.useMinashi300}
                      onChange={(e) => setBasicInfo({ ...basicInfo, useMinashi300: e.target.checked })}
                    />
                    <span className="text-sm text-slate-300">みなし300月を使用</span>
                  </label>
                  <p className="text-[10px] text-slate-500 ml-4">※現在厚生年金に加入している方はチェック</p>
                </div>
              </InputGroup>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function CustomerProfilePage() {
  const [profile, setProfile] = useState<CustomerProfile>({
    monthlyLivingExpense: 0, // 0は「--」として表示
    details: {
      food: 50_000,
      communication: 10_000,
      utilities: 15_000,
      education: 30_000,
      housingLoan: 0,
      rent: 80_000,
      dailyGoods: 20_000,
      entertainment: 20_000,
      lifeInsurance: 15_000,
      savings: 50_000,
    },
    danshinHolder: ['husband'], // デフォルトは夫
    basicInfo: {
      childrenCount: undefined, // undefinedは「--」として表示
      childrenAges: [],
      spouseType: undefined, // デフォルトは未選択（--）
      ageWife: 0, // 0は未入力として扱う（--を表示）
      oldAgeStartWife: 0, // 0は未入力として扱う（--を表示）
      annualIncomeWife: 3_000_000,
      avgStdMonthlyWife: Math.round(3_000_000 / 12), // 0は未入力として扱う（--を表示）
      monthsWife: 300, // デフォルトは300月
      useMinashi300Wife: false,
      ageHusband: 0, // 0は未入力として扱う（--を表示）
      oldAgeStartHusband: 0, // 0は未入力として扱う（--を表示）
      annualIncomeHusband: 4_500_000,
      avgStdMonthlyHusband: Math.round(4_500_000 / 12), // 0は未入力として扱う（--を表示）
      monthsHusband: 300, // デフォルトは300月
      useMinashi300Husband: false,
      age: 0, // 0は未入力として扱う（--を表示）
      oldAgeStart: 0, // 0は未入力として扱う（--を表示）
      hasEmployeePension: false,
      employeePensionMonths: 300, // デフォルトは300月
      annualIncome: 4_500_000,
      avgStdMonthly: Math.round(4_500_000 / 12), // 0は未入力として扱う（--を表示）
      useMinashi300: false,
      educationCourse: 'private_hs', // デフォルト
      cramSchoolOptions: { elementary: true, juniorHigh: true, highSchool: true }, // デフォルトでON
    },
    isLivingExpenseDetailed: false,
  });

  const [notification, setNotification] = useState<string | null>(null);
  const [savedPlans, setSavedPlans] = useState<SavedPlans>({});
  const [currentPlanId, setCurrentPlanId] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3000);
  };

  // localStorageから読み込み
  useEffect(() => {
    if (typeof window !== 'undefined') {
      // 生活費データ
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        try {
          const parsed = JSON.parse(saved);
          setProfile((prev) => ({ ...prev, ...parsed }));
        } catch (e) {
          console.error('Failed to load customer profile:', e);
        }
      }

      // 基本情報データ
      const savedBasic = localStorage.getItem(STORAGE_KEY_BASIC);
      if (savedBasic) {
        try {
          const parsedBasic = JSON.parse(savedBasic);
          setProfile((prev) => ({
            ...prev,
            basicInfo: { ...prev.basicInfo, ...parsedBasic },
          }));
        } catch (e) {
          console.error('Failed to load customer profile basic info:', e);
        }
      }

      // 保存済みプラン
      const savedPlansData = localStorage.getItem(STORAGE_KEY_PLANS);
      if (savedPlansData) {
        try {
          const parsedPlans = JSON.parse(savedPlansData);
          setSavedPlans(parsedPlans);
        } catch (e) {
          console.error('Failed to load saved plans:', e);
        }
      }

      // 現在のプランID
      const currentPlan = localStorage.getItem(STORAGE_KEY_CURRENT_PLAN);
      if (currentPlan) {
        setCurrentPlanId(currentPlan);
      }
    }
  }, []);

  // localStorageに保存（生活費）
  const saveProfile = (newProfile: CustomerProfile) => {
    setProfile(newProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        monthlyLivingExpense: newProfile.monthlyLivingExpense,
        details: newProfile.details,
        danshinHolder: newProfile.danshinHolder,
        isLivingExpenseDetailed: newProfile.isLivingExpenseDetailed,
      }));
    }
  };

  // localStorageに保存（基本情報）
  const saveBasicInfo = (newBasicInfo: CustomerProfileBasicInfo) => {
    setProfile((prev) => ({ ...prev, basicInfo: newBasicInfo }));
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_BASIC, JSON.stringify(newBasicInfo));
      // カスタムイベントを発行して、他のページに変更を通知
      window.dispatchEvent(new Event('customer-profile-updated'));
    }
  };

  // プラン保存
  const handleSavePlan = () => {
    const planId = currentPlanId || `plan-${Date.now()}`;
    const planName = currentPlanId
      ? savedPlans[currentPlanId]?.name || `プラン${Object.keys(savedPlans).length + 1}`
      : `プラン${Object.keys(savedPlans).length + 1}`;

    const newPlans = {
      ...savedPlans,
      [planId]: {
        name: planName,
        profile: profile,
        savedAt: new Date().toISOString()
      }
    };

    setSavedPlans(newPlans);
    setCurrentPlanId(planId);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(newPlans));
      localStorage.setItem(STORAGE_KEY_CURRENT_PLAN, planId);
    }
    showNotification(`${planName}を保存しました`);
  };

  // プラン読み込み
  const handleLoadPlan = (planId: string) => {
    if (!planId) {
      setCurrentPlanId(null);
      if (typeof window !== 'undefined') {
        localStorage.removeItem(STORAGE_KEY_CURRENT_PLAN);
      }
      return;
    }

    const plan = savedPlans[planId];
    if (plan) {
      setProfile(plan.profile);
      setCurrentPlanId(planId);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_CURRENT_PLAN, planId);
      }
      showNotification(`${plan.name}を読み込みました`);
    }
  };

  // プラン削除
  const handleDeletePlan = () => {
    if (!currentPlanId) return;

    const planName = savedPlans[currentPlanId]?.name || 'プラン';
    if (confirm(`${planName}を削除しますか？`)) {
      const newPlans = { ...savedPlans };
      delete newPlans[currentPlanId];

      setSavedPlans(newPlans);
      setCurrentPlanId(null);
      if (typeof window !== 'undefined') {
        localStorage.setItem(STORAGE_KEY_PLANS, JSON.stringify(newPlans));
        localStorage.removeItem(STORAGE_KEY_CURRENT_PLAN);
      }
      showNotification(`${planName}を削除しました`);
    }
  };

  return (
    <main className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-sky-500/30 pb-20">
      {/* ヘッダー */}
      <div className="bg-slate-900/50 border-b border-slate-800 backdrop-blur-md sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between">
          <h1 className="text-xl font-bold flex items-center gap-2">
            <span className="w-2 h-8 bg-sky-500 rounded-full"></span>
            Customer Profile
          </h1>
          <div className="flex items-center gap-2">
            <button
              onClick={() => {
                const clearedProfile = {
                  monthlyLivingExpense: 0,
                  details: {
                    food: 50_000,
                    communication: 10_000,
                    utilities: 15_000,
                    education: 30_000,
                    housingLoan: 0,
                    rent: 80_000,
                    dailyGoods: 20_000,
                    entertainment: 20_000,
                    lifeInsurance: 15_000,
                    savings: 50_000,
                  },
                  danshinHolder: ['husband'],
                  isLivingExpenseDetailed: false,
                  basicInfo: {
                    childrenCount: undefined,
                    childrenAges: [],
                    spouseType: undefined,
                    ageWife: 0,
                    oldAgeStartWife: 0,
                    avgStdMonthlyWife: 0,
                    monthsWife: 300,
                    useMinashi300Wife: false,
                    ageHusband: 0,
                    oldAgeStartHusband: 0,
                    avgStdMonthlyHusband: 0,
                    monthsHusband: 300,
                    useMinashi300Husband: false,
                    age: 0,
                    oldAgeStart: 0,
                    hasEmployeePension: false,
                    employeePensionMonths: 300,
                    avgStdMonthly: 0,
                    useMinashi300: false,
                    educationCourse: 'private_hs' as const,
                    cramSchoolOptions: { elementary: false, juniorHigh: false, highSchool: false },
                  },
                } as CustomerProfile;
                setProfile(clearedProfile);
                saveProfile(clearedProfile);
                saveBasicInfo(clearedProfile.basicInfo);
                showNotification('入力値をクリアしました');
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              クリア
            </button>
            <button
              onClick={() => {
                const coupleProfile = {
                  monthlyLivingExpense: 300_000,
                  details: {
                    food: 60_000,
                    communication: 15_000,
                    utilities: 20_000,
                    education: 20_000,
                    housingLoan: 90_000,
                    rent: 0,
                    dailyGoods: 25_000,
                    entertainment: 25_000,
                    lifeInsurance: 15_000,
                    savings: 30_000,
                  },
                  danshinHolder: ['husband'],
                  isLivingExpenseDetailed: true,
                  basicInfo: {
                    childrenCount: 2,
                    childrenAges: [3, 1],
                    spouseType: 'couple' as const,
                    ageWife: 32,
                    oldAgeStartWife: 65,
                    avgStdMonthlyWife: 250_000,
                    monthsWife: 300,
                    useMinashi300Wife: true,
                    ageHusband: 32,
                    oldAgeStartHusband: 65,
                    avgStdMonthlyHusband: 375_000,
                    monthsHusband: 300,
                    useMinashi300Husband: true,
                    age: 0,
                    oldAgeStart: 0,
                    hasEmployeePension: false,
                    employeePensionMonths: 300,
                    avgStdMonthly: 0,
                    useMinashi300: false,
                    educationCourse: 'private_uni' as const,
                    cramSchoolOptions: { elementary: false, juniorHigh: false, highSchool: true },
                  },
                } as CustomerProfile;
                setProfile(coupleProfile);
                saveProfile(coupleProfile);
                saveBasicInfo(coupleProfile.basicInfo);
                showNotification('テストデータ（夫婦）を読み込みました');
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              例（夫婦）
            </button>
            <button
              onClick={() => {
                const couple25Profile = {
                  monthlyLivingExpense: 250_000,
                  details: {
                    food: 59_000,
                    communication: 12_000,
                    utilities: 18_000,
                    education: 5_000,
                    housingLoan: 0,
                    rent: 65_000,
                    dailyGoods: 22_000,
                    entertainment: 22_000,
                    lifeInsurance: 12_000,
                    savings: 25_000,
                  },
                  danshinHolder: ['husband'],
                  isLivingExpenseDetailed: true,
                  basicInfo: {
                    childrenCount: 1,
                    childrenAges: [0],
                    spouseType: 'couple' as const,
                    ageWife: 25,
                    oldAgeStartWife: 65,
                    annualIncomeWife: 3_000_000,
                    avgStdMonthlyWife: 250_000,
                    monthsWife: 300,
                    useMinashi300Wife: true,
                    ageHusband: 25,
                    oldAgeStartHusband: 65,
                    annualIncomeHusband: 3_500_000,
                    avgStdMonthlyHusband: 290_000,
                    monthsHusband: 300,
                    useMinashi300Husband: true,
                    age: 0,
                    oldAgeStart: 0,
                    hasEmployeePension: false,
                    employeePensionMonths: 300,
                    avgStdMonthly: 0,
                    useMinashi300: false,
                    educationCourse: 'private_uni' as const,
                    cramSchoolOptions: { elementary: false, juniorHigh: false, highSchool: true },
                  },
                } as CustomerProfile;
                setProfile(couple25Profile);
                saveProfile(couple25Profile);
                saveBasicInfo(couple25Profile.basicInfo);
                showNotification('テストデータ（夫婦25歳）を読み込みました');
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              例（夫婦25歳）
            </button>
            <button
              onClick={() => {
                const singleMotherProfile = {
                  monthlyLivingExpense: 180_000,
                  details: {
                    food: 45_000,
                    communication: 10_000,
                    utilities: 15_000,
                    education: 10_000,
                    housingLoan: 0,
                    rent: 60_000,
                    dailyGoods: 15_000,
                    entertainment: 8_000,
                    lifeInsurance: 8_000,
                    savings: 9_000,
                  },
                  danshinHolder: [],
                  isLivingExpenseDetailed: true,
                  basicInfo: {
                    childrenCount: 1,
                    childrenAges: [5],
                    spouseType: 'none' as const,
                    ageWife: 0,
                    oldAgeStartWife: 0,
                    avgStdMonthlyWife: 0,
                    monthsWife: 300,
                    useMinashi300Wife: false,
                    ageHusband: 0,
                    oldAgeStartHusband: 0,
                    avgStdMonthlyHusband: 0,
                    monthsHusband: 300,
                    useMinashi300Husband: false,
                    age: 30,
                    oldAgeStart: 65,
                    hasEmployeePension: true,
                    employeePensionMonths: 120,
                    annualIncome: 2_500_000,
                    avgStdMonthly: 210_000,
                    useMinashi300: true,
                    educationCourse: 'private_hs' as const,
                    cramSchoolOptions: { elementary: false, juniorHigh: false, highSchool: false },
                  },
                } as CustomerProfile;
                setProfile(singleMotherProfile);
                saveProfile(singleMotherProfile);
                saveBasicInfo(singleMotherProfile.basicInfo);
                showNotification('テストデータ（シングルマザー）を読み込みました');
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              例（シングルマザー）
            </button>
            <button
              onClick={() => {
                const singleProfile = {
                  monthlyLivingExpense: 120_000,
                  details: {
                    food: 40_000,
                    communication: 10_000,
                    utilities: 15_000,
                    education: 0,
                    housingLoan: 0,
                    rent: 70_000,
                    dailyGoods: 15_000,
                    entertainment: 20_000,
                    lifeInsurance: 10_000,
                    savings: 20_000,
                  },
                  danshinHolder: [],
                  isLivingExpenseDetailed: false,
                  basicInfo: {
                    childrenCount: 0,
                    childrenAges: [],
                    spouseType: 'none' as const,
                    ageWife: 0,
                    oldAgeStartWife: 0,
                    avgStdMonthlyWife: 0,
                    monthsWife: 300,
                    useMinashi300Wife: false,
                    ageHusband: 0,
                    oldAgeStartHusband: 0,
                    avgStdMonthlyHusband: 0,
                    monthsHusband: 300,
                    useMinashi300Husband: false,
                    age: 25,
                    oldAgeStart: 65,
                    hasEmployeePension: true,
                    employeePensionMonths: 100,
                    avgStdMonthly: 250_000,
                    useMinashi300: true,
                    educationCourse: 'private_hs' as const,
                    cramSchoolOptions: { elementary: false, juniorHigh: false, highSchool: false },
                  },
                } as CustomerProfile;
                setProfile(singleProfile);
                saveProfile(singleProfile);
                saveBasicInfo(singleProfile.basicInfo);
                showNotification('テストデータ（独身）を読み込みました');
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              例（独身）
            </button>

            {/* 区切り線 */}
            <div className="h-6 w-px bg-slate-700"></div>

            {/* プラン選択 */}
            <select
              value={currentPlanId || ''}
              onChange={(e) => handleLoadPlan(e.target.value)}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors bg-slate-900"
            >
              <option value="">新規プラン</option>
              {Object.entries(savedPlans).map(([id, plan]) => (
                <option key={id} value={id}>{plan.name}</option>
              ))}
            </select>

            {/* 保存ボタン */}
            <button
              onClick={handleSavePlan}
              className="text-xs px-3 py-1.5 rounded-full border border-emerald-700 text-emerald-400 hover:text-white hover:bg-emerald-800 transition-colors"
            >
              💾 保存
            </button>

            {/* 削除ボタン */}
            <button
              onClick={handleDeletePlan}
              disabled={!currentPlanId}
              className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${currentPlanId
                ? 'border-rose-700 text-rose-400 hover:text-white hover:bg-rose-800'
                : 'border-slate-800 text-slate-600 cursor-not-allowed'
                }`}
            >
              🗑 削除
            </button>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-6 py-10 space-y-8">
        {/* 基本情報 */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-sky-500/10 flex items-center justify-center text-sky-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-100">基本情報</h2>
          </div>

          <BasicInfoInput
            basicInfo={profile.basicInfo}
            setBasicInfo={saveBasicInfo}
          />
        </div>

        {/* 生活費（月額） */}
        <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-8 backdrop-blur-sm shadow-xl">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 flex items-center justify-center text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor" className="w-6 h-6">
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0115.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 013 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 00-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 01-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 003 15h-.75M15 10.5a3 3 0 11-6 0 3 3 0 016 0zm3 0h.008v.008H18V10.5zm-12 0h.008v.008H6V10.5z" />
              </svg>
            </div>
            <h2 className="text-xl font-bold text-slate-100">生活費（月額）</h2>
          </div>

          <LivingExpenseSelector
            value={profile.monthlyLivingExpense}
            setValue={(v) => saveProfile({ ...profile, monthlyLivingExpense: v })}
            details={profile.details}
            setDetails={(d) => {
              const total = Object.values(d).reduce((a, b) => a + b, 0);
              saveProfile({ ...profile, details: d, monthlyLivingExpense: total });
            }}
            basicInfo={profile.basicInfo}
            danshinHolder={profile.danshinHolder}
            setDanshinHolder={(h) => saveProfile({ ...profile, danshinHolder: h })}
            isDetailed={profile.isLivingExpenseDetailed}
            setIsDetailed={(b) => saveProfile({ ...profile, isLivingExpenseDetailed: b })}
          />
        </div>
      </div>

      {/* Floating Action Button */}
      <div className="fixed bottom-8 right-8 z-40">
        <button
          onClick={() => {
            saveBasicInfo(profile.basicInfo);
            saveProfile(profile);
            showNotification('設定を保存しました');
          }}
          className="group flex items-center gap-3 px-6 py-4 bg-sky-600 hover:bg-sky-500 text-white rounded-full shadow-lg hover:shadow-sky-500/30 transition-all active:scale-95"
        >
          <span className="font-bold">保存して完了</span>
          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-5 h-5 group-hover:translate-x-1 transition-transform">
            <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
          </svg>
        </button>
      </div>

      {/* Notification Toast */}
      {notification && (
        <div className="fixed bottom-24 right-8 z-50 animate-fade-in-up">
          <div className="bg-slate-800 text-white px-4 py-3 rounded-xl shadow-lg border border-slate-700 flex items-center gap-3">
            <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400">
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="w-4 h-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
              </svg>
            </div>
            <span className="font-medium">{notification}</span>
          </div>
        </div>
      )}
    </main>
  );
}
