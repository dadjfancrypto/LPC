'use client';

import React from 'react';
import Link from 'next/link';

/**
 * 遺族年金について（お客様向け簡易版）
 * - 現行（〜2027）と 2028年見直し（試作）を並列で説明
 * - シミュレーターの前提（簡易化・定数）も明記
 * - できるだけ平易な言葉で要点整理
 */

// --- シミュレーターで用いている主な定数（説明用・表示のみ） ---
const CONSTS = {
  KISO_BASE: 831_700, // 遺族基礎年金（本体・年額）
  CHILD_ADD_1_2: 239_300, // 子1・2人目の加算（年額）
  CHILD_ADD_3P: 79_800, // 子3人目以降の加算（年額/人）
  CHUKOREI_KASAN: 623_800, // 中高齢寡婦加算（年額）
  COEF_POST2003: 5.481 / 1000, // 報酬比例の係数（2003/4以降・簡易）
  MIN_MONTHS: 300, // みなし300月
};

const yen = (n: number) => Math.round(n).toLocaleString('ja-JP');

export default function RulesPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto text-slate-100">
      <header className="mb-6">
        <div className="text-sm opacity-70 mb-1">
          <Link href="/simulators/survivor-pension" className="underline hover:opacity-90">
            ← シミュレーターへ戻る
          </Link>
        </div>
        <h1 className="text-2xl font-bold">遺族年金について（お客様向けの簡単な説明）</h1>
        <p className="text-sm opacity-80 mt-2">
          複雑な制度を、まずは<strong>ざっくり理解</strong>できるように整理しました。詳細は個別事情により異なります。
        </p>
      </header>

      {/* 現行 vs 2028年改正 概要 */}
      <section className="grid md:grid-cols-2 gap-4 mb-6">
        <Card>
          <h2 className="text-lg font-semibold mb-2">現行（〜2027）</h2>
          <ul className="list-disc ml-5 space-y-1 text-sm opacity-90">
            <li>
              子がいる配偶者：<b>遺族基礎年金</b>＋<b>遺族厚生年金</b>（会社員等の被保険者に限る）
            </li>
            <li>
              子がいない妻（40〜65歳未満）：<b>中高齢寡婦加算</b>が上乗せ
            </li>
            <li>
              子がいない夫：<b>60歳から</b>遺族厚生年金（55〜59歳は停止）
            </li>
          </ul>
        </Card>
        <Card>
          <h2 className="text-lg font-semibold mb-2">2028年見直し（試作の説明）</h2>
          <ul className="list-disc ml-5 space-y-1 text-sm opacity-90">
            <li>子がいる配偶者：基本的な考え方は現行と同様（基礎＋厚生）</li>
            <li>
              子がいない配偶者：<b>一定期間（原則5年）</b>の遺族厚生年金（所得等の要件・経過措置あり）
            </li>
            <li>
              <b>中高齢寡婦加算は段階的に見直し・廃止方向</b>（本ページでは0円扱いで説明）
            </li>
          </ul>
        </Card>
      </section>

      {/* 遺族基礎年金とは */}
      <Section title="遺族基礎年金（だれでも共通の“土台”）">
        <p className="text-sm opacity-90">
          18歳になる年度末までの子がいる配偶者に支給されます。金額は次のとおり（年額）。
        </p>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <MiniStat label="本体" value={`${yen(CONSTS.KISO_BASE)} 円`} />
          <MiniStat label="子の加算（1・2人目 各）" value={`${yen(CONSTS.CHILD_ADD_1_2)} 円`} />
          <MiniStat label="子の加算（3人目以降/人）" value={`${yen(CONSTS.CHILD_ADD_3P)} 円`} />
        </div>
        <Note>子がいない場合、遺族基礎年金は支給されません（配偶者のみでは対象外）。</Note>
      </Section>

      {/* 遺族厚生年金とは */}
      <Section title="遺族厚生年金（会社員・公務員などの“上乗せ”部分）">
        <p className="text-sm opacity-90">
          亡くなった方が厚生年金に加入していた場合に支給されます。シミュレーターでは簡易式：
          <code className="mx-1 px-1 rounded bg-slate-800 border border-slate-700">
            平均標準報酬月額 × 係数(5.481‰) × max(加入月数, 300)
          </code>
          を「報酬比例」とし、その<b>3/4</b>を遺族厚生年金としています。
        </p>
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs">
          <div className="font-semibold mb-1">シミュレーターの前提</div>
          <ul className="list-disc ml-5 space-y-1 opacity-90">
            <li>
              加入月数が300月未満でも、<b>みなし300月</b>として計算（最低保障のため）
            </li>
            <li>
              報酬比例の係数は<b>2003年4月以降</b>の簡易係数（5.481‰）を仮定
            </li>
            <li>端数処理や年度改定、被保険者種別の違いなどは簡略化</li>
          </ul>
        </div>
      </Section>

      {/* 夫側・妻側の違い */}
      <Section title="夫が亡くなった場合／妻が亡くなった場合の主な違い">
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-1">夫が亡くなった場合（受給者：妻）</h3>
            <ul className="list-disc ml-5 text-sm space-y-1 opacity-90">
              <li>
                子がいる：<b>基礎＋厚生</b>。子が0になった後は<b>厚生</b>中心。
              </li>
              <li>
                現行では、40〜65歳未満・子なしの一定条件で<b>中高齢寡婦加算</b>が加わる。
              </li>
              <li>
                2028見直しでは、<b>中高齢寡婦加算の見直し（本シミュでは0円扱い）</b>。
              </li>
            </ul>
          </Card>
          <Card>
            <h3 className="font-semibold mb-1">妻が亡くなった場合（受給者：夫）</h3>
            <ul className="list-disc ml-5 text-sm space-y-1 opacity-90">
              <li>
                子がいる：<b>基礎＋厚生</b>（夫が55歳以上で厚生に受給権）。
              </li>
              <li>
                子がいない：現行は<b>60歳から厚生</b>（55〜59歳は停止）。
              </li>
              <li>
                2028見直し：<b>一定期間（原則5年）</b>の厚生（所得等の要件・経過措置あり）。
              </li>
            </ul>
          </Card>
        </div>
      </Section>

      {/* よくある質問 */}
      <Section title="よくある質問（FAQ）">
        <FAQ
          q="『18歳になる年度末』っていつまで？"
          a="誕生日のある年度の3/31までです。本シミュレーターは年齢から簡易に推計しています。"
        />
        <FAQ
          q="自分の老齢年金と同時にもらえるの？"
          a="65歳以降は併給調整で『高い方に一部上乗せ』の差額支給になります。個別に試算が必要です。"
        />
        <FAQ
          q="収入や再婚で変わる？"
          a="生計維持要件や同順位者、再婚、所得状況などにより支給の有無や額が変わる場合があります。"
        />
      </Section>

      {/* 免責・注意 */}
      <Note>
        このページは制度理解のための<strong>簡易ガイド</strong>です。実際の受給は、加入歴・所得・続柄・同居状況・再婚・端数処理・年度改定等で異なります。
        最終判断や申請前には、年金事務所・自治体・各制度の公式資料をご確認ください。
      </Note>

      <div className="mt-6">
        <Link
          href="/simulators/survivor-pension"
          className="inline-flex items-center gap-2 rounded-md border border-sky-700/50 bg-sky-900/20 px-3 py-2 text-sky-200 underline hover:bg-sky-900/30"
        >
          ← シミュレーターへ戻る
        </Link>
      </div>
    </main>
  );
}

/* -------------------- 小さなUI -------------------- */
function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-900/60 p-4">
      {children}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-6">
      <h2 className="text-lg font-semibold mb-2">{title}</h2>
      <div className="space-y-3">{children}</div>
    </section>
  );
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-800 p-3">
      <div className="text-xs opacity-80">{label}</div>
      <div className="text-lg font-bold">{value}</div>
    </div>
  );
}

function Note({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-lg border border-amber-500/40 bg-amber-900/20 p-3 text-xs md:text-sm">
      <div className="font-semibold mb-1">注意</div>
      <div className="opacity-90">{children}</div>
    </div>
  );
}

function FAQ({ q, a }: { q: string; a: string }) {
  return (
    <div className="rounded-lg border border-slate-700 bg-slate-900/60 p-3">
      <div className="text-sm font-semibold">Q. {q}</div>
      <div className="text-sm opacity-90 mt-1">A. {a}</div>
    </div>
  );
}
