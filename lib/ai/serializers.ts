export interface EmbeddingSerializer<T = any> {
  source: string;
  collection: string;
  title: (doc: T) => string;
  content: (doc: T) => string;
  metadata?: (doc: T) => Record<string, unknown>;
}

export const SERIALIZERS: EmbeddingSerializer[] = [
  {
    source: "observation",
    collection: "observations",
    title: (d) =>
      `${d.category ?? "Issue"} — ${d.fileName ?? d.repository ?? d.project ?? d._id}`,
    content: (d) =>
      [
        d.category && `Categoria: ${d.category}`,
        d.severity && `Severidade: ${d.severity}`,
        d.project && `Projeto: ${d.project}`,
        d.repository && `Repositório: ${d.repository}`,
        d.branch && `Branch: ${d.branch}`,
        d.fileName && `Arquivo: ${d.fileName}`,
        d.status && `Status: ${d.status}`,
        d.description && `Descrição: ${d.description}`,
        d.recommendation && `Recomendação: ${d.recommendation}`,
      ]
        .filter(Boolean)
        .join("\n"),
    metadata: (d) => ({
      severity: d.severity,
      project: d.project,
      repository: d.repository,
      status: d.status,
    }),
  },
  {
    source: "project",
    collection: "projects",
    title: (d) => d.name ?? String(d._id),
    content: (d) => [d.name, d.description].filter(Boolean).join("\n\n"),
  },
  {
    source: "repository",
    collection: "repositories",
    title: (d) => d.name ?? String(d._id),
    content: (d) => [d.name, d.url, d.description].filter(Boolean).join("\n"),
  },
  {
    source: "savedQuery",
    collection: "savedqueries",
    title: (d) => d.name ?? String(d._id),
    content: (d) =>
      `Consulta DBQL: ${d.queryString}\nContexto: ${d.context}\nNome: ${d.name}`,
    metadata: (d) => ({ context: d.context, visibility: d.visibility }),
  },
  {
    source: "wiki",
    collection: "__wiki__", // não é uma collection Mongo — ver ingestWikiFile abaixo
    title: () => "",
    content: () => "",
  },
];
