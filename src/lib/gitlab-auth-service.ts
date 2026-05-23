import type { SigninRedirectArgs, UserProfile } from "oidc-client-ts";
import { useCallback, useMemo } from "react";
import { useAuth } from "react-oidc-context";

export type GitLabAuthService = {
  isPending: () => boolean;
  isLoggedIn: () => boolean;
  canLogIn: () => boolean;
  canLogOut: () => boolean;
  getAccessToken: () => string | undefined;
  getAuthorization: () => string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
  getUserProfile: () => UserProfile | undefined;
};

export type UseGitLabAuthResult = {
  gitLabAuthService: GitLabAuthService;
};

export function useGitLabAuth(): UseGitLabAuthResult {
  const auth = useAuth();

  const { isAuthenticated, signinRedirect, signoutRedirect, user, error } =
    auth;

  if (error) {
    throw error;
  }

  const accessToken = user?.access_token;

  const getAuthorization = useCallback(() => {
    if (!accessToken) {
      throw new Error("No access token");
    }
    return `Bearer ${accessToken}`;
  }, [accessToken]);

  const getAccessToken = useCallback(() => accessToken, [accessToken]);

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

  const isPending = Boolean(auth.activeNavigator) || auth.isLoading;

  const userProfile = user?.profile ?? undefined;
  const getUserProfile = useCallback(() => userProfile, [userProfile]);

  return useMemo(
    () => ({
      gitLabAuthService: {
        getAuthorization,
        getAccessToken,
        isPending: () => isPending,
        isLoggedIn: () => isAuthenticated,
        canLogIn: () => !isAuthenticated,
        canLogOut: () => isAuthenticated,
        login,
        logout,
        getUserProfile,
      },
    }),
    [
      getAuthorization,
      getAccessToken,
      isPending,
      isAuthenticated,
      login,
      logout,
      getUserProfile,
    ],
  );
}
