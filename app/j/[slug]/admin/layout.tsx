import { ReactNode } from "react";
import { AdminAuthGuard } from "./admin-auth-guard";

export default async function AdminLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <AdminAuthGuard slug={slug}>{children}</AdminAuthGuard>;
}
