"use client";

import { Suspense, useCallback, useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import {
  Pencil,
  Trash2,
  Plus,
  Archive,
  Settings2,
  BookOpen,
  Link2,
} from "lucide-react";
import PageHeader from "@/components/PageHeader/Header";
import { DataTable, type Column } from "@/components/DataTable";
import { useFeedback } from "@/hooks/useFeedback";

// ============================================================
// Tipos
// ============================================================
type Severity = "low" | "medium" | "high" | "critical";

interface Pattern {
  _id: string;
  dbId?: string;
  dbName?: string;
  name: string;
  queryPattern: string;
  severity: Severity;
  category: string;
  description: string;
  recommendation: string;
  score: number;
  slaHours: number;
  externalId?: string;
  externalLink?: string;
  externalIdCWE?: string;
  externalLinkCWE?: string;
  reference?: string;
  enabled: boolean;
  deprecated: boolean;
  deprecatedAt?: string;
  deprecatedReason?: string;
  supersededBy?: string;
}

type PatternForm = {
  dbId: string;
  dbName: string;
  name: string;
  queryPattern: string;
  severity: Severity;
  category: string;
  description: string;
  recommendation: string;
  score: number;
  slaHours: number;
  externalId: string;
  externalLink: string;
  externalIdCWE: string;
  externalLinkCWE: string;
  reference: string;
  enabled: boolean;
};

const EMPTY_FORM: PatternForm = {
  dbId: "",
  dbName: "",
  name: "",
  queryPattern: "",
  severity: "medium",
  category: "",
  description: "",
  recommendation: "",
  score: 5.0,
  slaHours: 72,
  externalId: "",
  externalLink: "",
  externalIdCWE: "",
  externalLinkCWE: "",
  reference: "",
  enabled: true,
};

// ============================================================
// Badges
// ============================================================
const severityBadge = (severity: Severity) => {
  const map: Record<Severity, string> = {
    critical: "bg-red-500/15 text-red-500 border-red-500/30",
    high: "bg-orange-500/15 text-orange-500 border-orange-500/30",
    medium: "bg-amber-500/15 text-amber-500 border-amber-500/30",
    low: "bg-emerald-500/15 text-emerald-500 border-emerald-500/30",
  };
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${map[severity]}`}
    >
      {severity}
    </span>
  );
};

const statusBadge = (p: Pattern) => {
  if (p.deprecated) {
    return (
      <span
        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border border-gray-500/40 text-gray-400 bg-gray-500/10"
        title={p.deprecatedReason || "Pattern obsoleto"}
      >
        <Archive className="w-3 h-3" /> Obsoleto
      </span>
    );
  }
  return (
    <span
      className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase border ${
        p.enabled
          ? "bg-emerald-500/15 text-emerald-500 border-emerald-500/30"
          : "bg-gray-500/15 text-gray-400 border-gray-500/30"
      }`}
    >
      {p.enabled ? "Ativo" : "Inativo"}
    </span>
  );
};

const identifierCell = (p: Pattern) => {
  if (!p.dbId && !p.dbName) {
    return (
      <span className="text-[10px] text-muted italic font-mono">
        não migrado
      </span>
    );
  }
  return (
    <div className="flex flex-col gap-0.5 font-mono text-[11px]">
      <span className="text-brand">{p.dbId}</span>
      <span className="text-muted truncate max-w-[200px]" title={p.dbName}>
        {p.dbName}
      </span>
    </div>
  );
};

function formatSla(hours: number): string {
  if (hours < 24) return `${hours}h`;
  const days = Math.round(hours / 24);
  return `${days}d`;
}

