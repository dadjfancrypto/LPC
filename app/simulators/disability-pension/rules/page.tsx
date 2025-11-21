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
  BASE_1_LEVEL: 1_039_625, // 障害基礎年金1級（年額）
  BASE_2_LEVEL: 831_700, // 障害基礎年金2級（年額）
  CHILD_ADD_1_2: 239_300, // 子1・2人目の加算（年額）
  CHILD_ADD_3P: 79_800, // 子3人目以降の加算（年額/人）
  SPOUSE_ADD: 224_700, // 配偶者加給年金額（年額）
  MIN_LEVEL3: 623_800, // 障害厚生年金3級の最低保障額（年額）
  COEF_BEFORE_2003: 7.125 / 1000, // 平成15年3月以前の係数
  COEF_AFTER_2003: 5.481 / 1000, // 平成15年4月以降の係数
  MIN_MONTHS: 300, // みなし300月
};

const yen = (n: number) => Math.round(n).toLocaleString('ja-JP');

export default function RulesPage() {
  return (
    <main className="p-6 max-w-4xl mx-auto text-slate-100">
      <header className="mb-6">
        <div className="text-sm opacity-70 mb-1">
          <Link href="/simulators/disability-pension" className="underline hover:opacity-90">
            ← シミュレーターへ戻る
          </Link>
        </div>
        <h1 className="text-2xl font-bold">障害年金について（お客様向けの簡単な説明）</h1>
        <p className="text-sm opacity-80 mt-2">
          複雑な制度を、まずは<strong>ざっくり理解</strong>できるように整理しました。詳細は個別事情により異なります。
        </p>
      </header>

      {/* 障害基礎年金とは */}
      <Section title="障害基礎年金（国民年金の障害年金）">
        <p className="text-sm opacity-90">
          病気やけがで障害が残り、その初診日が国民年金加入期間中、または20歳前、または60歳以上65歳未満の国内居住期間中である場合に支給されます。
        </p>
        <div className="mt-3 grid md:grid-cols-2 gap-3">
          <MiniStat label="1級（年額）" value={`${yen(CONSTS.BASE_1_LEVEL)} 円`} />
          <MiniStat label="2級（年額）" value={`${yen(CONSTS.BASE_2_LEVEL)} 円`} />
          <MiniStat label="子の加算（1・2人目 各）" value={`${yen(CONSTS.CHILD_ADD_1_2)} 円`} />
          <MiniStat label="子の加算（3人目以降/人）" value={`${yen(CONSTS.CHILD_ADD_3P)} 円`} />
        </div>
        <Note>
          <div className="font-semibold mb-1">受給要件</div>
          <ul className="list-disc ml-5 space-y-1">
            <li>初診日が国民年金加入期間中、または20歳前、または60歳以上65歳未満の国内居住期間中</li>
            <li>障害認定日において、障害等級1級または2級に該当すること</li>
            <li>
              保険料納付要件：初診日の前々月までの被保険者期間で、納付済み＋免除期間が3分の2以上、または直近1年間に未納なし
            </li>
          </ul>
        </Note>
      </Section>

      {/* 障害厚生年金とは */}
      <Section title="障害厚生年金（厚生年金の障害年金）">
        <p className="text-sm opacity-90">
          厚生年金被保険者期間中に初診日がある場合に支給されます。障害等級1級・2級・3級に該当する場合に受給できます。
        </p>
        <div className="mt-3 rounded-lg border border-slate-700 bg-slate-900/60 p-3 text-xs">
          <div className="font-semibold mb-1">報酬比例部分の計算式</div>
          <div className="space-y-2 opacity-90">
            <div>
              <strong>平成15年3月以前の加入期間：</strong>
              <code className="mx-1 px-1 rounded bg-slate-800 border border-slate-700">
                平均標準報酬月額 × 7.125/1,000 × 加入月数
              </code>
            </div>
            <div>
              <strong>平成15年4月以降の加入期間：</strong>
              <code className="mx-1 px-1 rounded bg-slate-800 border border-slate-700">
                平均標準報酬額 × 5.481/1,000 × 加入月数
              </code>
            </div>
          </div>
        </div>
        <div className="mt-3 grid md:grid-cols-3 gap-3">
          <MiniStat label="1級（報酬比例×1.25）" value="報酬比例×1.25" />
          <MiniStat label="2級（報酬比例）" value="報酬比例" />
          <MiniStat label="3級（最低保障額）" value={`${yen(CONSTS.MIN_LEVEL3)} 円`} />
        </div>
        <Note>
          <div className="font-semibold mb-1">受給要件</div>
          <ul className="list-disc ml-5 space-y-1">
            <li>初診日が厚生年金被保険者期間中であること</li>
            <li>障害認定日において、障害等級1級・2級・3級に該当すること</li>
            <li>保険料納付要件：障害基礎年金と同様</li>
          </ul>
        </Note>
      </Section>

      {/* 等級別の違い */}
      <Section title="障害等級と年金額の違い">
        <div className="grid md:grid-cols-3 gap-4">
          <Card>
            <h3 className="font-semibold mb-1">1級</h3>
            <ul className="list-disc ml-5 text-sm space-y-1 opacity-90">
              <li>
                障害基礎年金：<b>{yen(CONSTS.BASE_1_LEVEL)}円/年</b> + 子の加算
              </li>
              <li>
                障害厚生年金：報酬比例 × <b>1.25倍</b> + 配偶者加給
              </li>
              <li>日常生活で常時介助が必要な状態</li>
            </ul>
          </Card>
          <Card>
            <h3 className="font-semibold mb-1">2級</h3>
            <ul className="list-disc ml-5 text-sm space-y-1 opacity-90">
              <li>
                障害基礎年金：<b>{yen(CONSTS.BASE_2_LEVEL)}円/年</b> + 子の加算
              </li>
              <li>
                障害厚生年金：報酬比例 + 配偶者加給
              </li>
              <li>日常生活が著しく制限される状態</li>
            </ul>
          </Card>
          <Card>
            <h3 className="font-semibold mb-1">3級</h3>
            <ul className="list-disc ml-5 text-sm space-y-1 opacity-90">
              <li>
                障害基礎年金：<b>なし</b>（厚生年金のみ）
              </li>
              <li>
                障害厚生年金：報酬比例（最低保障：<b>{yen(CONSTS.MIN_LEVEL3)}円/年</b>）
              </li>
              <li>労働が制限される状態</li>
            </ul>
          </Card>
        </div>
      </Section>

      {/* 加算について */}
      <Section title="子の加算と配偶者加給年金額">
        <div className="grid md:grid-cols-2 gap-4">
          <Card>
            <h3 className="font-semibold mb-1">子の加算（障害基礎年金のみ）</h3>
            <ul className="list-disc ml-5 text-sm space-y-1 opacity-90">
              <li>
                第1子・第2子：各<b>{yen(CONSTS.CHILD_ADD_1_2)}円/年</b>
              </li>
              <li>
                第3子以降：各<b>{yen(CONSTS.CHILD_ADD_3P)}円/年</b>
              </li>
              <li>対象：18歳到達年度末までの子、または20歳未満で障害1・2級の子</li>
            </ul>
          </Card>
          <Card>
            <h3 className="font-semibold mb-1">配偶者加給年金額（障害厚生年金1・2級のみ）</h3>
            <ul className="list-disc ml-5 text-sm space-y-1 opacity-90">
              <li>
                金額：<b>{yen(CONSTS.SPOUSE_ADD)}円/年</b>
              </li>
              <li>対象：生計を維持している65歳未満の配偶者がいる場合</li>
              <li>※ 3級には加算されません</li>
            </ul>
          </Card>
        </div>
      </Section>

      {/* よくある質問 */}
      <Section title="よくある質問（FAQ）">
        <FAQ
          q="『初診日』とは何ですか？"
          a="障害の原因となった病気やけがについて、初めて医師の診療を受けた日を指します。同一の病気やけがについて、複数の医療機関を受診した場合は、最も早い受診日が初診日となります。"
        />
        <FAQ
          q="『障害認定日』とは何ですか？"
          a="初診日から1年6ヶ月を経過した日、または1年6ヶ月以内に症状が固定した日を指します。この時点での障害の程度で等級が決定されます。"
        />
        <FAQ
          q="保険料納付要件の『3分の2』や『直近1年間未納なし』とは？"
          a="初診日の前々月までの被保険者期間のうち、保険料納付済期間と免除期間を合わせた期間が3分の2以上あればOKです。また、初診日が令和18年3月末日までで65歳未満の場合は、直近1年間に未納がなければOKです（特例要件）。"
        />
        <FAQ
          q="老齢年金と同時にもらえますか？"
          a="基本的に、老齢年金と障害年金は選択になりますが、一定の条件を満たせば併給できる場合があります。個別の試算が必要です。"
        />
        <FAQ
          q="働きながらでももらえますか？"
          a="収入や所得の制限は基本的にありませんが、障害状態が改善した場合など、年金が停止される場合があります。"
        />
      </Section>

      {/* 免責・注意 */}
      <Note>
        このページは制度理解のための<strong>簡易ガイド</strong>です。実際の受給は、初診日、加入歴、保険料納付状況、障害の程度、個別の事情により異なります。
        最終判断や申請前には、年金事務所・自治体・各制度の公式資料をご確認ください。特に、初診日証明や診断書などの書類が必要です。
      </Note>

      <div className="mt-6">
        <Link
          href="/simulators/disability-pension"
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

