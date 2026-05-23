import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitlabClient } from "./gitlab-client";
import type { CommitAction } from "./gitlab-types.ts";
import { isPlainOldObject } from "./is-plain-old-object.ts";

describe("GitlabClient", () => {
  const mockFetch = vi.fn();

  const gitlabClient = new GitlabClient({
    gitlabUrl: "https://gitlab.example.com",
    accessToken: "token",
  });

  const gitlabClient_fetch = gitlabClient["fetch"].bind(gitlabClient);
  const gitlabClient_fetchJson = gitlabClient["fetchJson"].bind(gitlabClient);

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal("fetch", mockFetch);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  describe("fetch", () => {
    it("should make a GET request with the correct URL and headers", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

      await gitlabClient_fetch("/api/v4/projects");

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("https://gitlab.example.com/api/v4/projects"),
        {
          method: "GET",
          headers: new Headers({
            Authorization: "Bearer token",
          }),
          body: undefined,
        },
      );
    });

    it("should append query parameters to the URL", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 200 }),
      );

      await gitlabClient_fetch("/api/v4/projects", {
        query: { search: "test" },
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("https://gitlab.example.com/api/v4/projects?search=test"),
        {
          method: "GET",
          headers: new Headers({
            Authorization: "Bearer token",
          }),
          body: undefined,
        },
      );
    });

    it("should send a POST request with JSON body", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ success: true }), { status: 201 }),
      );

      const bodyObject = { name: "new project" };

      await gitlabClient_fetch("/api/v4/projects", {
        method: "POST",
        bodyObject,
      });

      expect(mockFetch).toHaveBeenCalledWith(
        new URL("https://gitlab.example.com/api/v4/projects"),
        {
          method: "POST",
          headers: new Headers({
            Authorization: "Bearer token",
            "Content-Type": "application/json",
          }),
          body: JSON.stringify(bodyObject),
        },
      );
    });

    it("should throw an error when fetch fails", async () => {
      mockFetch.mockRejectedValueOnce(new Error("Fetch error"));

      await expect(gitlabClient_fetch("/api/v4/projects")).rejects.toThrow(
        "Fetch error",
      );
    });
  });

  describe("fetchJson", () => {
    it("should return parsed JSON when response is ok", async () => {
      const data = { id: 1, name: "Test Project" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(data), { status: 200 }),
      );

      const result = await gitlabClient_fetchJson("/api/v4/projects/1");

      expect(result).toEqual(data);
    });

    it("should throw HttpResponseError when response is not ok", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({ error: "Not Found" }), { status: 404 }),
      );

      await expect(
        gitlabClient_fetchJson("/api/v4/projects/1"),
      ).rejects.toThrow("HTTP response error: 404");
    });

    it("should throw HttpResponseError when response is not ok and no JSON response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("some non-json body", { status: 500 }),
      );

      await expect(
        gitlabClient_fetchJson("/api/v4/projects/1"),
      ).rejects.toThrow("HTTP response error: 500");
    });

    it("should throw HttpResponseError when response is not valid JSON response", async () => {
      mockFetch.mockResolvedValueOnce(
        new Response("some non-json body", { status: 200 }),
      );

      await expect(
        gitlabClient_fetchJson("/api/v4/projects/1"),
      ).rejects.toThrow(SyntaxError);
    });

    it("should throw error if typeGuard fails", async () => {
      const data = { id: 1, name: "Test Project" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(data), { status: 200 }),
      );

      const typeGuard = (x: unknown): x is { different: string } =>
        isPlainOldObject(x) && "different" in x;

      await expect(
        gitlabClient_fetchJson("/api/v4/projects/1", { typeGuard }),
      ).rejects.toThrow("Response body does not match expected type");
    });
  });

  describe("getFilePath", () => {
    const getFilePath = gitlabClient["getFilePath"].bind(gitlabClient);

    it("should return the correct file path", () => {
      expect(getFilePath(123, "path/to/file.ts", "main")).toBe(
        "/api/v4/projects/123/repository/files/path%2Fto%2Ffile.ts?ref=main",
      );
    });

    it("should return the correct raw file path", () => {
      expect(
        getFilePath("group/project", "path/to/file.ts", "v1.0", true),
      ).toBe(
        "/api/v4/projects/group%2Fproject/repository/files/path%2Fto%2Ffile.ts?ref=v1.0",
      );
    });
  });

  describe("getRawFileUrl", () => {
    it("should return the full raw file URL", () => {
      expect(gitlabClient.getRawFileUrl(123, "README.md", "master")).toBe(
        "https://gitlab.example.com/api/v4/projects/123/repository/files/README.md/raw?ref=master",
      );
    });
  });

  describe("getUiFileUrl", () => {
    it("should return the correct URL for numeric project ID and simple file path", () => {
      const url = gitlabClient.getUiFileUrl(123, "README.md", "main");
      expect(url).toBe("https://gitlab.example.com/123/-/raw/main/README.md");
    });

    it("should return the correct URL for project path and file path with slashes", () => {
      const url = gitlabClient.getUiFileUrl(
        "group/subgroup/project",
        "src/lib/index.ts",
        "develop",
      );
      expect(url).toBe(
        "https://gitlab.example.com/group/subgroup/project/-/raw/develop/src/lib/index.ts",
      );
    });

    it("should return the correct URL with refType heads", () => {
      const url = gitlabClient.getUiFileUrl(
        "group/subgroup/project",
        "src/lib/index.ts",
        "develop",
        { refType: "heads" },
      );
      expect(url).toBe(
        "https://gitlab.example.com/group/subgroup/project/-/raw/develop/src/lib/index.ts?ref_type=heads",
      );
    });

    it("should return the correct URL with noInline", () => {
      const url = gitlabClient.getUiFileUrl(
        "group/subgroup/project",
        "src/lib/index.ts",
        "develop",
        { noInline: true },
      );
      expect(url).toBe(
        "https://gitlab.example.com/group/subgroup/project/-/raw/develop/src/lib/index.ts?inline=false",
      );
    });

    it("should return the correct URL for project path and file path with slashes", () => {
      const url = gitlabClient.getUiFileUrl(
        "group/subgroup/project",
        "src/lib/index.ts",
        "develop",
        { refType: "tags" },
      );
      expect(url).toBe(
        "https://gitlab.example.com/group/subgroup/project/-/raw/develop/src/lib/index.ts?ref_type=tags",
      );
    });

    it("should encode special characters in ref", () => {
      const url = gitlabClient.getUiFileUrl(
        "my-project",
        "file.txt",
        "feature/branch#1",
      );
      expect(url).toBe(
        "https://gitlab.example.com/my-project/-/raw/feature%2Fbranch%231/file.txt",
      );
    });
  });

  describe("repositoryFileExists", () => {
    it("should return true when response is ok", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 200 }));
      const exists = await gitlabClient.repositoryFileExists(
        123,
        "file.ts",
        "main",
      );
      expect(exists).toBe(true);
      expect(mockFetch).toHaveBeenCalledWith(
        expect.any(URL),
        expect.objectContaining({ method: "HEAD" }),
      );
    });

    it("should return false when response status is 404", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 404 }));
      const exists = await gitlabClient.repositoryFileExists(
        123,
        "file.ts",
        "main",
      );
      expect(exists).toBe(false);
    });

    it("should throw error for unexpected status", async () => {
      mockFetch.mockResolvedValueOnce(new Response(null, { status: 500 }));
      await expect(
        gitlabClient.repositoryFileExists(123, "file.ts", "main"),
      ).rejects.toThrow("Unexpected response status 500");
    });
  });

  describe("repository file operations", () => {
    it("fetchRepositoryFile should return file data", async () => {
      const fileData = {
        file_name: "test.txt",
        file_path: "test.txt",
        size: 5,
        encoding: "base64",
        content_sha256: "sha256",
        ref: "main",
        blob_id: "blob",
        commit_id: "commit",
        last_commit_id: "last",
        execute_filemode: false,
        content: "SGVsbG8=",
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(fileData), { status: 200 }),
      );

      const result = await gitlabClient["fetchRepositoryFile"](
        123,
        "test.txt",
        "main",
      );
      expect(result).toEqual(fileData);
    });

    it("fetchRepositoryFileContentUtf8 should return decoded content", async () => {
      const fileData = {
        file_name: "test.txt",
        file_path: "test.txt",
        size: 11,
        encoding: "base64",
        content_sha256: "sha256",
        ref: "main",
        blob_id: "blob",
        commit_id: "commit",
        last_commit_id: "last",
        execute_filemode: false,
        content: "SGVsbG8gd29ybGQ=",
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(fileData), { status: 200 }),
      );

      const result = await gitlabClient.fetchRepositoryFileContentUtf8(
        123,
        "test.txt",
        "main",
      );
      expect(result).toBe("Hello world");
    });

    it("fetchRepositoryFileContentUtf8 should throw error for unknown encoding", async () => {
      const fileData = {
        file_name: "test.txt",
        file_path: "test.txt",
        size: 5,
        encoding: "text",
        content_sha256: "sha256",
        ref: "main",
        blob_id: "blob",
        commit_id: "commit",
        last_commit_id: "last",
        execute_filemode: false,
        content: "Hello",
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(fileData), { status: 200 }),
      );

      await expect(
        gitlabClient.fetchRepositoryFileContentUtf8(123, "test.txt", "main"),
      ).rejects.toThrow("Encoding not implemented: text");
    });

    it("fetchRepositoryFileXml should return a Document", async () => {
      const xmlContent = "<root><child>test</child></root>";
      const base64Xml = btoa(xmlContent);
      const fileData = {
        file_name: "test.xml",
        file_path: "test.xml",
        size: xmlContent.length,
        encoding: "base64",
        content_sha256: "sha256",
        ref: "main",
        blob_id: "blob",
        commit_id: "commit",
        last_commit_id: "last",
        execute_filemode: false,
        content: base64Xml,
      };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(fileData), { status: 200 }),
      );

      const mockDocument = {
        documentElement: { nodeName: "root" },
      };
      const parseFromString = vi.fn().mockReturnValue(mockDocument);
      vi.stubGlobal(
        "DOMParser",
        class {
          parseFromString = parseFromString;
        },
      );

      const result = await gitlabClient.fetchRepositoryFileXml(
        123,
        "test.xml",
        "main",
      );
      expect(result).toBe(mockDocument);
      expect(parseFromString).toHaveBeenCalledWith(xmlContent, "text/xml");
    });
  });

  describe("commits and trees", () => {
    it("createCommit should send POST request", async () => {
      const commitData = { id: "abc", message: "Update" };
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(commitData), { status: 201 }),
      );

      const actions: CommitAction[] = [
        { action: "create", file_path: "test.txt", content: "hello" },
      ];
      const result = await gitlabClient.createCommit(
        123,
        "main",
        actions,
        "feat: test",
      );

      expect(result).toEqual(commitData);
      expect(mockFetch).toHaveBeenCalledWith(
        new URL(
          "https://gitlab.example.com/api/v4/projects/123/repository/commits",
        ),
        expect.objectContaining({
          method: "POST",
          body: JSON.stringify({
            branch: "main",
            commit_message: "feat: test",
            actions,
          }),
        }),
      );
    });

    it("listRepositoryTrees should send GET request with query", async () => {
      const treeData = [
        { id: "1", name: "src", type: "tree", path: "src", mode: "040000" },
      ];
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(treeData), { status: 200 }),
      );

      const result = await gitlabClient.listRepositoryTrees("123", {
        recursive: true,
      });

      expect(result).toEqual(treeData);
      expect(mockFetch).toHaveBeenCalledWith(
        new URL(
          "https://gitlab.example.com/api/v4/projects/123/repository/tree?recursive=true",
        ),
        expect.anything(),
      );
    });

    it("listRepositoryCommits should send GET request with query", async () => {
      const commitData = [{ id: "abc", message: "Initial commit" }];
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify(commitData), { status: 200 }),
      );

      const result = await gitlabClient.listRepositoryCommits(123, {
        ref_name: "main",
      });

      expect(result).toEqual(commitData);
      expect(mockFetch).toHaveBeenCalledWith(
        new URL(
          "https://gitlab.example.com/api/v4/projects/123/repository/commits?ref_name=main",
        ),
        expect.anything(),
      );
    });
  });

  describe("toQuery", () => {
    const toQuery = GitlabClient["toQuery"];

    it("should return undefined for undefined", () => {
      expect(toQuery(undefined)).toBeUndefined();
    });

    it("should convert object to entries", () => {
      const obj = { a: 1, b: "two", c: true };
      expect(toQuery(obj)).toEqual([
        ["a", "1"],
        ["b", "two"],
        ["c", "true"],
      ]);
    });
  });

  describe("fromBase64Utf8", () => {
    it("should decode a valid Base64 UTF-8 encoded string to the original string", () => {
      const base64String = "SMOkbGxvIFfDtnJsZCEKT25lIG1vcmUgbGluZS4=";
      const decodedString = GitlabClient["fromBase64Utf8"](base64String);
      expect(decodedString).toBe("Hällo Wörld!\nOne more line.");
    });

    it("should decode an empty Base64 encoded string to an empty string", () => {
      const base64String = "";
      const decodedString = GitlabClient["fromBase64Utf8"](base64String);
      expect(decodedString).toBe("");
    });

    it("should throw an error when decoding an invalid Base64 string", () => {
      const invalidBase64 = "invalid_base64!";
      expect(() => GitlabClient["fromBase64Utf8"](invalidBase64)).toThrow();
    });
  });
});