// ============================================================
// Colunas
// ============================================================
const buildColumns = (
  onEdit: (p: Pattern) => void,
  onDelete: (ids: string[]) => void,
): Column<Pattern>[] => [
  {
    key: "dbId",
    label: "ID / Slug",
    sortable: true,
    minWidth: "200px",
    render: identifierCell,
  },
  { key: "name", label: "Nome", sortable: true, minWidth: "220px" },
  { key: "category", label: "Categoria", sortable: true, width: "180px" },
  {
    key: "severity",
    label: "Severidade",
    sortable: true,
    align: "center",
    width: "120px",
    render: (item) => severityBadge(item.severity),
  },
  {
    key: "score",
    label: "Score",
    sortable: true,
    align: "center",
    width: "90px",
    render: (item) => (
      <span className="tabular-nums font-medium">{item.score.toFixed(1)}</span>
    ),
  },
  {
    key: "slaHours",
    label: "SLA",
    sortable: true,
    align: "center",
    width: "90px",
    render: (item) => (
      <span className="tabular-nums text-muted">
        {formatSla(item.slaHours)}
      </span>
    ),
  },
  {
    key: "enabled",
    label: "Status",
    sortable: true,
    align: "center",
    width: "120px",
    render: (item) => statusBadge(item),
  },
  {
    key: "actions",
    label: "Ações",
    sortable: false,
    align: "right",
    width: "120px",
    exportable: false,
    render: (item) => (
      <div className="flex">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
          }}
          title={item.deprecated ? "Ver detalhes (obsoleto)" : "Editar"}
          className="btn-primary !bg-transparent text-brand aspect-square"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete([item._id]);
          }}
          disabled={item.deprecated}
          title={
            item.deprecated
              ? "Pattern obsoleto — histórico preservado"
              : "Excluir"
          }
          className="btn-cancel !bg-transparent text-error aspect-square disabled:opacity-30"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    ),
  },
];

// ============================================================
// Editor de markdown — textarea + contador
// ============================================================
function MarkdownField({
  label,
  value,
  onChange,
  rows = 10,
  placeholder,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  rows?: number;
  placeholder?: string;
  disabled?: boolean;
}) {
  const charCount = value.length;
  return (
    <div>
      <div className="flex items-center justify-between mb-1">
        <label className="block text-xs font-semibold text-body uppercase tracking-wider">
          {label}
        </label>
        <span className="text-[10px] text-muted tabular-nums">
          {charCount.toLocaleString("pt-BR")} chars
        </span>
      </div>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-heading font-mono leading-relaxed focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        spellCheck={false}
      />
    </div>
  );
}

// ============================================================
// Tab button
// ============================================================
type TabId = "identity" | "content" | "references";

