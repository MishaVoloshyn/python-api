let CURRENT_TOKEN = null;

/*
  Finalization: we keep test results and show summary after running tests.
  Each test has an expected HTTP-like code (from JSON status.code).
*/

const TESTS = [
  // OK
  { id: "discount-ok-btn", name: "discount OK (normal token)", expectedCode: 200 },

  // header/auth errors
  { id: "discount-missing-auth-btn", name: "missing Authorization header", expectedCode: 403 },
  { id: "discount-wrong-scheme-btn", name: "wrong scheme (Token ...)", expectedCode: 403 },
  { id: "discount-short-token-btn", name: "short token (2 parts)", expectedCode: 403 },
  { id: "discount-bad-base64-btn", name: "bad base64 symbols", expectedCode: 403 },
  { id: "discount-bad-signature-btn", name: "bad signature", expectedCode: 403 },
  { id: "discount-expired-btn", name: "expired token", expectedCode: 403 },

  // nested
  { id: "nested-ok-btn", name: "nested token OK", expectedCode: 200 },
  { id: "nested-expired-btn", name: "nested token expired", expectedCode: 403 },

  // internal claims validation
  { id: "claim-bad-sub-btn", name: "claim bad_sub", expectedCode: 403 },
  { id: "claim-bad-iss-btn", name: "claim bad_iss", expectedCode: 403 },
  { id: "claim-no-name-email-btn", name: "claim no_name_email", expectedCode: 403 },
  { id: "claim-bad-email-btn", name: "claim bad_email", expectedCode: 403 },
  { id: "claim-email-only-btn", name: "claim email_only", expectedCode: 200 },
  { id: "claim-name-only-btn", name: "claim name_only", expectedCode: 200 },
];

const testState = {}; // id -> {status: "notrun"|"pass"|"fail", lastCode: number|null, lastMessage: string|null}

document.addEventListener("DOMContentLoaded", () => {
  initState();
  initButtons();
  renderSummary();
});

function initState() {
  for (const t of TESTS) {
    testState[t.id] = { status: "notrun", lastCode: null, lastMessage: null };
  }
}

function initButtons() {
  const ids = [
    "run-all-btn",
    "reset-tests-btn",
    "user-get-btn",

    ...TESTS.map(t => t.id),
  ];

  for (const id of ids) {
    const btn = document.getElementById(id);
    if (!btn) continue;

    if (id === "run-all-btn") btn.addEventListener("click", runAllTests);
    else if (id === "reset-tests-btn") btn.addEventListener("click", resetAllTests);
    else btn.addEventListener("click", onClick);
  }
}

/* =========================
   UI helpers
========================= */
function pretty(obj) {
  return JSON.stringify(obj, null, 4);
}

function renderJson(td, text) {
  try {
    const json = JSON.parse(text);
    td.innerHTML = `<pre>${pretty(json)}</pre>`;
  } catch {
    td.innerHTML = `<pre>${text}</pre>`;
  }
}

function nowText() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}.${pad(d.getMonth() + 1)}.${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

function renderSummary() {
  const total = TESTS.length;
  let pass = 0, fail = 0, notrun = 0;

  for (const t of TESTS) {
    const st = testState[t.id]?.status || "notrun";
    if (st === "pass") pass++;
    else if (st === "fail") fail++;
    else notrun++;
  }

  const elTotal = document.getElementById("sum-total");
  const elPass = document.getElementById("sum-pass");
  const elFail = document.getElementById("sum-fail");
  const elNot = document.getElementById("sum-notrun");

  if (elTotal) elTotal.textContent = String(total);
  if (elPass) elPass.textContent = String(pass);
  if (elFail) elFail.textContent = String(fail);
  if (elNot) elNot.textContent = String(notrun);

  // test list block
  const list = document.getElementById("test-list");
  if (list) {
    let lines = [];
    for (const t of TESTS) {
      const st = testState[t.id];
      const mark = st.status === "pass" ? "[PASS]" : st.status === "fail" ? "[FAIL]" : "[----]";
      const codePart = st.lastCode != null ? `code=${st.lastCode}` : "code=?";
      const msgPart = st.lastMessage ? `; ${st.lastMessage}` : "";
      lines.push(`${mark} ${t.name} (expected ${t.expectedCode}) -> ${codePart}${msgPart}`);
    }
    list.textContent = lines.join("\n");
  }
}

function setLastRun() {
  const el = document.getElementById("sum-last-run");
  if (el) el.textContent = nowText();
}

/* =========================
   Base64url helpers (decode JWT header)
========================= */
function b64urlToText(b64url) {
  let s = b64url.replace(/-/g, "+").replace(/_/g, "/");
  const pad = s.length % 4;
  if (pad) s += "=".repeat(4 - pad);
  try {
    return decodeURIComponent(escape(atob(s)));
  } catch {
    try { return atob(s); } catch { return null; }
  }
}

function decodeJwtHeader(token) {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length < 2) return null;
  const headerText = b64urlToText(parts[0]);
  if (!headerText) return null;
  try { return JSON.parse(headerText); } catch { return null; }
}

