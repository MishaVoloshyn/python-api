from models.request import CgiRequest
import json
import time
import base64
import hmac
import hashlib


class DiscountController:
    """
    GET /discount -> requires Authorization: Bearer <token>
    Tests:
    - missing Authorization
    - wrong scheme
    - malformed token (not 3 parts)
    - invalid base64 symbols
    - bad signature
    - expired token
    """

    SECRET = b"super-secret-key-13"

    def __init__(self, request: CgiRequest):
        self.request = request

    def serve(self):
        method = (self.request.request_method or "GET").upper()
        if method != "GET":
            self._json(self._err(method, 405, "Method Not Allowed"), status_line="405 Method Not Allowed")
            return

        # 1) Authorization header
        auth = self.request.headers.get("Authorization")
        if not auth:
            self._json(self._err(method, 403, "Forbidden: missing Authorization header"), status_line="403 Forbidden")
            return

        # 2) Scheme check
        if not auth.startswith("Bearer "):
            self._json(self._err(method, 403, "Forbidden: invalid scheme (expected 'Bearer <token>')"), status_line="403 Forbidden")
            return

        token = auth[len("Bearer "):].strip()
        if not token:
            self._json(self._err(method, 403, "Forbidden: empty token"), status_line="403 Forbidden")
            return

        # 3) Validate token
        ok, info = self._validate_token(token)
        if not ok:
            self._json(self._err(method, 403, f"Forbidden: {info}"), status_line="403 Forbidden")
            return

        # 4) Authorized
        payload = info["payload"]
        response = {
            "status": {"is_ok": True, "code": 200, "message": "OK"},
            "meta": {
                "service": "Discount API: protected",
                "requestMethod": method,
                "authUserId": payload.get("sub"),
                "dataType": "object",
                "serverTime": time.time(),
                "links": {"get_user": "GET /user", "get_discount": "GET /discount"}
            },
            "data": {
                "discountPercent": 7,
                "forUser": payload.get("name"),
                "aud": payload.get("aud"),
                "exp": payload.get("exp")
            }
        }
        self._json(response)

    # ---------------- token validation ----------------
    def _validate_token(self, token: str):
        # quick base64url symbol check (helps for "invalid base64 symbols" test)
        allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_."

        for ch in token:
            if ch not in allowed:
                return False, f"token has invalid base64url symbol '{ch}'"

        parts = token.split(".")
        if len(parts) != 3:
            return False, "token format invalid (expected 3 parts: header.payload.signature)"

        h64, p64, s64 = parts

        # decode base64url
        header_json = self._b64url_decode_to_text(h64)
        if header_json is None:
            return False, "header part is not valid base64url"

        payload_json = self._b64url_decode_to_text(p64)
        if payload_json is None:
            return False, "payload part is not valid base64url"

        try:
            header = json.loads(header_json)
        except Exception:
            return False, "header JSON invalid"

        try:
            payload = json.loads(payload_json)
        except Exception:
            return False, "payload JSON invalid"

        if header.get("alg") != "HS256":
            return False, "unsupported alg (expected HS256)"

        # verify signature
        expected = self._sign(h64, p64)
        if not hmac.compare_digest(expected, s64):
            return False, "signature invalid"

        # exp check
        exp = payload.get("exp")
        if isinstance(exp, int):
            now = int(time.time())
            if exp < now:
                return False, "token expired"
        else:
            return False, "payload missing/invalid exp"

        return True, {"header": header, "payload": payload}

    def _sign(self, h64: str, p64: str) -> str:
        signing_input = f"{h64}.{p64}".encode("ascii")
        sig = hmac.new(self.SECRET, signing_input, hashlib.sha256).digest()
        return self._b64url_encode(sig)

    def _b64url_encode(self, b: bytes) -> str:
        return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")

    def _b64url_decode_to_text(self, s: str):
        try:
            pad = "=" * ((4 - (len(s) % 4)) % 4)
            raw = base64.urlsafe_b64decode((s + pad).encode("ascii"))
            return raw.decode("utf-8")
        except Exception:
            return None

    # ---------------- response helpers ----------------
    def _err(self, method: str, code=400, message="Bad Request"):
        return {
            "status": {"is_ok": False, "code": code, "message": message},
            "meta": {"service": "Discount API: protected", "requestMethod": method, "serverTime": time.time()},
            "data": None
        }

    def _json(self, obj, status_line: str = None):
        if status_line:
            print(f"Status: {status_line}")
        print("Content-Type: application/json; charset=utf-8")
        print()
        print(json.dumps(obj, ensure_ascii=False, indent=2))
