// app/admin/actions.ts
'use server'

import { connectToDatabase } from "@/lib/mongodb";
import { Tenant } from "@/models/Tenant";
import { User } from "@/models/User";
import { getServerAuthSession } from "@/lib/auth";
import { revalidatePath } from "next/cache";
import crypto from 'crypto';

// --- Helper: verifica se o usuário atual é Admin ---
async function checkAdmin() {
  const session = await getServerAuthSession();
  if (session?.user?.email !== process.env.ADMIN_EMAIL) {
    throw new Error("Unauthorized");
  }
}

// --- CRUD de Tenants ---
export async function createTenant(formData: FormData) {
  await checkAdmin();
  const name = formData.get("name") as string;
  const dominio = formData.get("dominio") as string;
  if (!name) return;

  await connectToDatabase();
  const existingName = await Tenant.findOne({ name });
  if (existingName) throw new Error("Tenant com esse nome já existe");

  if (dominio) {
    const existingDom = await Tenant.findOne({ dominio });
    if (existingDom) throw new Error("Domínio já está em uso por outro tenant");
  }

  const newTenant = new Tenant({
    uuid: crypto.randomUUID(),
    name: name,
    dominio: dominio || '',
    isActive: true,
    azureSettings: {},
  });
  await newTenant.save();
  revalidatePath("/settings/admin");
}

export async function updateTenant(id: string, formData: FormData) {
  // await checkAdmin();
  const name = formData.get("name") as string;
  const dominio = formData.get("dominio") as string;
  if (!name) return;

  await connectToDatabase();
  const existingName = await Tenant.findOne({ name, _id: { $ne: id } });
  if (existingName) throw new Error("Nome de tenant já existe");
  if (dominio) {
    const existingDom = await Tenant.findOne({ dominio, _id: { $ne: id } });
    if (existingDom) throw new Error("Domínio já está em uso");
  }

  await Tenant.findByIdAndUpdate(id, { name, dominio });
  revalidatePath("/settings/admin");
}

export async function deleteTenant(id: string) {
  await checkAdmin();
  await connectToDatabase();
  await Tenant.findByIdAndDelete(id);
  revalidatePath("/settings/admin");
}

// --- Gerenciamento de Usuários ---
export async function assignUsersToTenant(userIds: string[], tenantId: string) {
  await checkAdmin();
  if (!tenantId || userIds.length === 0) return;

  await connectToDatabase();
  await User.updateMany(
    { sub: { $in: userIds } },
    { $set: { tenantId: tenantId } }
  );
  revalidatePath("/settings/admin");
}

export async function updateUser(userSub: string, formData: FormData) {
  await checkAdmin();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const tenantId = formData.get("tenantId") as string;
  const onboardingCompleted = formData.get("onboardingCompleted") === "true";

  await connectToDatabase();
  await User.updateOne(
    { sub: userSub },
    { $set: { name, email, tenantId, onboardingCompleted } }
  );
  revalidatePath("/settings/admin");
}

// --- CORREÇÃO: `createUser` exportada e implementada corretamente ---
export async function createUser(formData: FormData) {
  await checkAdmin();
  const name = formData.get("name") as string;
  const email = formData.get("email") as string;
  const tenantId = formData.get("tenantId") as string;

  if (!email || !tenantId) {
    throw new Error("E-mail e Tenant são obrigatórios.");
  }

  await connectToDatabase();
  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new Error("Já existe um usuário com este e-mail no sistema.");
  }

  const newUser = new User({
    sub: `manual-${crypto.randomUUID()}`,
    email: email,
    name: name || email.split('@')[0],
    tenantId: tenantId,
    onboardingCompleted: true,
    isActive: true,
  });

  await newUser.save();
  revalidatePath("/settings/admin");
}

// --- Toggle de Status (Ativo/Inativo) ---
export async function toggleTenantStatus(tenantId: string, isActive: boolean) {
  await checkAdmin();
  await connectToDatabase();
  await Tenant.findByIdAndUpdate(tenantId, { isActive });
  revalidatePath("/settings/admin");
}

export async function toggleUserStatus(userSub: string, isActive: boolean) {
  await checkAdmin();
  await connectToDatabase();
  await User.updateOne({ sub: userSub }, { $set: { isActive } });
  revalidatePath("/settings/admin");
}