function setCurrentToken(token) {
  CURRENT_TOKEN = token;
  const el = document.getElementById("current-token");
  if (el) el.textContent = token ? token : "none";

  const decoded = decodeJwtHeader(token);
  const hdrDecodedEl = document.getElementById("token-header-decoded");
  if (hdrDecodedEl) hdrDecodedEl.innerHTML = decoded ? `<pre>${pretty(decoded)}</pre>` : "<pre>none</pre>";
}

function setHeaderFromResponse(headerObj) {
  const el = document.getElementById("token-header-result");
  if (!el) return;
  el.innerHTML = headerObj ? `<pre>${pretty(headerObj)}</pre>` : "<pre>none</pre>";
}

/* =========================
   API calls
========================= */
function baseUrl() {
  // if you want: <body data-base="/python-api/basics/13">
  return document.body.dataset.base || "/python-api/basics/13";
}

function userUrl(mode) {
  const b = baseUrl();
  return mode ? `${b}/user?mode=${encodeURIComponent(mode)}` : `${b}/user`;
}

function discountUrl() {
  return `${baseUrl()}/discount`;
}

async function apiGetJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try { return { ok: true, json: JSON.parse(text), text }; }
  catch { return { ok: false, json: null, text }; }
}

async function apiGetDiscount(headersObj) {
  const res = await fetch(discountUrl(), {
    method: "GET",
    headers: headersObj ? headersObj : {}
  });
  return await res.text();
}

function flipLastChar(token) {
  if (!token || token.length < 2) return token;
  const last = token[token.length - 1];
  const newLast = last === "a" ? "b" : "a";
  return token.slice(0, -1) + newLast;
}

function evalDiscountResponse(text, expectedCode) {
  try {
    const j = JSON.parse(text);
    const code = j?.status?.code;
    const msg = j?.status?.message || null;
    const pass = (code === expectedCode);
    return { pass, code: (typeof code === "number" ? code : null), message: msg, json: j };
  } catch {
    return { pass: false, code: null, message: "response is not JSON", json: null };
  }
}

function updateTestResult(testId, expectedCode, discountText) {
  const t = testState[testId];
  if (!t) return;

  const r = evalDiscountResponse(discountText, expectedCode);
  t.status = r.pass ? "pass" : "fail";
  t.lastCode = r.code;
  t.lastMessage = r.message;

  renderSummary();
}

/* =========================
   Run all / reset
========================= */
async function runAllTests() {
  setLastRun();

  // run sequentially to avoid mixing outputs
  for (const t of TESTS) {
    const btn = document.getElementById(t.id);
    if (!btn) continue;

    // simulate click by calling handler directly
    await runTestById(t.id);
    await sleep(200);
  }

  renderSummary();
}

function resetAllTests() {
  for (const t of TESTS) {
    testState[t.id] = { status: "notrun", lastCode: null, lastMessage: null };
    const td = document.getElementById(t.id.replace("-btn", "-result"));
    if (td) td.innerHTML = "";
  }
  renderSummary();
}

function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

/* =========================
   Main click handler / runner
========================= */
async function onClick(e) {
  await runTestById(e.target.id);
}

