
import { calculateSurvivorPensionAmounts } from './app/utils/survivor-pension-logic';
import { PolicyMode } from './app/utils/pension-calc';

// 450万円 / 12 = 37.5万円 -> 標準報酬月額 38万円
const avgStdMonthly = 380000;

const result = calculateSurvivorPensionAmounts({
    ageWife: 32,
    ageHusband: 32,
    childrenAges: [3, 1],
    survivorSource: {
        avgStdMonthly: avgStdMonthly,
        months: 300,
        useMinashi300: true
    },
    ownSource: {
        avgStdMonthly: 250000,
        months: 300
    },
    oldAgeStart: 65,
    isWifeDeath: false,
    mode: 'current' as PolicyMode
});

console.log('--- Survivor Pension Calculation Debug (Income 4.5M -> 380k) ---');
console.log('Avg Std Monthly:', avgStdMonthly);
console.log('Total Annual:', result.total);
console.log('With Children Annual:', result.withChildrenAmount);
console.log('With Children Monthly:', result.withChildrenAmount / 12);
console.log('Breakdown:');
console.log('  Basic Pension:', result.basicPension);
console.log('  Employee Pension:', result.employeePension);
