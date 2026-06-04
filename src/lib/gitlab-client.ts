import {
  type CommitAction,
  type GetCommitDiffArgs,
  type GetCommitDiffResponse,
  type GitlabCommit,
  isGetCommitDiffResponse,
  isGitlabCommit,
  isListRepositoryCommitsResponse,
  isListRepositoryTreesResponse,
  isRepositoryFile,
  type ListRepositoryCommitsArgs,
  type ListRepositoryCommitsResponse,
  type ListRepositoryTreesArgs,
  type ListRepositoryTreesResponse,
  type RepositoryFile,
} from "./gitlab-types";
import { HttpResponseError } from "./http-response-error";

const simulateSlowResponses = false;

async function sleepRandom(): Promise<void> {
  const millis = Math.round(5000 * Math.random() + 1000);
  return sleep(millis);
}

async function sleep(millis: number): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(), millis));
}

type FetchInit = {
  method?: string;
  headers?: Record<string, string>;
  bodyObject?: unknown;
  query?: string[][] | Record<string, string> | string | URLSearchParams;
};

type FetchJsonInit<T> = FetchInit & {
  typeGuard?: (x: unknown) => x is T;
};

export type GitlabClientOpts = {
  gitlabUrl: string;
  accessToken?: string;
  simulateSlowResponses?: boolean;
};

export class GitlabClient {
  private readonly accessToken: string | undefined;
  private readonly gitlabUrl: string;

  constructor(opts: GitlabClientOpts) {
    this.gitlabUrl = opts.gitlabUrl;
    this.accessToken = opts.accessToken;
  }

  private async fetch(path: string, init?: FetchInit): Promise<Response> {
    const additionalHeaders: Record<string, string> = {};

    if (this.accessToken) {
      additionalHeaders["Authorization"] = `Bearer ${this.accessToken}`;
    }

    let body = undefined;
    if (init?.bodyObject) {
      body = JSON.stringify(init.bodyObject);
      additionalHeaders["Content-Type"] = "application/json";
    }

    if (simulateSlowResponses) {
      await sleepRandom();
    }

    const url = new URL(`${this.gitlabUrl}${path}`);
    if (init?.query) {
      url.search = new URLSearchParams(init.query).toString();
    }

    return fetch(url, {
      method: init?.method ?? "GET",
      headers: new Headers({
        ...additionalHeaders,
        ...init?.headers,
      }),
      body,
    });
  }

  private async fetchJson<T = unknown>(
    path: string,
    init?: FetchJsonInit<T>,
  ): Promise<T> {
    const response = await this.fetch(path, init);

    let body: unknown;
    try {
      body = await response.json();
    } catch (e) {
      if (!response.ok) {
        throw new HttpResponseError(response.status);
      }
      throw e;
    }

    if (!response.ok) {
      throw new HttpResponseError(
        response.status,
        "HTTP response error: " +
          response.status +
          ".\nBody:\n" +
          JSON.stringify(body, null, "  "),
      );
    }

    if (init?.typeGuard && !init.typeGuard(body)) {
      throw new Error("Response body does not match expected type");
    }

    return body as T;
  }

  public async fetchRepositoryFileXml(
    projectIdOrPath: number | string,
    filePath: string,
    ref = "master",
  ): Promise<Document> {
    return this.fetchRepositoryFileContentUtf8(
      projectIdOrPath,
      filePath,
      ref,
    ).then((xml) => new DOMParser().parseFromString(xml, "text/xml"));
  }

  public async fetchRepositoryFileContentUtf8(
    projectIdOrPath: number | string,
    filePath: string,
    ref = "master",
  ): Promise<string> {
    return this.fetchRepositoryFile(projectIdOrPath, filePath, ref).then(
      (file) => {
        if (file.encoding === "base64") {
          return GitlabClient.fromBase64Utf8(file.content);
        } else {
          throw new Error("Encoding not implemented: " + file.encoding);
        }
      },
    );
  }

  private async fetchRepositoryFile(
    projectIdOrPath: number | string,
    filePath: string,
    ref: string,
  ): Promise<RepositoryFile> {
    return this.fetchJson(this.getFilePath(projectIdOrPath, filePath, ref), {
      typeGuard: isRepositoryFile,
    });
  }

