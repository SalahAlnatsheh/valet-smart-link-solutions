# Valet Parking Platform

Multi-tenant valet parking management (NFC, customer self-service, staff queue, admin dashboard).

## Stack

- **Next.js** (App Router) — web app
- **Firebase** (Blaze) — Firestore, Auth, Storage, Hosting, Cloud Functions, FCM
- **Slug-based tenants** — `/j/{slug}/...` (e.g. `/j/mist/...` for Mist UAE)

## Setup

### 1. Firebase project

- Create a project in [Firebase Console](https://console.firebase.google.com) and enable **Blaze**.
- Enable **Firestore**, **Authentication**, **Storage**, **Hosting**, **Functions**.
- In Project settings, copy the client config (apiKey, authDomain, projectId, etc.).
- For Cloud Functions / Admin SDK: create a **Service account** (Project settings → Service accounts → Generate new private key). Note `project_id`, `client_email`, and `private_key`.

### 2. Local env

```bash
cp .env.local.example .env.local
```

Fill in:

- `NEXT_PUBLIC_FIREBASE_*` from Firebase client config.
- `FIREBASE_ADMIN_PROJECT_ID`, `FIREBASE_ADMIN_CLIENT_EMAIL`, `FIREBASE_ADMIN_PRIVATE_KEY` from the service account JSON (use the full private key string; keep newlines as `\n` or paste multi-line).

### 3. Firebase project ID in Cursor

Edit `.firebaserc` and set `"default": "your-actual-firebase-project-id"`.

### 4. Seed data (Mist tenant)

```bash
npm run seed
```

This creates:

- `countryProfiles/AE`, `countryProfiles/JO`
- `tenants/mist-ae-001` (Mist UAE)
- `slugs/mist` → `mist-ae-001`

### 5. Run the app

```bash
npm run dev
```

- **Config**: [http://localhost:3000/j/mist/config.json](http://localhost:3000/j/mist/config.json)
- **Theme**: [http://localhost:3000/j/mist/theme.css](http://localhost:3000/j/mist/theme.css)
- **Customer ticket**: `/j/mist/t/{publicId}?k={token}` (needs a real ticket from staff flow)
- **Staff**: [http://localhost:3000/j/mist/staff](http://localhost:3000/j/mist/staff)
- **Admin**: [http://localhost:3000/j/mist/admin](http://localhost:3000/j/mist/admin)

### 6. Enable Email/Password sign-in (for Staff)

- In Firebase Console → **Authentication** → **Sign-in method**, enable **Email/Password**.
- On first visit to `/j/mist/staff/login`, create the first admin account (name, email, password). No users exist yet, so the form will show “Create first admin account”.

### 7. Deploy Firestore & Storage rules

```bash
firebase deploy --only firestore:rules
firebase deploy --only storage
```

### 8. Deploy Cloud Functions

```bash
cd functions
npm install
npm run build
cd ..
firebase deploy --only functions
```

## Scripts

| Command     | Description                    |
|------------|--------------------------------|
| `npm run dev`  | Next.js dev server             |
| `npm run build`| Next.js production build       |
| `npm run seed` | Seed Mist tenant + country profiles |

## Project layout

- `app/j/[slug]/` — slug-based routes (config, theme, customer, staff, admin)
- `lib/` — types, Firebase client/admin, tenant resolver
- `scripts/seed.ts` — seed Firestore (Mist + countries)
- `functions/` — Cloud Functions (`requestCar`, `staffUpdateStatus`)
- `firestore.rules` / `storage.rules` — security rules

## Next steps (from your build plan)

1. **Step 4 — Staff MVP**: Auth + create ticket page, upload images, write ticket + publicTicket + events.
2. **Step 5 — Customer MVP**: Customer page reads publicTicket; “Request car” calls `requestCar` function.
3. **Step 6 — Real-time queue**: List REQUESTED tickets; status updates READY/DELIVERED; customer page real-time.
4. **Step 7 — Android**: Capacitor wrapper, NFC write, camera, ML Kit OCR.
5. **Step 8+**: Admin reports, HR, payments, hardening.
