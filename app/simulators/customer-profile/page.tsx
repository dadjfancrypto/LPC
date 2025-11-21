'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';

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
  avgStdMonthlyWife: number; // 妻の平均標準報酬月額
  monthsWife: number; // 妻の加入月数（0、1〜299、300以上）
  useMinashi300Wife: boolean; // 妻のみなし300月チェックボックス
  
  // 夫の情報（遺族年金シミュレーター用）
  ageHusband: number; // 夫の年齢
  oldAgeStartHusband: number; // 夫の老齢開始年齢（デフォルト65歳）
  avgStdMonthlyHusband: number; // 夫の平均標準報酬月額
  monthsHusband: number; // 夫の加入月数（0、1〜299、300以上）
  useMinashi300Husband: boolean; // 夫のみなし300月チェックボックス
  
  // 本人の情報（独身の場合用）
  age: number; // 本人の年齢
  oldAgeStart: number; // 老齢開始年齢（デフォルト65歳）
  hasEmployeePension: boolean; // 厚生年金に加入していた
  employeePensionMonths: number; // 加入月数（0、1〜299、300以上）
  avgStdMonthly: number; // 平均標準報酬月額（2003年4月以降の値として扱う）
  useMinashi300: boolean; // 本人のみなし300月チェックボックス
};

type CustomerProfile = {
  monthlyLivingExpense: number; // 生活費（月額）
  details: LivingExpenseDetail;
  basicInfo: CustomerProfileBasicInfo; // 基本情報
};

const STORAGE_KEY = 'customer-profile';
const STORAGE_KEY_BASIC = 'customer-profile-basic';

// 1万円単位の選択肢（10万円から100万円まで）
const TEN_THOUSAND_OPTIONS = Array.from({ length: 91 }, (_, i) => (i + 10) * 10_000);

// +1,000円〜+9,000円の調整選択肢
const ADJUSTMENT_OPTIONS = Array.from({ length: 9 }, (_, i) => (i + 1) * 1_000);

// 生活費の詳細項目のラベル
const DETAIL_LABELS: { [K in keyof LivingExpenseDetail]: string } = {
  food: '食費',
  communication: '通信費',
  utilities: '水道光熱費',
  education: '教育費',
  housingLoan: '住宅ローン',
  rent: '家賃',
  dailyGoods: '日用品',
  entertainment: '娯楽費',
  lifeInsurance: '生命保険料',
  savings: '貯蓄',
};

