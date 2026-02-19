import { getAdminFirestore } from "@/lib/firebase/admin";
import type { TenantConfig, CountryProfile } from "@/lib/types";
import { PLATFORM_FEE_PERCENT } from "@/lib/constants";

export async function resolveTenantIdBySlugServer(slug: string): Promise<string | null> {
  const db = getAdminFirestore();
  const slugRef = db.collection("slugs").doc(slug);
  const slugSnap = await slugRef.get();
  if (!slugSnap.exists) return null;
  return (slugSnap.data()?.tenantId as string) ?? null;
}

export async function getTenantConfigBySlugServer(slug: string): Promise<TenantConfig | null> {
  const tenantId = await resolveTenantIdBySlugServer(slug);
  if (!tenantId) return null;
  const db = getAdminFirestore();
  const tenantRef = db.collection("tenants").doc(tenantId);
  const tenantSnap = await tenantRef.get();
  if (!tenantSnap.exists) return null;
  return { id: tenantSnap.id, ...tenantSnap.data() } as TenantConfig;
}

export async function getCountryProfileServer(countryCode: string): Promise<CountryProfile | null> {
  const db = getAdminFirestore();
  const ref = db.collection("countryProfiles").doc(countryCode);
  const snap = await ref.get();
  if (!snap.exists) return null;
  return { ...snap.data(), countryCode: snap.id } as CountryProfile;
}

export function getPublicConfig(tenant: TenantConfig) {
  return {
    tenantId: tenant.id,
    name: tenant.name,
    slug: tenant.slug,
    country: tenant.country,
    currency: tenant.currency,
    onlineFeePercent: PLATFORM_FEE_PERCENT,
    pricing: tenant.pricing,
    payment: { enabled: tenant.payment.enabled, provider: tenant.payment.provider },
    cashEnabled: tenant.cashEnabled,
    branding: tenant.branding,
  };
}

export function getThemeCss(tenant: TenantConfig): string {
  const b = tenant.branding ?? {};
  const primary = b.primaryColor ?? "#0ea5e9";
  const bg = b.backgroundColor ?? "#0b1220";
  const text = b.textColor ?? "#ffffff";
  const logo = b.logoUrl ? `url("${b.logoUrl}")` : "none";
  return `:root {
  --primary: ${primary};
  --bg: ${bg};
  --text: ${text};
  --logo-url: ${logo};
}
`;
}
