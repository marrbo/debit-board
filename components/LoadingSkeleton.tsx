export default function LoadingSkeleton() {
  return (
    <div className="w-full space-y-4 animate-pulse">
      {/* Cabeçalho da página */}
      <div className="flex items-center justify-between py-2">
        <div className="space-y-2">
          <div className="h-6 w-40 bg-apple-tertiary-light/20 dark:bg-apple-tertiary-dark/20 rounded-md" />
          <div className="h-4 w-64 bg-apple-tertiary-light/10 dark:bg-apple-tertiary-dark/10 rounded-md" />
        </div>
        <div className="h-9 w-32 bg-apple-blue/20 rounded-xl" />
      </div>

      {/* Card da tabela */}
      <div className="w-full bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl overflow-hidden shadow-sm">
        {/* Cabeçalho da tabela */}
        <div className="flex items-center gap-4 px-4 py-3 bg-apple-tertiary-light/10 dark:bg-apple-tertiary-dark/20 border-b border-apple-border-light dark:border-apple-border-dark">
          <div className="h-3 w-24 bg-apple-tertiary-light/30 dark:bg-apple-tertiary-dark/30 rounded" />
          <div className="h-3 w-20 bg-apple-tertiary-light/30 dark:bg-apple-tertiary-dark/30 rounded" />
          <div className="h-3 w-24 bg-apple-tertiary-light/30 dark:bg-apple-tertiary-dark/30 rounded" />
          <div className="h-3 w-48 bg-apple-tertiary-light/30 dark:bg-apple-tertiary-dark/30 rounded" />
          <div className="h-3 w-16 ml-auto bg-apple-tertiary-light/30 dark:bg-apple-tertiary-dark/30 rounded" />
        </div>

        {/* Linhas de skeleton */}
        {Array.from({ length: 5 }).map((_, index) => (
          <div
            key={index}
            className="flex items-center gap-4 px-4 py-4 border-b border-apple-border-light dark:border-apple-border-dark last:border-b-0"
          >
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-apple-blue/10" />
              <div className="h-4 w-40 bg-apple-tertiary-light/20 dark:bg-apple-tertiary-dark/20 rounded" />
            </div>
            <div className="h-3 w-16 bg-apple-tertiary-light/20 dark:bg-apple-tertiary-dark/20 rounded" />
            <div className="h-3 w-20 bg-apple-tertiary-light/20 dark:bg-apple-tertiary-dark/20 rounded" />
            <div className="h-3 w-48 bg-apple-tertiary-light/20 dark:bg-apple-tertiary-dark/20 rounded" />
            <div className="ml-auto flex gap-2">
              <div className="h-7 w-20 bg-apple-blue/20 rounded-xl" />
              <div className="h-7 w-20 bg-apple-tertiary-light/20 dark:bg-apple-tertiary-dark/20 rounded-xl" />
              <div className="h-7 w-20 bg-apple-red/20 rounded-xl" />
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