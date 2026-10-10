const BASE = process.env.API_BASE || "http://localhost:5000/api";

let passed = 0;
let failed = 0;

function ok(label) {
  passed += 1;
  console.log(`  PASS  ${label}`);
}

function fail(label, detail) {
  failed += 1;
  console.log(`  FAIL  ${label} — ${detail}`);
}

async function req(method, path, { body, token } = {}) {
  const headers = { "Content-Type": "application/json" };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try {
    data = await res.json();
  } catch {
    data = null;
  }
  return { status: res.status, data };
}

const email = `testuser_${Date.now()}@example.com`;
const password = "TestPass123";
let token;
let adminToken;
let oldToken;

async function main() {
  console.log("== Phase 2 Auth E2E ==\n");

  // 1. Register
  {
    const r = await req("POST", "/auth/register", {
      body: { name: "Test User", email, password },
    });
    if (r.status === 201 && r.data?.data?.token && r.data?.data?.user?.id) {
      token = r.data.data.token;
      ok(`register → 201 + token + user (email ${email})`);
    } else {
      fail("register", JSON.stringify(r));
    }
    if (r.data?.data?.user && "passwordHash" in r.data.data.user) {
      fail("register no passwordHash leak", "passwordHash present in response");
    } else {
      ok("register response contains no passwordHash");
    }
    if (r.data?.data?.user?.role === "user") ok("register defaults role=user");
    else fail("register role", JSON.stringify(r.data?.data?.user));
  }

  // 2. Duplicate email
  {
    const r = await req("POST", "/auth/register", {
      body: { name: "Dup", email, password },
    });
    if (r.status === 409 && r.data?.error?.code === "CONFLICT")
      ok("duplicate email → 409 CONFLICT");
    else fail("duplicate email", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 3. Weak password
  {
    const r = await req("POST", "/auth/register", {
      body: { name: "Weak", email: `weak_${Date.now()}@x.com`, password: "short" },
    });
    if (r.status === 422 && r.data?.error?.code === "VALIDATION_ERROR")
      ok("weak password → 422 VALIDATION_ERROR");
    else fail("weak password", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 4. Invalid email
  {
    const r = await req("POST", "/auth/register", {
      body: { name: "Bad", email: "not-an-email", password },
    });
    if (r.status === 422) ok("invalid email → 422");
    else fail("invalid email", `${r.status}`);
  }

  // 5. Login success
  {
    const r = await req("POST", "/auth/login", { body: { email, password } });
    if (r.status === 200 && r.data?.data?.token) {
      oldToken = token;
      token = r.data.data.token;
      ok("login success → 200 + token");
    } else fail("login success", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 6. Wrong password — generic message
  {
    const r = await req("POST", "/auth/login", {
      body: { email, password: "WrongPass123" },
    });
    const msg = r.data?.error?.message || "";
    if (
      r.status === 401 &&
      msg === "Invalid email or password"
    )
      ok("wrong password → 401 generic message");
    else fail("wrong password", `${r.status} ${msg}`);
  }

  // 7. Unknown email — same generic message
  {
    const r = await req("POST", "/auth/login", {
      body: { email: "nobody@example.com", password: "Whatever123" },
    });
    if (
      r.status === 401 &&
      r.data?.error?.message === "Invalid email or password"
    )
      ok("unknown email → 401 same generic message (no enumeration)");
    else fail("unknown email", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 8. /auth/me with token
  {
    const r = await req("GET", "/auth/me", { token });
    if (r.status === 200 && r.data?.data?.user?.email === email)
      ok("/auth/me → 200 + current user");
    else fail("/auth/me", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 9. /auth/me without token
  {
    const r = await req("GET", "/auth/me");
    if (r.status === 401) ok("/auth/me no token → 401");
    else fail("/auth/me no token", `${r.status}`);
  }

  // 10. /auth/me with garbage token
  {
    const r = await req("GET", "/auth/me", { token: "garbage.token.here" });
    if (r.status === 401) ok("/auth/me bad token → 401");
    else fail("/auth/me bad token", `${r.status}`);
  }

  // 11. Update profile
  {
    const r = await req("PUT", "/users/me", {
      token,
      body: { name: "Updated Name", email },
    });
    if (r.status === 200 && r.data?.data?.user?.name === "Updated Name")
      ok("profile update → 200 name persisted");
    else fail("profile update", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 12. Profile update to conflicting email
  {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@pricecompare.local";
    const r = await req("PUT", "/users/me", {
      token,
      body: { name: "Updated Name", email: adminEmail },
    });
    if (r.status === 409) ok("profile email conflict → 409");
    else fail("profile email conflict", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 13. Change password — wrong current
  {
    const r = await req("PUT", "/users/me/password", {
      token,
      body: { currentPassword: "NotMyPass1", newPassword: "NewPass123" },
    });
    if (r.status === 401) ok("wrong current password → 401");
    else fail("wrong current password", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 14. Change password — success, new token
  let newToken;
  {
    const r = await req("PUT", "/users/me/password", {
      token,
      body: { currentPassword: password, newPassword: "NewPass123" },
    });
    if (r.status === 200 && r.data?.data?.token) {
      newToken = r.data.data.token;
      ok("change password → 200 + fresh token");
    } else fail("change password", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 15. Old token invalidated after password change
  {
    const r = await req("GET", "/auth/me", { token });
    if (r.status === 401) ok("old token after password change → 401");
    else fail("old token invalidation", `${r.status}`);
  }

  // 16. New token works
  {
    const r = await req("GET", "/auth/me", { token: newToken });
    if (r.status === 200) ok("fresh token after password change → 200");
    else fail("fresh token", `${r.status}`);
  }
  token = newToken;

  // 17. Login with new password
  {
    const r = await req("POST", "/auth/login", {
      body: { email, password: "NewPass123" },
    });
    if (r.status === 200 && r.data?.data?.token) ok("login with new password → 200");
    else fail("login new password", `${r.status}`);
    if (r.status === 200) token = r.data.data.token;
  }

  // 18. Logout
  {
    const r = await req("POST", "/auth/logout", { token });
    if (r.status === 200) ok("logout → 200");
    else fail("logout", `${r.status}`);
  }

  // 19. Admin login (seeded admin)
  {
    const adminEmail = process.env.ADMIN_EMAIL || "admin@pricecompare.local";
    const adminPassword = process.env.ADMIN_PASSWORD || "AdminPass123!";
    const r = await req("POST", "/auth/login", {
      body: { email: adminEmail, password: adminPassword },
    });
    if (r.status === 200 && r.data?.data?.user?.role === "admin") {
      adminToken = r.data.data.token;
      ok("admin login → 200 role=admin");
    } else fail("admin login", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 20. requireRole: user on admin route → 403 (users list is admin-only in P6;
  //     use /auth/me is user-allowed so we test role via a synthetic check:
  //     non-admin calling a role-gated route — mount check via users admin route)
  // For Phase 2, role middleware is exercised via the /api/users admin mount
  // added for verification: GET /api/users (requireRole admin).
  {
    const r = await req("GET", "/users", { token });
    if (r.status === 403) ok("regular user on admin route → 403");
    else fail("user on admin route", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 21. Admin on admin route → 200
  {
    const r = await req("GET", "/users", { token: adminToken });
    if (r.status === 200 && Array.isArray(r.data?.data?.users))
      ok("admin on admin route → 200 + users list");
    else fail("admin on admin route", `${r.status} ${JSON.stringify(r.data)}`);
  }

  // 22. Login with old password fails after change
  {
    const r = await req("POST", "/auth/login", {
      body: { email, password },
    });
    if (r.status === 401) ok("login with old password after change → 401");
    else fail("old password login", `${r.status}`);
  }

  console.log(`\n== Result: ${passed} passed, ${failed} failed ==`);
  process.exit(failed > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error("E2E script crashed:", err);
  process.exit(1);
});
