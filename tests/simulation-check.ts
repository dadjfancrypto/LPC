
import { calculateSurvivorPensionAmounts } from '../app/utils/survivor-pension-logic';
import { calculateDisabilityPensionAmounts } from '../app/utils/disability-pension-logic';
import { formatCurrency, POLICY_MODES } from '../app/utils/pension-calc';

// Mock Data
const MOCK_AVG_STD_MONTHLY = 400000;
const MOCK_MONTHS = 300;
const MOCK_USE_MINASHI = true;

console.log('=== Pension Logic Simulation Check ===\n');

// Case A: Standard Survivor (Husband dies, Wife 35, Child 5)
console.log('--- Case A: Standard Survivor (Husband dies, Wife 35, Child 5) ---');
const caseA = calculateSurvivorPensionAmounts({
    ageWife: 35,
    ageHusband: 35, // Assuming same age
    childrenAges: [5],
    survivorSource: {
        avgStdMonthly: MOCK_AVG_STD_MONTHLY,
        months: MOCK_MONTHS,
        useMinashi300: MOCK_USE_MINASHI
    },
    ownSource: {
        avgStdMonthly: 200000,
        months: 100
    },
    oldAgeStart: 65,
    isWifeDeath: false, // Husband died
    mode: 'current'
});
console.log(`With Children: ${formatCurrency(caseA.withChildrenAmount)}`);
console.log(`After Children: ${formatCurrency(caseA.afterChildrenAmount)}`);
console.log(`Pension Types (After): ${caseA.pensionTypesAfterChildren.join(', ')}`);
if (caseA.afterChildrenAmount > 0 && caseA.pensionTypesAfterChildren.includes('中高齢寡婦加算')) {
    console.log('✅ PASS: Wife receives pension + Chukorei Kasan after children leave.');
} else {
    console.log('❌ FAIL: Expected pension + Chukorei Kasan.');
}
console.log('');

// Case B: Husband Risk (Wife dies, Husband 35, Child 5) -> Husband < 55 at death
console.log('--- Case B: Husband Risk (Wife dies, Husband 35, Child 5) ---');
const caseB = calculateSurvivorPensionAmounts({
    ageWife: 35,
    ageHusband: 35,
    childrenAges: [5],
    survivorSource: {
        avgStdMonthly: MOCK_AVG_STD_MONTHLY,
        months: MOCK_MONTHS,
        useMinashi300: MOCK_USE_MINASHI
    },
    ownSource: {
        avgStdMonthly: 200000,
        months: 100
    },
    oldAgeStart: 65,
    isWifeDeath: true, // Wife died
    mode: 'current'
});
console.log(`With Children: ${formatCurrency(caseB.withChildrenAmount)}`);
console.log(`After Children: ${formatCurrency(caseB.afterChildrenAmount)}`);
console.log(`Pension Types (After): ${caseB.pensionTypesAfterChildren.join(', ')}`);

// Verification: Husband < 55 at death means NO survivor employee pension after children leave
if (caseB.afterChildrenAmount === 0) {
    console.log('✅ PASS: Husband < 55 correctly disqualified after children leave.');
} else {
    console.log('❌ FAIL: Husband < 55 should NOT receive pension after children leave.');
}
console.log('');

// Case C: Husband Safe (Wife dies, Husband 56, Child 15) -> Husband > 55 at death
console.log('--- Case C: Husband Safe (Wife dies, Husband 56, Child 15) ---');
const caseC = calculateSurvivorPensionAmounts({
    ageWife: 50,
    ageHusband: 56,
    childrenAges: [15],
    survivorSource: {
        avgStdMonthly: MOCK_AVG_STD_MONTHLY,
        months: MOCK_MONTHS,
        useMinashi300: MOCK_USE_MINASHI
    },
    ownSource: {
        avgStdMonthly: 200000,
        months: 100
    },
    oldAgeStart: 65,
    isWifeDeath: true, // Wife died
    mode: 'current'
});
console.log(`With Children: ${formatCurrency(caseC.withChildrenAmount)}`);
console.log(`After Children: ${formatCurrency(caseC.afterChildrenAmount)}`);
console.log(`Pension Types (After): ${caseC.pensionTypesAfterChildren.join(', ')}`);

// Verification: Husband > 55 at death means he IS eligible (from age 60)
// ageAfterChild will be 56 + (18-15) = 59. So he waits until 60.
// But the amount should be calculated (it might be 0 during 59-60, but the function returns the amount *when eligible* or indicates types)
// Wait, my logic returns '遺族厚生年金（60歳まで停止）' and amount 0 if ageAfterChild < 60.
// But eventually he gets it.
// Let's check pensionTypes.
if (caseC.pensionTypesAfterChildren.some(t => t.includes('遺族厚生年金'))) {
    console.log('✅ PASS: Husband > 55 is eligible (even if suspended until 60).');
} else {
    console.log('❌ FAIL: Husband > 55 should be eligible.');
}
console.log('');

// Case D: Disability Level 1 (Spouse < 65, Child 5)
console.log('--- Case D: Disability Level 1 (Spouse < 65, Child 5) ---');
const caseD = calculateDisabilityPensionAmounts({
    level: 1,
    hasSpouse: true,
    ageSpouse: 35,
    childrenAges: [5],
    avgStdMonthly: MOCK_AVG_STD_MONTHLY,
    months: MOCK_MONTHS,
    useMinashi300: MOCK_USE_MINASHI
});
console.log(`Basic Pension: ${formatCurrency(caseD.basicPension)}`);
console.log(`Employee Pension: ${formatCurrency(caseD.employeePension)}`);
console.log(`Spouse Bonus: ${formatCurrency(caseD.spouseBonus)}`);
console.log(`Total: ${formatCurrency(caseD.total)}`);

// Verification: Level 1 Basic (Standard * 1.25) + Child Addition + Spouse Bonus
// Basic 1 (2024): 1,020,000 (approx, 816000 * 1.25) + 234,800 (Child)
// Employee: Calculation + Spouse Bonus (234,800)
if (caseD.spouseBonus > 0 && caseD.basicPension > 1000000) {
    console.log('✅ PASS: Level 1 calculation looks correct (Spouse Bonus + High Basic).');
} else {
    console.log('❌ FAIL: Level 1 calculation incorrect.');
}
console.log('');

// Case E: Disability Level 2 (Spouse < 65, No children)
console.log('--- Case E: Disability Level 2 (Spouse < 65, No children) ---');
const caseE = calculateDisabilityPensionAmounts({
    level: 2,
    hasSpouse: true,
    ageSpouse: 35,
    childrenAges: [],
    avgStdMonthly: MOCK_AVG_STD_MONTHLY,
    months: MOCK_MONTHS,
    useMinashi300: MOCK_USE_MINASHI
});
console.log(`Basic Pension: ${formatCurrency(caseE.basicPension)}`);
console.log(`Employee Pension: ${formatCurrency(caseE.employeePension)}`);
console.log(`Spouse Bonus: ${formatCurrency(caseE.spouseBonus)}`);
console.log(`Total: ${formatCurrency(caseE.total)}`);

// Verification: Level 2 Basic (Standard) + No Child Addition + Spouse Bonus
// Basic 2 (2024): 816,000
if (caseE.spouseBonus > 0 && Math.abs(caseE.basicPension - 816000) < 10000) {
    console.log('✅ PASS: Level 2 calculation looks correct (Spouse Bonus + Standard Basic).');
} else {
    console.log(`❌ FAIL: Level 2 calculation incorrect. Basic: ${caseE.basicPension}`);
}
console.log('');
