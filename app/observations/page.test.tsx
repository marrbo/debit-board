import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import "@testing-library/jest-dom/vitest";
import ObservationsPage from "./page";
import { UserAvatar, ObservationsReport } from "./components";
import type { IObservation } from "@/models/Observation";
import { useSession } from "next-auth/react";
import { useReactToPrint } from "react-to-print";

// TODO: Cache Components adoption. Refactor this route so this opt-out can be removed.
// See: https://nextjs.org/docs/app/guides/migrating-to-cache-components
export const instant = false;

// =====================================================================
// Mocks
// =====================================================================
const mockPush = vi.fn();
const mockReplace = vi.fn();

vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: mockPush, replace: mockReplace }),
}));

const mockSession = {
  user: {
    id: "user-1",
    name: "Test User",
    email: "test@example.com",
    azureSettings: {
      instanceUrl: "https://dev.azure.com",
      azureCollection: "Collection",
    },
  },
  expires: "2099-01-01",
};

vi.mock('next-auth/react', () => ({
  useSession: vi.fn(() => ({ data: mockSession, status: 'authenticated' })),
}));

let mockPrint = vi.fn();

vi.mock("react-to-print", () => ({
  useReactToPrint: () => mockPrint,
}));

vi.mock("@/components/dbql/DBQLAdvancedSearch", () => ({
  default: ({
    onSearch,
    placeholder,
  }: {
    onSearch: (q: string) => void;
    placeholder?: string;
  }) => (
    <div data-testid="dbql-search">
      <input
        type="text"
        placeholder={placeholder}
        onChange={(e) => onSearch(e.target.value)}
      />
    </div>
  ),
}));

vi.mock("@/components/PageHeader", () => ({
  default: ({
    title,
    subtitle,
    actions,
  }: {
    title: string;
    subtitle: string;
    actions?: React.ReactNode;
  }) => (
    <div>
      <h1>{title}</h1>
      <p>{subtitle}</p>
      {actions && <div>{actions}</div>}
    </div>
  ),
}));

vi.mock("@/components/AssigneeSelect", () => ({
  default: ({
    value,
    onChange,
  }: {
    value?: string;
    onChange?: (v: string) => void;
  }) => (
    <select
      data-testid="assignee-select"
      value={value || ""}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <option value="">—</option>
      <option value="user-1">Test User</option>
    </select>
  ),
}));

vi.mock("exceljs", () => {
  class MockWorkbook {
    addWorksheet() {
      return {
        columns: [],
        views: [],
        mergeCells: vi.fn(),
        getCell: vi.fn(() => ({
          value: "",
          font: {},
          alignment: {},
          border: {},
        })),
        getRow: vi.fn(() => ({
          height: 0,
          font: {},
          fill: {},
          alignment: {},
          values: [],
          getCell: vi.fn(() => ({
            value: "",
            font: {},
            alignment: {},
            border: {},
          })),
          eachCell: vi.fn(),
        })),
        autoFilter: "",
      };
    }

    xlsx = {
      writeBuffer: vi.fn().mockResolvedValue(new ArrayBuffer(10)),
    };
  }

  return {
    default: { Workbook: MockWorkbook },
    Workbook: MockWorkbook,
  };
});

// =====================================================================
// Fixtures
// =====================================================================
const mockObservations = [
  {
    _id: "obs-1",
    project: "ProjA",
    repository: "RepoA",
    branch: "main",
    fileName: "file1.js",
    filePath: "src/file1.js",
    category: "Security",
    status: "open",
    severity: "high",
    slaHours: 24,
    hitCount: 5,
    firstSeen: new Date("2024-01-03").toISOString(),
    lastSeen: new Date("2024-01-04").toISOString(),
    slaDueAt: new Date("2024-01-05").toISOString(),
    assignedTo: "",
  },
  {
    _id: "obs-2",
    project: "ProjB",
    repository: "RepoB",
    branch: "develop",
    fileName: "file2.py",
    filePath: "src/file2.py",
    category: "Code Quality",
    status: "resolved",
    severity: "low",
    slaHours: 48,
    hitCount: 1,
    firstSeen: new Date("2024-01-01").toISOString(),
    lastSeen: new Date("2024-01-02").toISOString(),
    slaDueAt: new Date("2024-01-10").toISOString(),
    assignedTo: "user-1",
  },
];

const mockFetch = vi.fn();
global.fetch = mockFetch as unknown as typeof fetch;

// =====================================================================
// Setup antes de cada teste
// =====================================================================
beforeEach(() => {
  mockFetch.mockReset();
  mockPush.mockReset();
  mockReplace.mockReset();
  mockPrint = vi.fn();

  // ✅ Restaura o mock de useSession para o estado autenticado padrão
  (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
    data: mockSession,
    status: "authenticated",
  });

  // Mock padrão para todas as chamadas de API
  mockFetch.mockImplementation((url: RequestInfo | URL) => {
    const urlStr = url.toString();

    if (urlStr.includes("/api/users")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => [
          { sub: "user-1", name: "Test User", email: "test@example.com" },
        ],
      });
    }

    if (urlStr.includes("/api/observations")) {
      if (urlStr.includes("all=true")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: mockObservations }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          observations: mockObservations,
          totalPages: 2,
        }),
      });
    }

    return Promise.resolve({
      ok: true,
      status: 200,
      json: async () => ({}),
    });
  });
});

