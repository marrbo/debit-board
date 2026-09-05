// lib/client-utils.ts
/**
 * Constrói os parâmetros de URL para exportações (all=true),
 * preservando o filtro de DBQL (q) se ele existir na URL atual.
 */
export function getExportSearchParams(): URLSearchParams {
  const params = new URLSearchParams();
  
  // Sempre define all=true para exportar a lista completa filtrada
  params.set("all", "true");

  // Captura o ID da query salva (q) da URL atual do navegador
  if (typeof window !== 'undefined') {
    const currentParams = new URLSearchParams(window.location.search);
    const dbqlId = currentParams.get('q');
    
    if (dbqlId) {
      params.set("q", dbqlId);
    }
  }

  return params;
}