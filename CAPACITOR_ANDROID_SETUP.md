# Capacitor Android Setup — What You Need to Do

Capacitor is configured and the Android platform is added. Follow these steps to finish setup and build the app.

---

## 1. Deploy Your Next.js App

You need a live URL for the Android app to load.

1. Push your code to **GitHub** (if not already).
2. Go to [vercel.com](https://vercel.com) and sign in.
3. **Import** your repository.
4. Add **Environment Variables** in Vercel project settings:
   - `NEXT_PUBLIC_FIREBASE_API_KEY`
   - `NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN`
   - `NEXT_PUBLIC_FIREBASE_PROJECT_ID`
   - `NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET`
   - `NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID`
   - `NEXT_PUBLIC_FIREBASE_APP_ID`
   - `NEXT_PUBLIC_VAPID_PUBLIC_KEY`
   - `FIREBASE_ADMIN_PROJECT_ID`
   - `FIREBASE_ADMIN_CLIENT_EMAIL`
   - `FIREBASE_ADMIN_PRIVATE_KEY` (full key, with `\n` for newlines)
   - `VAPID_PUBLIC_KEY` (same as `NEXT_PUBLIC_VAPID_PUBLIC_KEY`)
   - `VAPID_PRIVATE_KEY`
5. **Deploy** and copy your URL (e.g. `https://valet-smart-link-solutions.vercel.app`).

---

## 2. Update Capacitor Config With Your URL

1. Open **`capacitor.config.ts`**.
2. Replace `https://YOUR-DEPLOYED-URL.vercel.app` with your real URL:
   ```ts
   url: "https://valet-smart-link-solutions.vercel.app",
   ```
3. Optionally remove `cleartext: true` (only needed for `http://`).

---

## 3. Add Your Domain in Firebase

1. Go to [Firebase Console](https://console.firebase.google.com) → your project.
2. **Authentication** → **Settings** → **Authorized domains**.
3. Add your deployed domain (e.g. `valet-smart-link-solutions.vercel.app`).

---

## 4. Add Android App in Firebase (for FCM Push)

1. Firebase Console → **Project settings** (gear icon) → **Your apps**.
2. Click **Add app** → choose **Android**.
3. Set **Android package name**: `com.valetsmartlink.solutions` (must match `capacitor.config.ts` `appId`).
4. Register the app and download **`google-services.json`**.
5. Copy `google-services.json` into:
   ```
   android/app/google-services.json
   ```

---

## 5. Enable Firebase Cloud Messaging

1. Firebase Console → **Project settings** → **Cloud Messaging**.
2. Enable **Cloud Messaging** if needed.
3. For FCM v1 API, create a server key or use the existing configuration.

---

## 6. Sync and Open Android Project

Run:

```bash
npm run cap:sync
npm run cap:android
```

This opens the Android project in **Android Studio**.

---

## 7. Build and Run in Android Studio

1. Wait for Gradle sync to finish.
2. Connect a device or start an emulator.
3. Click **Run** (green play button) or `Shift+F10`.
4. The app will open and load your deployed URL.

---

## 8. Test Push Notifications on Android

On Android, push uses **Firebase Cloud Messaging (FCM)**, not web push. Your current backend uses **web push** (VAPID). For native FCM on Android you would need to:

- Register the device with FCM in the app (via `@capacitor/push-notifications`).
- Send the FCM token to your backend and store it per ticket.
- Update your backend to send via FCM when the ticket is marked READY.

That can be done as a follow-up. For now, the app loads your web app, and web push may still work if the WebView supports it (behavior can differ from Chrome on desktop).

---

## Useful Commands

| Command | Purpose |
|---------|---------|
| `npm run cap:sync` | Copy web assets and config to native projects |
| `npm run cap:android` | Open Android project in Android Studio |

---

## Troubleshooting

- **White screen**: Ensure `capacitor.config.ts` `server.url` is correct and the app is deployed.
- **Auth errors**: Add your domain to Firebase Auth authorized domains.
- **Build errors**: Ensure `google-services.json` is in `android/app/` and Android Studio has finished Gradle sync.
