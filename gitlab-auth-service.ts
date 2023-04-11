import React, { ReactNode, useContext } from "react";
import {
  AuthService,
  AuthTokens,
  IdTokenPayload,
} from "@de-mklinger/react-oauth2-pkce";

type GitLabAuthContextProps = {
  gitLabAuthService: GitLabAuthService;
};

type GitLabAuthContextType = GitLabAuthContextProps | undefined;

const GitLabAuthContext = React.createContext<GitLabAuthContextType>(undefined);

export const useGitLabAuth = function useGitLabAuth(): GitLabAuthContextProps {
  const context = useContext(GitLabAuthContext);

  if (context === undefined) {
    throw new Error("useGitLabAuth must be used within a GitLabAuthProvider");
  }

  return context;
};

export interface GitLabAuthProviderProps {
  children: ReactNode;
  gitLabAuthService: GitLabAuthService;
}

export function GitLabAuthProvider(props: GitLabAuthProviderProps) {
  const gitLabAuthService = props.gitLabAuthService;
  const children = props.children;
  return React.createElement(
    GitLabAuthContext.Provider,
    {
      value: {
        gitLabAuthService: gitLabAuthService,
      },
    },
    children
  );
}

export type MeUrlSupplier<IdTokenPayloadT = IdTokenPayload> = (
  idTokenPayload: IdTokenPayloadT
) => string;

export interface GitLabAuthServiceProps<IdTokenPayloadT = IdTokenPayload> {
  clientId: string;
  provider: string;
  redirectUri: string;
  autoFetchMe?: boolean;
  scopes?: string[];
  meUrlSupplier?: MeUrlSupplier<IdTokenPayloadT>;
}

export class GitLabAuthService<
  IdTokenPayloadT = IdTokenPayload,
  MeT = unknown
> {
  private delegate: AuthService<IdTokenPayloadT>;
  private readonly autoFetchMe: boolean;
  private readonly meUrlSupplier?: MeUrlSupplier<IdTokenPayloadT>;

  constructor({
    clientId,
    provider,
    redirectUri,
    autoFetchMe = false,
    scopes = ["openid", "profile"],
    meUrlSupplier,
  }: GitLabAuthServiceProps<IdTokenPayloadT>) {
    this.delegate = new AuthService({
      clientId,
      provider,
      redirectUri,
      scopes: scopes,
      autoRefresh: true,
    });

    this.autoFetchMe = autoFetchMe;
    this.meUrlSupplier = meUrlSupplier;

    if (
      this.autoFetchMe &&
      this.meUrlSupplier &&
      this.isLoggedIn() &&
      !this.getMe()
    ) {
      const meEndpoint = this.meUrlSupplier(this.getIdTokenPayload());
      this.fetchMe(meEndpoint).then((me) => {
        console.log("Have me:", me);
        // Ugly hack to trigger re-render:
        window.location.reload();
      });
    }
  }

  async fetchMe(meEndpoint: string): Promise<MeT> {
    return fetch(meEndpoint, {
      headers: new Headers({
        Authorization: this.getAuthorization(),
      }),
    })
      .then((response) => response.json())
      .then((me) => {
        this.setMe(me);
        return me;
      });
  }

  getAuthorization() {
    const accessToken = this.getAuthTokens()?.access_token;
    if (!accessToken) {
      throw new Error("No access token available");
    }
    return "Bearer " + accessToken;
  }

  async login(): Promise<void> {
    try {
      await this.delegate.login();
    } catch (e) {
      throw e;
    }
  }

  isPending(): boolean {
    return (
      this.delegate.isPending() ||
      (this.autoFetchMe && this.delegate.isLoggedIn() && !this.getMe())
    );
  }

  isLoggedIn(): boolean {
    return this.delegate.isLoggedIn();
  }

  async logout(shouldEndSession?: boolean): Promise<void> {
    this.setMe(undefined);
    return this.delegate.logout(shouldEndSession);
  }

  getAuthTokens(): AuthTokens {
    return this.delegate.getAuthTokens();
  }

  getMe(): MeT | undefined {
    let me = window.localStorage.getItem("me");
    if (me) {
      return JSON.parse(me);
    } else {
      return undefined;
    }
  }

  setMe(me: MeT | undefined): void {
    if (!me) {
      window.localStorage.removeItem("me");
    } else {
      window.localStorage.setItem("me", JSON.stringify(me));
    }
  }

  getIdTokenPayload(): IdTokenPayloadT {
    return this.delegate.getIdTokenPayload();
  }
}
