import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';
import { useState } from 'react';

interface PaginationInfoProps {
  currentPage: number;
  totalPages: number;
  totalItems: number;
  pageSize: number;
  onPageChange: (page: number) => void;
  onPageSizeChange?: (size: number) => void;
  className?: string;
}

// Gera a lista de páginas (números e reticências) sem duplicações
function getPaginationItems(currentPage: number, totalPages: number): (number | '...')[] {
  if (totalPages <= 0) return [1];
  if (totalPages <= 7) {
    return Array.from({ length: totalPages }, (_, i) => i + 1);
  }

  const items: (number | '...')[] = [1];

  // Intervalo de 3 páginas ao redor da atual
  const start = Math.max(2, currentPage - 1);
  const end = Math.min(totalPages - 1, currentPage + 1);

  // Adiciona reticências se houver gap entre 1 e start
  if (start > 2) {
    items.push('...');
  }

  // Adiciona as páginas do intervalo
  for (let i = start; i <= end; i++) {
    items.push(i);
  }

  // Adiciona reticências se houver gap entre end e totalPages
  if (end < totalPages - 1) {
    items.push('...');
  }

  // Sempre inclui a última página
  items.push(totalPages);

  // Remove duplicatas (caso algum número se repita)
  const unique: (number | '...')[] = [];
  for (const item of items) {
    if (unique.length > 0 && unique[unique.length - 1] === item) continue;
    unique.push(item);
  }

  return unique;
}

export function PaginationInfo({
  currentPage,
  totalPages,
  totalItems,
  pageSize,
  onPageChange,
  onPageSizeChange,
  className = '',
}: PaginationInfoProps) {
  const [inputPage, setInputPage] = useState({ page: currentPage, value: '' });
  const inputValue = inputPage.page === currentPage ? inputPage.value : '';

  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);

  const handlePageInput = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      const parsed = parseInt(inputValue, 10);
      if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
        onPageChange(parsed);
      }
      setInputPage({ page: currentPage, value: '' });
    }
  };

  // Itens reais da paginação
  const paginationItems = getPaginationItems(currentPage, totalPages);

  // Preenche com itens vazios até ter 7 posições (para largura fixa)
  const items: (number | '...' | null)[] = [...paginationItems];
  while (items.length < 7) {
    items.push(null);
  }

  return (
    <div className={`flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 text-xs text-apple-tertiary-light ${className}`}>
      <span className="whitespace-nowrap">
        Exibindo {start} – {end} de {totalItems}
      </span>

      <div className="flex items-center gap-2 flex-wrap">
        {/* Seletor de itens por página */}
        {onPageSizeChange && (
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(Number(e.target.value))}
            className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-lg px-2 py-1 text-xs"
            aria-label="Itens por página"
          >
            {[10, 20, 50, 100].map((size) => (
              <option key={size} value={size}>
                {size} / página
              </option>
            ))}
          </select>
        )}

        {/* Navegação com larguras fixas */}
        <div className="flex items-center gap-1">
          {/* Primeira página */}
          <button
            onClick={() => onPageChange(1)}
            disabled={currentPage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-apple-border-light/30 transition-colors disabled:opacity-50"
            aria-label="Primeira página"
          >
            <ChevronsLeft className="w-4 h-4" />
          </button>

          {/* Anterior */}
          <button
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-apple-border-light/30 transition-colors disabled:opacity-50"
            aria-label="Página anterior"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>

          {/* Números - sempre 7 posições com largura fixa */}
          <div className="flex items-center">
            {items.map((item, index) => {
              if (item === null) {
                return <div key={`empty-${index}`} className="w-10 h-8" />;
              }
              if (item === '...') {
                return (
                  <span
                    key={`dots-${index}`}
                    className="w-10 h-8 flex items-center justify-center text-sm select-none"
                  >
                    …
                  </span>
                );
              }
              return (
                <button
                  key={`page-${item}`}
                  onClick={() => onPageChange(item)}
                  className={`w-10 h-8 flex items-center justify-center rounded-lg text-xs font-medium transition-colors ${
                    currentPage === item
                      ? 'bg-apple-blue/10 text-apple-blue font-bold'
                      : 'hover:bg-apple-border-light/30 text-apple-tertiary-light'
                  }`}
                  aria-current={currentPage === item ? 'page' : undefined}
                >
                  {item}
                </button>
              );
            })}
          </div>

          {/* Próxima */}
          <button
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-apple-border-light/30 transition-colors disabled:opacity-50"
            aria-label="Próxima página"
          >
            <ChevronRight className="w-4 h-4" />
          </button>

          {/* Última página */}
          <button
            onClick={() => onPageChange(totalPages)}
            disabled={currentPage === totalPages}
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-apple-border-light/30 transition-colors disabled:opacity-50"
            aria-label="Última página"
          >
            <ChevronsRight className="w-4 h-4" />
          </button>
        </div>

        {/* Input para digitar a página */}
        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={totalPages}
            value={inputValue}
            onChange={(e) => setInputPage({ page: currentPage, value: e.target.value })}
            onKeyDown={handlePageInput}
            placeholder={String(currentPage)}
            className="w-14 bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-lg px-2 py-1 text-xs text-center"
            aria-label="Ir para página"
          />
          <span>/ {totalPages}</span>
        </div>
      </div>
    </div>
  );
}