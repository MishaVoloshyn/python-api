document.addEventListener("DOMContentLoaded", () => {
  initOrderTests();   // старое (headers)
  initRestTests();    // новое (rest)
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
   HEADERS TEST (old)
========================= */
function initOrderTests() {
  const methods = ["get", "post", "put", "patch", "delete"];
  for (const m of methods) {
    const btn = document.getElementById(`api-order-${m}-btn`);
    if (btn) btn.addEventListener("click", orderBtnClick);
  }
}

async function orderBtnClick(e) {
  const [_, apiName, apiMethod, __] = e.target.id.split("-");
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
   REST TEST (new)
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

  // show bodies in UI
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
    const res = await fetch(url, {
      method,
      headers,
      body: body ? JSON.stringify(body) : null
    });

    const text = await res.text();
    renderJson(td, text);
  } catch (err) {
    td.innerHTML = `<pre>JS error: ${err}</pre>`;
  }
}
