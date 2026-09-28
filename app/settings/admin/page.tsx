// app/settings/admin/page.tsx
import { redirect } from "next/navigation";
import { UserCog } from "lucide-react";
import AdminTabs from "./AdminTabs";
import KeycloakExportPanel from "./KeycloakExportPanel";
import PageHeader from "@/components/PageHeader/Header";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { User } from "@/models/User";
import { getServerAuthSession } from "@/lib/auth-server";
import { rolesFromSession } from "@/lib/permissions";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getServerAuthSession();
  const roles = rolesFromSession(session);

  if (!roles.includes("admin")) {
    redirect("/settings");
  }

  await connectToDatabase();
  const tenants = await Tenant.find({}).sort({ name: 1 }).lean();
  const users = await User.find({}).sort({ name: 1 }).lean();

  const serializedTenants = JSON.parse(JSON.stringify(tenants));
  const serializedUsers = JSON.parse(JSON.stringify(users));

  return (
    <div className="w-full mx-auto space-y-6">
      <PageHeader subtitle="Gerencie Tenants, Usuários e configurações do realm" />

      <KeycloakExportPanel />

      <div className="card overflow-hidden">
        <div className="px-6 py-4 border-b border-default flex items-center gap-3">
          <UserCog className="w-5 h-5 text-brand" />
          <p className="text-xs text-muted">Gerencie Tenants e Usuários</p>
        </div>
        <AdminTabs tenants={serializedTenants} users={serializedUsers} />
      </div>
    </div>
  );
}