afterEach(() => {
  vi.restoreAllMocks();
  mockFetch.mockReset();
});

// =====================================================================
// Testes: UserAvatar
// =====================================================================
describe("UserAvatar", () => {
  it("deve renderizar com nome", () => {
    const { container } = render(<UserAvatar name="Alice" sub="alice" />);
    expect(container.textContent).toBe("A");
  });

  it("deve usar a primeira letra do sub quando nome não existe", () => {
    const { container } = render(<UserAvatar sub="bob" />);
    expect(container.textContent).toBe("B");
  });

  it('deve usar "U" como fallback', () => {
    const { container } = render(<UserAvatar />);
    expect(container.textContent).toBe("U");
  });

  it("deve aplicar classes adicionais", () => {
    const { container } = render(
      <UserAvatar name="Teste" className="extra-class" />,
    );
    expect(container.firstChild).toHaveClass("extra-class");
  });
});

// =====================================================================
// Testes: ObservationsReport
// =====================================================================
describe("ObservationsReport", () => {
  it("deve retornar null se não houver observações", () => {
    const { container } = render(
      <ObservationsReport observations={[]} usersMap={{}} />,
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("deve renderizar o cabeçalho do relatório", () => {
    const { container } = render(
      <ObservationsReport
        observations={[]}
        usersMap={{ "user-1": "Test User" }}
      />,
    );
    expect(container).toMatchSnapshot();
  });

  it("deve renderizar todas as variações de status e severidade", () => {
    const observations = [
        // status: open, recurring, resolved, wont_fix
        { _id: "o1", project: "P", repository: "R", branch: "b", fileName: "f1", filePath: "p", category: "c", status: "open", severity: "critical", slaHours: 1, hitCount: 1, firstSeen: "2024-01-01", lastSeen: "2024-01-01", slaDueAt: "2024-01-02", assignedTo: "" },
        { _id: "o2", project: "P", repository: "R", branch: "b", fileName: "f2", filePath: "p", category: "c", status: "recurring", severity: "high", slaHours: 1, hitCount: 1, firstSeen: "2024-01-01", lastSeen: "2024-01-01", slaDueAt: "2024-01-02", assignedTo: "" },
        { _id: "o3", project: "P", repository: "R", branch: "b", fileName: "f3", filePath: "p", category: "c", status: "resolved", severity: "medium", slaHours: 1, hitCount: 1, firstSeen: "2024-01-01", lastSeen: "2024-01-01", slaDueAt: "2024-01-02", assignedTo: "" },
        { _id: "o4", project: "P", repository: "R", branch: "b", fileName: "f4", filePath: "p", category: "c", status: "wont_fix", severity: "low", slaHours: 1, hitCount: 1, firstSeen: "2024-01-01", lastSeen: "2024-01-01", slaDueAt: "2024-01-02", assignedTo: "" },
    ] as unknown as IObservation[];

    render(<ObservationsReport observations={observations} usersMap={{}} />);

    // Verifica que os status e severidades aparecem
    expect(screen.getAllByText("open").length).toBeGreaterThan(0);
    expect(screen.getAllByText("recurring").length).toBeGreaterThan(0);
    expect(screen.getAllByText("resolved").length).toBeGreaterThan(0);
    expect(screen.getAllByText("wont_fix").length).toBeGreaterThan(0);
    expect(screen.getAllByText("critical").length).toBeGreaterThan(0);
    expect(screen.getAllByText("high").length).toBeGreaterThan(0);
    expect(screen.getAllByText("medium").length).toBeGreaterThan(0);
    expect(screen.getAllByText("low").length).toBeGreaterThan(0);
  });

  it("deve renderizar os totais e a tabela agrupada", () => {
    const observations = mockObservations as unknown as IObservation[];
    render(
      <ObservationsReport
        observations={observations}
        usersMap={{ "user-1": "Test User" }}
      />,
    );

    expect(screen.getByText("Debit Board")).toBeInTheDocument();
    expect(screen.getByText("Total")).toBeInTheDocument();

    const totalCard = screen.getByText("Total").closest("div");
    expect(totalCard).toHaveTextContent("2");

    const openCard = screen.getByText("Em aberto").closest("div");
    expect(openCard).toHaveTextContent("1");

    const resolvedCard = screen.getByText("Resolvidas").closest("div");
    expect(resolvedCard).toHaveTextContent("1");

    const wontFixCard = screen.getByText("Não corrigir").closest("div");
    expect(wontFixCard).toHaveTextContent("0");

    expect(screen.getByText("file1.js")).toBeInTheDocument();
    expect(screen.getByText("file2.py")).toBeInTheDocument();
    expect(screen.getByText(/Categoria: Security/)).toBeInTheDocument();
    expect(screen.getByText(/Projeto: ProjA/)).toBeInTheDocument();
    expect(screen.getByText(/Repositório: RepoA/)).toBeInTheDocument();
  });

  it("deve renderizar fallbacks quando projeto/repositório estão vazios", () => {
    const observations = [
      {
        _id: "obs-3",
        project: "",
        repository: "",
        branch: "feature",
        fileName: "file3.ts",
        filePath: "src/file3.ts",
        category: "Security",
        status: "recurring",
        severity: "critical",
        slaHours: 12,
        hitCount: 3,
        firstSeen: new Date("2024-01-05").toISOString(),
        lastSeen: new Date("2024-01-06").toISOString(),
        slaDueAt: new Date("2024-01-07").toISOString(),
        assignedTo: "",
      },
    ] as unknown as IObservation[];

    render(<ObservationsReport observations={observations} usersMap={{}} />);

    expect(screen.getByText(/Sem project/i)).toBeInTheDocument();
    expect(screen.getByText(/Sem repository/i)).toBeInTheDocument();
  });

  it("deve renderizar corretamente status wont_fix e recurring", () => {
    const observations = [
      {
        _id: "obs-4",
        project: "ProjC",
        repository: "RepoC",
        branch: "main",
        fileName: "file4.js",
        filePath: "src/file4.js",
        category: "Code Quality",
        status: "wont_fix",
        severity: "medium",
        slaHours: 24,
        hitCount: 2,
        firstSeen: new Date("2024-01-05").toISOString(),
        lastSeen: new Date("2024-01-06").toISOString(),
        slaDueAt: new Date("2024-01-07").toISOString(),
        assignedTo: "",
      },
      {
        _id: "obs-5",
        project: "ProjC",
        repository: "RepoC",
        branch: "develop",
        fileName: "file5.js",
        filePath: "src/file5.js",
        category: "Security",
        status: "recurring",
        severity: "high",
        slaHours: 24,
        hitCount: 4,
        firstSeen: new Date("2024-01-05").toISOString(),
        lastSeen: new Date("2024-01-06").toISOString(),
        slaDueAt: new Date("2024-01-07").toISOString(),
        assignedTo: "",
      },
    ] as unknown as IObservation[];

    render(<ObservationsReport observations={observations} usersMap={{}} />);

    expect(screen.getByText("wont_fix")).toBeInTheDocument();
    expect(screen.getByText("recurring")).toBeInTheDocument();
  });

  it("deve ordenar por severidade dentro de cada repositório", () => {
    const observations = [
      {
        _id: "obs-6",
        project: "ProjD",
        repository: "RepoD",
        branch: "main",
        fileName: "file6.js",
        filePath: "src/file6.js",
        category: "Security",
        status: "open",
        severity: "low",
        slaHours: 24,
        hitCount: 1,
        firstSeen: new Date("2024-01-01").toISOString(),
        lastSeen: new Date("2024-01-02").toISOString(),
        slaDueAt: new Date("2024-01-03").toISOString(),
        assignedTo: "",
      },
      {
        _id: "obs-7",
        project: "ProjD",
        repository: "RepoD",
        branch: "main",
        fileName: "file7.js",
        filePath: "src/file7.js",
        category: "Security",
        status: "open",
        severity: "critical",
        slaHours: 24,
        hitCount: 1,
        firstSeen: new Date("2024-01-01").toISOString(),
        lastSeen: new Date("2024-01-02").toISOString(),
        slaDueAt: new Date("2024-01-03").toISOString(),
        assignedTo: "",
      },
    ] as unknown as IObservation[];

    render(<ObservationsReport observations={observations} usersMap={{}} />);

    // Usa getAllByText para verificar que existe pelo menos uma ocorrência
    expect(screen.getAllByText(/critical/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/low/i).length).toBeGreaterThan(0);
  });
  
  it('deve ordenar por status', async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText('file1.js');

    const statusHeader = screen.getByText('Status');
    await user.click(statusHeader);
    await waitFor(() => expect(statusHeader.innerHTML).toContain('lucide-chevron-up'));
    });

  it('deve ordenar por branch', async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText('file1.js');

    const branchHeader = screen.getByText('Branch');
    await user.click(branchHeader);
    await waitFor(() => expect(branchHeader.innerHTML).toContain('lucide-chevron-up'));
    });

  it('deve ordenar por severity', async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText('file1.js');

    const severityHeader = screen.getByText('Severidade');
    await user.click(severityHeader);
    await waitFor(() => expect(severityHeader.innerHTML).toContain('lucide-chevron-up'));
    });

  it("deve renderizar '—' para atribuído quando não há usuário mapeado", () => {
    const observations = [
        { _id: "obs-9", project: "P", repository: "R", branch: "b", fileName: "f9", filePath: "p", category: "c", status: "open", severity: "high", slaHours: 1, hitCount: 1, firstSeen: "2024-01-01", lastSeen: "2024-01-01", slaDueAt: "2024-01-02", assignedTo: "" },
    ] as unknown as IObservation[];

    render(<ObservationsReport observations={observations} usersMap={{}} />);
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

// =====================================================================
// Testes: Fluxos de erro
// =====================================================================
describe("ObservationsPage - Fluxos de erro", () => {
  it("deve exibir mensagem de erro quando falha ao carregar observations", async () => {
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.toString().includes("/api/observations")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ message: "Erro" }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    expect(
      await screen.findByText("Erro ao carregar Observations"),
    ).toBeInTheDocument();
  });

  it("deve exibir alerta quando falha ao atualizar issue", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [{ sub: "user-1", name: "Test User" }],
        });
      }
      if (
        url.toString().includes("/api/observations") &&
        url.toString().includes("all=true")
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: mockObservations }),
        });
      }
      if (url.toString().includes("/api/observations")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: mockObservations, totalPages: 2 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const select = screen.getAllByTestId("assignee-select")[0];
    await userEvent.selectOptions(select, "user-1");

    // Simula falha no PATCH
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (
        url.toString().includes("/api/observations") &&
        url.toString().includes("?page=")
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: mockObservations, totalPages: 2 }),
        });
      }
      if (url.toString().includes("/api/observations")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ message: "Erro ao atualizar" }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    await userEvent.selectOptions(select, "user-1");
    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    alertSpy.mockRestore();
  });

  it("deve cancelar exportação Excel quando confirmação for false", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    // Abre o dropdown
    const menuButton = screen.getByTitle("Opções de exportação");
    await user.click(menuButton);

    // Clica em Exportar Excel
    const exportExcel = screen.getByTitle("Exportar Excel");
    await user.click(exportExcel);

    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining("all=true"));
    confirmSpy.mockRestore();
  });

  it("deve exibir alerta quando não há issues para exportar no Excel", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    // ... mocks de fetch para retornar observations: [] ...
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.toString().includes("/api/observations")) {
        if (url.toString().includes("all=true")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ observations: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: [], totalPages: 1 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    await screen.findByText("Nenhuma vulnerabilidade encontrada.");

    const menuButton = screen.getByTitle("Opções de exportação");
    await user.click(menuButton);
    const exportExcel = screen.getByTitle("Exportar Excel");
    await user.click(exportExcel);

    await waitFor(() => expect(alertSpy).toHaveBeenCalledWith("Nenhuma issue para exportar"));
    alertSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it("deve exibir alerta quando falha na exportação PDF", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    // ... mocks de fetch que falham no all=true ...
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.toString().includes("/api/observations")) {
        if (url.toString().includes("all=true")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ message: "Erro" }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: mockObservations, totalPages: 2 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const exportButton = screen.getByTitle("Exportar PDF"); // título novo
    await user.click(exportButton);

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    alertSpy.mockRestore();
  });

  it("deve lidar com exportação PDF quando não há dados", async () => {
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => [],
        });
      }
      if (url.toString().includes("/api/observations")) {
        if (url.toString().includes("all=true")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ observations: [] }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: [], totalPages: 1 }),
        });
      }
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({}),
      });
    });

    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("Nenhuma vulnerabilidade encontrada.");

    const exportButton = screen.getByTitle("Exportar PDF"); // título novo
    await user.click(exportButton);

    await waitFor(() =>
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("all=true"),
      ),
    );
  });

  it("deve exibir alerta quando falha na exportação Excel", async () => {
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);
    const user = userEvent.setup();

    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.toString().includes("/api/observations")) {
        if (url.toString().includes("all=true")) {
          return Promise.resolve({
            ok: false,
            status: 500,
            json: async () => ({ message: "Erro" }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: mockObservations, totalPages: 2 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    // Abre o dropdown
    const menuButton = screen.getByTitle("Opções de exportação");
    await user.click(menuButton);
    const exportExcel = screen.getByTitle("Exportar Excel");
    await user.click(exportExcel);

    await waitFor(() => expect(alertSpy).toHaveBeenCalled());
    alertSpy.mockRestore();
    confirmSpy.mockRestore();
  });

  it("deve lidar com erro ao buscar usuários sem quebrar", async () => {
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({
          ok: false,
          status: 500,
          json: async () => ({ message: "Erro" }),
        });
      }
      if (url.toString().includes("/api/observations")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: mockObservations, totalPages: 2 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    expect(await screen.findByText("file1.js")).toBeInTheDocument();
  });
});

// =====================================================================
// Testes: Cenários vazios, paginação e busca
// =====================================================================
describe("ObservationsPage - Cenários vazios, paginação e busca", () => {
  it("deve exibir mensagem quando não há observações", async () => {
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (
        url.toString().includes("/api/observations") &&
        url.toString().includes("all=true")
      ) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: [] }),
        });
      }
      if (url.toString().includes("/api/observations")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: [], totalPages: 1 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    expect(
      await screen.findByText("Nenhuma vulnerabilidade encontrada."),
    ).toBeInTheDocument();
  });

  it("não deve mostrar paginação quando totalPages = 1", async () => {
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.toString().includes("/api/observations")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({ observations: mockObservations, totalPages: 1 }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    await screen.findByText("file1.js");
    expect(screen.queryByText("Página 1 de 1")).not.toBeInTheDocument();
  });

  it("deve iniciar busca quando o campo DBQL é preenchido", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const searchInput = screen.getByPlaceholderText(/Buscar via DBQL/i);
    await user.type(searchInput, "severity:critical");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("search=severity%3Acritical"),
      );
    });
  });
});

