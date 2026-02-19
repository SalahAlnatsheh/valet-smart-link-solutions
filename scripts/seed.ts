/**
 * Seed script: run with npx tsx scripts/seed.ts (or ts-node)
 * Requires .env.local with FIREBASE_ADMIN_* and Firebase project set up.
 *
 * Creates:
 * - countryProfiles/AE (and JO)
 * - tenants/{mistTenantId} (Mist UAE)
 * - slugs/mist -> tenantId
 */

import * as admin from "firebase-admin";
import { getFirestore } from "firebase-admin/firestore";
import * as dotenv from "dotenv";
import * as path from "path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.local") });

const projectId = process.env.FIREBASE_ADMIN_PROJECT_ID ?? process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, "\n");

if (!projectId || !clientEmail || !privateKey) {
  console.error("Missing FIREBASE_ADMIN_* or NEXT_PUBLIC_FIREBASE_PROJECT_ID in .env.local");
  process.exit(1);
}

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId,
      clientEmail,
      privateKey,
    }),
  });
}

const db = getFirestore(admin.app(), "valett");

const COUNTRY_AE = {
  countryCode: "AE",
  currency: "AED",
  currencySymbol: "د.إ",
  name: "United Arab Emirates",
};

const COUNTRY_JO = {
  countryCode: "JO",
  currency: "JOD",
  currencySymbol: "د.ا",
  name: "Jordan",
};

async function seed() {
  console.log("Seeding country profiles...");
  await db.collection("countryProfiles").doc("AE").set(COUNTRY_AE, { merge: true });
  await db.collection("countryProfiles").doc("JO").set(COUNTRY_JO, { merge: true });

  const mistTenantId = "mist-ae-001";
  const mistTenant = {
    slug: "mist",
    name: "Mist",
    country: "AE",
    currency: "AED",
    onlineFeePercent: 2.5,
    pricing: {
      baseValetPrice: 25,
      currency: "AED",
    },
    payment: {
      provider: "stripe",
      enabled: true,
      providerConfig: {},
    },
    cashEnabled: true,
    branding: {
      primaryColor: "#0ea5e9",
      backgroundColor: "#0b1220",
      textColor: "#ffffff",
      logoUrl: "",
    },
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  console.log("Creating Mist tenant...");
  await db.collection("tenants").doc(mistTenantId).set(mistTenant, { merge: true });

  console.log("Linking slug mist -> tenant...");
  await db.collection("slugs").doc("mist").set({ tenantId: mistTenantId }, { merge: true });

  console.log("Seed done. Mist tenant ID:", mistTenantId);
  console.log("Visit /j/mist/config.json and /j/mist/theme.css to verify.");
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
