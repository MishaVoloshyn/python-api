let CURRENT_TOKEN = null;

document.addEventListener("DOMContentLoaded", () => {
  initUserTestButtons();
});

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
async function apiGetJson(url) {
  const res = await fetch(url);
  const text = await res.text();
  try { return { ok: true, json: JSON.parse(text), text }; }
  catch { return { ok: false, json: null, text }; }
}

async function apiGetDiscount(authHeader) {
  const res = await fetch(discountUrl(), {
    method: "GET",
    headers: authHeader ? authHeader : {}
  });
  return await res.text();
}

function baseUrl() {
  return document.body.dataset.base || "/python-api/basics/13";
}

function userUrl(mode) {
  const b = baseUrl();
  return mode ? `${b}/user?mode=${encodeURIComponent(mode)}` : `${b}/user`;
}

function discountUrl() {
  return `${baseUrl()}/discount`;
}

function flipLastChar(token) {
  if (!token || token.length < 2) return token;
  const last = token[token.length - 1];
  const newLast = last === "a" ? "b" : "a";
  return token.slice(0, -1) + newLast;
}

/* =========================
   Buttons init
========================= */
function initUserTestButtons() {
  const map = [
    "user-get-btn",
    "discount-ok-btn",
    "discount-missing-auth-btn",
    "discount-wrong-scheme-btn",
    "discount-short-token-btn",
    "discount-bad-base64-btn",
    "discount-bad-signature-btn",
    "discount-expired-btn",

    "nested-ok-btn",
    "nested-expired-btn",

    "claim-bad-sub-btn",
    "claim-bad-iss-btn",
    "claim-no-name-email-btn",
    "claim-bad-email-btn",
    "claim-email-only-btn",
    "claim-name-only-btn"
  ];

  for (const id of map) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", onClick);
  }
}

/* =========================
   Main click handler
========================= */
async function onClick(e) {
  const id = e.target.id;
  const td = document.getElementById(id.replace("-btn", "-result"));
  if (!td) return;

  try {
    // 1) GET /user normal
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

    // 2) /discount OK with current token
    if (id === "discount-ok-btn") {
      if (!CURRENT_TOKEN) {
        // auto get normal token
        const r = await apiGetJson(userUrl());
        if (r.ok && r.json?.data?.token) {
          setCurrentToken(r.json.data.token);
          setHeaderFromResponse(r.json?.data?.header);
        }
      }
      const text = await apiGetDiscount({ Authorization: "Bearer " + (CURRENT_TOKEN || "") });
      renderJson(td, text);
      return;
    }

    // 3) Missing Authorization header
    if (id === "discount-missing-auth-btn") {
      const text = await apiGetDiscount({});
      renderJson(td, text);
      return;
    }

    // 4) Wrong scheme
    if (id === "discount-wrong-scheme-btn") {
      if (!CURRENT_TOKEN) {
        const r = await apiGetJson(userUrl());
        if (r.ok && r.json?.data?.token) setCurrentToken(r.json.data.token);
      }
      const text = await apiGetDiscount({ Authorization: "Token " + (CURRENT_TOKEN || "") });
      renderJson(td, text);
      return;
    }

    // 5) Short token
    if (id === "discount-short-token-btn") {
      if (!CURRENT_TOKEN) {
        const r = await apiGetJson(userUrl());
        if (r.ok && r.json?.data?.token) setCurrentToken(r.json.data.token);
      }
      const shortToken = (CURRENT_TOKEN || "").split(".").slice(0, 2).join(".");
      const text = await apiGetDiscount({ Authorization: "Bearer " + shortToken });
      renderJson(td, text);
      return;
    }

    // 6) Bad base64 symbols
    if (id === "discount-bad-base64-btn") {
      if (!CURRENT_TOKEN) {
        const r = await apiGetJson(userUrl());
        if (r.ok && r.json?.data?.token) setCurrentToken(r.json.data.token);
      }
      const bad = (CURRENT_TOKEN || "") + "!";
      const text = await apiGetDiscount({ Authorization: "Bearer " + bad });
      renderJson(td, text);
      return;
    }

    // 7) Bad signature
    if (id === "discount-bad-signature-btn") {
      if (!CURRENT_TOKEN) {
        const r = await apiGetJson(userUrl());
        if (r.ok && r.json?.data?.token) setCurrentToken(r.json.data.token);
      }
      const badSig = flipLastChar(CURRENT_TOKEN || "");
      const text = await apiGetDiscount({ Authorization: "Bearer " + badSig });
      renderJson(td, text);
      return;
    }

    // 8) Expired token
    if (id === "discount-expired-btn") {
      const r = await apiGetJson(userUrl("expired"));
      renderJson(td, r.text);
      let tok = null;
      if (r.ok) tok = r.json?.data?.token;
      const text = await apiGetDiscount({ Authorization: "Bearer " + (tok || "") });
      // show discount response below the token response
      td.innerHTML += `<hr><div><b>/discount response</b></div>`;
      renderJson(td, text);
      return;
    }

    // 9) Nested OK
    if (id === "nested-ok-btn") {
      const r = await apiGetJson(userUrl("nested"));
      renderJson(td, r.text);
      const tok = r.ok ? r.json?.data?.token : null;

      const text = await apiGetDiscount({ Authorization: "Bearer " + (tok || "") });
      td.innerHTML += `<hr><div><b>/discount response</b></div>`;
      renderJson(td, text);
      return;
    }

    // 10) Nested expired
    if (id === "nested-expired-btn") {
      const r = await apiGetJson(userUrl("nested_expired"));
      renderJson(td, r.text);
      const tok = r.ok ? r.json?.data?.token : null;

      const text = await apiGetDiscount({ Authorization: "Bearer " + (tok || "") });
      td.innerHTML += `<hr><div><b>/discount response</b></div>`;
      renderJson(td, text);
      return;
    }

    // ===== Internal claims validation buttons =====
    // Each: get token from /user?mode=... and then call /discount with it

    if (id === "claim-bad-sub-btn") {
      await claimScenario(td, "bad_sub");
      return;
    }

    if (id === "claim-bad-iss-btn") {
      await claimScenario(td, "bad_iss");
      return;
    }

    if (id === "claim-no-name-email-btn") {
      await claimScenario(td, "no_name_email");
      return;
    }

    if (id === "claim-bad-email-btn") {
      await claimScenario(td, "bad_email");
      return;
    }

    if (id === "claim-email-only-btn") {
      await claimScenario(td, "email_only");
      return;
    }

    if (id === "claim-name-only-btn") {
      await claimScenario(td, "name_only");
      return;
    }

  } catch (err) {
    td.innerHTML = `<pre>JS error: ${err}</pre>`;
  }
}

async function claimScenario(td, mode) {
  const r = await apiGetJson(userUrl(mode));
  renderJson(td, r.text);

  const tok = r.ok ? r.json?.data?.token : null;

  const text = await apiGetDiscount({ Authorization: "Bearer " + (tok || "") });
  td.innerHTML += `<hr><div><b>/discount response</b></div>`;
  renderJson(td, text);
}
