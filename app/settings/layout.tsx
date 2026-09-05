import { getServerAuthSession } from "@/lib/auth-server";
import SettingsNav from "./SettingsNav";

export const dynamic = 'force-dynamic'; // Força a renderização no servidor a cada requisição

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();
  const isAdmin = !!session?.user?.isAdmin;

  return (
    <div className="flex flex-col md:flex-row w-full p-8 gap-6 mx-auto transition-colors duration-200">
      <div className="w-full md:w-52 shrink-0 space-y-6">
        {/* Passamos a informação de admin para o componente de navegação */}
        <SettingsNav isAdmin={isAdmin} />
      </div>
      <div className="flex-1 min-w-0">{children}</div>
    </div>
  );
}
