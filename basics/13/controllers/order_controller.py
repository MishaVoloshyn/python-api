from models.request import CgiRequest
import os
import json
import time
import sys


class OrderController:
    def __init__(self, request: CgiRequest):
        self.request = request
        self.base_dir = os.path.dirname(os.path.dirname(__file__))  # .../basics/13
        self.db_path = os.path.join(self.base_dir, "db.json")

    # =========================
    # MAIN ENTRY
    # =========================
    def serve(self):
        method = (self.request.request_method or "GET").upper()

        # ---- REST CRUD ----
        if method == "GET":
            self.handle_get()
            return
        if method == "POST":
            self.handle_post()
            return
        if method == "PUT":
            self.handle_put()
            return
        if method == "PATCH":
            self.handle_patch()
            return
        if method == "DELETE":
            self.handle_delete()
            return

        self._json(self._err(method, 405, "Method Not Allowed"), status_line="405 Method Not Allowed")

    # =========================
    # REST HANDLERS
    # =========================
    def handle_get(self):
        method = "GET"
        db = self._read_db()
        orders = db.get("orders", [])

        oid = self._get_id()
        if oid is None:
            self._json(self._ok(method, {"items": orders}))
            return

        item = next((x for x in orders if x.get("id") == oid), None)
        if not item:
            self._json(self._err(method, 404, "Order not found"), status_line="404 Not Found")
            return

        self._json(self._ok(method, {"item": item}))

    def handle_post(self):
        method = "POST"
        db = self._read_db()
        orders = db.get("orders", [])

        body = self._read_body_json()
        new_id = max([x.get("id", 0) for x in orders], default=0) + 1

        item = {
            "id": new_id,
            "title": body.get("title", f"Order {new_id}"),
            "price": body.get("price", 0),
            "status": body.get("status", "new")
        }

        orders.append(item)
        db["orders"] = orders
        self._write_db(db)

        self._json(self._ok(method, {"created": item}, code=201, message="Created"), status_line="201 Created")

    def handle_put(self):
        method = "PUT"
        oid = self._get_id()
        if oid is None:
            self._json(self._err(method, 400, "PUT requires ?id="), status_line="400 Bad Request")
            return

        db = self._read_db()
        orders = db.get("orders", [])

        idx = next((i for i, x in enumerate(orders) if x.get("id") == oid), None)
        if idx is None:
            self._json(self._err(method, 404, "Order not found"), status_line="404 Not Found")
            return

        body = self._read_body_json()
        replaced = {
            "id": oid,
            "title": body.get("title", ""),
            "price": body.get("price", 0),
            "status": body.get("status", "new")
        }

        orders[idx] = replaced
        db["orders"] = orders
        self._write_db(db)

        self._json(self._ok(method, {"updated": replaced}, message="Replaced"))

    def handle_patch(self):
        method = "PATCH"
        oid = self._get_id()
        if oid is None:
            self._json(self._err(method, 400, "PATCH requires ?id="), status_line="400 Bad Request")
            return

        db = self._read_db()
        orders = db.get("orders", [])

        item = next((x for x in orders if x.get("id") == oid), None)
        if not item:
            self._json(self._err(method, 404, "Order not found"), status_line="404 Not Found")
            return

        body = self._read_body_json()
        # partial update
        for k in ["title", "price", "status"]:
            if k in body:
                item[k] = body[k]

        self._write_db(db)
        self._json(self._ok(method, {"updated": item}, message="Patched"))

    def handle_delete(self):
        method = "DELETE"
        oid = self._get_id()
        if oid is None:
            self._json(self._err(method, 400, "DELETE requires ?id="), status_line="400 Bad Request")
            return

        db = self._read_db()
        orders = db.get("orders", [])

        before = len(orders)
        orders = [x for x in orders if x.get("id") != oid]
        if len(orders) == before:
            self._json(self._err(method, 404, "Order not found"), status_line="404 Not Found")
            return

        db["orders"] = orders
        self._write_db(db)

        self._json(self._ok(method, {"deletedId": oid}, message="Deleted"))

    # =========================
    # LOW-LEVEL HELPERS
    # =========================
    def _read_db(self):
        if not os.path.exists(self.db_path):
            return {"orders": []}
        with open(self.db_path, "r", encoding="utf-8") as f:
            return json.load(f)

    def _write_db(self, data):
        with open(self.db_path, "w", encoding="utf-8") as f:
            json.dump(data, f, ensure_ascii=False, indent=2)

    def _get_id(self):
        oid = self.request.query_params.get("id")
        if oid and str(oid).isdigit():
            return int(oid)
        return None

    def _read_body_json(self):
        try:
            length = int(os.environ.get("CONTENT_LENGTH", "0") or "0")
        except ValueError:
            length = 0

        raw = "" if length == 0 else sys.stdin.read(length)
        raw = raw.strip()
        if not raw:
            return {}
        try:
            return json.loads(raw)
        except Exception:
            return {"_raw": raw}

    def _ok(self, method: str, data, code=200, message="OK"):
        return {
            "status": {"is_ok": True, "code": code, "message": message},
            "meta": {
                "service": "Order API: REST",
                "requestMethod": method,
                "serverTime": time.time(),
                "links": {
                    "get_list": "GET /order",
                    "get_one": "GET /order?id=1",
                    "post": "POST /order",
                    "put": "PUT /order?id=1",
                    "patch": "PATCH /order?id=1",
                    "delete": "DELETE /order?id=1",
                }
            },
            "data": data
        }

    def _err(self, method: str, code=400, message="Bad Request"):
        return {
            "status": {"is_ok": False, "code": code, "message": message},
            "meta": {
                "service": "Order API: REST",
                "requestMethod": method,
                "serverTime": time.time()
            },
            "data": None
        }

    def _json(self, obj, status_line: str = None):
        if status_line:
            print(f"Status: {status_line}")
        print("Content-Type: application/json; charset=utf-8")
        print()
        print(json.dumps(obj, ensure_ascii=False, indent=2))
