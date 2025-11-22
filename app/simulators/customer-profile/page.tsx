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
      <label className="block text-sm font-semibold text-slate-300 mb-2">生活費（月額）</label>
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

  const InputGroup = ({ label, children }: { label: string, children: React.ReactNode }) => (
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

            <InputGroup label="平均標準報酬月額">
              <Select
                value={basicInfo.avgStdMonthlyWife || 0}
                onChange={(e: any) => setBasicInfo({ ...basicInfo, avgStdMonthlyWife: parseInt(e.target.value, 10) || 0 })}
                options={Array.from({ length: 196 }, (_, i) => {
                  const value = 50_000 + i * 10_000;
                  return <option key={value} value={value}>{(value / 10_000).toFixed(0)}万円</option>;
                })}
              />
            </InputGroup>

            <InputGroup label="加入月数">
              <input
                type="number"
                className="w-full rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-rose-500 focus:ring-1 focus:ring-rose-500 transition-all text-slate-100"
                value={basicInfo.monthsWife}
                onChange={(e) => setBasicInfo({ ...basicInfo, monthsWife: parseInt(e.target.value) || 0 })}
              />
            </InputGroup>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-600 text-rose-500 focus:ring-rose-500 bg-slate-700"
                checked={basicInfo.useMinashi300Wife}
                onChange={(e) => setBasicInfo({ ...basicInfo, useMinashi300Wife: e.target.checked })}
              />
              <span className="text-sm text-slate-300">みなし300月を使用</span>
            </label>
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

            <InputGroup label="平均標準報酬月額">
              <Select
                value={basicInfo.avgStdMonthlyHusband || 0}
                onChange={(e: any) => setBasicInfo({ ...basicInfo, avgStdMonthlyHusband: parseInt(e.target.value, 10) || 0 })}
                options={Array.from({ length: 196 }, (_, i) => {
                  const value = 50_000 + i * 10_000;
                  return <option key={value} value={value}>{(value / 10_000).toFixed(0)}万円</option>;
                })}
              />
            </InputGroup>

            <InputGroup label="加入月数">
              <input
                type="number"
                className="w-full rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-sky-500 focus:ring-1 focus:ring-sky-500 transition-all text-slate-100"
                value={basicInfo.monthsHusband}
                onChange={(e) => setBasicInfo({ ...basicInfo, monthsHusband: parseInt(e.target.value) || 0 })}
              />
            </InputGroup>

            <label className="flex items-center gap-3 p-3 rounded-lg bg-slate-800/30 border border-slate-700/50 cursor-pointer hover:bg-slate-800/50 transition-colors">
              <input
                type="checkbox"
                className="w-4 h-4 rounded border-slate-600 text-sky-500 focus:ring-sky-500 bg-slate-700"
                checked={basicInfo.useMinashi300Husband}
                onChange={(e) => setBasicInfo({ ...basicInfo, useMinashi300Husband: e.target.checked })}
              />
              <span className="text-sm text-slate-300">みなし300月を使用</span>
            </label>
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
              <InputGroup label="平均標準報酬月額">
                <Select
                  value={basicInfo.avgStdMonthly || 0}
                  onChange={(e: any) => setBasicInfo({ ...basicInfo, avgStdMonthly: parseInt(e.target.value) || 0 })}
                  options={Array.from({ length: 196 }, (_, i) => {
                    const val = 50000 + i * 10000;
                    return <option key={val} value={val}>{(val / 10000).toFixed(0)}万円</option>
                  })}
                />
              </InputGroup>
              <InputGroup label="加入月数">
                <input
                  type="number"
                  className="w-full rounded-lg px-3 py-2 bg-slate-800/50 border border-slate-700 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 transition-all text-slate-100"
                  value={basicInfo.employeePensionMonths}
                  onChange={(e) => setBasicInfo({ ...basicInfo, employeePensionMonths: parseInt(e.target.value) || 0 })}
                />
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

  const [notification, setNotification] = useState<string | null>(null);

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
                showNotification('入力値をクリアしました');
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              クリア
            </button>
            <button
              onClick={() => {
                // サンプルデータを入力（夫婦タイプ）
                setProfile({
                  monthlyLivingExpense: 280_000,
                  details: {
                    food: 60_000,
                    communication: 15_000,
                    utilities: 20_000,
                    education: 20_000,
                    housingLoan: 0,
                    rent: 90_000,
                    dailyGoods: 25_000,
                    entertainment: 25_000,
                    lifeInsurance: 15_000,
                    savings: 30_000,
                  },
                  basicInfo: {
                    childrenCount: 2,
                    childrenAges: [3, 1],
                    spouseType: 'couple',
                    ageWife: 32,
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
                showNotification('テストデータ（夫婦）を読み込みました');
              }}
              className="text-xs px-3 py-1.5 rounded-full border border-slate-700 text-slate-400 hover:text-white hover:bg-slate-800 transition-colors"
            >
              例（夫婦）
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
