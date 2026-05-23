import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { GitlabClient } from "./gitlab-client";
import { type GitLabAuthService } from "./gitlab-auth-service";

describe("GitlabClient", () => {
  describe("fetch", () => {
    const mockGitlabAuthService = {
      getAuthorization: vi.fn(),
    };
    const mockFetch = vi.fn();

    const gitlabClient = new GitlabClient(
      "https://gitlab.example.com",
      mockGitlabAuthService as unknown as GitLabAuthService,
    );

    const gitlabClient_fetch = gitlabClient["fetch"].bind(gitlabClient);

    beforeEach(() => {
      vi.clearAllMocks();
      vi.stubGlobal("fetch", mockFetch);
    });

    afterEach(() => {
      vi.unstubAllGlobals();
    });

    it("should make a GET request with the correct URL and headers", async () => {
      mockGitlabAuthService.getAuthorization.mockReturnValue("Bearer token");
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
      mockGitlabAuthService.getAuthorization.mockReturnValue("Bearer token");
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
      mockGitlabAuthService.getAuthorization.mockReturnValue("Bearer token");
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
      mockGitlabAuthService.getAuthorization.mockReturnValue("Bearer token");
      mockFetch.mockRejectedValueOnce(new Error("Fetch error"));

      await expect(gitlabClient_fetch("/api/v4/projects")).rejects.toThrow(
        "Fetch error",
      );
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
