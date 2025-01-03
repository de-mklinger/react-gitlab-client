import { GitLabAuthService } from "./gitlab-auth-service";
import { GitlabCommit, isGitlabCommit } from "./gitlab-types";

export interface CommitAction {
  action: "create" | "delete" | "move" | "update" | "chmod"; //	yes	The action to perform, create, delete, move, update, chmod
  file_path: string; //	yes	Full path to the file. Ex. lib/class.rb
  previous_path?: string; //	no	Original full path to the file being moved. Ex. lib/class1.rb. Only considered for move action.
  content?: string; //	no	File content, required for all except delete, chmod, and move. Move actions that do not specify content preserve the existing file content, and any other value of content overwrites the file content.
  encoding?: "text" | "base64"; //	no	text or base64. text is default.
  last_commit_id?: string; //	no	Last known file commit ID. Only considered in update, move, and delete actions.
  execute_filemode?: boolean; //	no	When true/false enables/disables the execute flag on the file. Only considered for chmod action.
}

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

export class GitlabClient {
  private readonly gitlabAuthService: GitLabAuthService;
  private readonly gitlabUrl: string;

  constructor(gitlabUrl: string, gitlabAuthService: GitLabAuthService) {
    this.gitlabUrl = gitlabUrl;
    this.gitlabAuthService = gitlabAuthService;
  }

  private async fetch(
    path: string,
    method: string = "GET",
    bodyObject?: any,
    headers?: Record<string, string>
  ): Promise<Response> {
    const additionalHeaders: { [name: string]: string } = {
      Authorization: this.gitlabAuthService.getAuthorization(),
    };

    let body = undefined;
    if (bodyObject !== null && bodyObject !== undefined) {
      body = JSON.stringify(bodyObject);
      additionalHeaders["Content-Type"] = "application/json";
    }

    if (simulateSlowResponses) {
      await sleepRandom();
    }

    return fetch(`${this.gitlabUrl}${path}`, {
      method,
      headers: new Headers({
        ...additionalHeaders,
        ...headers,
      }),
      body,
    });
  }

  private async fetchJson(
    path: string,
    method: string = "GET",
    bodyObject?: any,
    headers?: Record<string, string>
  ): Promise<unknown> {
    const response = await this.fetch(path, method, bodyObject, headers);

    let body;
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
          JSON.stringify(body, null, "  ")
      );
    }

    return body;
  }

  public async fetchRepositoryFileXml(
    projectIdOrPath: number | string,
    filePath: string,
    ref = "master"
  ): Promise<Document> {
    return this.fetchRepositoryFileContentUtf8(
      projectIdOrPath,
      filePath,
      ref
    ).then((xml) => new DOMParser().parseFromString(xml, "text/xml"));
  }

  public async fetchRepositoryFileContentUtf8(
    projectIdOrPath: number | string,
    filePath: string,
    ref = "master"
  ): Promise<string> {
    return this.fetchRepositoryFile(projectIdOrPath, filePath, ref).then(
      (file) => {
        if (file.encoding === "base64") {
          return GitlabClient.fromBase64Utf8(file.content);
        } else {
          throw new Error("Encoding not implemented: " + file.encoding);
        }
      }
    );
  }

  private async fetchRepositoryFile(
    projectIdOrPath: number | string,
    filePath: string,
    ref: string
  ): Promise<any> {
    return this.fetchJson(this.getFilePath(projectIdOrPath, filePath, ref));
  }

  private getFilePath(
    projectIdOrPath: number | string,
    filePath: string,
    ref: string,
    raw = false
  ): string {
    return `/api/v4/projects/${encodeURIComponent(
      projectIdOrPath
    )}/repository/files/${encodeURIComponent(filePath)}${
      raw ? "/raw" : ""
    }?ref=${ref}`;
  }

  public getRawFileUrl(
    projectIdOrPath: number | string,
    filePath: string,
    ref: string
  ): string {
    return `${this.gitlabUrl}${this.getFilePath(
      projectIdOrPath,
      filePath,
      ref,
      true
    )}`;
  }

  public async repositoryFileExists(
    projectIdOrPath: number | string,
    filePath: string,
    ref: string
  ): Promise<boolean> {
    const response = await this.fetch(
      this.getFilePath(projectIdOrPath, filePath, ref),
      "HEAD"
    );
    if (response.ok) {
      return true;
    } else if (response.status === 404) {
      return false;
    } else {
      throw new Error(
        `Unexpected response status ${response.status} for ${response.url}`
      );
    }
  }

  // update file
  // public async putRepositoryFile(projectIdOrPath: number | string, filePath: string, branch: string, content: string): Promise<any> {
  //     const bodyObject = {
  //         branch,
  //         content,
  //         commit_message: "Update file"
  //     }
  //     return this.fetchJson(
  //         `/api/v4/projects/${encodeURIComponent(projectIdOrPath)}/repository/files/${encodeURIComponent(filePath)}`,
  //         "PUT",
  //         bodyObject
  //     );
  // }

  public async createCommit(
    projectIdOrPath: number | string,
    branch: string,
    actions: CommitAction[],
    commitMessage = "Update"
  ): Promise<GitlabCommit> {
    const data = await this.fetchJson(
      `/api/v4/projects/${encodeURIComponent(
        projectIdOrPath
      )}/repository/commits`,
      "POST",
      {
        branch,
        commit_message: commitMessage,
        actions,
      }
    );

    if (!isGitlabCommit(data)) {
      throw new Error("Invalid gitlab response");
    }

    return data as GitlabCommit;
  }

  // private static toBase64Utf8(str: string): string {
  //   return btoa(unescape(encodeURIComponent(str)));
  // }

  private static fromBase64Utf8(str: string): string {
    return decodeURIComponent(escape(atob(str)));
  }
}
