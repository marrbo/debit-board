// app/settings/admin/tenants/[id]/azure-settings/page.tsx
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { Settings } from "lucide-react";
import { getServerAuthSession } from "@/lib/auth-server";

export default async function TenantAzureSettings(props: { params: Promise<{ id: string }> }) {
  const params = await props.params;
  const session = await getServerAuthSession();
  const adminEmail = process.env.NEXT_PUBLIC_ADMIN_EMAIL;

  if (session?.user?.email !== adminEmail) {
    redirect("/");
  }

  await connectToDatabase();

  let tenant: any = null;
  try {
    tenant = await Tenant.findById(params.id);
  } catch {
    if (!tenant) {
      tenant = await Tenant.findOne({ uuid: params.id });
    }
  }

  if (!tenant) {
    return (
      <div className="w-full mx-auto py-8">
        <div className="bg-apple-red/10 border border-apple-red/40 rounded-2xl p-6 text-error shadow-sm hover:drop-shadow-lg">
          <h2 className="text-xl font-bold text-heading dark:text-heading mb-2">Tenant não encontrado</h2>
          <p className="text-sm">
            O Tenant com o ID ou UUID <strong>{params.id}</strong> não existe.
          </p>
          <a href="/settings/admin" className="mt-4 inline-block bg-apple-tertiary-light/20 dark:bg-apple-tertiary-dark/20 hover:bg-page dark:hover:bg-surface px-4 py-2 rounded-2xl text-heading dark:text-heading text-sm border border-default dark:border-strong transition-colors">Voltar para Admin</a>
        </div>
      </div>
    );
  }

  async function updateAzureSettings(formData: FormData) {
    "use server";
    const settings = {
      instanceUrl: formData.get("instanceUrl"),
      azureCollection: formData.get("azureCollection"),
      pat: formData.get("pat"),
      username: formData.get("username"),
      defaultProject: formData.get("defaultProject"),
      defaultRepository: formData.get("defaultRepository"),
      reportTitle: formData.get("reportTitle"),
      ignoreTlsErrors: formData.get("ignoreTlsErrors") === "on",
    };
    await connectToDatabase();
    await Tenant.findByIdAndUpdate(tenant?._id, { azureSettings: settings });
    
    revalidatePath("/settings/admin");
    redirect("/settings/admin");
  }

  return (
    <div className="w-full mx-auto">
      <div className="flex items-center justify-between mb-8">
          <h1 className="text-2xl font-bold text-heading dark:text-heading flex items-center gap-2">
              <Settings className="w-5 h-5" /> 
              Configurações Azure
          </h1>
      </div>
      <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-2xl p-6 shadow-sm hover:drop-shadow-lg transition-colors">
        <h2 className="text-xl font-bold text-heading dark:text-heading mb-4 flex items-center gap-2">
          {tenant.name}
        </h2>
        <p className="text-sm text-muted dark:text-muted mb-6">
          Essas configurações serão utilizadas por todos os usuários vinculados a este Tenant.
        </p>

        <form action={updateAzureSettings} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">URL da Instância</label>
              <input type="url" name="instanceUrl" defaultValue={tenant.azureSettings?.instanceUrl || ''} className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors" required />
            </div>
            <div>
              <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">Coleção</label>
              <input type="text" name="azureCollection" defaultValue={tenant.azureSettings?.azureCollection || ''} className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors" required />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">Personal Access Token (PAT)</label>
            <input type="password" name="pat" defaultValue={tenant.azureSettings?.pat || ''} className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors" required />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">Usuário (Opcional)</label>
              <input type="text" name="username" defaultValue={tenant.azureSettings?.username || ''} className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors" />
            </div>
            <div>
              <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">Projeto Padrão (Opcional)</label>
              <input type="text" name="defaultProject" defaultValue={tenant.azureSettings?.defaultProject || ''} className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors" />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-body dark:text-body uppercase tracking-wider mb-2">Título do Relatório (Opcional)</label>
            <input type="text" name="reportTitle" defaultValue={tenant.azureSettings?.reportTitle || ''} className="w-full bg-surface dark:bg-surface border border-default dark:border-strong rounded-xl px-4 py-2 text-heading dark:text-heading focus:outline-none focus:ring-2 focus:ring-brand/30 transition-colors" />
          </div>

          <div className="flex items-center gap-3 py-2">
            <input type="checkbox" id="ignoreTlsErrors" name="ignoreTlsErrors" defaultChecked={tenant.azureSettings?.ignoreTlsErrors || false} className="w-4 h-4 bg-surface dark:bg-surface border border-default dark:border-strong rounded focus:ring-2 focus:ring-brand cursor-pointer transition-colors" />
            <label htmlFor="ignoreTlsErrors" className="text-sm text-body dark:text-body cursor-pointer select-none transition-colors">
              Ignorar erros de certificado TLS (Self-signed CA / Proxy interno)
            </label>
          </div>

          <div className="flex justify-end pt-4 border-t border-default dark:border-strong">
            <button type="submit" className="bg-brand hover:bg-brand/80 text-white px-5 py-2 rounded-2xl text-sm font-medium transition-all shadow-sm hover:drop-shadow-lg">
              Salvar Configurações do Tenant
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}