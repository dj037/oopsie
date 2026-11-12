import type { CapacitorConfig } from "@capacitor/cli";

const config: CapacitorConfig = {
  appId: "com.oopsie.app",
  appName: "Oopsie",
  webDir: "dist",
  ios: { contentInset: "never", backgroundColor: "#F7F8FA" },
  plugins: {
    CapacitorHttp: { enabled: true },
    CapacitorCookies: { enabled: true },
  },
};
export default config;
