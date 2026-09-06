import { getServerAuthSession } from "@/lib/auth-server";
import SettingsNav from "./SettingsNav";

export const dynamic = 'force-dynamic';

export default async function SettingsLayout({ children }: { children: React.ReactNode }) {
  const session = await getServerAuthSession();
  const isAdmin = !!session?.user?.isAdmin;

  return (
    <div className="flex min-h-screen transition-colors duration-200">
      {/* Área do menu - sem largura fixa, o componente controla */}
      <div className="shrink-0 h-screen sticky top-0">
        <SettingsNav isAdmin={isAdmin} />
      </div>
      {/* Conteúdo flexível */}
      <main className="flex-1 min-w-0 p-8 overflow-y-auto">
        {children}
      </main>
    </div>
  );
}