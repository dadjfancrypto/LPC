import React from 'react';

export function PensionCup({
    workIncome,
    pensionAmount,
    assetAmount,
    totalRequired,
    label
}: {
    workIncome: number;
    pensionAmount: number;
    assetAmount: number;
    totalRequired: number;
    label: string;
}) {
    const totalIncome = workIncome + pensionAmount + assetAmount;
    const coverageRatio = totalRequired > 0 ? Math.min(100, (totalIncome / totalRequired) * 100) : 100;

    // Scale for visualization (max height 200px represents e.g. 500,000 yen or dynamic max)
    const maxVal = Math.max(totalIncome, totalRequired, 1);
    const scale = (val: number) => (val / maxVal) * 100;

    const workHeight = scale(workIncome);
    const pensionHeight = scale(pensionAmount);
    const assetHeight = scale(assetAmount);
    const requiredHeight = scale(totalRequired);

    return (
        <div className="flex flex-col items-center">
            <h3 className="text-sm font-bold text-slate-400 mb-2">{label}</h3>
            <div className="relative w-32 h-48 bg-slate-800/30 rounded-b-3xl border-b-4 border-x-2 border-slate-600 flex flex-col-reverse overflow-hidden">
                {/* Water Level (Income) */}
                <div className="w-full flex flex-col-reverse transition-all duration-500">
                    {/* Asset Layer (Bottom) */}
                    <div style={{ height: `${assetHeight}%` }} className="w-full bg-emerald-500/80 border-t border-emerald-400/50 relative group">
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-xs text-white font-bold transition-opacity">
                            資産: {(assetAmount / 10000).toFixed(1)}万
                        </div>
                    </div>
                    {/* Pension Layer (Middle) */}
                    <div style={{ height: `${pensionHeight}%` }} className="w-full bg-amber-500/80 border-t border-amber-400/50 relative group">
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-xs text-white font-bold transition-opacity">
                            年金: {(pensionAmount / 10000).toFixed(1)}万
                        </div>
                    </div>
                    {/* Work Layer (Top) */}
                    <div style={{ height: `${workHeight}%` }} className="w-full bg-sky-500/80 border-t border-sky-400/50 relative group">
                        <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 bg-black/50 text-xs text-white font-bold transition-opacity">
                            就労: {(workIncome / 10000).toFixed(1)}万
                        </div>
                    </div>
                </div>

                {/* Required Line */}
                <div
                    className="absolute w-full border-t-2 border-dashed border-rose-400 z-10"
                    style={{ bottom: `${requiredHeight}%` }}
                >
                    <span className="absolute right-0 -top-5 text-xs text-rose-400 font-bold bg-slate-900/80 px-1 rounded">
                        必要: {(totalRequired / 10000).toFixed(1)}万
                    </span>
                </div>
            </div>
            <div className="mt-2 text-center">
                <div className="text-2xl font-bold text-slate-100">
                    {(totalIncome / 10000).toFixed(1)}<span className="text-sm text-slate-400">万円</span>
                </div>
                <div className={`text-xs font-bold ${totalIncome >= totalRequired ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {totalIncome >= totalRequired ? '不足なし' : `不足: ${((totalRequired - totalIncome) / 10000).toFixed(1)}万円`}
                </div>
            </div>
        </div>
    );
}

export function CashFlowTimeline({
    data,
    height = 200
}: {
    data: {
        age: number;
        workIncome: number;
        pensionIncome: number;
        assetIncome: number;
        expenses: number;
    }[];
    height?: number;
}) {
    if (!data || data.length === 0) return null;

    const maxVal = Math.max(
        ...data.map(d => d.workIncome + d.pensionIncome + d.assetIncome),
        ...data.map(d => d.expenses)
    ) * 1.1; // 10% padding

    const width = 100; // 100%
    const xStep = width / (data.length - 1);

    // Points for expense line
    const expensePoints = data.map((d, i) => {
        const x = i * xStep;
        const y = height - (d.expenses / maxVal) * height;
        return `${x},${y}`;
    }).join(' ');

    // SVG Paths for stacked areas
    // We will use rects for bars to make it "Staircase" like, or path for smooth area?
    // User said "Staircase Graph" and "Stacked bar chart".
    // Let's use Rects for bars.

    return (
        <div className="w-full h-full relative">
            <svg width="100%" height={height} viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" className="overflow-visible">
                {/* Bars */}
                {data.map((d, i) => {
                    const x = i * xStep;
                    const barWidth = xStep * 0.9; // Slight gap

                    const assetH = (d.assetIncome / maxVal) * height;
                    const pensionH = (d.pensionIncome / maxVal) * height;
                    const workH = (d.workIncome / maxVal) * height;

                    const assetY = height - assetH;
                    const pensionY = assetY - pensionH;
                    const workY = pensionY - workH;

                    return (
                        <g key={i}>
                            {/* Asset */}
                            <rect x={`${x}%`} y={assetY} width={`${barWidth}%`} height={assetH} fill="#10b981" opacity="0.6" />
                            {/* Pension */}
                            <rect x={`${x}%`} y={pensionY} width={`${barWidth}%`} height={pensionH} fill="#f59e0b" opacity="0.6" />
                            {/* Work */}
                            <rect x={`${x}%`} y={workY} width={`${barWidth}%`} height={workH} fill="#0ea5e9" opacity="0.6" />

                            {/* Shortfall Highlight (Red Area) */}
                            {d.expenses > (d.assetIncome + d.pensionIncome + d.workIncome) && (
                                <rect
                                    x={`${x}%`}
                                    y={height - (d.expenses / maxVal) * height}
                                    width={`${barWidth}%`}
                                    height={(d.expenses - (d.assetIncome + d.pensionIncome + d.workIncome)) / maxVal * height}
                                    fill="#f43f5e"
                                    opacity="0.3"
                                />
                            )}
                        </g>
                    );
                })}

                {/* Expense Line */}
                <polyline
                    points={data.map((d, i) => `${i * (100 / (data.length - 1))},${height - (d.expenses / maxVal) * height}`).join(' ')}
                    fill="none"
                    stroke="#f43f5e"
                    strokeWidth="2"
                    vectorEffect="non-scaling-stroke"
                />
            </svg>

            {/* X Axis Labels (Every 5 years) */}
            <div className="absolute bottom-0 w-full flex justify-between text-[10px] text-slate-500 transform translate-y-full pt-1">
                {data.filter((_, i) => i % 5 === 0).map((d, i) => (
                    <span key={i} style={{ left: `${(data.indexOf(d) / (data.length - 1)) * 100}%`, position: 'absolute' }}>
                        {d.age}歳
                    </span>
                ))}
            </div>
        </div>
    );
}
