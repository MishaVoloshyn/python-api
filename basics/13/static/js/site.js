document.addEventListener("DOMContentLoaded", () => {
  initOrderTests();
});

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

  // По ДЗ:
  // GET/POST -> header есть
  // PUT/PATCH/DELETE -> header нет -> 403
  const sendHeader = (method === "GET" || method === "POST");

  const headers = {};
  if (sendHeader) headers["Custom-Header"] = "AnyValue123";

  try {
    const res = await fetch(`${base}/order`, {
      method,
      headers
    });

    const text = await res.text();
    try {
      const json = JSON.parse(text);
      td.innerHTML = `<pre>${JSON.stringify(json, null, 4)}</pre>`;
    } catch {
      td.innerHTML = `<pre>${text}</pre>`;
    }
  } catch (err) {
    td.innerHTML = `<pre>JS error: ${err}</pre>`;
  }
}
