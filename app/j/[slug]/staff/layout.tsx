import { ReactNode } from "react";
import { StaffAuthGuard } from "./staff-auth-guard";

export default async function StaffLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  return <StaffAuthGuard slug={slug}>{children}</StaffAuthGuard>;
}