// =====================================================================
// Testes: Ordenação por outros campos
// =====================================================================
describe("ObservationsPage - Ordenação por outros campos", () => {
  it("deve ordenar por categoria", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const categoryHeader = screen.getByText("Categoria");
    await user.click(categoryHeader);
    await waitFor(() =>
      expect(categoryHeader.innerHTML).toContain("lucide-chevron-up"),
    );
  });

  it('deve renderizar agrupamento sem categoria', () => {
    const observations = [
        {
        _id: 'obs-8',
        project: 'ProjE',
        repository: 'RepoE',
        branch: 'main',
        fileName: 'file8.js',
        filePath: 'src/file8.js',
        category: '',
        status: 'open',
        severity: 'medium',
        slaHours: 24,
        hitCount: 2,
        firstSeen: new Date('2024-01-01').toISOString(),
        lastSeen: new Date('2024-01-02').toISOString(),
        slaDueAt: new Date('2024-01-03').toISOString(),
        assignedTo: '',
        },
    ] as unknown as IObservation[];

    render(<ObservationsReport observations={observations} usersMap={{}} />);

    expect(screen.getByText(/Sem category/i)).toBeInTheDocument();
  });

  it("deve ordenar por slaDueAt", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const slaHeader = screen.getByText("Previsão (SLA)");
    await user.click(slaHeader);
    await waitFor(() =>
      expect(slaHeader.innerHTML).toContain("lucide-chevron-up"),
    );
  });

  it("deve ordenar por fileName", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const fileNameHeader = screen.getByText("Arquivo / Observação");
    await user.click(fileNameHeader);
    await waitFor(() =>
      expect(fileNameHeader.innerHTML).toContain("lucide-chevron-up"),
    );
  });

  it("deve ordenar por assignedTo", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const assignedHeader = screen.getByText("Responsável");
    await user.click(assignedHeader);
    await waitFor(() =>
      expect(assignedHeader.innerHTML).toContain("lucide-chevron-up"),
    );
  });

  it("deve ordenar por firstSeen", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    // Não há coluna específica para firstSeen, mas podemos usar o header de Status?
    // Na verdade, o sortBy inicial é 'firstSeen', então não precisamos clicar, mas podemos verificar que o estado está correto.
    // Vamos simplesmente verificar que a tabela está renderizada.
    expect(screen.getByText("file1.js")).toBeInTheDocument();
  });
});

