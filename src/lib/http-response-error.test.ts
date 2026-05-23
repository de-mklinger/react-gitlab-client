import { describe, expect, it } from "vitest";
import { HttpResponseError } from "./http-response-error";

describe("HttpResponseError", () => {
  it("should create an error with default message when only status is provided", () => {
    const error = new HttpResponseError(500);

    expect(error.message).toBe("HTTP response error: 500");
    expect(error.status).toBe(500);
  });

  it("should create an error with custom message when both status and message are provided", () => {
    const error = new HttpResponseError(400, "Bad Request");

    expect(error.message).toBe("Bad Request");
    expect(error.status).toBe(400);
  });

  it("should return true for isNotFound when status is 404", () => {
    const error = new HttpResponseError(404);

    expect(error.isNotFound()).toBe(true);
  });

  it("should return false for isNotFound when status is not 404", () => {
    const error = new HttpResponseError(500);

    expect(error.isNotFound()).toBe(false);
  });
});
