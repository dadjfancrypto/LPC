export type PensionType = 'basic' | 'employee';

export type TimelineItem = {
    age: number;
    year: number;
    label: string;
    amount: number;
    type: 'pension' | 'event';
    breakdown?: { name: string; amount: number }[];
};

export type PolicyMode = 'current' | 'revised2028';

export const POLICY_MODES: Record<PolicyMode, { name: string; description: string }> = {
    current: { name: '現行制度', description: '2027年までの現行制度' },
    revised2028: { name: '2028年改正案', description: '2028年以降の改正案（試算）' },
};

// 令和6年度 遺族基礎年金（年額）
export const KISO_BASE_ANNUAL = 816000; // 68歳未満（令和6年度）
export const CHILD_ADDITION_1_2 = 234800; // 第1子・第2子
export const CHILD_ADDITION_3_PLUS = 78300; // 第3子以降

// 中高齢寡婦加算（年額）
export const CHUKOREI_KASAN = 612000; // 令和6年度

// 経過的寡婦加算（簡易的に固定値または計算式）
// ※本来は生年月日によるが、ここでは簡易シミュレーションのため0または代表値とする
export const KEIKATEKI_KASAN_BASE = 0;

// 障害年金（1級は2級の1.25倍）
export const DISABILITY_BASIC_1 = 1020000; // 1級（令和6年度）
export const DISABILITY_BASIC_2 = 816000;  // 2級（令和6年度）

export type DisabilityLevel = 1 | 2 | 3;

/**
 * 年齢計算
 */
export function calculateAge(birthDate: Date, targetDate: Date = new Date()): number {
    let age = targetDate.getFullYear() - birthDate.getFullYear();
    const m = targetDate.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && targetDate.getDate() < birthDate.getDate())) {
        age--;
    }
    return age;
}

/**
 * 年度年齢計算（4月1日時点の年齢）
 */
export function calculateFiscalYearAge(birthDate: Date, fiscalYear: number): number {
    // 簡易的に、その年度末（3月31日）時点の年齢 - 1 などを採用する場合もあるが、
    // ここではシンプルに「その年度に到達する年齢」とする
    return fiscalYear - birthDate.getFullYear();
}

/**
 * 金額フォーマット
 */
export function formatCurrency(amount: number): string {
    return Math.round(amount).toLocaleString('ja-JP');
}

/**
 * 遺族基礎年金の計算
 */
export function calculateSurvivorBasicPension(childrenCount: number): number {
    if (childrenCount <= 0) return 0;

    let amount = KISO_BASE_ANNUAL;

    // 子の加算
    if (childrenCount >= 1) amount += CHILD_ADDITION_1_2;
    if (childrenCount >= 2) amount += CHILD_ADDITION_1_2;
    if (childrenCount >= 3) amount += CHILD_ADDITION_3_PLUS * (childrenCount - 2);

    return amount;
}

/**
 * 遺族厚生年金の計算（簡易版）
 * 報酬比例部分の3/4
 */
export function calculateSurvivorEmployeePension(
    avgStdMonthly: number,
    months: number,
    useMinashi300: boolean = true
): number {
    // 報酬比例部分の計算（平成15年4月以降の乗率を使用：5.481/1000）
    const multiplier = 5.481 / 1000;

    // 加入月数（みなし300月）
    const calcMonths = useMinashi300 ? Math.max(months, 300) : months;

    const remunerationProportional = avgStdMonthly * calcMonths * multiplier;

    // 遺族厚生年金は報酬比例部分の3/4
    return remunerationProportional * 0.75;
}

/**
 * 老齢基礎年金の計算（簡易版）
 * 基本的に満額を返す（加入期間40年と仮定）
 */
export function calculateOldAgeBasicPension(): number {
    return KISO_BASE_ANNUAL;
}

/**
 * 老齢厚生年金の計算（簡易版）
 * 報酬比例部分
 */
export function calculateOldAgeEmployeePension(
    avgStdMonthly: number,
    months: number
): number {
    // 報酬比例部分の計算（平成15年4月以降の乗率を使用：5.481/1000）
    const multiplier = 5.481 / 1000;
    return avgStdMonthly * months * multiplier;
}

/**
 * 中高齢寡婦加算の計算
 */
export function calculateChukoreiKasan(): number {
    return CHUKOREI_KASAN;
}

/**
 * 寡婦年金の計算（簡易）
 */
export function calculateWidowPension(
    avgStdMonthly: number,
    months: number
): number {
    // 第1号被保険者期間だけで計算するが、ここでは簡易的に基礎年金の3/4とするロジックも考えられるが
    // 独自計算が必要。今回は簡易的に0とするか、基礎年金満額の3/4程度を返す
    return KISO_BASE_ANNUAL * 0.75;
}

/**
 * 死亡一時金の計算
 */
export function calculateLumpSumDeath(months: number): number {
    if (months < 36) return 0;
    // 簡易テーブル
    if (months < 180) return 120000;
    if (months < 240) return 145000;
    if (months < 300) return 170000;
    if (months < 360) return 220000;
    if (months < 420) return 270000;
    return 320000;
}

/**
 * 障害基礎年金の計算
 */
