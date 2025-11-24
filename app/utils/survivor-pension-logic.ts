import {
    calculateEligibleChildrenCount,
    calculateSurvivorBasicPension,
    calculateSurvivorEmployeePension,
    calculateOldAgeBasicPension,
    calculateOldAgeEmployeePension,
    calculateChukoreiKasan,
    PolicyMode
} from './pension-calc';

export type SurvivorPensionResult = {
    basicPension: number;
    employeePension: number;
    total: number;
    withChildrenAmount: number;
    afterChildrenAmount: number;
    oldAgeAmount: number;
    yearsUntilChild18: number;
    ageAfterChild: number;
    pensionTypesWithChildren: string[];
    pensionTypesAfterChildren: string[];
    pensionTypesOldAge: string[];
};

/**
 * 老齢年金の繰上げ・繰下げ調整計算
 */
export function calculateOldAgePensionAdjustment(amount: number, startAge: number): number {
    if (startAge === 65) return amount;

    if (startAge < 65) {
        // 繰上げ（0.4%減額/月）※2022年4月以降
        const monthsEarly = (65 - startAge) * 12;
        // 最大減額率は24% (60歳開始)
        const reduction = Math.min(monthsEarly * 0.004, 0.24);
        return amount * (1 - reduction);
    } else {
        // 繰下げ（0.7%増額/月）
        const monthsLate = (startAge - 65) * 12;
        // 最大増額率は84% (75歳開始)
        const increase = Math.min(monthsLate * 0.007, 0.84);
        return amount * (1 + increase);
    }
}

/**
 * 遺族年金計算ロジック（夫死亡・妻死亡共通）
 */
