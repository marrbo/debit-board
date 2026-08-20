// components/Charts.tsx
'use client';

import { SearchItem } from '@/lib/types';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar, Line, Pie } from 'react-chartjs-2';
import { useMemo } from 'react';

ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  LineElement,
  PointElement,
  ArcElement,
  Title,
  Tooltip,
  Legend
);

type ChartDataPoint = { label: string; value: number };

interface ChartsProps {
  data: SearchItem[] | ChartDataPoint[];
  type: 'bar' | 'line' | 'pie' | 'project' | 'project-repo';
}

export default function Charts({ data, type }: ChartsProps) {
  const processed = useMemo(() => {
    const isSearchItemArray = (arr: any[]): arr is SearchItem[] => {
      return arr.length > 0 && 'hitCount' in arr[0];
    };

    if (isSearchItemArray(data)) {
      if (type === 'project') {
        const map = new Map<string, number>();
        data.forEach((item) => {
          const proj = item.project || 'Sem Projeto';
          map.set(proj, (map.get(proj) || 0) + (item.hitCount || 0));
        });
        return { 
          type: 'bar' as const, 
          data: Array.from(map.entries()).map(([l, v]) => ({ label: l, value: v })) 
        };
      }
      return { type: 'bar' as const, data: [] };
    } else {
      return { 
        type: (type === 'line' ? 'line' : type === 'pie' ? 'pie' : 'bar') as 'bar' | 'line' | 'pie', 
        data: data as ChartDataPoint[] 
      };
    }
  }, [data, type]);

  const chartData = {
    labels: processed.data.map(d => d.label),
    datasets: [
      {
        label: processed.type === 'line' ? 'Evolução' : processed.type === 'pie' ? 'Distribuição' : 'Ocorrências',
        data: processed.data.map(d => d.value),
        backgroundColor: processed.type === 'pie' 
          ? ['#007AFF', '#AF52DE', '#FF9500', '#34C759', '#FF3B30', '#FF2D55', '#64D2FF', '#FFCC00', '#5856D6', '#30B0C0']
          : '#007AFF',
        borderColor: processed.type === 'pie' ? '#1C1C1E' : '#007AFF',
        borderWidth: processed.type === 'pie' ? 2 : 2,
        tension: 0.3,
      }
    ]
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: {
        position: 'bottom' as const,
        labels: { color: '#8E8E93', usePointStyle: true, boxWidth: 8 },
      },
    },
    scales: processed.type === 'pie' ? undefined : {
      y: { beginAtZero: true, grid: { color: '#D1D1D6' }, ticks: { color: '#8E8E93' } },
      x: { grid: { display: false }, ticks: { color: '#8E8E93' } },
    },
  };

  if (processed.type === 'line') {
    return <Line data={chartData} options={options} />;
  }
  if (processed.type === 'pie') {
    return <Pie data={chartData} options={options} />;
  }
  return <Bar data={chartData} options={options} />;
}