import React, { useMemo } from 'react';
import ReactECharts from 'echarts-for-react';
import * as echarts from 'echarts';
import 'echarts-gl';

export interface SellerLite {
  id: string;
  name: string;
  amount: number;
  kg: number;
}

interface Analytics3DProps {
  sellers: SellerLite[];
  topN?: number;
}

const Analytics3D: React.FC<Analytics3DProps> = ({ sellers, topN = 10 }) => {
  const { xCats, yCats, dataPoints, maxValue } = useMemo(() => {
    const sorted = [...sellers]
      .sort((a, b) => (Number(b.kg) + Number(b.amount)) - (Number(a.kg) + Number(a.amount)))
      .slice(0, topN);

    const xCats = sorted.map(s => (s.name?.length > 10 ? s.name.slice(0, 10) + '…' : s.name));
    const yCats = ['Weight (kg)', 'Amount (₹)'];

    const dataPoints: Array<[number, number, number]> = [];
    let maxValue = 0;

    sorted.forEach((s, xi) => {
      const w = Number(s.kg) || 0;
      const a = Number(s.amount) || 0;
      dataPoints.push([xi, 0, w]);
      dataPoints.push([xi, 1, a]);
      maxValue = Math.max(maxValue, w, a);
    });

    return { xCats, yCats, dataPoints, maxValue };
  }, [sellers, topN]);

  const option = useMemo(() => ({
    tooltip: {
      formatter: (params: any) => {
        const { value } = params; // [x,y,z]
        const seller = xCats[value[0]];
        const metric = yCats[value[1]];
        const v = value[2];
        return `<div style="min-width:140px">
          <div style="font-weight:600;margin-bottom:4px">${seller}</div>
          <div>${metric}: ${value[1] === 0 ? v.toFixed(2) + ' kg' : '₹' + Number(v).toFixed(2)}</div>
        </div>`;
      }
    },
    visualMap: {
      max: maxValue || 1,
      inRange: {
        color: ['#93c5fd', '#60a5fa', '#2563eb']
      },
      calculable: false,
      show: false
    },
    grid3D: {
      boxWidth: 200,
      boxDepth: 80,
      viewControl: {
        projection: 'perspective',
        autoRotate: false,
        distance: 200
      },
      light: {
        main: { intensity: 1.2, shadow: true },
        ambient: { intensity: 0.6 }
      }
    },
    xAxis3D: {
      type: 'category',
      data: xCats,
      name: 'Sellers',
      nameTextStyle: { color: '#6b7280' },
      axisLabel: { color: '#6b7280' }
    },
    yAxis3D: {
      type: 'category',
      data: yCats,
      name: '',
      axisLabel: { color: '#6b7280' }
    },
    zAxis3D: {
      type: 'value',
      axisLabel: { color: '#6b7280' }
    },
    series: [{
      type: 'bar3D',
      shading: 'lambert',
      data: dataPoints.map(d => ({ value: d })),
      label: {
        show: false,
        formatter: (p: any) => (p.value[1] === 0 ? `${p.value[2].toFixed(1)} kg` : `₹${Number(p.value[2]).toFixed(0)}`),
      },
      emphasis: {
        label: { show: true },
        itemStyle: { color: '#22c55e' }
      }
    }]
  }), [xCats, yCats, dataPoints, maxValue]);

  return (
    <div className="surface-card p-4 rounded-lg">
      <h3 className="text-lg font-semibold mb-3">3D Analytics (Top {Math.min(topN, sellers.length)})</h3>
      <div className="text-xs text-muted-foreground mb-2">Weight first, then Amount for each seller</div>
      <ReactECharts
        option={option}
        echarts={echarts as any}
        style={{ height: 420, width: '100%' }}
        opts={{ renderer: 'canvas' }}
      />
    </div>
  );
};

export default Analytics3D;
