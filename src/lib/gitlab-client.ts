import { type GitLabAuthService } from "./gitlab-auth-service";
import {
  type CommitAction,
  type GitlabCommit,
  isGitlabCommit,
  isRepositoryFile,
  type RepositoryFile,
} from "./gitlab-types";
import { isPlainOldObject } from "./is-plain-old-object.ts";

const simulateSlowResponses = false;

async function sleepRandom(): Promise<void> {
  const millis = 5000 * Math.random();
  return sleep(millis);
}

async function sleep(millis: number): Promise<void> {
  return new Promise((resolve) => setTimeout(() => resolve(), millis));
}

export class HttpResponseError extends Error {
  public readonly status: number;

  constructor(status: number, message?: string) {
    super(message ?? "HTTP response error: " + status);
    this.status = status;
  }

  public isNotFound(): boolean {
    return this.status === 404;
  }
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

export class GitlabClient {
  private readonly gitlabAuthService: GitLabAuthService;
  private readonly gitlabUrl: string;

  constructor(gitlabUrl: string, gitlabAuthService: GitLabAuthService) {
    this.gitlabUrl = gitlabUrl;
    this.gitlabAuthService = gitlabAuthService;
  }

  private async fetch(path: string, init?: FetchInit): Promise<Response> {
    const additionalHeaders: { [name: string]: string } = {
      Authorization: this.gitlabAuthService.getAuthorization(),
    };

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
    raw = false,
  ): string {
    return `/api/v4/projects/${encodeURIComponent(
      projectIdOrPath,
    )}/repository/files/${encodeURIComponent(filePath)}${
      raw ? "/raw" : ""
    }?ref=${ref}`;
  }

  public getRawFileUrl(
    projectIdOrPath: number | string,
    filePath: string,
    ref: string,
  ): string {
    return `${this.gitlabUrl}${this.getFilePath(
      projectIdOrPath,
      filePath,
      ref,
      true,
    )}`;
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

export type ListRepositoryTreesArgs = {
  /** Tree record ID at which to fetch the next page. Used only with keyset pagination. */
  page_token?: string;
  /** If keyset, use the keyset-based pagination method. */
  pagination?: string;
  /** Path inside the repository. Used to get content of subdirectories. */
  path?: string;
  /** Number of results to show per page. If not specified, defaults to 20. For more information, see pagination. */
  per_page?: number;
  /** If true, get a recursive tree. Default is false. */
  recursive?: boolean;
  /** Name of a repository branch or tag. If not specified, uses the default branch. */
  ref?: string;
};

export type ListRepositoryTreesResponse =
  Array<ListRepositoryTreesResponseItem>;

export function isListRepositoryTreesResponse(
  x: unknown,
): x is ListRepositoryTreesResponse {
  return Array.isArray(x) && x.every(isListRepositoryTreesResponseItem);
}

export type ListRepositoryTreesResponseItem = {
  id: string;
  name: string;
  type: "tree" | "blob" | string;
  path: string;
  mode: string;
};

export function isListRepositoryTreesResponseItem(
  x: unknown,
): x is ListRepositoryTreesResponseItem {
  return (
    isPlainOldObject(x) &&
    typeof x.id === "string" &&
    typeof x.name === "string" &&
    typeof x.type === "string" &&
    typeof x.path === "string" &&
    typeof x.mode === "string"
  );
}
