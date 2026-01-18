from models.request import CgiRequest
import json
import time


class OrderController:
    def __init__(self, request: CgiRequest):
        self.request = request

    def serve(self):
        # Требование ДЗ: если НЕТ Custom-Header -> 403
        custom = self.request.headers.get("Custom-Header")

        if not custom:
            self._json({
                "status": {"is_ok": False, "code": 403, "message": "Forbidden: missing Custom-Header"},
                "meta": {"service": "Order API: headers auth", "requestMethod": self.request.request_method, "serverTime": time.time()},
                "data": None
            }, status_line="403 Forbidden")
            return

        # REST actions
        method = self.request.request_method.upper()

        if method == "GET":
            self._json({
                "status": {"is_ok": True, "code": 200, "message": "OK"},
                "meta": {"service": "Order API: headers auth", "requestMethod": method, "serverTime": time.time()},
                "data": {"api": "order", "method": "GET"}
            })
            return

        if method == "POST":
            self._json({
                "status": {"is_ok": True, "code": 201, "message": "Created"},
                "meta": {"service": "Order API: headers auth", "requestMethod": method, "serverTime": time.time()},
                "data": {"api": "order", "method": "POST"}
            }, status_line="201 Created")
            return

        if method == "PUT":
            self._json({
                "status": {"is_ok": True, "code": 200, "message": "OK"},
                "meta": {"service": "Order API: headers auth", "requestMethod": method, "serverTime": time.time()},
                "data": {"api": "order", "method": "PUT"}
            })
            return

        if method == "PATCH":
            self._json({
                "status": {"is_ok": True, "code": 200, "message": "OK"},
                "meta": {"service": "Order API: headers auth", "requestMethod": method, "serverTime": time.time()},
                "data": {"api": "order", "method": "PATCH"}
            })
            return

        if method == "DELETE":
            self._json({
                "status": {"is_ok": True, "code": 200, "message": "OK"},
                "meta": {"service": "Order API: headers auth", "requestMethod": method, "serverTime": time.time()},
                "data": {"api": "order", "method": "DELETE"}
            })
            return

        self._json({
            "status": {"is_ok": False, "code": 405, "message": "Method Not Allowed"},
            "meta": {"service": "Order API: headers auth", "requestMethod": method, "serverTime": time.time()},
            "data": None
        }, status_line="405 Method Not Allowed")

    def _json(self, obj, status_line: str = None):
        if status_line:
            print(f"Status: {status_line}")
        print("Content-Type: application/json; charset=utf-8")
        print()
        print(json.dumps(obj, ensure_ascii=False, indent=2))
