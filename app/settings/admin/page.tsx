// app/admin/page.tsx
import { getServerAuthSession } from "@/lib/auth";
import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { User } from "@/models/User";
import { redirect } from "next/navigation";
import AdminTabs from "./AdminTabs";
import { UserCog } from "lucide-react";

export default async function AdminPage() {
  const session = await getServerAuthSession();

  // Remova o comentário abaixo se quiser proteger a rota
  if (!session || session.user?.email !== process.env.NEXT_PUBLIC_ADMIN_EMAIL) { redirect("/settings"); }

  await connectToDatabase();
  const tenants = await Tenant.find({}).sort({ name: 1 }).lean();
  const users = await (User as any).find({}).sort({ name: 1 }).lean();

  const serializedTenants = JSON.parse(JSON.stringify(tenants));
  const serializedUsers = JSON.parse(JSON.stringify(users));

  return (
    <div className="w-full mx-auto">
     <div className="flex items-center justify-between mb-8">
        <h1 className="text-2xl font-bold text-apple-label-light dark:text-apple-label-dark flex items-center gap-2">
            <UserCog className="w-5 h-5" />
            Admin
        </h1>
    </div>

      <div className="bg-apple-card-light dark:bg-apple-card-dark border border-apple-border-light dark:border-apple-border-dark rounded-2xl shadow-sm overflow-hidden transition-colors">
        <div className="px-6 py-4 border-b border-apple-border-light dark:border-apple-border-dark flex items-center gap-3 bg-apple-card-light dark:bg-apple-card-dark/80">
            <p className="text-xs text-apple-tertiary-light dark:text-apple-tertiary-dark">Gerencie Tenants e Usuários</p>
        </div>

        <AdminTabs tenants={serializedTenants} users={serializedUsers} />
      </div>
    </div>
  );
}