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
    grid: { left: 40, right: 50, bottom: 40, top: 40 },
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
        axisLabel: { color: '#6b7280' },
        splitLine: { show: false }
      }
    ],
    series: [
      {
        name: 'Weight',
        type: 'bar',
        data: weights,
        itemStyle: { color: '#60a5fa' },
        barMaxWidth: 32
      },
      {
        name: 'Amount',
        type: 'bar',
        yAxisIndex: 1,
        data: amounts,
        itemStyle: { color: '#22c55e' },
        barMaxWidth: 32
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
