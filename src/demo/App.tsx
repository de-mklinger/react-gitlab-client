import { type PropsWithChildren, useEffect, useState } from "react";
import { AuthProvider } from "react-oidc-context";
import { GitlabClient, useGitLabAuth } from "../lib";
import type { ListRepositoryTreesResponse } from "../lib/gitlab-client.ts";
import ErrorBoundary from "./ErrorBoundary.tsx";
import { getAuthProviderProps, getSettings } from "./settings.ts";

export default function App() {
  return (
    <ErrorBoundary>
      <MyAuthProvider>
        <MyHeader />
        <MyBody />
      </MyAuthProvider>
    </ErrorBoundary>
  );
}

function MyAuthProvider({ children }: PropsWithChildren) {
  const props = getAuthProviderProps();
  console.log("AuthProvider props:", props);
  return <AuthProvider {...props}>{children}</AuthProvider>;
}

function MyHeader() {
  const { gitLabAuthService } = useGitLabAuth();

  return (
    <div style={{ display: "flex", gap: "1rem" }}>
      {gitLabAuthService.isLoggedIn() ? (
        <>
          We are logged-in. Hello{" "}
          {gitLabAuthService.getUserProfile()?.name ?? "User"}!
        </>
      ) : (
        <>We are not logged-in.</>
      )}
      {gitLabAuthService.canLogIn() && (
        <button onClick={() => gitLabAuthService.login()}>Log in</button>
      )}
      {gitLabAuthService.canLogOut() && (
        <button onClick={() => gitLabAuthService.logout()}>Log out</button>
      )}
      {gitLabAuthService.isPending() && <span>Loading...</span>}
    </div>
  );
}

function MyBody() {
  const { gitlabUrl, gitlabProjectPath } = getSettings();
  const { gitLabAuthService } = useGitLabAuth();

  const [respositoryTrees, setRespositoryTrees] =
    useState<ListRepositoryTreesResponse>();
  const [error, setError] = useState<unknown>();

  const isLoggedIn = gitLabAuthService.isLoggedIn();

  useEffect(() => {
    if (isLoggedIn) {
      const gitLabClient = new GitlabClient(gitlabUrl, gitLabAuthService);
      gitLabClient
        .listRepositoryTrees(gitlabProjectPath)
        .then(setRespositoryTrees)
        .catch(setError);
    }
  }, [gitlabUrl, gitLabAuthService, isLoggedIn, gitlabProjectPath]);

  if (error) {
    throw error;
  }

  return <pre>{JSON.stringify(respositoryTrees, null, 2)}</pre>;
}
