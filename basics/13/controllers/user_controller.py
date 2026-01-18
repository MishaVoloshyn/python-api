from models.request import CgiRequest
import json
import time
import base64
import hmac
import hashlib


class UserController:
    """
    GET /user               -> returns token (valid)
    GET /user?mode=expired  -> returns token with exp in past (expired)
    """

    SECRET = b"super-secret-key-13"

    def __init__(self, request: CgiRequest):
        self.request = request

    def serve(self):
        method = (self.request.request_method or "GET").upper()
        if method != "GET":
            self._json(self._err(method, 405, "Method Not Allowed"), status_line="405 Method Not Allowed")
            return

        mode = (self.request.query_params.get("mode") or "").lower()

        now = int(time.time())
        exp = now + 3600
        if mode == "expired":
            exp = now - 30  # already expired

        header = {"alg": "HS256", "typ": "JWT"}
        payload = {
            "sub": "296c7f07-ba1a-11f0-83b6-62517600596c",
            "iss": "Server-KN-P-221",
            "aud": "admin",
            "iat": now,
            "exp": exp,
            "name": "Default Administrator",
            "email": "change.me@fake.net",
        }

        token = self._jwt_encode(header, payload)

        response = {
            "status": {"is_ok": True, "code": 200, "message": "OK"},
            "meta": {
                "service": "User API: authentication",
                "requestMethod": method,
                "authUserId": None,
                "dataType": "object",
                "cache": {"exp": exp, "lifetime": 3600},
                "serverTime": time.time(),
                "links": {"get": "GET /user", "get_expired": "GET /user?mode=expired", "get_discount": "GET /discount"}
            },
            "data": {
                "token": token,
                "header": header,
                "payload": payload
            }
        }

        self._json(response)

    # ---------------- JWT helpers ----------------
    def _b64url_encode(self, b: bytes) -> str:
        return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")

    def _jwt_encode(self, header: dict, payload: dict) -> str:
        h = self._b64url_encode(json.dumps(header, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
        p = self._b64url_encode(json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))
        signing_input = f"{h}.{p}".encode("ascii")
        sig = hmac.new(self.SECRET, signing_input, hashlib.sha256).digest()
        s = self._b64url_encode(sig)
        return f"{h}.{p}.{s}"

    # ---------------- response helpers ----------------
    def _err(self, method: str, code=400, message="Bad Request"):
        return {
            "status": {"is_ok": False, "code": code, "message": message},
            "meta": {"service": "User API: authentication", "requestMethod": method, "serverTime": time.time()},
            "data": None
        }

    def _json(self, obj, status_line: str = None):
        if status_line:
            print(f"Status: {status_line}")
        print("Content-Type: application/json; charset=utf-8")
        print()
        print(json.dumps(obj, ensure_ascii=False, indent=2))
