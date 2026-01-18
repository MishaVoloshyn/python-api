#!C:/python/python.exe
# -*- coding: utf-8 -*-

import os

BASE_URL = "/python-api/basics/13"

def response_text(text: str):
    print("Content-Type: text/plain; charset=utf-8")
    print()
    print(text)

def response_json(text: str):
    print("Content-Type: application/json; charset=utf-8")
    print()
    print(text)

def response_html(html: str):
    print("Content-Type: text/html; charset=utf-8")
    print()
    print(html)

uri = os.environ.get("REQUEST_URI", "/")
path = uri.split("?", 1)[0]
segment = path.strip("/").split("/")[-1].lower()

method = os.environ.get("REQUEST_METHOD", "GET").upper()

if segment == "ordertest":
    html = f"""
<!doctype html>
<html lang="uk">
<head>
  <meta charset="utf-8" />
  <title>Випробування API: Order</title>
  <style>
    body {{ font-family: Arial, sans-serif; padding: 20px; background: #f2d9b8; }}
    h1 {{ margin-top: 0; }}
    table {{ width: 100%; border-collapse: collapse; background: #f2d9b8; }}
    th, td {{ border: 1px solid #caa57a; padding: 10px; vertical-align: top; }}
    th {{ width: 140px; text-align: left; }}
    .btn {{ display:block; width: 100px; padding: 8px; margin: 6px 0; cursor:pointer; }}
    pre {{ margin: 0; white-space: pre-wrap; }}
  </style>
</head>
<body>

<div>Header</div>
<h1>Випробування API: Order</h1>

<table>
  <tr>
    <th>Метод</th>
    <th>Результат</th>
  </tr>
  <tr>
    <td>
      <button class="btn" data-method="GET">GET<br>order</button>
      <button class="btn" data-method="POST">POST<br>order</button>
      <button class="btn" data-method="PUT">PUT<br>order</button>
      <button class="btn" data-method="PATCH">PATCH<br>order</button>
      <button class="btn" data-method="DELETE">DELETE<br>order</button>
    </td>
    <td><pre id="result">{{ }}</pre></td>
  </tr>
</table>

<script>
  const result = document.getElementById("result");

  document.querySelectorAll("button[data-method]").forEach(btn => {{
    btn.addEventListener("click", async () => {{
      const method = btn.dataset.method;

      try {{
        const res = await fetch("{BASE_URL}/order", {{
          method,
          headers: {{ "Content-Type": "application/json" }},
          body: (method === "GET" || method === "DELETE") ? null : JSON.stringify({{ test: true }})
        }});

        const text = await res.text();
        result.textContent = text;
      }} catch (e) {{
        result.textContent = "Помилка: " + e;
      }}
    }});
  }});
</script>

</body>
</html>
"""
    response_html(html)


elif segment == "order":
    import time, json

    payload = {
        "status": {
            "is_ok": True,
            "code": 200,
            "message": "OK"
        },
        "meta": {
            "service": "Order API: routing",
            "requestMethod": method,
            "serverTime": time.time(),
            "links": {
                "get": "GET /order",
                "post": "POST /order",
                "put": "PUT /order",
                "patch": "PATCH /order",
                "delete": "DELETE /order"
            }
        },
        "data": {
            "api": "order",
            "method": method
        }
    }

    response_json(json.dumps(payload, ensure_ascii=False, indent=2))


else:
    response_text("Router works. Try /order or /ordertest")