async function runTestById(id) {
  const td = document.getElementById(id.replace("-btn", "-result"));
  if (!td) return;

  const def = TESTS.find(x => x.id === id);
  const expectedCode = def ? def.expectedCode : null;

  try {
    // -----------------------------
    // GET /user (normal token)
    // -----------------------------
    if (id === "user-get-btn") {
      const r = await apiGetJson(userUrl());
      renderJson(td, r.text);

      if (r.ok) {
        const token = r.json?.data?.token;
        const header = r.json?.data?.header;
        if (token) {
          setCurrentToken(token);
          setHeaderFromResponse(header);
        }
      }
      return;
    }

    // -----------------------------
    // discount OK with current token
    // -----------------------------
    if (id === "discount-ok-btn") {
      if (!CURRENT_TOKEN) {
        const r = await apiGetJson(userUrl());
        if (r.ok && r.json?.data?.token) {
          setCurrentToken(r.json.data.token);
          setHeaderFromResponse(r.json?.data?.header);
        }
      }

      const discountText = await apiGetDiscount({ Authorization: "Bearer " + (CURRENT_TOKEN || "") });
      renderJson(td, discountText);
      updateTestResult(id, expectedCode, discountText);
      return;
    }

    // -----------------------------
    // Missing Authorization header
    // -----------------------------
    if (id === "discount-missing-auth-btn") {
      const discountText = await apiGetDiscount({});
      renderJson(td, discountText);
      updateTestResult(id, expectedCode, discountText);
      return;
    }

    // -----------------------------
    // Wrong scheme
    // -----------------------------
    if (id === "discount-wrong-scheme-btn") {
      if (!CURRENT_TOKEN) {
        const r = await apiGetJson(userUrl());
        if (r.ok && r.json?.data?.token) setCurrentToken(r.json.data.token);
      }
      const discountText = await apiGetDiscount({ Authorization: "Token " + (CURRENT_TOKEN || "") });
      renderJson(td, discountText);
      updateTestResult(id, expectedCode, discountText);
      return;
    }

    // -----------------------------
    // Short token
    // -----------------------------
    if (id === "discount-short-token-btn") {
      if (!CURRENT_TOKEN) {
        const r = await apiGetJson(userUrl());
        if (r.ok && r.json?.data?.token) setCurrentToken(r.json.data.token);
      }
      const shortToken = (CURRENT_TOKEN || "").split(".").slice(0, 2).join(".");
      const discountText = await apiGetDiscount({ Authorization: "Bearer " + shortToken });
      renderJson(td, discountText);
      updateTestResult(id, expectedCode, discountText);
      return;
    }

    // -----------------------------
    // Bad base64 symbols
    // -----------------------------
    if (id === "discount-bad-base64-btn") {
      if (!CURRENT_TOKEN) {
        const r = await apiGetJson(userUrl());
        if (r.ok && r.json?.data?.token) setCurrentToken(r.json.data.token);
      }
      const bad = (CURRENT_TOKEN || "") + "!";
      const discountText = await apiGetDiscount({ Authorization: "Bearer " + bad });
      renderJson(td, discountText);
      updateTestResult(id, expectedCode, discountText);
      return;
    }

    // -----------------------------
    // Bad signature
    // -----------------------------
    if (id === "discount-bad-signature-btn") {
      if (!CURRENT_TOKEN) {
        const r = await apiGetJson(userUrl());
        if (r.ok && r.json?.data?.token) setCurrentToken(r.json.data.token);
      }
      const badSig = flipLastChar(CURRENT_TOKEN || "");
      const discountText = await apiGetDiscount({ Authorization: "Bearer " + badSig });
      renderJson(td, discountText);
      updateTestResult(id, expectedCode, discountText);
      return;
    }

    // -----------------------------
    // Expired token
    // -----------------------------
    if (id === "discount-expired-btn") {
      const r = await apiGetJson(userUrl("expired"));
      // show user response + discount response
      td.innerHTML = `<div><b>/user response</b></div>`;
      renderJson(td, r.text);

      const tok = r.ok ? r.json?.data?.token : null;
      const discountText = await apiGetDiscount({ Authorization: "Bearer " + (tok || "") });

      td.innerHTML += `<hr><div><b>/discount response</b></div>`;
      renderJson(td, discountText);
      updateTestResult(id, expectedCode, discountText);
      return;
    }

    // -----------------------------
    // Nested OK
    // -----------------------------
    if (id === "nested-ok-btn") {
      const r = await apiGetJson(userUrl("nested"));
      td.innerHTML = `<div><b>/user response</b></div>`;
      renderJson(td, r.text);

      const tok = r.ok ? r.json?.data?.token : null;
      const discountText = await apiGetDiscount({ Authorization: "Bearer " + (tok || "") });

      td.innerHTML += `<hr><div><b>/discount response</b></div>`;
      renderJson(td, discountText);
      updateTestResult(id, expectedCode, discountText);
      return;
    }

    // -----------------------------
    // Nested expired
    // -----------------------------
    if (id === "nested-expired-btn") {
      const r = await apiGetJson(userUrl("nested_expired"));
      td.innerHTML = `<div><b>/user response</b></div>`;
      renderJson(td, r.text);

      const tok = r.ok ? r.json?.data?.token : null;
      const discountText = await apiGetDiscount({ Authorization: "Bearer " + (tok || "") });

      td.innerHTML += `<hr><div><b>/discount response</b></div>`;
      renderJson(td, discountText);
      updateTestResult(id, expectedCode, discountText);
      return;
    }

    // -----------------------------
    // Claims scenarios helper
    // -----------------------------
    const claimModes = {
      "claim-bad-sub-btn": "bad_sub",
      "claim-bad-iss-btn": "bad_iss",
      "claim-no-name-email-btn": "no_name_email",
      "claim-bad-email-btn": "bad_email",
      "claim-email-only-btn": "email_only",
      "claim-name-only-btn": "name_only",
    };

    if (claimModes[id]) {
      const mode = claimModes[id];
      const r = await apiGetJson(userUrl(mode));
      td.innerHTML = `<div><b>/user response</b></div>`;
      renderJson(td, r.text);

      const tok = r.ok ? r.json?.data?.token : null;
      const discountText = await apiGetDiscount({ Authorization: "Bearer " + (tok || "") });

      td.innerHTML += `<hr><div><b>/discount response</b></div>`;
      renderJson(td, discountText);
      updateTestResult(id, expectedCode, discountText);
      return;
    }

    // fallback
    td.innerHTML = `<pre>Unknown action: ${id}</pre>`;

  } catch (err) {
    td.innerHTML = `<pre>JS error: ${err}</pre>`;
    if (expectedCode != null) {
      testState[id] = { status: "fail", lastCode: null, lastMessage: "JS error" };
      renderSummary();
    }
  }
}
