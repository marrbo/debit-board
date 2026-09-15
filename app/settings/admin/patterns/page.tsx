'use client';

import { Suspense, useCallback, useMemo, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Pencil, Trash2, Plus } from 'lucide-react';
import PageHeader from '@/components/PageHeader';
import { DataTable, type Column } from '@/components/DataTable';

// ============================================================
// Tipos
// ============================================================
interface Pattern {
  _id: string;
  name: string;
  queryPattern: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  category: string;
  description: string;
  recommendation: string;
  slaHours: number;
  externalId: string;
  externalLink: string;
  reference: string;
  enabled: boolean;
}

type PatternForm = Omit<Pattern, '_id'>;

const EMPTY_FORM: PatternForm = {
  name: '',
  queryPattern: '',
  severity: 'medium',
  category: '',
  description: '',
  recommendation: '',
  slaHours: 72,
  externalId: '',
  externalLink: '',
  reference: '',
  enabled: true,
};

// ============================================================
// Badges
// ============================================================
const severityBadge = (severity: Pattern['severity']) => {
  const map: Record<Pattern['severity'], string> = {
    critical: 'bg-apple-red/20 text-error',
    high: 'bg-apple-orange/20 text-warning',
    medium: 'bg-brand/20 text-brand',
    low: 'bg-apple-tertiary-light/20 text-muted',
  };
  return (
    <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${map[severity] ?? map.low}`}>
      {severity}
    </span>
  );
};

const enabledBadge = (enabled: boolean) => (
  <span
    className={`px-2 py-0.5 rounded-full text-xs ${
      enabled ? 'bg-apple-green/20 text-success' : 'bg-apple-tertiary-light/20 text-muted'
    }`}
  >
    {enabled ? 'Sim' : 'Não'}
  </span>
);

// ============================================================
// Colunas (fora do componente para evitar recriação)
// ============================================================
const buildColumns = (
  onEdit: (pattern: Pattern) => void,
  onDelete: (ids: string[]) => void
): Column<Pattern>[] => [
  { key: 'name', label: 'Nome', sortable: true, minWidth: '200px' },
  { key: 'category', label: 'Categoria', sortable: true },
  {
    key: 'severity',
    label: 'Severidade',
    sortable: true,
    align: 'center',
    render: (item) => severityBadge(item.severity),
  },
  {
    key: 'slaHours',
    label: 'SLA (h)',
    sortable: true,
    align: 'center',
    width: '100px',
  },
  {
    key: 'enabled',
    label: 'Ativo',
    sortable: true,
    align: 'center',
    width: '100px',
    render: (item) => enabledBadge(item.enabled),
  },
  {
    key: 'actions',
    label: 'Ações',
    sortable: false,
    align: 'right',
    width: '120px',
    exportable: false,
    render: (item) => (
      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onEdit(item);
          }}
          title="Editar"
          className="text-brand hover:text-brand/80 transition-colors"
        >
          <Pencil className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            onDelete([item._id]);
          }}
          title="Excluir"
          className="text-error hover:text-error/80 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    ),
  },
];

// ============================================================
// Conteúdo
// ============================================================
function PatternsContent() {
  const { data: session, status } = useSession();
  const router = useRouter();

  // Busca client-side (padrão SimpleColumnSearch)
  const [filterColumn, setFilterColumn] = useState<string | null>(null);
  const [filterValue, setFilterValue] = useState('');

  // Estado do DataTable
  const [refreshKey, setRefreshKey] = useState(0);

  // Modal de edição/criação
  const [editingPattern, setEditingPattern] = useState<Pattern | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState<PatternForm>(EMPTY_FORM);

  // ============================================================
  // Handlers
  // ============================================================
  const handleSimpleSearch = useCallback((column: string | null, value: string) => {
    setFilterColumn(column);
    setFilterValue(value);
  }, []);

  const openCreate = useCallback(() => {
    setForm(EMPTY_FORM);
    setEditingPattern(null);
    setShowCreate(true);
  }, []);

  const openEdit = useCallback((pattern: Pattern) => {
    setEditingPattern(pattern);
    setForm({
      name: pattern.name,
      queryPattern: pattern.queryPattern,
      severity: pattern.severity,
      category: pattern.category,
      description: pattern.description,
      recommendation: pattern.recommendation,
      slaHours: pattern.slaHours,
      externalId: pattern.externalId,
      externalLink: pattern.externalLink,
      reference: pattern.reference,
      enabled: pattern.enabled,
    });
    setShowCreate(false);
  }, []);

  const closeModal = useCallback(() => {
    setEditingPattern(null);
    setShowCreate(false);
    setForm(EMPTY_FORM);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const method = editingPattern ? 'PUT' : 'POST';
    const url = editingPattern
      ? `/api/patterns?id=${editingPattern._id}`
      : '/api/patterns';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(form),
    });

    if (res.ok) {
      closeModal();
      setRefreshKey((k) => k + 1);
    } else {
      alert('Erro ao salvar padrão.');
    }
  };

  const handleDelete = useCallback(async (ids: string[]) => {
    if (!confirm(`Remover ${ids.length} padrão(ões)?`)) return;
    await Promise.all(
      ids.map((id) => fetch(`/api/patterns?id=${id}`, { method: 'DELETE' }))
    );
    setRefreshKey((k) => k + 1);
  }, []);

  // Colunas memoizadas com handlers estáveis
  const columns = useMemo(
    () => buildColumns(openEdit, handleDelete),
    [openEdit, handleDelete]
  );

  if (status === 'loading') {
    return <div className="py-10 text-center text-muted">Carregando...</div>;
  }
  if (!session) {
    router.push('/login');
    return null;
  }

  // ============================================================
  // Render
  // ============================================================
  return (
    <div className="w-full space-y-4">
      <PageHeader
        title="SAST Patterns"
        subtitle="Gerencie os padrões de detecção utilizados pelo scanner SAST."
        search={{
          type: 'simple',
          onSearch: handleSimpleSearch,
          userId: session?.user?._id?.toString() || session?.user?.id,
          columns: columns.map((c) => ({ key: c.key, label: c.label })),
          placeholder: 'Buscar padrões (ex: name:SQL OR category:"Broken Access Control")',
        }}
        actions={
          <button
            onClick={openCreate}
            className="flex items-center gap-2 bg-apple-green hover:bg-apple-green/80 text-white px-4 py-1.5 rounded-2xl text-sm font-medium transition-all shadow-sm hover:drop-shadow-lg"
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
        defaultSort={{ field: 'name', order: 'asc' }}
        defaultLimit={10}
        pdfTitle="SAST Patterns"
        selectable={true}
        canDelete={true}
        onDelete={handleDelete}
        onRowClick={openEdit}
        filterColumn={filterColumn}
        filterValue={filterValue}
      />

      {/* Modal Criar/Editar */}
      {(showCreate || editingPattern) && (
        <div className="fixed inset-0 bg-page/70 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-2xl w-full max-w-lg p-6 shadow-2xl max-h-[90vh] overflow-y-auto transition-colors">
            <h2 className="text-lg font-bold text-heading dark:text-heading mb-4">
              {editingPattern ? 'Editar Padrão' : 'Criar Novo Padrão'}
            </h2>

            <form onSubmit={handleSubmit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-1">
                  Nome *
                </label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-3 py-1.5 text-sm text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                  required
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-1">
                  Query Pattern *
                </label>
                <input
                  type="text"
                  value={form.queryPattern}
                  onChange={(e) => setForm({ ...form, queryPattern: e.target.value })}
                  className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-3 py-1.5 text-sm text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-1">
                    Categoria
                  </label>
                  <input
                    type="text"
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                    className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-3 py-1.5 text-sm text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-1">
                    Severidade
                  </label>
                  <select
                    value={form.severity}
                    onChange={(e) =>
                      setForm({ ...form, severity: e.target.value as Pattern['severity'] })
                    }
                    className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-3 py-1.5 text-sm text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                  >
                    <option value="low">Low</option>
                    <option value="medium">Medium</option>
                    <option value="high">High</option>
                    <option value="critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-1">
                  SLA (horas)
                </label>
                <input
                  type="number"
                  value={form.slaHours}
                  onChange={(e) =>
                    setForm({ ...form, slaHours: parseInt(e.target.value) || 0 })
                  }
                  className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-3 py-1.5 text-sm text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-1">
                  Por que isso é um problema? (Descrição)
                </label>
                <textarea
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-3 py-1.5 text-sm text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                  rows={2}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-1">
                  Como corrigir? (Recomendação)
                </label>
                <textarea
                  value={form.recommendation}
                  onChange={(e) => setForm({ ...form, recommendation: e.target.value })}
                  className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-3 py-1.5 text-sm text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                  rows={3}
                  placeholder="Ex: Utilize PreparedStatement, ORM, etc."
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-1">
                  External ID (ex: CVE-2021-44228)
                </label>
                <input
                  type="text"
                  value={form.externalId}
                  onChange={(e) => setForm({ ...form, externalId: e.target.value })}
                  className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-3 py-1.5 text-sm text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-1">
                  External Link (URL)
                </label>
                <input
                  type="url"
                  value={form.externalLink}
                  onChange={(e) => setForm({ ...form, externalLink: e.target.value })}
                  className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-3 py-1.5 text-sm text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30"
                />
              </div>

              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  id="enabled"
                  checked={form.enabled}
                  onChange={(e) => setForm({ ...form, enabled: e.target.checked })}
                  className="w-4 h-4 rounded bg-surface dark:bg-surface border-default dark:border-strong focus:ring-2 focus:ring-brand/30"
                />
                <label htmlFor="enabled" className="text-sm text-body dark:text-body">
                  Ativo
                </label>
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 text-muted dark:text-muted hover:text-heading dark:hover:text-heading"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="bg-brand hover:bg-brand/80 text-white px-4 py-2 rounded-2xl font-medium transition-colors"
                >
                  Salvar
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ============================================================
// Page
// ============================================================
export default function PatternsPage() {
  return (
    <Suspense
      fallback={
        <div className="py-12 text-center text-muted">Carregando página de padrões...</div>
      }
    >
      <PatternsContent />
    </Suspense>
  );
}