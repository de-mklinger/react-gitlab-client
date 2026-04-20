import type { AuthProviderProps } from "react-oidc-context";
import { hashSigninCallback } from "../lib/hash-signin-callback.ts";

const envPrefix = "VITE_";

const envMapping = {
  gitlabUrl: "GITLAB_URL",
  gitlabOauthApplicationId: "GITLAB_OAUTH_APPLICATION_ID",
  gitlabOauthRedirectUrl: "GITLAB_OAUTH_REDIRECT_URL",
  gitlabProjectPath: "GITLAB_PROJECT_PATH",
} as const;

type SettingsKeys = keyof typeof envMapping;

export type Settings = Record<SettingsKeys, string>;

let cachedSettings: Settings | undefined;

export function getSettings(): Settings {
  if (!cachedSettings) {
    const missing: SettingsKeys[] = [];
    const settings = {};

    for (const key of Object.keys(envMapping) as SettingsKeys[]) {
      const value = getEnv(envMapping[key]);
      if (!value) {
        missing.push(key);
      }
      settings[key] = value;
    }

    if (missing.length > 0) {
      throw new Error(
        "Insufficient configuration. Please check your .env files, e.g. .env.development.\nMissing environment variable(s): " +
          missing.map((key) => envMapping[key]).join(","),
      );
    }

    cachedSettings = settings as Settings;
  }

  return cachedSettings;
}

function getEnv(name: string): string | undefined {
  return import.meta.env[`${envPrefix}${name}`];
}

export function getAuthProviderProps(): AuthProviderProps {
  const settings = getSettings();

  return {
    authority: settings.gitlabUrl,
    client_id: settings.gitlabOauthApplicationId,
    redirect_uri: settings.gitlabOauthRedirectUrl,
    scope: ["openid", "profile", "api"].join(" "),
    automaticSilentRenew: true,
    onSigninCallback: hashSigninCallback,
  };
}
