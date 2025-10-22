import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

interface SellerLiteTotals {
  id: string;
  amount: number;
  kg: number;
}

interface AnalyticsTotalsRadialProps {
  sellers: SellerLiteTotals[];
  title?: string;
}

// A more unique totals visualization using concentric radial bars (polar coordinates)
const AnalyticsTotalsRadial: React.FC<AnalyticsTotalsRadialProps> = ({ sellers, title = 'Totals' }) => {
  const { totalAmount, totalKg, maxVal } = useMemo(() => {
    const amt = sellers.reduce((s, x) => s + Number(x.amount || 0), 0);
    const kg = sellers.reduce((s, x) => s + Number(x.kg || 0), 0);
    const maxVal = Math.max(amt, kg, 1);
    return { totalAmount: amt, totalKg: kg, maxVal };
  }, [sellers]);

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'item',
      formatter: (p: any) => {
        const isAmt = p.name === 'Total Amount';
        const v = Number(p.value) || 0;
        return `${p.marker} ${p.name}: ${isAmt ? '₹' + v.toFixed(2) : v.toFixed(2) + ' kg'}`;
      }
    },
    title: {
      text: title,
      left: 'center',
      top: 8,
      textStyle: { fontWeight: 600 }
    },
    polar: {
      radius: ['24%', '80%']
    },
    angleAxis: {
      max: maxVal,
      startAngle: 90,
      clockwise: false,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: false },
      splitLine: { show: false }
    },
    radiusAxis: {
      type: 'category',
      data: ['Total Weight', 'Total Amount'], // inner to outer order
      z: 10,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: true, color: '#6b7280' }
    },
    grid: {},
    series: [
      {
        name: 'Total Amount',
        type: 'bar',
        coordinateSystem: 'polar',
        roundCap: true,
        barWidth: 28,
        data: [0, totalAmount], // aligned with radiusAxis categories
        itemStyle: {
          color: new (echarts as any).graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#86efac' },
            { offset: 1, color: '#16a34a' }
          ]),
          shadowBlur: 6,
          shadowColor: 'rgba(22, 163, 74, 0.25)'
        }
      },
      {
        name: 'Total Weight',
        type: 'bar',
        coordinateSystem: 'polar',
        roundCap: true,
        barWidth: 28,
        data: [totalKg, 0],
        itemStyle: {
          color: new (echarts as any).graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#93c5fd' },
            { offset: 1, color: '#3b82f6' }
          ]),
          shadowBlur: 6,
          shadowColor: 'rgba(59, 130, 246, 0.25)'
        }
      },
      // Center labels
      {
        type: 'pie',
        radius: ['0%', '18%'],
        center: ['50%', '50%'],
        label: {
          show: true,
          position: 'center',
          formatter: () => `₹${totalAmount.toFixed(0)}\n${totalKg.toFixed(1)} kg`,
          rich: {
            a: { fontSize: 16, fontWeight: 700 },
          }
        },
        data: [{ value: 1, name: '' }],
        itemStyle: { color: 'transparent' }
      }
    ]
  }), [title, totalAmount, totalKg, maxVal]);

  return (
    <div className="surface-card p-4 rounded-lg">
      <ReactECharts option={option as any} echarts={echarts as any} style={{ height: 400, width: '100%' }} />
    </div>
  );
};

export default AnalyticsTotalsRadial;