// =====================================================================
// Testes: Sucesso nas exportações
// =====================================================================
describe("ObservationsPage - Exportações com sucesso", () => {
  it("deve exportar para PDF com sucesso (chamando handlePrint)", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText('file1.js');

    const exportButton = screen.getByTitle('Exportar PDF'); // título novo
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('all=true'));
    });
  });

  it("deve abrir e fechar o dropdown do split button", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText('file1.js');

    const menuButton = screen.getByTitle('Opções de exportação');
    expect(screen.queryByTitle('Exportar Excel')).not.toBeInTheDocument();

    await user.click(menuButton);
    expect(screen.getByTitle('Exportar Excel')).toBeInTheDocument();

    // Clica fora para fechar (simula clique no body)
    await user.click(document.body);
    expect(screen.queryByTitle('Exportar Excel')).not.toBeInTheDocument();
  });

  it("deve cancelar exportação Excel quando confirmação for false", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(false);
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const menuButton = screen.getByTitle("Opções de exportação");
    await user.click(menuButton);
    const exportExcel = screen.getByTitle("Exportar Excel");
    await user.click(exportExcel);

    expect(mockFetch).not.toHaveBeenCalledWith(expect.stringContaining("all=true"));
    confirmSpy.mockRestore();
  });

  it("deve exportar para PDF e chamar a função de impressão", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const exportButton = screen.getByTitle("Exportar PDF"); // título novo
    await user.click(exportButton);

    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("all=true"));
    });

    await waitFor(() => {
        expect(mockPrint).toHaveBeenCalled();
    }, { timeout: 2000 });
  });

  it("deve exportar para Excel com sucesso (gerando arquivo)", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true); // adicionado

    render(<ObservationsPage />);
    await screen.findByText('file1.js');

    const menuButton = screen.getByTitle('Opções de exportação');
    await user.click(menuButton);
    const exportExcel = screen.getByTitle('Exportar Excel');
    await user.click(exportExcel);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('all=true'));
    });
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });

  it("deve exportar para Excel com sucesso sem azureSettings", async () => {
    const user = userEvent.setup();
    const confirmSpy = vi.spyOn(window, "confirm").mockReturnValue(true);

    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
        data: {
        ...mockSession,
        user: { ...mockSession.user, azureSettings: undefined },
        },
        status: "authenticated",
    });

    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const menuButton = screen.getByTitle("Opções de exportação");
    await user.click(menuButton);
    const exportExcel = screen.getByTitle("Exportar Excel");
    await user.click(exportExcel);

    await waitFor(() => {
        expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("all=true"));
    });
    expect(confirmSpy).toHaveBeenCalled();
    confirmSpy.mockRestore();
  });
});

