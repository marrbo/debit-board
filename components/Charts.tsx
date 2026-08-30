// components/Charts.tsx
'use client';

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
import type { ChartDataPoint } from '@/lib/types';

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

type ChartType = 'bar' | 'line' | 'pie' | 'project' | 'project-detail' | 'stacked-bar';

interface ChartsProps {
  data?: ChartDataPoint[];
  datasets?: any[];
  labels?: string[];
  type: ChartType;
  colors?: string[];
  onSliceClick?: (label: string) => void;
}

export default function Charts({ data, datasets, labels, type, colors, onSliceClick }: ChartsProps) {
  const processed = useMemo(() => {
    // Caso múltiplos datasets (linha ou barra empilhada)
    if (datasets && datasets.length > 0) {
      return {
        type: type === 'stacked-bar' ? 'bar' as const : 'line' as const,
        labels: labels || datasets[0]?.labels || [],
        datasets: datasets.map(ds => ({
          ...ds,
          spanGaps: true,
          // Para barras empilhadas, garantir stack
          stack: ds.stack || 'stack0',
        })),
        data: [],
      };
    }

    // Barras coloridas individuais (project-detail)
    if (data && type === 'project-detail') {
      return {
        type: 'bar' as const,
        labels: data.map(d => d.label),
        datasets: [{
          label: 'Ocorrências',
          data: data.map(d => d.value),
          backgroundColor: data.map(d => (d as any).color || '#007AFF'),
          borderColor: data.map(d => (d as any).color || '#007AFF'),
          borderWidth: 2,
        }],
        data: [],
      };
    }

    // Pie
    if (data && type === 'pie') {
      return {
        type: 'pie' as const,
        labels: data.map(d => d.label),
        datasets: [{
          data: data.map(d => d.value),
          backgroundColor: colors || ['#007AFF', '#AF52DE', '#FF9500', '#34C759', '#FF3B30', '#FF2D55', '#64D2FF', '#FFCC00', '#5856D6', '#30B0C0'],
          borderColor: '#1C1C1E',
          borderWidth: 1,
          hoverOffset: 20,
          hoverBorderWidth: 0,
        }],
        data: [],
      };
    }

    // Linha simples
    if (data && type === 'line') {
      return {
        type: 'line' as const,
        labels: data.map(d => d.label),
        datasets: [{
          label: 'Evolução',
          data: data.map(d => d.value),
          backgroundColor: colors?.[0] || '#007AFF',
          borderColor: colors?.[0] || '#007AFF',
          borderWidth: 2,
          tension: 0.3,
        }],
        data: [],
      };
    }

    // Fallback barra
    return {
      type: 'bar' as const,
      labels: data?.map(d => d.label) || [],
      datasets: [{
        label: 'Ocorrências',
        data: data?.map(d => d.value) || [],
        backgroundColor: '#007AFF',
        borderColor: '#007AFF',
        borderWidth: 2,
      }],
      data: [],
    };
  }, [data, datasets, labels, type, colors]);

  const options = useMemo(() => {
    const base: any = {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'bottom' as const,
          labels: { color: '#8E8E93', usePointStyle: true, boxWidth: 8 },
        },
        tooltip: {
          mode: 'index',
          intersect: false,
        },
      },
    };

    if (processed.type !== 'pie') {
      base.scales = {
        y: {
          beginAtZero: true,
          grid: { color: '#D1D1D6' },
          ticks: { color: '#8E8E93' },
          stacked: type === 'stacked-bar',
        },
        x: {
          grid: { display: false },
          ticks: { color: '#8E8E93' },
          stacked: type === 'stacked-bar',
        },
      };
    }

    if (processed.type === 'pie' && onSliceClick) {
      base.onHover = (event: any, elements: any) => {
        event.native.target.style.cursor = elements.length > 0 ? 'pointer' : 'default';
      };
      base.onClick = (elements: any) => {
        if (elements.length > 0) {
          const index = elements[0].index;
          const label = processed.labels[index];
          if (label) onSliceClick(label);
        }
      };
    }

    return base;
  }, [processed, onSliceClick, type]);

  if (processed.type === 'line') {
    return <Line data={processed} options={options} />;
  }

  if (processed.type === 'pie') {
    return <Pie data={processed} options={options} />;
  }

  return <Bar data={processed} options={options} />;
}