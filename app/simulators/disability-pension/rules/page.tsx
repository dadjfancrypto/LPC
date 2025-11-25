'use client';

import React from 'react';
import Link from 'next/link';

/**
 * 障害年金について（お客様向け簡易版）
 * - 障害基礎年金と障害厚生年金の要点を整理
 * - シミュレーターの前提（簡易化・定数）も明記
 * - できるだけ平易な言葉で要点整理
 */

// --- シミュレーターで用いている主な定数（説明用・表示のみ） ---
const CONSTS = {
  BASE_1_LEVEL: 1_020_000, // 障害基礎年金1級（年額・令和6年度）
  BASE_2_LEVEL: 816_000, // 障害基礎年金2級（年額・令和6年度）
  CHILD_ADD_1_2: 234_800, // 子1・2人目の加算（年額）
  CHILD_ADD_3P: 78_300, // 子3人目以降の加算（年額/人）
  SPOUSE_ADD: 234_800, // 配偶者加給年金額（年額）
  MIN_LEVEL3: 612_000, // 障害厚生年金3級の最低保障額（年額）
  COEF_BEFORE_2003: 7.125 / 1000, // 平成15年3月以前の係数
  COEF_AFTER_2003: 5.481 / 1000, // 平成15年4月以降の係数
  MIN_MONTHS: 300, // みなし300月
};

