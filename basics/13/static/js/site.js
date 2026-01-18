let CURRENT_TOKEN = null;
let EXPIRED_TOKEN = null;

document.addEventListener("DOMContentLoaded", () => {
  initOrderTests();
  initRestTests();
  initUserTests();
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
   HELPERS: base64url decode header from JWT
========================= */
function b64urlToText(b64url) {
  // replace URL-safe chars, pad, decode
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
  if (el) el.textContent = token ? token : "немає";
}

function setTokenHeaderFromResponse(headerObj) {
  const el = document.getElementById("token-header-result");
  if (!el) return;
  if (!headerObj) {
    el.innerHTML = "<pre>немає</pre>";
    return;
  }
  el.innerHTML = `<pre>${pretty(headerObj)}</pre>`;
}

function setTokenHeaderDecoded(headerObj) {
  const el = document.getElementById("token-header-decoded");
  if (!el) return;
  if (!headerObj) {
    el.innerHTML = "<pre>немає</pre>";
    return;
  }
  el.innerHTML = `<pre>${pretty(headerObj)}</pre>`;
}

/* =========================
   HEADERS TEST (ordertest)
========================= */
function initOrderTests() {
  const methods = ["get", "post", "put", "patch", "delete"];
  for (const m of methods) {
    const btn = document.getElementById(`api-order-${m}-btn`);
    if (btn) btn.addEventListener("click", orderBtnClick);
  }
}

async function orderBtnClick(e) {
  const [_, apiName, apiMethod] = e.target.id.split("-");
  const td = document.getElementById(`api-${apiName}-${apiMethod}-result`);
  if (!td) return;

  const base = document.body.dataset.base || "";
  const method = apiMethod.toUpperCase();

  const sendHeader = (method === "GET" || method === "POST");
  const headers = {};
  if (sendHeader) headers["Custom-Header"] = "AnyValue123";

  try {
    const res = await fetch(`${base}/order`, { method, headers });
    const text = await res.text();
    renderJson(td, text);
  } catch (err) {
    td.innerHTML = `<pre>JS error: ${err}</pre>`;
  }
}

/* =========================
   REST TEST (resttest)
========================= */
function initRestTests() {
  const ids = [
    "rest-order-get-btn",
    "rest-order-getone-btn",
    "rest-order-post-btn",
    "rest-order-put-btn",
    "rest-order-patch-btn",
    "rest-order-delete-btn",
  ];

  for (const id of ids) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", restBtnClick);
  }

  const postBody = { title: "New Order", price: 999, status: "new" };
  const putBody = { title: "Replaced Order", price: 555, status: "paid" };
  const patchBody = { status: "patched" };

  const postPre = document.getElementById("rest-post-body");
  const putPre = document.getElementById("rest-put-body");
  const patchPre = document.getElementById("rest-patch-body");

  if (postPre) postPre.textContent = pretty(postBody);
  if (putPre) putPre.textContent = pretty(putBody);
  if (patchPre) patchPre.textContent = pretty(patchBody);
}

async function restBtnClick(e) {
  const base = document.body.dataset.base || "";
  const id = e.target.id;

  let method = "GET";
  let url = `${base}/order`;
  let body = null;

  if (id === "rest-order-getone-btn") {
    method = "GET";
    url = `${base}/order?id=1`;
  }
  if (id === "rest-order-post-btn") {
    method = "POST";
    url = `${base}/order`;
    body = { title: "New Order", price: 999, status: "new" };
  }
  if (id === "rest-order-put-btn") {
    method = "PUT";
    url = `${base}/order?id=1`;
    body = { title: "Replaced Order", price: 555, status: "paid" };
  }
  if (id === "rest-order-patch-btn") {
    method = "PATCH";
    url = `${base}/order?id=1`;
    body = { status: "patched" };
  }
  if (id === "rest-order-delete-btn") {
    method = "DELETE";
    url = `${base}/order?id=1`;
  }

  const resultId = id.replace("-btn", "-result");
  const td = document.getElementById(resultId);
  if (!td) return;

  const headers = { "Content-Type": "application/json" };

  try {
    const res = await fetch(url, { method, headers, body: body ? JSON.stringify(body) : null });
    const text = await res.text();
    renderJson(td, text);
  } catch (err) {
    td.innerHTML = `<pre>JS error: ${err}</pre>`;
  }
}

/* =========================
   USER TEST (usertest)  <-- ЭТО ДЗ
========================= */
function initUserTests() {
  const ids = [
    "user-get-btn",
    "discount-ok-btn",
    "discount-missing-auth-btn",
    "discount-wrong-scheme-btn",
    "discount-short-token-btn",
    "discount-bad-base64-btn",
    "discount-bad-signature-btn",
    "discount-expired-btn",
  ];

  for (const id of ids) {
    const btn = document.getElementById(id);
    if (btn) btn.addEventListener("click", userTestClick);
  }
}

function flipLastChar(token) {
  if (!token || token.length < 2) return token;
  const last = token[token.length - 1];
  const newLast = last === "a" ? "b" : "a";
  return token.slice(0, -1) + newLast;
}

async function ensureToken(base) {
  if (CURRENT_TOKEN) return;

  const r = await fetch(`${base}/user`);
  const t = await r.text();

  try {
    const j = JSON.parse(t);
    const token = j?.data?.token;
    const headerFromResponse = j?.data?.header;

    if (token) {
      setCurrentToken(token);
      setTokenHeaderFromResponse(headerFromResponse);

      const decodedHeader = decodeJwtHeader(token);
      setTokenHeaderDecoded(decodedHeader);
    }
  } catch {}
}

async function userTestClick(e) {
  const base = document.body.dataset.base || "";
  const id = e.target.id;

  const resultId = id.replace("-btn", "-result");
  const td = document.getElementById(resultId);
  if (!td) return;

  try {
    // GET /user -> store token + show header info
    if (id === "user-get-btn") {
      const res = await fetch(`${base}/user`);
      const text = await res.text();
      renderJson(td, text);

      try {
        const j = JSON.parse(text);
        const token = j?.data?.token;
        const headerFromResponse = j?.data?.header;

        if (token) {
          setCurrentToken(token);
          setTokenHeaderFromResponse(headerFromResponse);

          const decodedHeader = decodeJwtHeader(token);
          setTokenHeaderDecoded(decodedHeader);
        }
      } catch {}
      return;
    }

    // For tests that need token: auto get it
    if (id === "discount-ok-btn" ||
        id === "discount-short-token-btn" ||
        id === "discount-bad-base64-btn" ||
        id === "discount-bad-signature-btn") {
      await ensureToken(base);
    }

    let headers = {};
    const url = `${base}/discount`;

    if (id === "discount-ok-btn") {
      headers = { "Authorization": `Bearer ${CURRENT_TOKEN || ""}` };
    }

    if (id === "discount-missing-auth-btn") {
      headers = {};
    }

    if (id === "discount-wrong-scheme-btn") {
      headers = { "Authorization": `Token ${CURRENT_TOKEN || ""}` };
    }

    if (id === "discount-short-token-btn") {
      const shortToken = (CURRENT_TOKEN || "").split(".").slice(0, 2).join(".");
      headers = { "Authorization": `Bearer ${shortToken}` };
    }

    if (id === "discount-bad-base64-btn") {
      const bad = (CURRENT_TOKEN || "") + "!";
      headers = { "Authorization": `Bearer ${bad}` };
    }

    if (id === "discount-bad-signature-btn") {
      const badSig = flipLastChar(CURRENT_TOKEN || "");
      headers = { "Authorization": `Bearer ${badSig}` };
    }

    if (id === "discount-expired-btn") {
      // ask server for expired token
      const resTok = await fetch(`${base}/user?mode=expired`);
      const tokText = await resTok.text();
      try {
        const j = JSON.parse(tokText);
        EXPIRED_TOKEN = j?.data?.token;
      } catch {}
      headers = { "Authorization": `Bearer ${EXPIRED_TOKEN || ""}` };
    }

    const res = await fetch(url, { method: "GET", headers });
    const text = await res.text();
    renderJson(td, text);

  } catch (err) {
    td.innerHTML = `<pre>JS error: ${err}</pre>`;
  }
}
