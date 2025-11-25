import { EducationCourse, calculateHouseholdEducationCost, CramSchoolOptions } from './education-costs';

/**
 * 遺族就労収入の計算 (Final Income)
 * 計算式: (annualIncome / 12) * 0.8 (税/社保控除) * sliderRatio
 * @param annualIncome 額面年収
 * @param sliderRatio リスク調整比率 (0.0 - 1.0, default 0.9)
 * @returns 月額手取り収入
 */
export function calculateSurvivorWorkIncome(annualIncome: number, sliderRatio: number = 0.9): number {
    const monthlyGross = annualIncome / 12;
    const netIncome = monthlyGross * 0.8; // 税・社保控除（簡易的に20%引く）
    return netIncome * sliderRatio;
}

/**
 * 必要生活費の天井計算 (Goal Ceiling Logic)
 * @param age 現在の年齢（計算対象の年齢）
 * @param livingCostBase ベース生活費（月額）
 * @param educationCourse 教育費コース
 * @param childrenAges 子の年齢リスト（現在の年齢）
 * @param currentAgeOfParent 親の現在の年齢（時系列計算の基準点）
 * @returns その年齢時点での必要月額
 */
export function calculateRequiredExpenses({
    age,
    livingCostBase,
    educationCourse,
    childrenAges,
    currentAgeOfParent,
    cramSchoolOptions = { elementary: true, juniorHigh: true, highSchool: true }
}: {
    age: number;
    livingCostBase: number;
    educationCourse: EducationCourse;
    childrenAges: number[];
    currentAgeOfParent: number;
    cramSchoolOptions?: CramSchoolOptions;
}): number {
    let base = 0;

    // 1. ベース生活費
    if (age < 65) {
        // 18歳未満の子がいるかどうかで判定すべきだが、
        // 要件: "18歳まで: livingCostBase (100%)", "18歳〜65歳: livingCostBase の 70%"
        // ここでいう「18歳まで」は「末子が18歳になるまで」と解釈するのが一般的だが、
        // シンプルに「親の年齢」で区切る指定にはなっていない。
        // 文脈から「子供がいる期間（末子が18歳になるまで）」を100%、それ以降65歳までを70%と読み取る。

        const yearsPassed = age - currentAgeOfParent;
        const currentChildrenAges = childrenAges.map(a => a + yearsPassed);
        const hasChildUnder18 = currentChildrenAges.some(a => a < 18);

        if (hasChildUnder18) {
            base = livingCostBase;
        } else {
            base = livingCostBase * 0.7;
        }
    } else {
        // 65歳以降: livingCostBase の 80%
        base = livingCostBase * 0.8;
    }

    // 2. 教育費積立
    // その年齢（年）における月額教育費を加算
    const yearsPassed = age - currentAgeOfParent;
    const currentChildrenAges = childrenAges.map(a => a + yearsPassed);
    const educationCost = calculateHouseholdEducationCost(educationCourse, currentChildrenAges, cramSchoolOptions);

    base += educationCost;

    // 3. 老後準備 (65歳以降)
    if (age >= 65) {
        base += 30000; // 3万円上乗せ
    }

    return base;
}