export function calculateSurvivorPensionAmounts({
    ageWife,
    ageHusband,
    childrenAges,
    survivorSource, // 亡くなった人のデータ（遺族年金の計算元）
    ownSource,      // 受給者のデータ（自身の老齢年金の計算元）
    oldAgeStart,
    isWifeDeath,    // true = 妻死亡（夫受給）, false = 夫死亡（妻受給）
    mode
}: {
    ageWife: number;
    ageHusband: number;
    childrenAges: number[];
    survivorSource: { avgStdMonthly: number; months: number; useMinashi300: boolean };
    ownSource: { avgStdMonthly: number; months: number };
    oldAgeStart: number;
    isWifeDeath: boolean;
    mode: PolicyMode;
}): SurvivorPensionResult {

    const eligibleChildren = calculateEligibleChildrenCount(childrenAges);
    const basicPension = calculateSurvivorBasicPension(eligibleChildren);
    const survivorEmployeePension = calculateSurvivorEmployeePension(
        survivorSource.avgStdMonthly,
        survivorSource.months,
        survivorSource.useMinashi300
    );

    const youngestChildAge = childrenAges.length > 0 ? Math.min(...childrenAges) : null;
    const yearsUntilChild18 = youngestChildAge !== null ? Math.max(0, 18 - youngestChildAge) : 0;

    // 受給者（残された方）の年齢
    const survivorAge = isWifeDeath ? ageHusband : ageWife;
    const ageAfterChild = survivorAge + yearsUntilChild18;

    // 最適な老齢年金開始年齢（ユーザー指定）
    const effectiveOldAgeStart = oldAgeStart;

    // 自身の老齢年金（簡易計算）
    const ownBasicCalc = calculateOldAgeBasicPension();
    const ownEmployeeCalc = calculateOldAgeEmployeePension(ownSource.avgStdMonthly, ownSource.months);

    const adjustedOwnBasic = calculateOldAgePensionAdjustment(ownBasicCalc, effectiveOldAgeStart);
    const adjustedOwnEmployee = calculateOldAgePensionAdjustment(ownEmployeeCalc, effectiveOldAgeStart);

    // --- 子がいる期間の計算 ---
    let withChildrenAmount = 0;
    const pensionTypesWithChildren: string[] = ['遺族基礎年金'];

    if (isWifeDeath) {
        // 夫受給（妻死亡）
        // 夫が55歳未満でも、子が遺族厚生年金を受給できるため、世帯としては「基礎＋厚生」となる
        withChildrenAmount = basicPension + survivorEmployeePension;
        pensionTypesWithChildren.push('遺族厚生年金');
    } else {
        // 妻受給（夫死亡）
        // 妻は年齢要件なしで併給可能
        withChildrenAmount = basicPension + survivorEmployeePension;
        pensionTypesWithChildren.push('遺族厚生年金');
    }

    // --- 子がいなくなった後の計算 ---
    let afterChildrenAmount = 0;
    let pensionTypesAfterChildren: string[] = [];

    if (mode === 'revised2028') {
        // 2028年改正案
        if (isWifeDeath) {
            // 夫受給：中高齢寡婦加算なし。原則5年有期
            const yearsAfterChild = effectiveOldAgeStart - ageAfterChild;
            if (yearsAfterChild > 0 && yearsAfterChild <= 5) {
                afterChildrenAmount = survivorEmployeePension;
                pensionTypesAfterChildren = ['遺族厚生年金（5年間）'];
            } else {
                afterChildrenAmount = 0;
                pensionTypesAfterChildren = [];
            }
        } else {
            // 妻受給：中高齢寡婦加算廃止。原則5年有期（ただし経過措置等はここでは省略し、新制度の原則を適用）
            // ※実際には既存受給者への配慮があるが、シミュレーターとしては「改正後の新規裁定」を想定
            const yearsAfterChild = effectiveOldAgeStart - ageAfterChild;
            if (yearsAfterChild > 0 && yearsAfterChild <= 5) {
                afterChildrenAmount = survivorEmployeePension;
                pensionTypesAfterChildren = ['遺族厚生年金（5年間）'];
            } else {
                afterChildrenAmount = 0;
                pensionTypesAfterChildren = [];
            }
        }
    } else {
        // 現行制度
        if (isWifeDeath) {
            // 夫受給（妻死亡）
            // 重要: 妻死亡時に夫が55歳以上であることが要件
            if (ageHusband >= 55) {
                if (ageAfterChild >= 60) {
                    afterChildrenAmount = survivorEmployeePension;
                    pensionTypesAfterChildren = ['遺族厚生年金（60歳〜）'];
                } else if (ageAfterChild >= 55 && ageAfterChild < 60) {
                    afterChildrenAmount = 0;
                    pensionTypesAfterChildren = ['遺族厚生年金（60歳まで停止）'];
                } else {
                    afterChildrenAmount = 0;
                    pensionTypesAfterChildren = [];
                }
            } else {
                // 55歳未満：受給権なし（失権）
                afterChildrenAmount = 0;
                pensionTypesAfterChildren = [];
            }
        } else {
            // 妻受給（夫死亡）
            // 30歳未満の妻に対する5年有期給付
            if (ageAfterChild < 30) {
                afterChildrenAmount = survivorEmployeePension;
                pensionTypesAfterChildren = ['遺族厚生年金（5年間・30歳未満）'];
            } else {
                const chukoreiKasanAfter = (ageAfterChild >= 40 && ageAfterChild < 65) ? calculateChukoreiKasan() : 0;
                afterChildrenAmount = survivorEmployeePension + chukoreiKasanAfter;
                pensionTypesAfterChildren = ['遺族厚生年金'];
                if (chukoreiKasanAfter > 0) {
                    pensionTypesAfterChildren.push('中高齢寡婦加算');
                }
            }
        }
    }

    // --- 老齢年金期間の計算 ---
    let oldAgeAmount = 0;
    const pensionTypesOldAge: string[] = ['老齢基礎年金', '老齢厚生年金'];

    if (isWifeDeath) {
        // 夫受給
        // 55歳未満（妻死亡時）の場合、遺族厚生年金の受給権自体がないため、自身の老齢厚生年金のみ
        const isEligibleForSurvivor = ageHusband >= 55;

        // 改正案の場合は、そもそも有期給付が終わっている可能性が高いが、
        // ここでは現行制度のロジックを中心に考える。
        // 改正案でも「自身の老齢厚生年金」は受給できる。
        // 遺族厚生年金との併給（差額支給）は、受給権がある場合のみ。

        if (mode === 'revised2028') {
            // 改正案では遺族厚生年金は有期で終了しているため、老齢年金期間には遺族年金はない（自身の年金のみ）
            oldAgeAmount = adjustedOwnBasic + adjustedOwnEmployee;
        } else {
            // 現行制度
            const maxEmployeePart = isEligibleForSurvivor
                ? Math.max(survivorEmployeePension, adjustedOwnEmployee)
                : adjustedOwnEmployee;

            oldAgeAmount = adjustedOwnBasic + maxEmployeePart;
            if (isEligibleForSurvivor && survivorEmployeePension > adjustedOwnEmployee) {
                pensionTypesOldAge.push('遺族厚生年金（差額）');
            }
        }
    } else {
        // 妻受給
        if (mode === 'revised2028') {
            oldAgeAmount = adjustedOwnBasic + adjustedOwnEmployee;
        } else {
            const maxEmployeePart = Math.max(survivorEmployeePension, adjustedOwnEmployee);
            oldAgeAmount = adjustedOwnBasic + maxEmployeePart;
            if (survivorEmployeePension > adjustedOwnEmployee) {
                pensionTypesOldAge.push('遺族厚生年金（差額）');
            }
        }
    }

    return {
        basicPension,
        employeePension: survivorEmployeePension,
        total: withChildrenAmount, // Default to withChildrenAmount for simple total, but semantic meaning varies
        withChildrenAmount,
        afterChildrenAmount,
        oldAgeAmount,
        yearsUntilChild18,
        ageAfterChild,
        pensionTypesWithChildren,
        pensionTypesAfterChildren,
        pensionTypesOldAge
    };
}
