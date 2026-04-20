import type { User } from "oidc-client-ts";

/**
 * To be used as AuthProviderProps.onSigninCallback that strips OAuth query
 * parameters from the URL and restores the previous hash, if any.
 */
export function hashSigninCallback(user?: User) {
  let hash = "";

  const state = user?.state;
  if (isLoginState(state) && state.hash) {
    hash = state.hash;
  }

  globalThis.location.replace(globalThis.location.pathname + hash);
}

export type LoginState = {
  hash?: string;
};

function isLoginState(x: unknown): x is LoginState {
  return (
    isPlainOldObject(x) && (x.hash === undefined || typeof x.hash === "string")
  );
}

function isPlainOldObject(x: unknown): x is Record<string, unknown> {
  return Boolean(x) && typeof x === "object" && !Array.isArray(x);
}