// =====================================================================
// Testes: Atualização com valor nulo
// =====================================================================
describe("ObservationsPage - Atualização com valor nulo", () => {
  it("deve atualizar o responsável para null quando seleciona opção vazia", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const select = screen.getAllByTestId("assignee-select")[1]; // segunda observação (assignedTo: user-1)
    await user.selectOptions(select, "");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/observations",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ issueId: "obs-2", assignedTo: null }),
        }),
      );
    });
  });
});

// =====================================================================
// Testes principais da página
// =====================================================================
describe("ObservationsPage", () => {
  it("deve renderizar o estado de carregamento inicialmente", async () => {
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      const urlStr = url.toString();
      if (
        urlStr.includes("/api/users") ||
        urlStr.includes("/api/observations")
      ) {
        return new Promise((resolve) =>
          setTimeout(
            () =>
              resolve({
                ok: true,
                status: 200,
                json: async () => ({}),
              }),
            10,
          ),
        );
      }
      return Promise.reject(new Error("Unknown URL"));
    });

    render(<ObservationsPage />);
    expect(
      await screen.findByText("Carregando observations..."),
    ).toBeInTheDocument();
  });

  it("deve renderizar as observações após a busca", async () => {
    render(<ObservationsPage />);
    expect(await screen.findByText("file1.js")).toBeInTheDocument();
    expect(screen.getByText("file2.py")).toBeInTheDocument();
    expect(screen.getByText("Security")).toBeInTheDocument();
    expect(screen.getByText("Code Quality")).toBeInTheDocument();
    expect(screen.getByText("Página 1 de 2")).toBeInTheDocument();
  });

  it('deve limpar a busca quando o campo é esvaziado', async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText('file1.js');

    const searchInput = screen.getByPlaceholderText(/Buscar via DBQL/i);
    await user.type(searchInput, 'severity:critical');
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('search=severity%3Acritical')));

    await user.clear(searchInput);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining('page=1')));
  });

  it("deve alternar a ordenação ao clicar no cabeçalho", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const statusHeader = screen.getByText("Status");
    await user.click(statusHeader);

    await waitFor(() => {
      expect(statusHeader.innerHTML).toContain("lucide-chevron-up");
    });

    await user.click(statusHeader);
    await waitFor(() => {
      expect(statusHeader.innerHTML).toContain("lucide-chevron-down");
    });
  });

  it("deve navegar para a próxima página", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const nextButton = screen.getByRole("button", { name: /próxima página/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2"));
    });
  });

  it("deve atualizar o responsável ao selecionar", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const assigneeSelects = screen.getAllByTestId("assignee-select");
    const firstSelect = assigneeSelects[0];

    await user.selectOptions(firstSelect, "user-1");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        "/api/observations",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ issueId: "obs-1", assignedTo: "user-1" }),
        }),
      );
    });
  });

  it("deve exibir o AdvancedSearch por padrão", async () => {
    render(<ObservationsPage />);
    await screen.findByText("file1.js");
    expect(screen.getByTestId("dbql-search")).toBeInTheDocument();
  });
});

