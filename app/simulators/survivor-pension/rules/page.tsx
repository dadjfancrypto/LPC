'use client';

import React from 'react';
import Link from 'next/link';

/**
 * 遺族年金について（お客様向け簡易版）
 * - 現行（〜2027）と 2028年見直し（試作）を並列で説明
 * - シミュレーターの前提（簡易化・定数）も明記
 * - できるだけ平易な言葉で要点整理
 */

// --- シミュレーターで用いている主な定数（令和6年度・説明用・表示のみ） ---
const CONSTS = {
  KISO_BASE: 816_000, // 遺族基礎年金（本体・年額）
  CHILD_ADD_1_2: 234_800, // 子1・2人目の加算（年額）
  CHILD_ADD_3P: 78_300, // 子3人目以降の加算（年額/人）
  CHUKOREI_KASAN: 612_000, // 中高齢寡婦加算（年額・令和6年度）
  COEF_POST2003: 5.481 / 1000, // 報酬比例の係数（2003/4以降・簡易）
  MIN_MONTHS: 300, // みなし300月
};

const yen = (n: number) => Math.round(n).toLocaleString('ja-JP');

export default function RulesPage() {
  return (
    <main className="min-h-screen bg-[#0B0E14] text-slate-100">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 space-y-8">
        <header className="bg-gradient-to-br from-slate-900/80 via-slate-900/40 to-slate-800/40 border border-slate-800 rounded-3xl p-6 shadow-[0_20px_60px_rgba(0,0,0,0.35)]">
          <p className="text-xs uppercase tracking-[0.3em] text-slate-400 mb-3">SURVIVOR PENSION GUIDE</p>
          <h1 className="text-3xl font-semibold tracking-tight">遺族年金のルールをひと目で整理</h1>
          <p className="text-sm text-slate-300 mt-3 leading-relaxed">
            シミュレーター本編と同じ配色・コンポーネントで「現行制度」と「2028年見直し案」の要点を横断比較。
            支給対象や金額感を視覚的に把握できます。
          </p>
        </header>

        {/* 現行 vs 改正案 */}
        <div className="grid md:grid-cols-2 gap-4">
          <SectionCard icon="📘" title="現行制度（〜2027）">
            <ul className="text-sm text-slate-200 space-y-2 list-disc ml-5">
              <li>子がいる配偶者：遺族基礎年金＋遺族厚生年金</li>
              <li>子がいない妻（40〜65歳未満）：中高齢寡婦加算が上乗せ</li>
              <li>子がいない夫：60歳から遺族厚生（55〜59歳は支給停止）</li>
            </ul>
          </SectionCard>
          <SectionCard icon="🧭" title="2028年改正議論（参考）">
            <ul className="text-sm text-slate-200 space-y-2 list-disc ml-5">
              <li>子がいる配偶者：基本は現行と同様（基礎＋厚生）</li>
              <li>子がいない配偶者：原則5年間の遺族厚生年金（所得要件・経過措置あり）</li>
              <li>中高齢寡婦加算は段階的に見直し・廃止方向</li>
            </ul>
            <p className="text-[11px] text-slate-500 border-t border-slate-800 mt-3 pt-2">
              ※まだ議論段階であり、決定事項ではありません。
            </p>
          </SectionCard>
        </div>

        {/* 遺族基礎年金 */}
        <SectionCard icon="🌤️" title="遺族基礎年金（すべての世帯共通の土台）">
          <p className="text-sm text-slate-300 leading-relaxed">
            18歳になる年度末までの子がいる配偶者に支給。子の人数に応じて加算され、シミュレーターでも同じ金額を使用しています。
          </p>
          <BadgeGrid
            items={[
              { label: '本体（年額）', value: `${yen(CONSTS.KISO_BASE)} 円` },
              { label: '子の加算（第1・2子 各）', value: `${yen(CONSTS.CHILD_ADD_1_2)} 円` },
              { label: '子の加算（第3子以降/人）', value: `${yen(CONSTS.CHILD_ADD_3P)} 円` },
            ]}
          />
          <NoteCard title="ポイント">
            <p className="text-sm text-slate-200">子がいない配偶者のみでは支給対象になりません。</p>
          </NoteCard>
        </SectionCard>

        {/* 遺族厚生年金 */}
        <SectionCard icon="🏛️" title="遺族厚生年金（会社員・公務員などの上乗せ）">
          <p className="text-sm text-slate-300 leading-relaxed">
            亡くなった方が厚生年金加入者の場合に支給。シミュレーターでは報酬比例部分から簡易計算し、その
            <span className="text-emerald-400 font-semibold"> 3/4 </span>
            を遺族厚生年金として扱います。
          </p>
          <div className="rounded-2xl border border-slate-800 bg-slate-900/40 p-4 text-xs text-slate-300 space-y-2">
            <div className="font-semibold text-slate-100 tracking-wide">計算ロジック（シミュレーター）</div>
            <FormulaLine label="報酬比例" value="平均標準報酬月額 × 5.481‰ × max(加入月数, 300)" />
            <FormulaLine label="遺族厚生年金" value="報酬比例 × 3 / 4" />
            <ul className="list-disc ml-5 text-[11px] text-slate-500 space-y-1">
              <li>加入月数300月未満でも「みなし300月」で計算</li>
              <li>端数処理・年度改定など細部は簡略化しています</li>
            </ul>
          </div>
        </SectionCard>

        {/* 夫婦別の違い */}
        <SectionCard icon="👥" title="夫が亡くなった場合／妻が亡くなった場合">
          <div className="grid md:grid-cols-2 gap-4">
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-2">
              <div className="text-sm text-slate-400">CASE A</div>
              <h3 className="text-xl font-semibold">夫が亡くなった場合（受給者：妻）</h3>
              <ul className="text-sm text-slate-200 list-disc ml-5 space-y-1.5">
                <li>子がいる：基礎＋厚生。子が独立後は厚生中心。</li>
                <li>40〜65歳未満で子なし：中高齢寡婦加算がプラス。</li>
                <li>2028案：中高齢寡婦加算は段階的に縮小（本シミュでは0円）。</li>
              </ul>
            </div>
            <div className="rounded-2xl border border-slate-800 bg-slate-950/40 p-5 space-y-2">
              <div className="text-sm text-slate-400">CASE B</div>
              <h3 className="text-xl font-semibold">妻が亡くなった場合（受給者：夫）</h3>
              <ul className="text-sm text-slate-200 list-disc ml-5 space-y-1.5">
                <li>子がいる：基礎＋厚生（年齢要件なし）。子18歳到達で両方終了。</li>
                <li>子がいない：現行は60歳から厚生（55〜59歳は停止）。</li>
                <li>2028案：一定期間（原則5年）の厚生に短縮される想定。</li>
              </ul>
            </div>
          </div>
        </SectionCard>

        {/* FAQ */}
        <SectionCard icon="💬" title="よくある質問">
          <div className="grid gap-4">
            <FAQ q="『18歳になる年度末』とはいつまで？" a="誕生日を含む年度の3月31日まで。シミュレーターでは子の年齢から単純化して計算しています。" />
            <FAQ q="自分の老齢年金と同時にもらえる？" a="65歳以降は併給調整により高い方へ差額加算が行われます。個別の年金額により変わるため、詳細試算が必要です。" />
            <FAQ q="収入や再婚で支給は変わる？" a="生計維持要件、同順位者、再婚、所得状況によって支給の有無・金額が変動する場合があります。" />
          </div>
        </SectionCard>

        <NoteCard title="免責・注意">
          <p className="text-sm text-slate-200 leading-relaxed">
            このページは制度理解のための簡易ガイドです。加入歴・所得・続柄・同居状況・再婚・端数処理・年度改定などで実際の受給は変わります。
            申請前には年金事務所や公式資料で最新情報をご確認ください。
          </p>
        </NoteCard>

        <div className="flex justify-center pt-4">
          <Link
            href="/simulators/survivor-pension"
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
