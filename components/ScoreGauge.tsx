'use client';

interface ScoreGaugeProps {
  score: number; // 0-100
  size?: number;
}

function getSeverityLabel(score: number): string {
  if (score >= 90) return 'Critical';
  if (score >= 70) return 'High Risk';
  if (score >= 40) return 'Medium Risk';
  if (score >= 20) return 'Low Risk';
  return 'Info';
}

export default function ScoreGauge({ score, size = 90 }: ScoreGaugeProps) {
  const clampedScore = Math.min(100, Math.max(0, score));
  const severityLabel = getSeverityLabel(clampedScore);

  // Configuração do arco semicircular (180°)
  const cx = 18;
  const cy = 18;
  const r = 15.9155;

  const startAngle = -180;
  const endAngle = 0;
  const totalAngle = endAngle - startAngle;

  // Segmentos fixos com cores (verde, azul, laranja, vermelho)
  const segments = [
    { from: 0, to: 39, color: '#22c55e' },
    { from: 40, to: 69, color: '#3b82f6' },
    { from: 70, to: 89, color: '#f97316' },
    { from: 90, to: 100, color: '#ef4444' },
  ];

  // Função para converter ângulo (graus) em ponto (x,y) no viewBox
  const pointAt = (angle: number) => {
    const rad = (angle * Math.PI) / 180;
    return {
      x: cx + r * Math.cos(rad),
      y: cy + r * Math.sin(rad),
    };
  };

  // Gera os arcos de cada segmento (sempre completos, pois o fundo é cinza)
  const arcs = segments.map((seg) => {
    const a1 = startAngle + (seg.from / 100) * totalAngle;
    const a2 = startAngle + (seg.to / 100) * totalAngle;
    const p1 = pointAt(a1);
    const p2 = pointAt(a2);
    return {
      d: `M ${p1.x} ${p1.y} A ${r} ${r} 0 0 1 ${p2.x} ${p2.y}`,
      color: seg.color,
    };
  });

  // Indicador branco na posição do score
  const indicatorAngle = startAngle + (clampedScore / 100) * totalAngle;
  const indicatorPoint = pointAt(indicatorAngle);

  return (
    <div className="relative scale-150 flex items-center justify-center" style={{ width: size, height: size }}>
      <svg viewBox="0 0 36 36" width={size} height={size}>
        {/* Fundo cinza (arc completo) */}
        <path
          d={`M ${pointAt(startAngle).x} ${pointAt(startAngle).y} A ${r} ${r} 0 0 1 ${pointAt(endAngle).x} ${pointAt(endAngle).y}`}
          fill="none"
          stroke="#374151"
          strokeWidth="3"
          strokeLinecap="round"
        />
        {/* Segmentos coloridos */}
        {arcs.map((arc, idx) => (
          <path
            key={idx}
            d={arc.d}
            fill="none"
            stroke={arc.color}
            strokeWidth="3"
            strokeLinecap="butt"
          />
        ))}
        {/* Indicador branco */}
        <circle
          cx={indicatorPoint.x}
          cy={indicatorPoint.y}
          r="1.5"
          fill="#ffffff"
          stroke="#0d1117"
          strokeWidth="0.5"
        />
      </svg>

      {/* Texto central */}
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-bold text-white" style={{ fontSize: size * 0.28 }}>
          {clampedScore}
        </span>
        <span className="text-[10px] text-gray-300">{severityLabel}</span>
      </div>
    </div>
  );
}