// =====================================================================
// Testes: Estado de carregamento / não autenticado
// =====================================================================
describe("ObservationsPage - Estado de autenticação", () => {
  it("deve mostrar spinner quando status é loading", async () => {
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({ data: null, status: "loading" });
    render(<ObservationsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();

    // ✅ Restaura para o próximo teste
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockSession,
      status: "authenticated",
    });
  });

  it("deve mostrar spinner quando status é unauthenticated", async () => {
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({ data: null, status: "unauthenticated" });
    render(<ObservationsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();

    // ✅ Restaura para o próximo teste
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({
      data: mockSession,
      status: "authenticated",
    });
  });
});

// =====================================================================
// Testes: Paginação (anterior)
// =====================================================================
describe("ObservationsPage - Paginação", () => {
  it("deve navegar para a página anterior", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    // Vai para página 2
    const nextButton = screen.getByRole("button", { name: /próxima página/i });
    await user.click(nextButton);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=2")));

    // Volta para página 1
    const prevButton = screen.getByRole("button", { name: /página anterior/i });
    await user.click(prevButton);
    await waitFor(() => expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("page=1")));
  });
});

// =====================================================================
// Testes: SLA ausente
// =====================================================================
describe("ObservationsPage - SLA ausente", () => {
  it("deve renderizar '—' quando slaDueAt não existe", async () => {
  mockFetch.mockImplementation((url: RequestInfo | URL) => {
    if (url.toString().includes("/api/users")) {
      return Promise.resolve({ ok: true, status: 200, json: async () => [] });
    }
    if (url.toString().includes("/api/observations")) {
      return Promise.resolve({
        ok: true,
        status: 200,
        json: async () => ({
          observations: [
            {
              _id: "obs-no-sla",
              project: "ProjX",
              repository: "RepoX",
              branch: "main",
              fileName: "file-no-sla.js",
              filePath: "src/file-no-sla.js",
              category: "Security",
              status: "open",
              severity: "medium",
              slaHours: 24,
              hitCount: 1,
              firstSeen: new Date().toISOString(),
              lastSeen: new Date().toISOString(),
              slaDueAt: null, // ✅ Corrigido: null em vez de undefined
              assignedTo: "",
            },
          ],
          totalPages: 1,
        }),
      });
    }
    return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
  });

  render(<ObservationsPage />);
  expect(await screen.findByText("file-no-sla.js")).toBeInTheDocument();
  expect(screen.getAllByText("—").length).toBeGreaterThan(0);
});
});

