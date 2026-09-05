interface ProjectStatsCardProps {
  type: 'status' | 'category';
  projectName: string;
  stats: {
    total?: number;
    severity?: Record<string, number>;
    status?: Record<string, number>;
    category?: Record<string, number>;
  };
}

const STATUS_COLORS: Record<string, string> = {
    open: '#007AFF',
    recurring: '#FF9500',
    resolved: '#34C759',
    wont_fix: '#FF3B30'
};



const SEVERITY_COLORS: Record<string, string> = {
  critical: '#ef4444',
  high: '#f59e0b',
  medium: '#3b82f6',
  low: '#10b981',
};

const CATEGORY_COLORS = [
  '#8b5cf6', // roxo
  '#f59e0b', // amarelo
  '#10b981', // verde
  '#3b82f6', // azul
  '#a78bfa', // lilás
  '#e5e7eb', // cinza
];

export default function ProjectStatsCard({ type, projectName, stats }: ProjectStatsCardProps) {
  const total = stats.total || 0;

  const renderBar = (
    data: Record<string, number> | undefined,
    colorMap: Record<string, string> | string[],
    order?: string[]
  ) => {
    if (!data) return null;
    const entries = Object.entries(data);
    if (entries.length === 0) return null;

    const keys = order || Object.keys(data);
    const colors = Array.isArray(colorMap)
      ? colorMap
      : keys.map(k => (colorMap as Record<string, string>)[k] || '#e5e7eb');

    const segments = entries.map(([key, value]) => {
      const color = Array.isArray(colorMap)
        ? colors[Object.keys(data).indexOf(key)] || '#e5e7eb'
        : (colorMap as Record<string, string>)[key] || '#e5e7eb';
      const width = total > 0 ? (value / total) * 100 : 0;
      return { key, value, color, width };
    });

    return (
      <div className="mt-2">
        <div className="flex h-3 w-full rounded-full overflow-hidden bg-gray-200">
          {segments.map(seg => (
            <div
              key={seg.key}
              style={{ width: `${seg.width}%`, backgroundColor: seg.color }}
            />
          ))}
        </div>
        <div className="mt-2 flex flex-wrap gap-2">
          {segments.map(seg => (
            <div key={seg.key} className="flex items-center gap-1 text-xs">
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: seg.color }} />
              <span className="text-apple-tertiary-light dark:text-apple-tertiary-dark">
                {seg.key}
              </span>
              <span className="font-semibold">{seg.value}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (type === 'status') {
    return (
      <div className="bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-sm h-full">
        <h3 className="font-semibold text-apple-label-light dark:text-apple-label-dark truncate">
          {projectName}
        </h3>
        <div className="mt-3 text-3xl font-bold text-apple-label-light dark:text-apple-label-dark">
          {total}
        </div>
        <div className="text-sm text-apple-tertiary-light mt-10 dark:text-apple-tertiary-dark">
          Total de Observations
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium mb-1">Severidade</div>
          {renderBar(stats.severity, SEVERITY_COLORS)}
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium mb-1">Status</div>
          {renderBar(stats.status, STATUS_COLORS, ['open', 'fixed', 'recurring', 'wont_fix'])}
        </div>

        <div className="text-sm text-apple-tertiary-light mt-10 dark:text-apple-tertiary-dark">
          Observations por Categoria
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium mb-1">Categoria</div>
          {renderBar(stats.category, CATEGORY_COLORS)}
        </div>
      </div>
    );
  }

  if (type === 'category') {
    return (
      <div className="bg-white dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl p-4 shadow-sm h-full">
        <h3 className="font-semibold text-apple-label-light dark:text-apple-label-dark truncate">
          {projectName}
        </h3>
        <div className="mt-3 text-3xl font-bold text-apple-label-light dark:text-apple-label-dark">
          {total}
        </div>
        <div className="text-sm text-apple-tertiary-light dark:text-apple-tertiary-dark">
          Observations por Categoria
        </div>

        <div className="mt-4">
          <div className="text-sm font-medium mb-1">Categorias</div>
          {renderBar(stats.category, CATEGORY_COLORS)}
        </div>
      </div>
    );
  }

  return null;
}