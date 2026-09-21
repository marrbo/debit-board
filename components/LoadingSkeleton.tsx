export default function LoadingSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-surface/20 dark:bg-elevated/20 rounded-md" />
          <div className="h-4 w-64 bg-surface/10 dark:bg-apple-tertiary-dark/10 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-brand/20 rounded-lg" />
      </div>

      {/* Card da tabela */}
      <div className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg overflow-hidden shadow-sm hover:drop-shadow-lg">
        {/* Cabeçalho da tabela */}
        <div className="flex items-center gap-4 px-4 py-3 bg-surface/10 dark:bg-elevated/20 border-b border-default dark:border-strong">
          <div className="h-3 w-24 bg-surface/30 dark:bg-elevated/30 rounded" />
          <div className="h-3 w-20 bg-surface/30 dark:bg-elevated/30 rounded" />
          <div className="h-3 w-24 bg-surface/30 dark:bg-elevated/30 rounded" />
          <div className="h-3 w-48 bg-surface/30 dark:bg-elevated/30 rounded" />
          <div className="h-3 w-16 ml-auto bg-surface/30 dark:bg-elevated/30 rounded" />
        </div>

        {/* Linhas de skeleton */}
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 px-4 py-4 border-b border-default dark:border-strong last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand/10" />
              <div className="h-4 w-40 bg-surface/20 dark:bg-elevated/20 rounded" />
            </div>
            <div className="h-3 w-16 bg-surface/20 dark:bg-elevated/20 rounded" />
            <div className="h-3 w-20 bg-surface/20 dark:bg-elevated/20 rounded" />
            <div className="h-3 w-48 bg-surface/20 dark:bg-elevated/20 rounded" />
            <div className="ml-auto flex gap-2">
              <div className="h-7 w-20 bg-brand/20 rounded-lg" />
              <div className="h-7 w-20 bg-surface/20 dark:bg-elevated/20 rounded-lg" />
              <div className="h-7 w-20 bg-apple-red/20 rounded-lg" />
            </div>
          </div>
        ))}
      </div>

      {/* Skeleton do modal (opcional) */}
      <div className="hidden">
        {/* Pode adicionar um modal skeleton se necessário */}
      </div>
    </div>
  );
}