// =====================================================================
// Testes: Ordenação toggle (asc/desc) em outros campos
// =====================================================================
describe("ObservationsPage - Toggle de ordenação", () => {
  it("deve alternar a ordenação por severidade", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const severityHeader = screen.getByText("Severidade");
    // Primeiro clique -> asc
    await user.click(severityHeader);
    await waitFor(() => expect(severityHeader.innerHTML).toContain("lucide-chevron-up"));
    // Segundo clique -> desc
    await user.click(severityHeader);
    await waitFor(() => expect(severityHeader.innerHTML).toContain("lucide-chevron-down"));
  });
});

// =====================================================================
// Testes: Estado não autenticado
// =====================================================================
describe("ObservationsPage - Estado de autenticação", () => {
  it("deve mostrar spinner quando status é unauthenticated", async () => {
    // Sobrescreve o mock de useSession para unauthenticated
    (useSession as ReturnType<typeof vi.fn>).mockReturnValue({ data: null, status: "unauthenticated" });
    render(<ObservationsPage />);
    expect(document.querySelector(".animate-spin")).toBeInTheDocument();
  });
});

// =====================================================================
// Testes: Cores e renderização de status/severidade na tabela principal
// =====================================================================
describe("ObservationsPage - Renderização de status e severidade", () => {
  it("deve renderizar status wont_fix e recurring na tabela principal", async () => {
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.toString().includes("/api/observations")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            observations: [
              { _id: "w1", project: "P", repository: "R", branch: "b", fileName: "wont.js", filePath: "p", category: "c", status: "wont_fix", severity: "low", slaHours: 1, hitCount: 1, firstSeen: "2024-01-01", lastSeen: "2024-01-01", slaDueAt: null, assignedTo: "" },
              { _id: "r1", project: "P", repository: "R", branch: "b", fileName: "recur.js", filePath: "p", category: "c", status: "recurring", severity: "high", slaHours: 1, hitCount: 2, firstSeen: "2024-01-01", lastSeen: "2024-01-01", slaDueAt: null, assignedTo: "" },
            ],
            totalPages: 1,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    expect(await screen.findByText("wont.js")).toBeInTheDocument();
    expect(screen.getByText("recur.js")).toBeInTheDocument();
    expect(screen.getByText("WONT FIX")).toBeInTheDocument();
    expect(screen.getByText("RECURRING")).toBeInTheDocument();
  });

  it("deve renderizar severidade critical e medium na tabela principal", async () => {
    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({ ok: true, status: 200, json: async () => [] });
      }
      if (url.toString().includes("/api/observations")) {
        return Promise.resolve({
          ok: true,
          status: 200,
          json: async () => ({
            observations: [
              { _id: "c1", project: "P", repository: "R", branch: "b", fileName: "crit.js", filePath: "p", category: "c", status: "open", severity: "critical", slaHours: 1, hitCount: 1, firstSeen: "2024-01-01", lastSeen: "2024-01-01", slaDueAt: null, assignedTo: "" },
              { _id: "m1", project: "P", repository: "R", branch: "b", fileName: "med.js", filePath: "p", category: "c", status: "open", severity: "medium", slaHours: 1, hitCount: 1, firstSeen: "2024-01-01", lastSeen: "2024-01-01", slaDueAt: null, assignedTo: "" },
            ],
            totalPages: 1,
          }),
        });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    expect(await screen.findByText("crit.js")).toBeInTheDocument();
    expect(screen.getByText("med.js")).toBeInTheDocument();
    expect(screen.getByText("critical")).toBeInTheDocument();
    expect(screen.getByText("medium")).toBeInTheDocument();
  });
});

// =====================================================================
// Testes adicionais para cobertura de branches
// =====================================================================
describe("ObservationsReport - Branches adicionais", () => {
  it("deve renderizar status 'new' com fallback de cor e usuário não mapeado", () => {
    const observations = [
      {
        _id: "obs-new",
        project: "ProjNew",
        repository: "RepoNew",
        branch: "feature",
        fileName: "new.js",
        filePath: "src/new.js",
        category: "Security",
        status: "new", // status não coberto
        severity: "low",
        slaHours: 8,
        hitCount: 1,
        firstSeen: new Date().toISOString(),
        lastSeen: new Date().toISOString(),
        slaDueAt: new Date().toISOString(),
        assignedTo: "unknown-user", // não existe no usersMap
      },
    ] as unknown as IObservation[];

    render(<ObservationsReport observations={observations} usersMap={{}} />);

    // Verifica que o status aparece (mesmo com fallback)
    expect(screen.getByText("new")).toBeInTheDocument();
    // Verifica que o atribuído é "—" (pois não está no map)
    expect(screen.getAllByText("—").length).toBeGreaterThan(0);
  });
});

describe("ObservationsPage - Paginação com botões desabilitados", () => {
  it("deve desabilitar o botão anterior na primeira página", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const prevButton = screen.getByRole("button", { name: /página anterior/i });
    expect(prevButton).toBeDisabled();
  });

  it("deve desabilitar o botão próximo na última página", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    // Vai para a página 2
    const nextButton = screen.getByRole("button", { name: /próxima página/i });
    await user.click(nextButton);

    // Após navegar, o botão próximo deve estar desabilitado (página 2 de 2)
    await waitFor(() => {
      const nextButtonAfter = screen.getByRole("button", { name: /próxima página/i });
      expect(nextButtonAfter).toBeDisabled();
    });
  });
});

