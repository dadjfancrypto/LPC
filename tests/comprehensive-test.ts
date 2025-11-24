import { calculateSurvivorPensionAmounts } from '../app/utils/survivor-pension-logic';
import { calculateDisabilityPensionAmounts } from '../app/utils/disability-pension-logic';
import {
  CHILD_ADDITION_1_2,
  CHILD_ADDITION_3_PLUS,
  KISO_BASE_ANNUAL,
  CHUKOREI_KASAN,
} from '../app/utils/pension-calc';

type TestResult = { id: string; title: string; ok: boolean; detail: string };
type CaseRunner = () => TestResult;

const survivorsBase = {
  childrenAges: [] as number[],
  oldAgeStart: 65,
  mode: 'current' as const,
  ownSource: { avgStdMonthly: 280000, months: 260 },
};

const cases: CaseRunner[] = [
  () => {
    const result = calculateSurvivorPensionAmounts({
      ageWife: 35,
      ageHusband: 35,
      childrenAges: [3, 1],
      survivorSource: { avgStdMonthly: 300000, months: 300, useMinashi300: true },
      ownSource: survivorsBase.ownSource,
      oldAgeStart: 65,
      isWifeDeath: false,
      mode: 'current',
    });
    const hasBasic = result.pensionTypesWithChildren.includes('遺族基礎年金');
    const hasEmployee = result.pensionTypesWithChildren.includes('遺族厚生年金');
    return {
      id: 'Case 1',
      title: '標準世帯',
      ok: hasBasic && hasEmployee && result.withChildrenAmount > 0,
      detail: hasBasic && hasEmployee ? '基礎＋厚生を確認' : 'どちらかが欠落',
    };
  },
  () => {
    const result = calculateSurvivorPensionAmounts({
      ageWife: 28,
      ageHusband: 30,
      childrenAges: [],
      survivorSource: { avgStdMonthly: 320000, months: 300, useMinashi300: true },
      ownSource: survivorsBase.ownSource,
      oldAgeStart: 65,
      isWifeDeath: false,
      mode: 'current',
    });
    const hasFiveYear = result.pensionTypesAfterChildren.includes('遺族厚生年金（5年間・30歳未満）');
    return {
      id: 'Case 2',
      title: '若年・子なし妻（28歳）',
      ok: hasFiveYear,
      detail: hasFiveYear ? '5年有期判定OK' : '5年有期ラベルなし',
    };
  },
  () => {
    const result = calculateSurvivorPensionAmounts({
      ageWife: 30,
      ageHusband: 28,
      childrenAges: [],
      survivorSource: { avgStdMonthly: 280000, months: 240, useMinashi300: true },
      ownSource: { avgStdMonthly: 260000, months: 220 },
      oldAgeStart: 65,
      isWifeDeath: true,
      mode: 'current',
    });
    const zeroAfter = result.afterChildrenAmount === 0 && result.pensionTypesAfterChildren.length === 0;
    return {
      id: 'Case 3',
      title: '若年・子なし夫（28歳）',
      ok: zeroAfter,
      detail: zeroAfter ? '55歳未満→失権を確認 (0円)' : '0円になっていない',
    };
  },
  () => {
    const result = calculateSurvivorPensionAmounts({
      ageWife: 45,
      ageHusband: 47,
      childrenAges: [],
      survivorSource: { avgStdMonthly: 320000, months: 300, useMinashi300: true },
      ownSource: survivorsBase.ownSource,
      oldAgeStart: 65,
      isWifeDeath: false,
      mode: 'current',
    });
    const hasChukorei = result.pensionTypesAfterChildren.includes('遺族厚生年金') &&
      result.pensionTypesAfterChildren.includes('中高齢寡婦加算');
    const addsChukorei = result.afterChildrenAmount >= CHUKOREI_KASAN;
    return {
      id: 'Case 4',
      title: '中高齢・子なし妻（45歳）',
      ok: hasChukorei && addsChukorei,
      detail: hasChukorei ? '中高齢寡婦加算を確認' : '加算ラベルが無い',
    };
  },
  () => {
    const result = calculateSurvivorPensionAmounts({
      ageWife: 54,
      ageHusband: 56,
      childrenAges: [],
      survivorSource: { avgStdMonthly: 280000, months: 300, useMinashi300: true },
      ownSource: { avgStdMonthly: 260000, months: 240 },
      oldAgeStart: 65,
      isWifeDeath: true,
      mode: 'current',
    });
    const hasPause = result.pensionTypesAfterChildren.includes('遺族厚生年金（60歳まで停止）');
    return {
      id: 'Case 5',
      title: '高齢・子なし夫（56歳）',
      ok: hasPause,
      detail: hasPause ? '60歳開始ラベルを確認' : '停止ラベルが無い',
    };
  },
  () => {
    const result = calculateSurvivorPensionAmounts({
      ageWife: 35,
      ageHusband: 37,
      childrenAges: [7, 5, 2],
      survivorSource: { avgStdMonthly: 310000, months: 300, useMinashi300: true },
      ownSource: survivorsBase.ownSource,
      oldAgeStart: 65,
      isWifeDeath: false,
      mode: 'current',
    });
    const expectedBasic = KISO_BASE_ANNUAL + (CHILD_ADDITION_1_2 * 2) + CHILD_ADDITION_3_PLUS;
    const matches = Math.abs(result.basicPension - expectedBasic) < 1;
    return {
      id: 'Case 6',
      title: '子だくさん（3人）',
      ok: matches,
      detail: matches ? '第3子加算を確認' : `期待:${expectedBasic} 実際:${result.basicPension}`,
    };
  },
  () => {
    const result = calculateDisabilityPensionAmounts({
      level: 3,
      hasSpouse: false,
      childrenAges: [],
      avgStdMonthly: 400000,
      months: 200,
      useMinashi300: true,
    });
    const ok = result.basicPension === 0 && result.employeePension >= 612000;
    return {
      id: 'Case 7',
      title: '障害3級（単身）',
      ok,
      detail: ok ? '基礎なし＋最低保証以上' : '基礎が付いているか最低保証未満',
    };
  },
  () => {
    const result = calculateDisabilityPensionAmounts({
      level: 1,
      hasSpouse: true,
      ageSpouse: 33,
      childrenAges: [5],
      avgStdMonthly: 350000,
      months: 300,
      useMinashi300: true,
    });
    const expectedBasic = 1_020_000 + 234_800;
    const hasBonus = result.spouseBonus === 234_800;
    const ok = Math.abs(result.basicPension - expectedBasic) < 1 && hasBonus;
    return {
      id: 'Case 8',
      title: '障害1級（子あり）',
      ok,
      detail: ok ? '1.25倍＋子加算＋配偶者加給を確認' : '金額が想定と不一致',
    };
  },
  () => {
    const result = calculateSurvivorPensionAmounts({
      ageWife: 40,
      ageHusband: 42,
      childrenAges: [10],
      survivorSource: { avgStdMonthly: 650000, months: 300, useMinashi300: true },
      ownSource: survivorsBase.ownSource,
      oldAgeStart: 65,
      isWifeDeath: false,
      mode: 'current',
    });
    const ok = result.employeePension > 500000;
    return {
      id: 'Case 9',
      title: '高所得世帯（標準報酬65万）',
      ok,
      detail: ok ? `報酬比例: ${Math.round(result.employeePension).toLocaleString()}円` : '想定より低い',
    };
  },
  () => {
    const result = calculateSurvivorPensionAmounts({
      ageWife: 40,
      ageHusband: 42,
      childrenAges: [10],
      survivorSource: { avgStdMonthly: 100000, months: 180, useMinashi300: true },
      ownSource: survivorsBase.ownSource,
      oldAgeStart: 65,
      isWifeDeath: false,
      mode: 'current',
    });
    const ok = result.employeePension > 0 && result.withChildrenAmount >= result.basicPension;
    return {
      id: 'Case 10',
      title: '低所得世帯（標準報酬10万）',
      ok,
      detail: ok ? '最低限の保障を確認' : '0円または計算エラー',
    };
  },
];

function runAll(): void {
  console.log('\n=== 遺族・障害年金 網羅テストレポート ===\n');
  const results: TestResult[] = cases.map((runner) => runner());
  let allPass = true;

  for (const r of results) {
    const status = r.ok ? 'OK ✅' : 'FAIL ❌';
    console.log(`[${r.id}: ${r.title}] ... ${status} (${r.detail})\n`);
    if (!r.ok) allPass = false;
  }

  console.log('----------------------------------------\n');
  if (allPass) {
    console.log('🎉 全10ケース合格！ロジックは正常です。\n');
  } else {
    console.log('⚠️ 失敗ケースがあります。ロジックを確認してください。\n');
    process.exit(1);
  }
}

runAll();

