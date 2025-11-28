
import { proportionAnnual, kisoAnnualByCount } from './app/utils/pension-calc';

// 450万円 / 12 = 37.5万円 -> 標準報酬月額 38万円
const avgStdMonthly = 380000;
const months = 300;
const useMinashi = true;

const kousei = proportionAnnual(avgStdMonthly, months, useMinashi);
const kiso = kisoAnnualByCount(2); // Assuming 2 children

console.log('--- Necessary Coverage Calculation Debug ---');
console.log('Avg Std Monthly:', avgStdMonthly);
console.log('Months:', months);
console.log('Kousei (Employee Pension):', kousei);
console.log('Kiso (Basic Pension):', kiso);
console.log('Total Annual:', kousei + kiso);
console.log('Total Monthly:', (kousei + kiso) / 12);
