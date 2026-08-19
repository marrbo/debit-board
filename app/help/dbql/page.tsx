// app/help/dbql/page.tsx
import { redirect } from 'next/navigation';

export default function DbqlHelpRedirectPage() {
  redirect('/settings/wiki/dbql');
}