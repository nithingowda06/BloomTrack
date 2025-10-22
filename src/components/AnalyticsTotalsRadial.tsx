import React, { useMemo, useRef, useState } from 'react';
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
  show?: 'both' | 'amount' | 'weight';
}

// A more unique totals visualization using concentric radial bars (polar coordinates)
const AnalyticsTotalsRadial: React.FC<AnalyticsTotalsRadialProps> = ({ sellers, title = 'Totals', show: showProp = 'both' }) => {
  const [show, setShow] = useState<'both' | 'amount' | 'weight'>(showProp);
  const chartRef = useRef<ReactECharts | null>(null);
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
    animation: true,
    animationDuration: 800,
    animationEasing: 'cubicOut',
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
      data: show === 'both' ? ['Total Weight', 'Total Amount'] : (show === 'amount' ? ['Total Amount'] : ['Total Weight']),
      z: 10,
      axisLine: { show: false },
      axisTick: { show: false },
      axisLabel: { show: true, color: '#6b7280' }
    },
    grid: {},
    series: [
      ...(show !== 'weight' ? [{
        name: 'Total Amount',
        type: 'bar',
        coordinateSystem: 'polar',
        roundCap: true,
        barWidth: 28,
        data: show === 'both' ? [0, totalAmount] : [totalAmount],
        itemStyle: {
          color: new (echarts as any).graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#86efac' },
            { offset: 1, color: '#16a34a' }
          ]),
          shadowBlur: 6,
          shadowColor: 'rgba(22, 163, 74, 0.25)'
        }
      }] : []),
      ...(show !== 'amount' ? [{
        name: 'Total Weight',
        type: 'bar',
        coordinateSystem: 'polar',
        roundCap: true,
        barWidth: 28,
        data: show === 'both' ? [totalKg, 0] : [totalKg],
        itemStyle: {
          color: new (echarts as any).graphic.LinearGradient(0, 0, 1, 0, [
            { offset: 0, color: '#93c5fd' },
            { offset: 1, color: '#3b82f6' }
          ]),
          shadowBlur: 6,
          shadowColor: 'rgba(59, 130, 246, 0.25)'
        }
      }] : []),
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
  }), [show, totalAmount, totalKg, maxVal]);

  const handleExport = () => {
    const inst = chartRef.current?.getEchartsInstance?.();
    if (!inst) return;
    const url = inst.getDataURL({ type: 'png', pixelRatio: 2, backgroundColor: '#ffffff' });
    const a = document.createElement('a');
    a.href = url;
    a.download = 'analytics_totals.png';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <div className="surface-card p-4 rounded-lg">
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-lg font-semibold">{title}</h3>
        <div className="flex gap-2">
          <div className="inline-flex rounded-md overflow-hidden border">
            <button className={`px-3 py-1 text-sm ${show==='both'?'bg-primary text-primary-foreground':'bg-background'}`} onClick={()=>setShow('both')}>Both</button>
            <button className={`px-3 py-1 text-sm ${show==='amount'?'bg-primary text-primary-foreground':'bg-background'}`} onClick={()=>setShow('amount')}>Amount</button>
            <button className={`px-3 py-1 text-sm ${show==='weight'?'bg-primary text-primary-foreground':'bg-background'}`} onClick={()=>setShow('weight')}>Weight</button>
          </div>
          <button onClick={handleExport} className="px-3 py-1 text-sm border rounded-md">Export PNG</button>
        </div>
      </div>
      <ReactECharts ref={chartRef as any} option={option as any} echarts={echarts as any} style={{ height: 400, width: '100%' }} />
    </div>
  );
};

export default AnalyticsTotalsRadial;
