import { describe, expect, it } from "vitest";
import { GitlabClient } from "./gitlab-client";

describe("GitlabClient.fromBase64Utf8", () => {
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
