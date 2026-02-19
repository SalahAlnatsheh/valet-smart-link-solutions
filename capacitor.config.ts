import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.valetsmartlink.solutions",
  appName: "Valet Smart Link",
  webDir: "public",
  server: {
    // Replace with your deployed URL after deploying to Vercel/hosting
    // e.g. https://valet-smart-link-solutions.vercel.app
    url: "https://YOUR-DEPLOYED-URL.vercel.app",
    cleartext: true,
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ["badge", "sound", "alert"],
    },
  },
};

export default config;
