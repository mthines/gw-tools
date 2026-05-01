/**
 * Tests for branch-protection.ts
 */

import { assertEquals } from "@std/assert";
import { isProtectedBranch } from "./branch-protection.ts";

Deno.test("isProtectedBranch - protects default branch", () => {
  assertEquals(isProtectedBranch("main", "main"), true);
  assertEquals(isProtectedBranch("master", "master"), true);
  assertEquals(isProtectedBranch("develop", "develop"), true);
});

Deno.test("isProtectedBranch - protects gw_root", () => {
  assertEquals(isProtectedBranch("gw_root", "main"), true);
  assertEquals(isProtectedBranch("gw_root", "master"), true);
});

Deno.test("isProtectedBranch - allows removal of feature branches", () => {
  assertEquals(isProtectedBranch("feat/my-feature", "main"), false);
  assertEquals(isProtectedBranch("fix/bug-123", "main"), false);
  assertEquals(isProtectedBranch("chore/cleanup", "main"), false);
});

Deno.test("isProtectedBranch - handles undefined branch", () => {
  assertEquals(isProtectedBranch(undefined, "main"), false);
});

Deno.test("isProtectedBranch - default branch is relative to config", () => {
  // If default is "main", "master" is NOT protected
  assertEquals(isProtectedBranch("master", "main"), false);

  // If default is "master", "main" is NOT protected
  assertEquals(isProtectedBranch("main", "master"), false);
});

Deno.test("isProtectedBranch - case sensitive matching", () => {
  // Branch names are case-sensitive in git
  assertEquals(isProtectedBranch("Main", "main"), false);
  assertEquals(isProtectedBranch("MAIN", "main"), false);
  assertEquals(isProtectedBranch("GW_ROOT", "main"), false);
});
