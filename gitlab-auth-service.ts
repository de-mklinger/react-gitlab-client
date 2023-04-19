import { useAuth } from "react-oidc-context";
import { LoginState, settings } from "../../settings";
import { useCallback } from "react";

export type GitLabAuthService = {
  isPending: () => boolean;
  isLoggedIn: () => boolean;
  canLogIn: () => boolean;
  canLogOut: () => boolean;
  getAuthorization: () => string;
  login: () => Promise<void>;
  logout: () => Promise<void>;
};

export function useGitLabAuth(): { gitLabAuthService: GitLabAuthService } {
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
      throw new Error();
    }

    let state: LoginState | undefined;
    if (window.location.hash && window.location.hash !== "#") {
      state = {
        hash: window.location.hash,
      };
    }
    return signinRedirect({
      state,
    });
  }, [isAuthenticated, signinRedirect]);

  const logout = useCallback(async () => {
    if (!isAuthenticated) {
      throw new Error();
    }
    await signoutRedirect();
  }, [isAuthenticated, signoutRedirect]);

  return {
    gitLabAuthService: {
      getAuthorization,
      isPending: () => Boolean(auth.activeNavigator) || auth.isLoading,
      isLoggedIn: () => auth.isAuthenticated,
      canLogIn: () => !settings.immediateLogin && !auth.isAuthenticated,
      canLogOut: () => !settings.immediateLogin && auth.isAuthenticated,
      login,
      logout,
    },
  };
}
