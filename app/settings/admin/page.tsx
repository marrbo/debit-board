// app/admin/page.tsx
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { User } from "@/models/User";
import { redirect } from "next/navigation";
import AdminTabs from "./AdminTabs";
import { UserCog } from "lucide-react";
import { getServerAuthSession } from "@/lib/auth-server";

export default async function AdminPage() {
  const session = await getServerAuthSession();

  // Remova o comentário abaixo se quiser proteger a rota
  if (!session || session.user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) {
    redirect("/settings");
  }

  await connectToDatabase();
  const tenants = await Tenant.find({}).sort({ name: 1 }).lean();
  const users = await User.find({}).sort({ name: 1 }).lean();

  const serializedTenants = JSON.parse(JSON.stringify(tenants));
  const serializedUsers = JSON.parse(JSON.stringify(users));

  return (
    <div className="w-full mx-auto">
      <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-heading dark:text-heading flex items-center gap-2">
          <UserCog className="w-10 h-10 text-brand" />
          Admin
        </h1>
      </div>

      <div className="bg-surface dark:bg-surface border border-default dark:border-strong rounded-lg shadow-sm hover:drop-shadow-lg overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-default dark:border-strong flex items-center gap-3 bg-surface dark:bg-surface/80">
          <p className="text-xs text-muted dark:text-muted">
            Gerencie Tenants e Usuários
          </p>
        </div>

        <AdminTabs tenants={serializedTenants} users={serializedUsers} />
      </div>
    </div>
  );
}
