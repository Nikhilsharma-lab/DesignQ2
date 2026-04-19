/**
 * Regression tests for selectUserSessionDatabaseUrl.
 *
 * Bug: withUserSession connected to DATABASE_URL directly, but DATABASE_URL
 * points to Supabase's transaction-mode pooler. Session-level GUCs set
 * outside a transaction are unreliable there — Supavisor can release the
 * backend connection between queries, dropping the RLS identity.
 *
 * Fix: resolve the URL via selectUserSessionDatabaseUrl, which prefers
 * DIRECT_DATABASE_URL and fails loud in production when it is missing.
 */

import { describe, it, expect, vi } from "vitest";
import { selectUserSessionDatabaseUrl } from "@/db/user";

describe("selectUserSessionDatabaseUrl", () => {
  it("prefers DIRECT_DATABASE_URL when set", () => {
    expect(
      selectUserSessionDatabaseUrl({
        DIRECT_DATABASE_URL: "postgres://direct",
        DATABASE_URL: "postgres://pooled",
        NODE_ENV: "production",
      })
    ).toBe("postgres://direct");
  });

  it("prefers DIRECT_DATABASE_URL even in development", () => {
    expect(
      selectUserSessionDatabaseUrl({
        DIRECT_DATABASE_URL: "postgres://direct",
        DATABASE_URL: "postgres://pooled",
        NODE_ENV: "development",
      })
    ).toBe("postgres://direct");
  });

  it("throws in production when DIRECT_DATABASE_URL is missing", () => {
    expect(() =>
      selectUserSessionDatabaseUrl({
        DATABASE_URL: "postgres://pooled",
        NODE_ENV: "production",
      })
    ).toThrow(/DIRECT_DATABASE_URL is required in production/);
  });

  it("throws in production even if DATABASE_URL is also missing", () => {
    expect(() =>
      selectUserSessionDatabaseUrl({ NODE_ENV: "production" })
    ).toThrow(/DIRECT_DATABASE_URL is required in production/);
  });

  it("falls back to DATABASE_URL with a warning in development", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      selectUserSessionDatabaseUrl({
        DATABASE_URL: "postgres://pooled",
        NODE_ENV: "development",
      })
    ).toBe("postgres://pooled");
    expect(warn).toHaveBeenCalledWith(
      expect.stringContaining("DIRECT_DATABASE_URL not set")
    );
    warn.mockRestore();
  });

  it("treats test env like development (warns, uses fallback)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      selectUserSessionDatabaseUrl({
        DATABASE_URL: "postgres://pooled",
        NODE_ENV: "test",
      })
    ).toBe("postgres://pooled");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("treats unset NODE_ENV as non-production (warns, uses fallback)", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    expect(
      selectUserSessionDatabaseUrl({ DATABASE_URL: "postgres://pooled" })
    ).toBe("postgres://pooled");
    expect(warn).toHaveBeenCalled();
    warn.mockRestore();
  });

  it("throws when neither env var is set outside production", () => {
    expect(() =>
      selectUserSessionDatabaseUrl({ NODE_ENV: "development" })
    ).toThrow(/Neither DIRECT_DATABASE_URL nor DATABASE_URL is set/);
  });
});