function ModalTabButton({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative flex items-center gap-1.5 px-4 py-2.5 text-xs font-medium border-b-2 transition-colors ${
        active
          ? "border-brand text-brand"
          : "border-transparent text-muted hover:text-heading"
      }`}
    >
      {icon}
      {label}
    </button>
  );
}

// ============================================================
// Conteúdo
// ============================================================
function PatternsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const { toast } = useFeedback();

  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<PatternForm>(EMPTY_FORM);
  const [activeTab, setActiveTab] = useState<TabId>("identity");

  const handleSimpleSearch = useCallback(
    (column: string | null, value: string) => {
      setFilterColumn(column);
      setFilterValue(value);
    },
    [],
  );

  const openCreate = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingPattern(null);
    setShowCreate(true);
    setActiveTab("identity");
  }, []);

  const openEdit = useCallback((pattern: Pattern) => {
    setEditingPattern(pattern);
    setForm({
      dbId: pattern.dbId ?? "",
      dbName: pattern.dbName ?? "",
      name: pattern.name,
      queryPattern: pattern.queryPattern,
      severity: pattern.severity,
      category: pattern.category,
      description: pattern.description,
      recommendation: pattern.recommendation,
      score: pattern.score,
      slaHours: pattern.slaHours,
      externalId: pattern.externalId ?? "",
      externalLink: pattern.externalLink ?? "",
      externalIdCWE: pattern.externalIdCWE ?? "",
      externalLinkCWE: pattern.externalLinkCWE ?? "",
      reference: pattern.reference ?? "",
      enabled: pattern.enabled,
    });
    setShowCreate(false);
    setActiveTab("identity");
  }, []);

  const closeModal = useCallback(() => {
    setEditingPattern(null);
    setShowCreate(false);
    setForm(EMPTY_FORM);
    setActiveTab("identity");
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const method = editingPattern ? "PUT" : "POST";
    const url = editingPattern
      ? `/api/patterns?id=${editingPattern._id}`
      : "/api/patterns";

    const res = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      closeModal();
      setRefreshKey((k) => k + 1);
      toast.success(editingPattern ? "Pattern atualizado." : "Pattern criado.");
    } else {
      const data = await res.json().catch(() => ({}));
      toast.error(data.error || "Erro ao salvar padrão.");
    }
  };

  const handleDelete = useCallback(
    async (ids: string[]) => {
      if (!confirm(`Remover ${ids.length} padrão(ões)?`)) return;
      const results = await Promise.all(
        ids.map((id) => fetch(`/api/patterns?id=${id}`, { method: "DELETE" })),
      );
      const failed = results.filter((r) => !r.ok).length;
      if (failed > 0) {
        toast.error(
          `${failed} pattern(s) não puderam ser removidos. Considere marcá-los como obsoletos.`,
        );
      }
      setRefreshKey((k) => k + 1);
    },
    [toast],
  );

  const columns = useMemo(
    () => buildColumns(openEdit, handleDelete),
    [openEdit, handleDelete],
  );

  if (status === "loading") {
    return <div className="py-10 text-center text-muted">Carregando...</div>;
  }
  if (!session) {
    router.push("/login");
    return null;
  }

  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="Padrões de Segurança"
        subtitle="Gerencie os padrões de detecção utilizados pelo scanner SAST."
        search={{
          type: "simple",
          onSearch: handleSimpleSearch,
          userSub: session?.user?.sub?.toString() || session?.user?.sub,
          columns: columns.map((c) => ({ key: c.key, label: c.label })),
          placeholder:
            'Buscar padrões (ex: dbId:DB-INJ OR category:"Broken Access Control")',
        }}
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 btn-primary"
          >
            <Plus className="w-4 h-4" />
            Novo Padrão
          </button>
        }
      />

      <DataTable<Pattern>
        key={refreshKey}
        endpoint="/api/patterns"
        columns={columns}
        defaultSort={{ field: "dbId", order: "asc" }}
        defaultLimit={10}
        pdfTitle="Padrões de Segurança"
        selectable={true}
        canDelete={true}
        onDelete={handleDelete}
        onRowClick={openEdit}
        filterColumn={filterColumn}
        filterValue={filterValue}
      />

      {(showCreate || editingPattern) && (
        <div
          className="fixed inset-0 bg-page/70 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          onClick={closeModal}
        >
          <div
            className="bg-surface border border-default rounded-lg w-full max-w-3xl shadow-2xl max-h-[90vh] flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="px-6 py-4 border-b border-default shrink-0">
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2 className="text-lg font-bold text-heading">
                    {editingPattern ? "Editar Padrão" : "Criar Novo Padrão"}
                  </h2>
                  {editingPattern && (
                    <p className="text-xs text-muted mt-0.5 font-mono">
                      {editingPattern.dbId ?? "—"} ·{" "}
                      {editingPattern.dbName ?? "não migrado"}
                    </p>
                  )}
                </div>
              </div>

              {editingPattern?.deprecated && (
                <div className="mt-3 p-3 rounded-lg border border-gray-500/40 bg-gray-500/10 text-xs text-gray-300">
                  <p className="font-semibold">Pattern obsoleto</p>
                  <p className="mt-0.5">
                    {editingPattern.deprecatedReason ||
                      "Este pattern foi descontinuado e não pode ser reativado."}
                  </p>
                  {editingPattern.deprecatedAt && (
                    <p className="mt-1 text-[10px] text-gray-500">
                      Desde{" "}
                      {new Date(editingPattern.deprecatedAt).toLocaleDateString(
                        "pt-BR",
                      )}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Tabs */}
            <div className="flex border-b border-default px-6 shrink-0">
              <ModalTabButton
                active={activeTab === "identity"}
                onClick={() => setActiveTab("identity")}
                icon={<Settings2 className="w-3.5 h-3.5" />}
                label="Configuração"
              />
              <ModalTabButton
                active={activeTab === "content"}
                onClick={() => setActiveTab("content")}
                icon={<BookOpen className="w-3.5 h-3.5" />}
                label="Conteúdo Técnico"
              />
              <ModalTabButton
                active={activeTab === "references"}
                onClick={() => setActiveTab("references")}
                icon={<Link2 className="w-3.5 h-3.5" />}
                label="Referências"
              />
            </div>

            {/* Body */}
            <form
              id="pattern-form"
              onSubmit={handleSubmit}
              className="flex-1 overflow-y-auto"
            >
              <div className="px-6 py-5">
                {/* ============ Tab 1: Configuração ============ */}
                {activeTab === "identity" && (
                  <div className="space-y-4">
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                          DB ID *
                        </label>
                        <input
                          type="text"
                          value={form.dbId}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              dbId: e.target.value.toUpperCase(),
                            })
                          }
                          placeholder="DB-INJ-001"
                          pattern="^DB-[A-Z]{2,5}-\d{3}$"
                          className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading font-mono focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
                          required
                          disabled={Boolean(editingPattern)}
                          title={
                            editingPattern ? "Imutável após criação" : undefined
                          }
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                          DB Name *
                        </label>
                        <input
                          type="text"
                          value={form.dbName}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              dbName: e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9-]/g, "-"),
                            })
                          }
                          placeholder="sql-injection-csharp-concatenation"
                          pattern="^[a-z0-9]+(-[a-z0-9]+)*$"
                          className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading font-mono focus:outline-none focus:ring-2 focus:ring-brand/30 disabled:opacity-60"
                          required
                          disabled={Boolean(editingPattern)}
                          title={
                            editingPattern ? "Imutável após criação" : undefined
                          }
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                        Nome *
                      </label>
                      <input
                        type="text"
                        value={form.name}
                        onChange={(e) =>
                          setForm({ ...form, name: e.target.value })
                        }
                        className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                        required
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                        Query Pattern *
                      </label>
                      <textarea
                        value={form.queryPattern}
                        onChange={(e) =>
                          setForm({ ...form, queryPattern: e.target.value })
                        }
                        className="w-full bg-surface border border-default rounded-lg px-3 py-2 text-xs text-heading font-mono focus:outline-none focus:ring-2 focus:ring-brand/30"
                        rows={3}
                        required
                      />
                    </div>

                    <div className="grid grid-cols-3 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                          Categoria
                        </label>
                        <input
                          type="text"
                          value={form.category}
                          onChange={(e) =>
                            setForm({ ...form, category: e.target.value })
                          }
                          className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                          Severidade
                        </label>
                        <select
                          value={form.severity}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              severity: e.target.value as Severity,
                            })
                          }
                          className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                        >
                          <option value="low">Low</option>
                          <option value="medium">Medium</option>
                          <option value="high">High</option>
                          <option value="critical">Critical</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                          Score (0–10)
                        </label>
                        <input
                          type="number"
                          min={0}
                          max={10}
                          step={0.1}
                          value={form.score}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              score: parseFloat(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading tabular-nums focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                          SLA (horas)
                        </label>
                        <input
                          type="number"
                          min={1}
                          value={form.slaHours}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              slaHours: parseInt(e.target.value) || 0,
                            })
                          }
                          className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading tabular-nums focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                      <div className="flex items-end pb-1.5">
                        <label className="flex items-center gap-2 text-sm text-body">
                          <input
                            type="checkbox"
                            checked={form.enabled}
                            onChange={(e) =>
                              setForm({ ...form, enabled: e.target.checked })
                            }
                            disabled={editingPattern?.deprecated}
                            className="w-4 h-4 rounded bg-surface border-default focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
                          />
                          Ativo
                          {editingPattern?.deprecated && (
                            <span className="text-xs text-muted">
                              (obsoleto)
                            </span>
                          )}
                        </label>
                      </div>
                    </div>
                  </div>
                )}

                {/* ============ Tab 2: Conteúdo ============ */}
                {activeTab === "content" && (
                  <div className="space-y-5">
                    <p className="text-[11px] text-muted bg-sunken/40 border border-default/40 rounded-lg px-3 py-2">
                      Os campos abaixo usam <strong>Markdown</strong>. Use
                      blocos de código com três crases (&#96;&#96;&#96;) e
                      símbolos ❌/✅ para diferenciar exemplos errados e
                      corretos.
                    </p>

                    <MarkdownField
                      label="Por que isso é um problema?"
                      value={form.description}
                      onChange={(v) => setForm({ ...form, description: v })}
                      rows={12}
                      placeholder={
                        "Descreva o impacto da vulnerabilidade.\n\n### Por que é grave\n\n- **Impacto**: ...\n- **CVSS**: ...\n- **CWE**: ..."
                      }
                    />

                    <MarkdownField
                      label="Como corrigir?"
                      value={form.recommendation}
                      onChange={(v) => setForm({ ...form, recommendation: v })}
                      rows={16}
                      placeholder={
                        "### Solução\n\nDescreva a correção.\n\n### ❌ Errado\n\n// código inseguro\n\n### ✅ Correto\n\n// código seguro\n\n### Como evitar novamente\n\n1. ..."
                      }
                    />
                  </div>
                )}

                {/* ============ Tab 3: Referências ============ */}
                {activeTab === "references" && (
                  <div className="space-y-4">
                    <p className="text-[11px] text-muted bg-sunken/40 border border-default/40 rounded-lg px-3 py-2">
                      Dois padrões universais adotados:{" "}
                      <strong>OWASP Top 10</strong> (categoria) e{" "}
                      <strong>CWE</strong> (taxonomia técnica).
                    </p>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                          OWASP ID
                        </label>
                        <input
                          type="text"
                          value={form.externalId}
                          onChange={(e) =>
                            setForm({ ...form, externalId: e.target.value })
                          }
                          placeholder="OWASP A03:2021"
                          className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                          OWASP Link
                        </label>
                        <input
                          type="url"
                          value={form.externalLink}
                          onChange={(e) =>
                            setForm({ ...form, externalLink: e.target.value })
                          }
                          placeholder="https://owasp.org/Top10/..."
                          className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                          CWE ID
                        </label>
                        <input
                          type="text"
                          value={form.externalIdCWE}
                          onChange={(e) =>
                            setForm({ ...form, externalIdCWE: e.target.value })
                          }
                          placeholder="CWE-89"
                          className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                      <div>
                        <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                          CWE Link
                        </label>
                        <input
                          type="url"
                          value={form.externalLinkCWE}
                          onChange={(e) =>
                            setForm({
                              ...form,
                              externalLinkCWE: e.target.value,
                            })
                          }
                          placeholder="https://cwe.mitre.org/data/definitions/89.html"
                          className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-semibold text-body uppercase tracking-wider mb-1">
                        Referência (texto curto)
                      </label>
                      <input
                        type="text"
                        value={form.reference}
                        onChange={(e) =>
                          setForm({ ...form, reference: e.target.value })
                        }
                        placeholder="OWASP Top 10 2021 - A3: Injection | CWE-89"
                        className="w-full bg-surface border border-default rounded-lg px-3 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                      />
                    </div>
                  </div>
                )}
              </div>
            </form>

            {/* Footer */}
            <div className="flex items-center justify-between gap-2 px-6 py-4 border-t border-default shrink-0 bg-surface">
              <span className="text-[11px] text-muted">
                {activeTab === "identity" && "Identidade e regra de detecção"}
                {activeTab === "content" && "Texto técnico em Markdown"}
                {activeTab === "references" && "Padrões externos"}
              </span>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-muted hover:text-heading"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  form="pattern-form"
                  className="bg-brand hover:bg-brand/80 text-white px-4 py-2 rounded-lg font-medium transition-colors"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default function PatternsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-muted">
          Carregando página de padrões...
        </div>
      }
    >
      <PatternsContent />
    </Suspense>
  );
}