  private getFilePath(
    projectIdOrPath: number | string,
    filePath: string,
    ref: string,
    opts?: { raw?: boolean; addAccessToken?: boolean },
  ): string {
    const query = new URLSearchParams();

    query.set("ref", ref);

    if (opts?.addAccessToken && this.accessToken) {
      query.set("access_token", this.accessToken);
    }

    return `/api/v4/projects/${encodeURIComponent(
      projectIdOrPath,
    )}/repository/files/${encodeURIComponent(filePath)}${
      opts?.raw ? "/raw" : ""
    }?${query.toString()}`;
  }

  public getRawFileUrl(
    projectIdOrPath: number | string,
    filePath: string,
    ref: string,
    opts?: { addAccessToken?: boolean },
  ): string {
    return `${this.gitlabUrl}${this.getFilePath(
      projectIdOrPath,
      filePath,
      ref,
      {
        ...opts,
        raw: true,
      },
    )}`;
  }

  public getUiFileUrl(
    projectIdOrPath: number | string,
    filePath: string,
    ref: string,
    opts?: {
      refType?: "heads" | "tags";
      noInline?: boolean;
    },
  ) {
    function encodeURIKeepSlashes(s: string): string {
      return encodeURIComponent(s).replace(/%2F/gi, "/");
    }

    const query = new URLSearchParams();

    if (opts?.refType) {
      query.set("ref_type", opts.refType);
    }

    if (opts?.noInline) {
      query.set("inline", "false");
    }

    let querySuffix = "";
    if (query.size > 0) {
      querySuffix = `?${query.toString()}`;
    }

    return `${this.gitlabUrl}/${encodeURIKeepSlashes(projectIdOrPath.toString())}/-/raw/${encodeURIComponent(ref)}/${encodeURIKeepSlashes(filePath)}${querySuffix}`;
  }

  public async repositoryFileExists(
    projectIdOrPath: number | string,
    filePath: string,
    ref: string,
  ): Promise<boolean> {
    const response = await this.fetch(
      this.getFilePath(projectIdOrPath, filePath, ref),
      { method: "HEAD" },
    );
    if (response.ok) {
      return true;
    } else if (response.status === 404) {
      return false;
    } else {
      throw new Error(
        `Unexpected response status ${response.status} for ${response.url}`,
      );
    }
  }

  public async createCommit(
    projectIdOrPath: number | string,
    branch: string,
    actions: CommitAction[],
    commitMessage = "Update",
  ): Promise<GitlabCommit> {
    return await this.fetchJson(
      `/api/v4/projects/${encodeURIComponent(
        projectIdOrPath,
      )}/repository/commits`,
      {
        method: "POST",
        bodyObject: {
          branch,
          commit_message: commitMessage,
          actions,
        },
        typeGuard: isGitlabCommit,
      },
    );
  }

  // private static toBase64Utf8(str: string): string {
  //   return btoa(unescape(encodeURIComponent(str)));
  // }

  private static fromBase64Utf8(str: string): string {
    return decodeURIComponent(escape(atob(str)));
  }

  public listRepositoryTrees(
    projectIdOrPath: string,
    args?: ListRepositoryTreesArgs,
  ): Promise<ListRepositoryTreesResponse> {
    return this.fetchJson(
      `/api/v4/projects/${encodeURIComponent(projectIdOrPath)}/repository/tree`,
      {
        method: "GET",
        query: GitlabClient.toQuery(args),
        typeGuard: isListRepositoryTreesResponse,
      },
    );
  }

  public listRepositoryCommits(
    projectIdOrPath: number | string,
    args?: ListRepositoryCommitsArgs,
  ): Promise<ListRepositoryCommitsResponse> {
    return this.fetchJson(
      `/api/v4/projects/${encodeURIComponent(
        projectIdOrPath,
      )}/repository/commits`,
      {
        method: "GET",
        query: GitlabClient.toQuery(args),
        typeGuard: isListRepositoryCommitsResponse,
      },
    );
  }

  public getCommitDiff(
    projectIdOrPath: number | string,
    sha: string,
    opts?: GetCommitDiffArgs,
  ): Promise<GetCommitDiffResponse> {
    return this.fetchJson(
      `/api/v4/projects/${encodeURIComponent(projectIdOrPath)}/repository/commits/${encodeURIComponent(sha)}/diff`,
      {
        method: "GET",
        query: GitlabClient.toQuery(opts),
        typeGuard: isGetCommitDiffResponse,
      },
    );
  }

  private static toQuery(
    obj?: Record<string, unknown>,
  ): string[][] | undefined {
    if (!obj) {
      return undefined;
    }

    return Object.entries(obj).map(([k, v]) => [k, String(v)]);
  }
}