const yen = (n: number) => Math.round(n).toLocaleString('ja-JP');

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-[#0B0E14] text-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <header className="bg-gradient-to-br from-slate-900/70 via-slate-900/40 to-slate-800/40 border border-slate-800 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-3">DISABILITY PENSION GUIDE</p>
          <h1 className="text-3xl font-semibold tracking-tight">障害年金ルールをひと目で整理</h1>
          <p className="text-sm text-slate-300 mt-3 leading-relaxed">
            シミュレーターと同じ前提・デザインで、「障害基礎年金」「障害厚生年金」「加算」の要点をまとめました。
            家族構成や等級ごとの違いをダッシュボード感覚で確認できます。
          </p>
        </header>

        {/* 障害基礎年金とは */}
        <SectionCard icon="🌱" title="障害基礎年金（国民年金）">
          <p className="text-sm text-slate-300 leading-relaxed">
            初診日が国民年金の加入中・20歳前・60〜64歳国内居住のいずれかに該当し、障害認定日に1級または2級なら支給対象です。
          </p>
          <BadgeGrid
            items={[
              { label: '1級（年額）', value: `${yen(CONSTS.BASE_1_LEVEL)} 円` },
              { label: '2級（年額）', value: `${yen(CONSTS.BASE_2_LEVEL)} 円` },
              { label: '子の加算（第1・2子 各）', value: `${yen(CONSTS.CHILD_ADD_1_2)} 円` },
              { label: '子の加算（第3子以降/人）', value: `${yen(CONSTS.CHILD_ADD_3P)} 円` },
            ]}
          />
          <NoteCard title="受給要件">
            <ul className="list-disc ml-5 space-y-1 text-sm text-slate-200">
              <li>初診日が国民年金の被保険者期間中、20歳前、または60〜64歳の国内居住期間</li>
              <li>障害認定日に障害等級1級または2級に該当</li>
              <li>保険料納付要件：納付＋免除期間が3分の2以上、または直近1年未納なし</li>
            </ul>
          </NoteCard>
        </SectionCard>

        {/* 障害厚生年金とは */}
        <SectionCard icon="🏢" title="障害厚生年金（会社員・公務員の上乗せ）">
          <p className="text-sm text-slate-300 leading-relaxed">
            厚生年金の被保険者期間に初診日がある場合、1〜3級で受給できます。報酬比例部分を基準に、1級は1.25倍、3級は最低保障額を設定。
          </p>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-slate-100 tracking-wide">報酬比例の計算式</div>
            <FormulaLine label="平成15年3月以前" value="平均標準報酬月額 × 7.125‰ × 加入月数" />
            <FormulaLine label="平成15年4月以降" value="平均標準報酬額 × 5.481‰ × 加入月数" />
            <p className="text-[11px] text-slate-500">※ シミュレーターでは加入月数が300月未満でもみなし300月として計算します。</p>
          </div>
          <BadgeGrid
            items={[
              { label: '1級', value: '報酬比例 × 1.25 + 配偶者加給' },
              { label: '2級', value: '報酬比例 + 配偶者加給' },
              { label: '3級（最低保障）', value: `${yen(CONSTS.MIN_LEVEL3)} 円` },
            ]}
          />
          <NoteCard title="受給要件">
            <ul className="list-disc ml-5 space-y-1 text-sm text-slate-200">
              <li>初診日が厚生年金被保険者期間内</li>
              <li>障害認定日に1〜3級に該当</li>
              <li>保険料納付要件は障害基礎年金に準じます</li>
            </ul>
          </NoteCard>
        </SectionCard>

        {/* 等級別 */}
        <SectionCard icon="📊" title="障害等級ごとの主な違い">
          <div className="grid gap-4 md:grid-cols-3">
            {[
              {
                level: '1級',
                summary: [
                  `基礎：${yen(CONSTS.BASE_1_LEVEL)}円 + 子の加算`,
                  '厚生：報酬比例×1.25 + 配偶者加給',
                  '常時介助が必要な状態',
                ],
              },
              {
                level: '2級',
                summary: [
                  `基礎：${yen(CONSTS.BASE_2_LEVEL)}円 + 子の加算`,
                  '厚生：報酬比例 + 配偶者加給',
                  '日常生活が著しく制限',
                ],
              },
              {
                level: '3級',
                summary: [
                  '基礎：支給なし',
                  `厚生：報酬比例（最低 ${yen(CONSTS.MIN_LEVEL3)}円）`,
                  '労働に制限がある状態',
                ],
              },
            ].map((item) => (
              <div key={item.level} className="rounded-2xl border border-slate-800 bg-slate-950/40 p-4">
                <div className="text-sm text-slate-400">LEVEL</div>
                <div className="text-2xl font-semibold text-white mb-3">{item.level}</div>
                <ul className="text-sm text-slate-200 space-y-1.5 list-disc ml-5">
                  {item.summary.map((text) => (
                    <li key={text}>{text}</li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* 加算 */}
        <SectionCard icon="➕" title="子の加算・配偶者加給">
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
              <div className="text-sm text-slate-400">CHILD BONUS</div>
              <h3 className="text-xl font-semibold">子の加算（障害基礎年金のみ）</h3>
              <BadgeGrid
                items={[
                  { label: '第1・2子', value: `${yen(CONSTS.CHILD_ADD_1_2)} 円 / 年` },
                  { label: '第3子以降', value: `${yen(CONSTS.CHILD_ADD_3P)} 円 / 年` },
                ]}
              />
              <p className="text-sm text-slate-300">18歳年度末まで、または20歳未満で障害1・2級の子が対象。</p>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-5 space-y-3">
              <div className="text-sm text-slate-400">SPOUSE BONUS</div>
              <h3 className="text-xl font-semibold">配偶者加給年金（厚生1・2級のみ）</h3>
              <StatBadge label="年額" value={`${yen(CONSTS.SPOUSE_ADD)} 円`} />
              <ul className="text-sm text-slate-300 list-disc ml-5 space-y-1.5">
                <li>生計維持関係にある65歳未満の配偶者が対象</li>
                <li>3級には加算されません</li>
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* FAQ */}
        <SectionCard icon="💡" title="よくある質問">
          <div className="grid gap-4">
            <FAQ q="『初診日』とは何ですか？" a="障害の原因となった病気やけがについて、最初に医師の診療を受けた日です。複数受診している場合は最も早い受診日が初診日になります。" />
            <FAQ q="『障害認定日』とは何ですか？" a="初診日から1年6ヶ月経過した日、またはそれ以前に症状が固定した日を指し、その時点の障害状態で等級が決まります。" />
            <FAQ q="保険料納付要件の『3分の2』や『直近1年間未納なし』とは？" a="初診日前々月までの期間で納付＋免除が3分の2以上、または直近1年に未納が無い場合に要件を満たします（令和18年3月末の特例）。" />
            <FAQ q="老齢年金と同時にもらえますか？" a="原則は選択ですが、条件を満たせば併給調整で一定額を受け取れるケースがあります。個別試算が必要です。" />
            <FAQ q="働きながらでももらえますか？" a="収入制限は基本ありませんが、障害状態が改善した場合は支給停止の可能性があります。" />
          </div>
        </SectionCard>

        <NoteCard title="免責・注意">
          <p className="text-sm text-slate-200 leading-relaxed">
            このページは制度理解のための簡易ガイドです。実際の受給は初診日・加入歴・保険料納付状況・障害の程度など個別事情で変わります。
            申請前には年金事務所や公式資料で最新情報を必ず確認してください。
          </p>
        </NoteCard>

        <div className="flex justify-center pt-4">
          <Link
            href="/simulators/disability-pension"
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 text-white font-semibold shadow-lg shadow-blue-900/40 transition hover:bg-blue-700"
          >
            ← シミュレーターへ戻る
          </Link>
        </div>
      </div>
    </main>
  );
}

/* -------------------- 小さなUI -------------------- */
function SectionCard({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-slate-950/40 border border-slate-900 rounded-2xl p-6 shadow-[0_10px_40px_rgba(0,0,0,0.35)]">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-2xl">{icon}</span>
        <h2 className="text-xl font-semibold tracking-tight">{title}</h2>
      </div>
      <div className="space-y-4">{children}</div>
    </section>
  );
}

function BadgeGrid({ items }: { items: { label: string; value: string }[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {items.map((item) => (
        <StatBadge key={item.label} label={item.label} value={item.value} />
      ))}
    </div>
  );
}

function StatBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/50 p-4">
      <div className="text-xs uppercase tracking-widest text-slate-500">{label}</div>
      <div className="text-2xl font-bold text-emerald-400 mt-1">{value}</div>
    </div>
  );
}

function NoteCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5 shadow-inner">
      <div className="text-sm font-semibold text-amber-300 mb-2 flex items-center gap-2">
        <span>⚠️</span>
        <span>{title}</span>
      </div>
      {children}
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4">
      <div className="text-sm font-semibold text-white">Q. {q}</div>
      <div className="text-sm text-slate-300 mt-1 leading-relaxed">A. {a}</div>
    </div>
  );
}

function FormulaLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center gap-2 text-[13px]">
      <span className="text-slate-400">{label}</span>
      <code className="flex-1 rounded-xl border border-slate-800 bg-black/30 px-3 py-1 font-mono text-[12px] text-slate-100">
        {value}
      </code>
    </div>
  );
}

