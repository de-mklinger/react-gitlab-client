import type { PropsWithChildren } from "react";
import { AuthProvider } from "react-oidc-context";
import { useGitLabAuth } from "../lib";
import ErrorBoundary from "./ErrorBoundary.tsx";
import { getAuthProviderProps } from "./settings.ts";

export default function App() {
  return (
    <ErrorBoundary>
      <MyAuthProvider>
        <MyHeader />
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