// 2段階選択コンポーネント
function TwoStepSelector({
  label,
  value,
  setValue,
}: {
  label: string;
  value: number;
  setValue: (v: number) => void;
}) {
  const baseValue = Math.floor(value / 10_000) * 10_000;
  const adjustment = value - baseValue;

  return (
    <div className="space-y-2">
      <label className="block text-sm opacity-80">{label}</label>
      <div className="grid grid-cols-2 gap-2">
        <select
          className="rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
          value={baseValue}
          onChange={(e) => {
            const newBase = parseInt(e.target.value, 10);
            setValue(newBase + adjustment);
          }}
        >
          {TEN_THOUSAND_OPTIONS.map((v) => (
            <option key={v} value={v}>
              {v.toLocaleString('ja-JP')}円
            </option>
          ))}
        </select>
        <select
          className="rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
          value={adjustment}
          onChange={(e) => {
            const newAdjustment = parseInt(e.target.value, 10);
            setValue(baseValue + newAdjustment);
          }}
        >
          <option value={0}>+0円</option>
          {ADJUSTMENT_OPTIONS.map((v) => (
            <option key={v} value={v}>
              +{v.toLocaleString('ja-JP')}円
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

// 生活費選択コンポーネント
function LivingExpenseSelector({
  value,
  setValue,
}: {
  value: number;
  setValue: (v: number) => void;
}) {
  return (
    <div className="space-y-2">
      <label className="block text-sm font-semibold">生活費（月額）</label>
      <select
        className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
        value={value || 0}
        onChange={(e) => setValue(parseInt(e.target.value, 10) || 0)}
      >
        <option value={0}>--</option>
        {TEN_THOUSAND_OPTIONS.map((v) => (
          <option key={v} value={v}>
            {v.toLocaleString('ja-JP')}円
          </option>
        ))}
      </select>
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
    basicInfo: {
      childrenCount: undefined, // undefinedは「--」として表示
      childrenAges: [],
      spouseType: undefined, // デフォルトは未選択（--）
      ageWife: 0, // 0は未入力として扱う（--を表示）
      oldAgeStartWife: 0, // 0は未入力として扱う（--を表示）
      avgStdMonthlyWife: 0, // 0は未入力として扱う（--を表示）
      monthsWife: 300, // デフォルトは300月
      useMinashi300Wife: false,
      ageHusband: 0, // 0は未入力として扱う（--を表示）
      oldAgeStartHusband: 0, // 0は未入力として扱う（--を表示）
      avgStdMonthlyHusband: 0, // 0は未入力として扱う（--を表示）
      monthsHusband: 300, // デフォルトは300月
      useMinashi300Husband: false,
      age: 0, // 0は未入力として扱う（--を表示）
      oldAgeStart: 0, // 0は未入力として扱う（--を表示）
      hasEmployeePension: false,
      employeePensionMonths: 300, // デフォルトは300月
      avgStdMonthly: 0, // 0は未入力として扱う（--を表示）
      useMinashi300: false,
    },
  });

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
    }
  }, []);

  // localStorageに保存（生活費）
  const saveProfile = (newProfile: CustomerProfile) => {
    setProfile(newProfile);
    if (typeof window !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({
        monthlyLivingExpense: newProfile.monthlyLivingExpense,
        details: newProfile.details,
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

  return (
    <main className="p-6 lg:p-10 max-w-4xl mx-auto text-slate-100">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold">Customer Profile</h1>
        <div className="flex items-center gap-2">
          <button
            onClick={() => {
              // すべての入力値をクリア
              setProfile({
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
                },
              });
            }}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-4 py-2 hover:bg-slate-900/80"
          >
            クリア
          </button>
          <button
            onClick={() => {
              // サンプルデータを入力（夫婦タイプ）
              setProfile({
                monthlyLivingExpense: 250_000,
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
                basicInfo: {
                  childrenCount: 2,
                  childrenAges: [5, 3],
                  spouseType: 'couple',
                  ageWife: 35,
                  oldAgeStartWife: 65,
                  avgStdMonthlyWife: 250_000,
                  monthsWife: 300,
                  useMinashi300Wife: true,
                  ageHusband: 32,
                  oldAgeStartHusband: 65,
                  avgStdMonthlyHusband: 300_000,
                  monthsHusband: 300,
                  useMinashi300Husband: true,
                  age: 0,
                  oldAgeStart: 0,
                  hasEmployeePension: false,
                  employeePensionMonths: 300,
                  avgStdMonthly: 0,
                  useMinashi300: false,
                },
              });
            }}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-4 py-2 hover:bg-slate-900/80"
          >
            例
          </button>
          <button
            onClick={() => {
              // サンプルデータを入力（独身タイプ）
              setProfile({
                monthlyLivingExpense: 120_000,
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
                basicInfo: {
                  childrenCount: 0,
                  childrenAges: [],
                  spouseType: 'none',
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
                  hasEmployeePension: false,
                  employeePensionMonths: 300,
                  avgStdMonthly: 250_000,
                  useMinashi300: true,
                },
              });
            }}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-4 py-2 hover:bg-slate-900/80"
          >
            例2
          </button>
          <button
            onClick={() => {
              // 基本情報を保存
              saveBasicInfo(profile.basicInfo);
              // 生活費を保存
              saveProfile(profile);
            }}
            className="inline-flex items-center gap-2 rounded-md border border-sky-700 bg-sky-900/60 px-4 py-2 hover:bg-sky-900/80 text-sky-200"
          >
            保存
          </button>
          <button
            onClick={() => {
              // 直前のページに戻る
              if (typeof window !== 'undefined' && window.history.length > 1) {
                window.history.back();
              } else {
                // 履歴がない場合は遺族年金シミュレーターに戻る
                window.location.href = '/simulators/survivor-pension';
              }
            }}
            className="inline-flex items-center gap-2 rounded-md border border-slate-700 bg-slate-900/60 px-4 py-2 hover:bg-slate-900/80"
          >
            閉じる
          </button>
        </div>
      </div>

      <div className="space-y-6">
        {/* 基本情報 */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
          <div className="font-semibold mb-4">基本情報（両シミュレーター共通）</div>
          <BasicInfoInput
            basicInfo={profile.basicInfo}
            setBasicInfo={saveBasicInfo}
          />
        </div>

        {/* 生活費（月額） */}
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-6">
          <LivingExpenseSelector
            value={profile.monthlyLivingExpense}
            setValue={(v) => saveProfile({ ...profile, monthlyLivingExpense: v })}
          />
        </div>
      </div>
    </main>
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
  // 子の人数が変更されたときに年齢配列を更新
  useEffect(() => {
    if (basicInfo.childrenCount === undefined || basicInfo.childrenCount === 0) {
      setBasicInfo({
        ...basicInfo,
        childrenAges: [],
      });
      return;
    }
    const newAges = (() => {
      const arr = basicInfo.childrenAges.slice(0, basicInfo.childrenCount);
      while (arr.length < basicInfo.childrenCount!) arr.push(0);
      return arr;
    })();
    
    if (newAges.length !== basicInfo.childrenAges.length || 
        newAges.some((age, i) => age !== basicInfo.childrenAges[i])) {
      setBasicInfo({
        ...basicInfo,
        childrenAges: newAges,
      });
    }
  }, [basicInfo.childrenCount]);

  return (
    <div className="space-y-4">
      {/* 種類 */}
      <div>
        <label className="block text-sm mb-1">種類</label>
        <select
          className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
          value={basicInfo.spouseType || ''}
          onChange={(e) =>
            setBasicInfo({
              ...basicInfo,
              spouseType: e.target.value === '' ? undefined : (e.target.value as 'couple' | 'none'),
            })
          }
        >
          <option value="">--</option>
          <option value="couple">夫婦</option>
          <option value="none">独身</option>
        </select>
      </div>

      {/* 子の人数 */}
      <div>
        <label className="block text-sm mb-1">子の人数</label>
        <select
          className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
          value={basicInfo.childrenCount === undefined ? '' : basicInfo.childrenCount}
          onChange={(e) =>
            setBasicInfo({
              ...basicInfo,
              childrenCount: e.target.value === '' ? undefined : parseInt(e.target.value, 10),
            })
          }
        >
          <option value="">--</option>
          {Array.from({ length: 6 }, (_, i) => (
            <option key={i} value={i}>
              {i}人
            </option>
          ))}
        </select>
      </div>

      {/* 子の年齢 */}
      {basicInfo.childrenCount !== undefined && basicInfo.childrenCount > 0 && (
        <div className="space-y-2">
          <label className="block text-sm mb-1">子の年齢</label>
          {Array.from({ length: basicInfo.childrenCount }, (_, i) => (
            <div key={i}>
              <label className="block text-xs opacity-60 mb-1">
                {i + 1}人目の年齢
              </label>
              <select
                className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
                value={basicInfo.childrenAges[i] || 0}
                onChange={(e) => {
                  const newAges = [...basicInfo.childrenAges];
                  const val = parseInt(e.target.value, 10);
                  newAges[i] = val === 0 ? 0 : val; // 0は「--」として扱う
                  setBasicInfo({ ...basicInfo, childrenAges: newAges });
                }}
              >
                <option value={0}>--</option>
                {Array.from({ length: 19 }, (_, j) => {
                  const ageValue = j; // 0歳から18歳まで
                  return (
                    <option key={ageValue} value={ageValue}>
                      {ageValue}歳
                    </option>
                  );
                })}
              </select>
            </div>
          ))}
        </div>
      )}

      {/* 妻と夫の情報（横並び） - 夫婦の場合のみ表示 */}
      {basicInfo.spouseType === 'couple' && basicInfo.spouseType !== undefined && (
      <div className="pt-4 border-t border-slate-700">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* 妻の情報 */}
          <div className="space-y-4 pr-6 border-r border-slate-700">
            <div className="font-semibold text-sm">妻の情報</div>
            
            <div>
              <label className="block text-sm mb-1">年齢</label>
              <select
                className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
                value={basicInfo.ageWife || 0}
                onChange={(e) =>
                  setBasicInfo({
                    ...basicInfo,
                    ageWife: parseInt(e.target.value, 10) || 0,
                  })
                }
              >
                <option value={0}>--</option>
                {Array.from({ length: 100 - 18 + 1 }, (_, i) => {
                  const age = 18 + i;
                  return (
                    <option key={age} value={age}>
                      {age}歳
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">老齢開始年齢</label>
              <select
                className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
                value={basicInfo.oldAgeStartWife || 0}
                onChange={(e) =>
                  setBasicInfo({
                    ...basicInfo,
                    oldAgeStartWife: parseInt(e.target.value, 10) || 0,
                  })
                }
              >
                <option value={0}>--</option>
                {Array.from({ length: 75 - 60 + 1 }, (_, i) => {
                  const age = 60 + i;
                  return (
                    <option key={age} value={age}>
                      {age}歳
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">平均標準報酬月額</label>
              <select
                className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
                value={basicInfo.avgStdMonthlyWife || 0}
                onChange={(e) =>
                  setBasicInfo({
                    ...basicInfo,
                    avgStdMonthlyWife: parseInt(e.target.value, 10) || 0,
                  })
                }
              >
                <option value={0}>--</option>
                {Array.from({ length: 196 }, (_, i) => {
                  const value = 50_000 + i * 10_000; // 5万円から200万円まで
                  return (
                    <option key={value} value={value}>
                      {value.toLocaleString('ja-JP')}円
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">厚生年金加入月数</label>
              <input
                type="text"
                className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
                value={basicInfo.monthsWife === 0 ? '--' : String(basicInfo.monthsWife)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === '' || v === '--') {
                    setBasicInfo({
                      ...basicInfo,
                      monthsWife: 0,
                    });
                  } else {
                    const num = parseInt(v, 10);
                    if (!isNaN(num)) {
                      setBasicInfo({
                        ...basicInfo,
                        monthsWife: num,
                      });
                    }
                  }
                }}
                placeholder="--"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={basicInfo.useMinashi300Wife}
                  onChange={(e) =>
                    setBasicInfo({
                      ...basicInfo,
                      useMinashi300Wife: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm">みなし300月</span>
              </label>
              <p className="text-xs opacity-70 mt-1">
                ※チェックを入れると、1〜299月は300月として計算します。チェックを外すと、1〜299月は入力値そのまま計算します（300月未満の場合は300月特例が適用されます）。
              </p>
            </div>
          </div>

          {/* 夫の情報 */}
          <div className="space-y-4 pl-6">
            <div className="font-semibold text-sm">夫の情報</div>
            
            <div>
              <label className="block text-sm mb-1">年齢</label>
              <select
                className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
                value={basicInfo.ageHusband || 0}
                onChange={(e) =>
                  setBasicInfo({
                    ...basicInfo,
                    ageHusband: parseInt(e.target.value, 10) || 0,
                  })
                }
              >
                <option value={0}>--</option>
                {Array.from({ length: 100 - 18 + 1 }, (_, i) => {
                  const age = 18 + i;
                  return (
                    <option key={age} value={age}>
                      {age}歳
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">老齢開始年齢</label>
              <select
                className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
                value={basicInfo.oldAgeStartHusband || 0}
                onChange={(e) =>
                  setBasicInfo({
                    ...basicInfo,
                    oldAgeStartHusband: parseInt(e.target.value, 10) || 0,
                  })
                }
              >
                <option value={0}>--</option>
                {Array.from({ length: 75 - 60 + 1 }, (_, i) => {
                  const age = 60 + i;
                  return (
                    <option key={age} value={age}>
                      {age}歳
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">平均標準報酬月額</label>
              <select
                className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
                value={basicInfo.avgStdMonthlyHusband || 0}
                onChange={(e) =>
                  setBasicInfo({
                    ...basicInfo,
                    avgStdMonthlyHusband: parseInt(e.target.value, 10) || 0,
                  })
                }
              >
                <option value={0}>--</option>
                {Array.from({ length: 196 }, (_, i) => {
                  const value = 50_000 + i * 10_000; // 5万円から200万円まで
                  return (
                    <option key={value} value={value}>
                      {value.toLocaleString('ja-JP')}円
                    </option>
                  );
                })}
              </select>
            </div>

            <div>
              <label className="block text-sm mb-1">厚生年金加入月数</label>
              <input
                type="text"
                className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
                value={basicInfo.monthsHusband === 0 ? '--' : String(basicInfo.monthsHusband)}
                onChange={(e) => {
                  const v = e.target.value.trim();
                  if (v === '' || v === '--') {
                    setBasicInfo({
                      ...basicInfo,
                      monthsHusband: 0,
                    });
                  } else {
                    const num = parseInt(v, 10);
                    if (!isNaN(num)) {
                      setBasicInfo({
                        ...basicInfo,
                        monthsHusband: num,
                      });
                    }
                  }
                }}
                placeholder="--"
              />
            </div>
            <div>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={basicInfo.useMinashi300Husband}
                  onChange={(e) =>
                    setBasicInfo({
                      ...basicInfo,
                      useMinashi300Husband: e.target.checked,
                    })
                  }
                  className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-600 focus:ring-sky-500"
                />
                <span className="text-sm">みなし300月</span>
              </label>
              <p className="text-xs opacity-70 mt-1">
                ※チェックを入れると、1〜299月は300月として計算します。チェックを外すと、1〜299月は入力値そのまま計算します（300月未満の場合は300月特例が適用されます）。
              </p>
            </div>
          </div>
        </div>
      </div>
      )}

      {/* 本人の情報（独身の場合のみ表示） */}
      {basicInfo.spouseType === 'none' && basicInfo.spouseType !== undefined && (
      <div className="pt-4 border-t border-slate-700 space-y-4">
        <div className="font-semibold text-sm">本人の情報</div>
        
        <div>
          <label className="block text-sm mb-1">年齢</label>
          <select
            className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
            value={basicInfo.age || 0}
            onChange={(e) =>
              setBasicInfo({
                ...basicInfo,
                age: parseInt(e.target.value, 10) || 0,
              })
            }
          >
            <option value={0}>--</option>
            {Array.from({ length: 100 - 18 + 1 }, (_, i) => {
              const age = 18 + i;
              return (
                <option key={age} value={age}>
                  {age}歳
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">老齢開始年齢</label>
          <select
            className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
            value={basicInfo.oldAgeStart || 0}
            onChange={(e) =>
              setBasicInfo({
                ...basicInfo,
                oldAgeStart: parseInt(e.target.value, 10) || 0,
              })
            }
          >
            <option value={0}>--</option>
            {Array.from({ length: 75 - 60 + 1 }, (_, i) => {
              const age = 60 + i;
              return (
                <option key={age} value={age}>
                  {age}歳
                </option>
              );
            })}
          </select>
        </div>

        <div>
          <label className="block text-sm mb-1">平均標準報酬月額</label>
          <select
            className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
            value={basicInfo.avgStdMonthly || 0}
            onChange={(e) =>
              setBasicInfo({
                ...basicInfo,
                avgStdMonthly: parseInt(e.target.value, 10) || 0,
              })
            }
          >
            <option value={0}>--</option>
            {Array.from({ length: 196 }, (_, i) => {
              const value = 50_000 + i * 10_000; // 5万円から200万円まで
              return (
                <option key={value} value={value}>
                  {value.toLocaleString('ja-JP')}円
                </option>
              );
            })}
          </select>
          <p className="text-xs opacity-70 mt-1">
            ※2003年4月以降の値として扱います
          </p>
        </div>

        <div>
          <label className="block text-sm mb-1">厚生年金加入月数</label>
          <input
            type="text"
            className="w-full rounded-md px-3 py-2 bg-slate-800 border border-slate-600"
            value={basicInfo.employeePensionMonths === 0 ? '--' : String(basicInfo.employeePensionMonths)}
            onChange={(e) => {
              const v = e.target.value.trim();
              if (v === '' || v === '--') {
                setBasicInfo({
                  ...basicInfo,
                  employeePensionMonths: 0,
                });
              } else {
                const num = parseInt(v, 10);
                if (!isNaN(num)) {
                  setBasicInfo({
                    ...basicInfo,
                    employeePensionMonths: num,
                  });
                }
              }
            }}
            placeholder="--"
          />
        </div>
        <div>
          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={basicInfo.useMinashi300}
              onChange={(e) =>
                setBasicInfo({
                  ...basicInfo,
                  useMinashi300: e.target.checked,
                })
              }
              className="w-4 h-4 rounded border-slate-600 bg-slate-800 text-sky-600 focus:ring-sky-500"
            />
            <span className="text-sm">みなし300月</span>
          </label>
          <p className="text-xs opacity-70 mt-1">
            ※チェックを入れると、1〜299月は300月として計算します。チェックを外すと、1〜299月は入力値そのまま計算します（300月未満の場合は300月特例が適用されます）。
          </p>
        </div>
      </div>
      )}

    </div>
  );
}