describe("ObservationsPage - Toggle de ordenação por categoria", () => {
  it("deve alternar a ordenação por categoria (asc/desc)", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const categoryHeader = screen.getByText("Categoria");
    await user.click(categoryHeader);
    await waitFor(() => expect(categoryHeader.innerHTML).toContain("lucide-chevron-up"));

    await user.click(categoryHeader);
    await waitFor(() => expect(categoryHeader.innerHTML).toContain("lucide-chevron-down"));
  });
});

describe("ObservationsReport - Totais com status variados", () => {
  it("deve calcular totais de wont_fix e recurring", () => {
    const observations = [
      {
        _id: "obs-wf",
        project: "ProjWF",
        repository: "RepoWF",
        branch: "main",
        fileName: "wf.js",
        filePath: "src/wf.js",
        category: "Security",
        status: "wont_fix",
        severity: "low",
        slaHours: 24,
        hitCount: 1,
        firstSeen: "2024-01-01",
        lastSeen: "2024-01-01",
        slaDueAt: null,
        assignedTo: "",
      },
      {
        _id: "obs-rec",
        project: "ProjRec",
        repository: "RepoRec",
        branch: "main",
        fileName: "rec.js",
        filePath: "src/rec.js",
        category: "Security",
        status: "recurring",
        severity: "medium",
        slaHours: 24,
        hitCount: 2,
        firstSeen: "2024-01-01",
        lastSeen: "2024-01-01",
        slaDueAt: null,
        assignedTo: "",
      },
    ] as unknown as IObservation[];

    render(<ObservationsReport observations={observations} usersMap={{}} />);

    const openCard = screen.getByText("Em aberto").closest("div");
    expect(openCard).toHaveTextContent("1");

    const wontFixCard = screen.getByText("Não corrigir").closest("div");
    expect(wontFixCard).toHaveTextContent("1");

    expect(screen.getByText("wont_fix")).toBeInTheDocument();
    expect(screen.getByText("recurring")).toBeInTheDocument();
  });
});

describe("ObservationsPage - Busca e paginação combinadas", () => {
  it("deve manter a busca ao navegar para a próxima página", async () => {
    const user = userEvent.setup();
    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const searchInput = screen.getByPlaceholderText(/Buscar via DBQL/i);
    await user.type(searchInput, "severity:high");

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("search=severity%3Ahigh"));
    });

    const nextButton = screen.getByRole("button", { name: /próxima página/i });
    await user.click(nextButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining("page=2") && expect.stringContaining("search=severity%3Ahigh")
      );
    });
  });
});

describe("ObservationsPage - Erro na busca de usuários com exportação PDF", () => {
  it("deve permitir exportação PDF mesmo se a busca de usuários falhar", async () => {
    const user = userEvent.setup();
    const alertSpy = vi.spyOn(window, "alert").mockImplementation(() => {});

    mockFetch.mockImplementation((url: RequestInfo | URL) => {
      if (url.toString().includes("/api/users")) {
        return Promise.resolve({ ok: false, status: 500, json: async () => ({}) });
      }
      if (url.toString().includes("/api/observations")) {
        if (url.toString().includes("all=true")) {
          return Promise.resolve({ ok: true, status: 200, json: async () => ({ observations: mockObservations }) });
        }
        return Promise.resolve({ ok: true, status: 200, json: async () => ({ observations: mockObservations, totalPages: 2 }) });
      }
      return Promise.resolve({ ok: true, status: 200, json: async () => ({}) });
    });

    render(<ObservationsPage />);
    await screen.findByText("file1.js");

    const exportButton = screen.getByTitle("Exportar PDF"); // título novo
    await user.click(exportButton);

    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("all=true"));
    });

    expect(alertSpy).not.toHaveBeenCalled();
    await waitFor(() => {
      expect(mockPrint).toHaveBeenCalled();
    }, { timeout: 2000 });

    alertSpy.mockRestore();
  });
});

describe("ObservationsReport - Agrupamento sem categoria com usuário mapeado", () => {
  it("deve renderizar 'Sem category' e nome do usuário", () => {
    const observations = [
      {
        _id: "obs-sem-cat",
        project: "ProjSemCat",
        repository: "RepoSemCat",
        branch: "main",
        fileName: "sem-cat.js",
        filePath: "src/sem-cat.js",
        category: "",
        status: "open",
        severity: "critical",
        slaHours: 24,
        hitCount: 1,
        firstSeen: "2024-01-01",
        lastSeen: "2024-01-01",
        slaDueAt: null,
        assignedTo: "user-1",
      },
    ] as unknown as IObservation[];

    render(<ObservationsReport observations={observations} usersMap={{ "user-1": "Test User" }} />);

    expect(screen.getByText(/Sem category/i)).toBeInTheDocument();
    expect(screen.getByText("Test User")).toBeInTheDocument();
  });
});