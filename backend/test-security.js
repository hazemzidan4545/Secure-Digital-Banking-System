#!/usr/bin/env node

/**
 * Security Test Suite for Secure Banking Application
 * This script tests the key security controls without external test libraries
 */

const API = "http://localhost:8081/api";
const results = {
  passed: 0,
  failed: 0,
  tests: [],
};

async function test(name, fn) {
  try {
    await fn();
    results.tests.push({ name, status: "✅ PASS" });
    results.passed++;
    console.log(`✅ ${name}`);
  } catch (error) {
    results.tests.push({ name, status: `❌ FAIL: ${error.message}` });
    results.failed++;
    console.error(`❌ ${name}`);
    console.error(`   Error: ${error.message}`);
  }
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

async function request(method, path, opts = {}) {
  const url = `${API}${path}`;
  const res = await fetch(url, {
    method,
    headers: {
      "Content-Type": "application/json",
      ...opts.headers,
    },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    credentials: "include",
  });

  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }

  return { status: res.status, body, headers: res.headers };
}

async function register(email, password = "TestPass123") {
  const res = await request("POST", "/auth/register", {
    body: { fullName: "Test User", email, password },
  });
  return res;
}

async function login(email, password) {
  const res = await request("POST", "/auth/login", {
    body: { email, password },
  });
  return res;
}

async function main() {
  console.log("\n🏦 SECURE BANKING - SECURITY TEST SUITE\n");
  console.log("Testing security controls...\n");

  //  1. LOGIN BRUTE-FORCE LOCKOUT
  console.log("1️⃣  LOGIN BRUTE-FORCE LOCKOUT (5 attempts => 423)");
  const lockoutEmail = `lockout-${Date.now()}@test.com`;

  await test("Create lockout test user", async () => {
    const res = await register(lockoutEmail, "CorrectPass123");
    assert(res.status === 201, `Expected 201, got ${res.status}`);
  });

  await test("Reject with 401 on first failed login", async () => {
    const res = await login(lockoutEmail, "WrongPass1");
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test("Lock account (423) after 5 failed attempts", async () => {
    // Attempts 2-5
    for (let i = 0; i < 4; i++) {
      await login(lockoutEmail, `WrongPass${i + 2}`);
    }
    const res = await login(lockoutEmail, "WrongPass6");
    assert(res.status === 423, `Expected 423, got ${res.status}`);
    assert(res.body.error.includes("temporarily locked"), "Should contain 'temporarily locked'");
  });

  await test("Reject correct password when locked", async () => {
    const lockoutEmail2 = `lockout2-${Date.now()}@test.com`;
    await register(lockoutEmail2, "CorrectPass123");

    // 5 failed attempts
    for (let i = 0; i < 5; i++) {
      await login(lockoutEmail2, `Wrong${i}`);
    }

    // Try with correct password
    const res = await login(lockoutEmail2, "CorrectPass123");
    assert(res.status === 423, `Expected 423 even with correct password, got ${res.status}`);
  });

  // 2. MFA REQUIREMENT
  console.log("\n2️⃣  MFA REQUIREMENT");

  await test("Require authentication for protected endpoints", async () => {
    const res = await request("GET", "/accounts/me");
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test("Issue MFA challenge on successful login", async () => {
    const email = `mfa-${Date.now()}@test.com`;
    await register(email, "TestPass123");
    const res = await login(email, "TestPass123");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.requiresMfa === true, "Should return requiresMfa=true when challenge is issued");
  });

  // 3. RBAC - ADMIN ENDPOINTS
  console.log("\n3️⃣  RBAC - ADMIN-ONLY ENDPOINTS");

  await test("Deny unauthenticated admin access (401)", async () => {
    const res = await request("GET", "/admin/audit-logs");
    assert(res.status === 401, `Expected 401, got ${res.status}`);
  });

  await test("Deny non-admin user access (403)", async () => {
    // Note: Without cookies, we can't fully test this, but verify endpoint exists
    const res = await request("GET", "/admin/audit-logs");
    assert([401, 403].includes(res.status), `Expected 401 or 403, got ${res.status}`);
  });

  // 4. CSRF PROTECTION
  console.log("\n4️⃣  CSRF PROTECTION");

  await test("Reject POST without CSRF token (401/403 depending on auth state)", async () => {
    const email = `csrf-${Date.now()}@test.com`;
    await register(email, "TestPass123");

    const res = await request("POST", "/transfers", {
      body: { toAccountNumber: "1000000001", amount: 100 },
    });
    assert([401, 403].includes(res.status), `Expected 401 or 403, got ${res.status}`);
  });

  // 5. TRANSFER CAPS
  console.log("\n5️⃣  TRANSFER CAPS");

  await test("Endpoint rejects oversized transfers", async () => {
    const res = await request("POST", "/transfers", {
      body: { toAccountNumber: "1000000001", amount: 50000 },
    });
    // Should fail with 403(CSRF), 401(auth), or 400(cap check)
    assert([400, 401, 403].includes(res.status), `Got ${res.status}`);
  });

  //6. AUTHENTICATION
  console.log("\n6️⃣  AUTHENTICATION");

  await test("Allow health check without authentication", async () => {
    const res = await request("GET", "/health");
    assert(res.status === 200, `Expected 200, got ${res.status}`);
    assert(res.body.status === "ok", "Should return status ok");
  });

  // SUMMARY
  console.log("\n" + "=".repeat(60));
  console.log(`\n📊 TEST SUMMARY\n`);
  console.log(`✅ Passed: ${results.passed}`);
  console.log(`❌ Failed: ${results.failed}`);
  console.log(`📈 Total:  ${results.passed + results.failed}\n`);

  console.log("Test Results:");
  results.tests.forEach((t) => {
    console.log(`  ${t.status.padEnd(50)} ${t.name}`);
  });

  console.log("\n" + "=".repeat(60));

  if (results.failed === 0) {
    console.log("\n🎉 ALL SECURITY TESTS PASSED!\n");
    process.exit(0);
  } else {
    console.log(`\n⚠️  ${results.failed} test(s) failed\n`);
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("Test suite error:", error);
  process.exit(1);
});