export function calculateDisabilityBasicPension(level: DisabilityLevel, childrenCount: number): number {
    if (level === 3) return 0; // 3級は基礎年金なし

    let base = (level === 1) ? DISABILITY_BASIC_1 : DISABILITY_BASIC_2;

    // 子の加算
    if (childrenCount >= 1) base += CHILD_ADDITION_1_2;
    if (childrenCount >= 2) base += CHILD_ADDITION_1_2;
    if (childrenCount >= 3) base += CHILD_ADDITION_3_PLUS * (childrenCount - 2);

    return base;
}

/**
 * 障害厚生年金の計算
 */
export function calculateDisabilityEmployeePension(
    level: DisabilityLevel,
    spouseBonus: number, // 配偶者加給年金
    remunerationBase: number, // 報酬比例部分（計算済みの場合）
    avgStdMonthly: number = 0, // 未計算の場合に使用
    months: number = 0, // 未計算の場合に使用
    useMinashi300: boolean = true
): number {
    let amount = remunerationBase;

    if (amount === 0 && avgStdMonthly > 0) {
        const multiplier = 5.481 / 1000;
        const calcMonths = useMinashi300 ? Math.max(months, 300) : months;
        amount = avgStdMonthly * calcMonths * multiplier;
    }

    // 1級は1.25倍
    if (level === 1) {
        amount = amount * 1.25;
    }

    // 3級の最低保証額（令和7年度：623,800円）
    if (level === 3 && amount < 623800) {
        amount = 623800;
    }

    // 配偶者加給年金（1級・2級のみ）
    if (level < 3) {
        amount += spouseBonus;
    }

    return amount;
}

/**
 * 支給対象となる子の数を計算（18歳到達年度末まで、障害がある場合は20歳まで）
 */
export function calculateEligibleChildrenCount(childrenAges: number[], disabilityLevel: number = 0): number {
    // 簡易的に現在の年齢だけで判定（本来は生年月日と現在日付が必要）
    // 障害等級（子の障害）は考慮せず、年齢のみで判定
    return childrenAges.filter(age => age < 18).length;
}

/**
 * タイムライン生成ロジック
 */
export function generateTimeline({
    currentAge,
    targetAge,
    spouseDeathAge,
    childrenAges,
    pensionAmounts,
    isWife,
    oldAgeStart = 65
}: {
    currentAge: number;
    targetAge: number;
    spouseDeathAge: number;
    childrenAges: number[];
    pensionAmounts: { basic: number; employee: number; chukorei: number };
    isWife: boolean;
    oldAgeStart?: number;
}): TimelineItem[] {
    const items: TimelineItem[] = [];
    const currentYear = new Date().getFullYear();

    for (let age = currentAge; age <= targetAge; age++) {
        const year = currentYear + (age - currentAge);
        const childrenCurrentAges = childrenAges.map(a => a + (age - currentAge));
        const eligibleChildren = childrenCurrentAges.filter(a => a < 18).length; // 18歳年度末まで（簡易）

        let amount = 0;
        const breakdown: { name: string; amount: number }[] = [];
        let label = '';

        // 遺族基礎年金（子が18歳年度末まで）
        if (eligibleChildren > 0) {
            const basic = calculateSurvivorBasicPension(eligibleChildren);
            amount += basic;
            breakdown.push({ name: '遺族基礎年金', amount: basic });
            label = '遺族基礎年金 + 遺族厚生年金';
        }

        // 遺族厚生年金（一生涯）
        // ※妻の場合、30歳未満で子のない妻は5年有期などの例外があるが、ここでは一般ケース
        amount += pensionAmounts.employee;
        breakdown.push({ name: '遺族厚生年金', amount: pensionAmounts.employee });
        if (!label) label = '遺族厚生年金';

        // 中高齢寡婦加算（妻のみ、40歳〜65歳、子がいない/成人した）
        if (isWife && age >= 40 && age < 65 && eligibleChildren === 0) {
            // 夫死亡時に40歳以上だったか、または40歳到達時に子がいたか等の要件チェックが必要
            // ここでは簡易的に「現在受給要件を満たしているなら、年齢期間中はずっと出る」とする
            if (pensionAmounts.chukorei > 0) {
                amount += pensionAmounts.chukorei;
                breakdown.push({ name: '中高齢寡婦加算', amount: pensionAmounts.chukorei });
                label += ' + 中高齢寡婦加算';
            }
        }

        // 老齢年金への切り替え（65歳〜）
        // ※本来は自分の老齢年金と遺族厚生年金の調整があるが、ここでは簡易表示
        if (age >= oldAgeStart) {
            label = '老齢年金 + 遺族厚生年金（調整あり）';
            // 金額は変わる可能性があるが、シミュレーターのスコープ外なら維持または注釈
        }

        // 5年ごとの節目、または変化点（子が18歳になった翌年、65歳到達など）のみ出力
        const isMilestone = (age === currentAge) || (age % 5 === 0) || (age === 65) || (age === 40);
        // 子が18歳になるタイミング
        const isChildGraduation = childrenCurrentAges.some(a => a === 18);

        if (isMilestone || isChildGraduation) {
            items.push({
                age,
                year,
                label,
                amount,
                type: 'pension',
                breakdown
            });
        }
    }

    return items;
}
// 必要保障額シミュレーター用ヘルパー
export function kisoAnnualByCount(count: number): number {
    return calculateSurvivorBasicPension(count);
}

export function proportionAnnual(avgStd: number, months: number, useMinashi: boolean): number {
    return calculateSurvivorEmployeePension(avgStd, months, useMinashi);
}
