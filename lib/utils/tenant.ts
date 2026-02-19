import { doc, getDoc } from "firebase/firestore";
import { getFirebaseDb } from "@/lib/firebase/client";
import type { TenantConfig, CountryProfile } from "@/lib/types";

const CACHE_KEY_TENANT = "tenant:";
const CACHE_KEY_SLUG = "slug:";

// In-memory cache for server-side (per request in server components we don't cache long)
const tenantCache = new Map<string, { data: TenantConfig; at: number }>();
const slugCache = new Map<string, { tenantId: string; at: number }>();
const CACHE_TTL_MS = 60_000; // 1 min

function getCachedTenant(slug: string): TenantConfig | null {
  const key = CACHE_KEY_SLUG + slug;
  const entry = slugCache.get(key);
  if (!entry) return null;
  if (Date.now() - entry.at > CACHE_TTL_MS) {
    slugCache.delete(key);
    return null;
  }
  const tent = tenantCache.get(CACHE_KEY_TENANT + entry.tenantId);
  if (!tent || Date.now() - tent.at > CACHE_TTL_MS) return null;
  return tent.data;
}

export async function resolveTenantIdBySlug(slug: string): Promise<string | null> {
  const cached = getCachedTenant(slug);
  if (cached) return cached.id;

  const db = getFirebaseDb();
  const slugRef = doc(db, "slugs", slug);
  const slugSnap = await getDoc(slugRef);
  if (!slugSnap.exists()) return null;
  const tenantId = slugSnap.data()?.tenantId as string;
  if (tenantId) slugCache.set(CACHE_KEY_SLUG + slug, { tenantId, at: Date.now() });
  return tenantId ?? null;
}

export async function getTenantConfigBySlug(slug: string): Promise<TenantConfig | null> {
  const cached = getCachedTenant(slug);
  if (cached) return cached;

  const tenantId = await resolveTenantIdBySlug(slug);
  if (!tenantId) return null;

  const cacheKey = CACHE_KEY_TENANT + tenantId;
  const cachedTenant = tenantCache.get(cacheKey);
  if (cachedTenant && Date.now() - cachedTenant.at <= CACHE_TTL_MS) return cachedTenant.data;

  const db = getFirebaseDb();
  const tenantRef = doc(db, "tenants", tenantId);
  const tenantSnap = await getDoc(tenantRef);
  if (!tenantSnap.exists()) return null;

  const data = { id: tenantSnap.id, ...tenantSnap.data() } as TenantConfig;
  tenantCache.set(cacheKey, { data, at: Date.now() });
  return data;
}

export async function getCountryProfile(countryCode: string): Promise<CountryProfile | null> {
  const db = getFirebaseDb();
  const ref = doc(db, "countryProfiles", countryCode);
  const snap = await getDoc(ref);
  if (!snap.exists()) return null;
  return { ...snap.data(), countryCode: snap.id } as CountryProfile;
}

/** For public config.json: safe subset of tenant config */
export function getPublicConfig(tenant: TenantConfig) {
  return {
    name: tenant.name,
    slug: tenant.slug,
    country: tenant.country,
    currency: tenant.currency,
    onlineFeePercent: tenant.onlineFeePercent,
    pricing: tenant.pricing,
    payment: { enabled: tenant.payment.enabled, provider: tenant.payment.provider },
    cashEnabled: tenant.cashEnabled,
    branding: tenant.branding,
  };
}

/** Generate theme.css variables from tenant branding */
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
