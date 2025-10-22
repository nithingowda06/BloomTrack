import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';

export interface SellerLite {
  id: string;
  name: string;
  amount: number;
  kg: number;
}

interface AnalyticsBarProps {
  sellers: SellerLite[];
  topN?: number;
}

const AnalyticsBar: React.FC<AnalyticsBarProps> = ({ sellers, topN = 10 }) => {
  const { names, weights, amounts, hasData } = useMemo(() => {
    const sorted = [...sellers]
      .sort((a, b) => (Number(b.kg) + Number(b.amount)) - (Number(a.kg) + Number(a.amount)))
      .slice(0, topN);

    const names = sorted.map(s => (s.name?.length > 12 ? s.name.slice(0, 12) + '…' : s.name));
    const weights = sorted.map(s => Number(s.kg) || 0);
    const amounts = sorted.map(s => Number(s.amount) || 0);
    return { names, weights, amounts, hasData: sorted.length > 0 };
  }, [sellers, topN]);

  const option = useMemo(() => ({
    tooltip: {
      trigger: 'axis',
      axisPointer: { type: 'shadow' },
      formatter: (params: any[]) => {
        const lines = params.map(p => {
          if (p.seriesName === 'Weight') return `${p.marker} ${p.seriesName}: ${Number(p.value).toFixed(2)} kg`;
          return `${p.marker} ${p.seriesName}: ₹${Number(p.value).toFixed(2)}`;
        });
        return `${params?.[0]?.axisValueLabel || ''}<br/>${lines.join('<br/>')}`;
      }
    },
    legend: {
      data: ['Weight', 'Amount']
    },
    grid: { left: 48, right: 56, bottom: 64, top: 32 },
    dataZoom: [
      { type: 'inside', start: 0, end: 100 },
      { type: 'slider', height: 18, bottom: 16 }
    ],
    xAxis: {
      type: 'category',
      data: names,
      axisLabel: { color: '#6b7280', rotate: 0 }
    },
    yAxis: [
      {
        type: 'value',
        name: 'kg',
        axisLabel: { color: '#6b7280' },
        splitLine: { show: true }
      },
      {
        type: 'value',
        name: '₹',
        axisLabel: {
          color: '#6b7280',
          formatter: (v: number) => `₹${v}`
        },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'Weight',
        type: 'bar',
        data: weights,
        itemStyle: {
          color: new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#93c5fd' },
            { offset: 1, color: '#3b82f6' }
          ])
        },
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => `${Number(p.value).toFixed(1)} kg`,
          color: '#6b7280'
        },
        barMaxWidth: 36,
        emphasis: { focus: 'series' }
      },
      {
        name: 'Amount',
        type: 'bar',
        yAxisIndex: 1,
        data: amounts,
        itemStyle: {
          color: new (echarts as any).graphic.LinearGradient(0, 0, 0, 1, [
            { offset: 0, color: '#86efac' },
            { offset: 1, color: '#16a34a' }
          ])
        },
        label: {
          show: true,
          position: 'top',
          formatter: (p: any) => `₹${Number(p.value).toFixed(0)}`,
          color: '#6b7280'
        },
        barMaxWidth: 36,
        emphasis: { focus: 'series' }
      }
    ]
  }), [names, weights, amounts]);

  return (
    <div className="surface-card p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-3">Analytics (Top {Math.min(topN, sellers.length)})</h3>
      {!hasData ? (
        <div className="text-sm text-muted-foreground">No data</div>
      ) : (
        <ReactECharts
          option={option}
          echarts={echarts as any}
          style={{ height: 420, width: '100%' }}
          opts={{ renderer: 'canvas' }}
        />
      )}
    </div>
  );
};

export default AnalyticsBar;
