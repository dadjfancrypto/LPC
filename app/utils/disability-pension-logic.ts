import {
    calculateDisabilityBasicPension,
    calculateDisabilityEmployeePension,
    calculateEligibleChildrenCount,
    DisabilityLevel
} from './pension-calc';

export const SPOUSE_BONUS_2024 = 234800; // 令和6年度 配偶者加給年金

export type DisabilityPensionResult = {
    basicPension: number;
    employeePension: number;
    spouseBonus: number;
    total: number;
    eligibleChildren: number;
};

export function calculateDisabilityPensionAmounts({
    level,
    hasSpouse,
    ageSpouse,
    childrenAges,
    avgStdMonthly,
    months,
    useMinashi300
}: {
    level: number;
    hasSpouse: boolean;
    ageSpouse?: number;
    childrenAges: number[];
    avgStdMonthly: number;
    months: number;
    useMinashi300: boolean;
}): DisabilityPensionResult {
    const eligibleChildren = calculateEligibleChildrenCount(childrenAges);

    // 配偶者加給年金判定
    const spouseBonusAmount = (hasSpouse && ageSpouse !== undefined && ageSpouse < 65) ? SPOUSE_BONUS_2024 : 0;

    const employeePension = calculateDisabilityEmployeePension(
        level as DisabilityLevel,
        spouseBonusAmount,
        0, // fixedAmount (not used here)
        avgStdMonthly,
        months,
        useMinashi300
    );

    const basicPension = calculateDisabilityBasicPension(level as DisabilityLevel, eligibleChildren);

    return {
        basicPension,
        employeePension,
        spouseBonus: spouseBonusAmount,
        total: basicPension + employeePension,
        eligibleChildren
    };
}
