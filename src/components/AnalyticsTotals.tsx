import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

export interface SellerLiteTotals {
  id: string;
  amount: number;
  kg: number;
}

interface AnalyticsTotalsProps {
  sellers: SellerLiteTotals[];
  title?: string;
}

const AnalyticsTotals: React.FC<AnalyticsTotalsProps> = ({ sellers, title = 'Totals' }) => {
  const { totalAmount, totalKg } = useMemo(() => {
    const amt = sellers.reduce((s, x) => s + Number(x.amount || 0), 0);
    const kg = sellers.reduce((s, x) => s + Number(x.kg || 0), 0);
    return { totalAmount: amt, totalKg: kg };
  }, [sellers]);

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any[]) => {
        const p = params?.[0];
        if (!p) return '';
        const name = p.axisValue as string;
        const isAmt = name.toLowerCase().includes('amount');
        const v = Number(p.value) || 0;
        return `${name}: ${isAmt ? '₹' + v.toFixed(2) : v.toFixed(2) + ' kg'}`;
      }
    },
    grid: { left: 56, right: 40, bottom: 40, top: 24 },
    xAxis: {
      type: 'category',
      data: ['Total Amount', 'Total Weight'],
      axisLabel: { color: '#6b7280' }
    },
    yAxis: {
      type: 'value',
      axisLabel: { color: '#6b7280' },
      splitLine: { show: true }
    },
    series: [
      {
        type: 'bar',
        data: [totalAmount, totalKg],
        barWidth: 56,
        itemStyle: {
          color: (params: any) => {
            const idx = params.dataIndex;
            if (idx === 0) {
              return new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
                { offset: 0, color: '#86efac' },
                { offset: 1, color: '#16a34a' }
              ]);
            }
            return new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
              { offset: 0, color: '#93c5fd' },
              { offset: 1, color: '#3b82f6' }
            ]);
          }
        },
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => {
            const isAmt = p.dataIndex === 0;
            const v = Number(p.value) || 0;
            return isAmt ? `₹${v.toFixed(2)}` : `${v.toFixed(2)} kg`;
          },
          color: '#6b7280'
        }
      }
    ]
  }), [totalAmount, totalKg]);

  return (
    <div className="surface-card p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-3">{title}</h3>
      <ReactECharts option={option} echarts={echarts as any} style={{ height: 360, width: '100%' }} />
    </div>
  );
};

export default AnalyticsTotals;
