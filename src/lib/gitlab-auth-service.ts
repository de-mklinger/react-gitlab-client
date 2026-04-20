import type { SigninRedirectArgs } from "oidc-client-ts";
import { useCallback } from "react";
import { useAuth } from "react-oidc-context";

export type GitLabAuthService = {
  isPending: () => boolean;
  isLoggedIn: () => boolean;
  canLogIn: () => boolean;
  canLogOut: () => boolean;
  getAuthorization: () => string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

export type UseGitLabAuthResult = {
  gitLabAuthService: GitLabAuthService;
};

export function useGitLabAuth(): UseGitLabAuthResult {
  const auth = useAuth();

  const { isAuthenticated, signinRedirect, signoutRedirect, user } = auth;
  const accessToken = user?.access_token;

  const getAuthorization = useCallback(() => {
    if (!accessToken) {
      throw new Error("No access token");
    }
    return `Bearer ${accessToken}`;
  }, [accessToken]);

  const login = useCallback(() => {
    if (isAuthenticated) {
      throw new Error("Already authenticated");
    }

    const args: SigninRedirectArgs = {};
    if (globalThis.location.hash && globalThis.location.hash !== "#") {
      args.state = {
        hash: globalThis.location.hash,
      };
    }
    return signinRedirect(args);
  }, [isAuthenticated, signinRedirect]);

  const logout = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error("Not authenticated");
    }
    await signoutRedirect();
  }, [isAuthenticated, signoutRedirect]);

  return {
    gitLabAuthService: {
      getAuthorization,
      isPending: () => Boolean(auth.activeNavigator) || auth.isLoading,
      isLoggedIn: () => auth.isAuthenticated,
      canLogIn: () => !auth.isAuthenticated,
      canLogOut: () => auth.isAuthenticated,
      login,
      logout,
    },
  };
}
