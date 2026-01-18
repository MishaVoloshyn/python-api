from models.request import CgiRequest
import json
import time
import base64
import hmac
import hashlib
import re


class DiscountController:
    """
    GET /discount -> requires Authorization: Bearer <token>

    Includes:
    - signature check
    - exp check
    - nested JWT Step 8 (cty=JWT)
    - internal claims validation:
        sub must be UUID
        iss must be "Server-KN-P-221"
        must have at least one of: name OR email
        if email exists -> must be valid email format
    """

    SECRET = b"super-secret-key-13"
    MAX_NESTING = 3

    UUID_RE = re.compile(r"^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$")
    EMAIL_RE = re.compile(r"^[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}$")

    def __init__(self, request: CgiRequest):
        self.request = request

    def serve(self):
        method = (self.request.request_method or "GET").upper()
        if method != "GET":
            self._json(self._err(method, 405, "Method Not Allowed"), status_line="405 Method Not Allowed")
            return

        auth = self.request.headers.get("Authorization")
        if not auth:
            self._json(self._err(method, 403, "Forbidden: missing Authorization header"), status_line="403 Forbidden")
            return

        if not auth.startswith("Bearer "):
            self._json(self._err(method, 403, "Forbidden: invalid scheme (expected 'Bearer <token>')"), status_line="403 Forbidden")
            return

        token = auth[len("Bearer "):].strip()
        if not token:
            self._json(self._err(method, 403, "Forbidden: empty token"), status_line="403 Forbidden")
            return

        ok, info = self._validate_token(token, depth=0)
        if not ok:
            self._json(self._err(method, 403, f"Forbidden: {info}"), status_line="403 Forbidden")
            return

        payload = info["payload"]
        nesting = info.get("nesting", 0)

        response = {
            "status": {"is_ok": True, "code": 200, "message": "OK"},
            "meta": {
                "service": "Discount API: protected",
                "requestMethod": method,
                "authUserId": payload.get("sub"),
                "serverTime": time.time(),
                "nesting": nesting,
                "links": {"get_user": "GET /user", "get_discount": "GET /discount"}
            },
            "data": {
                "discountPercent": 7,
                "forUser": payload.get("name"),
                "email": payload.get("email"),
                "aud": payload.get("aud"),
                "exp": payload.get("exp")
            }
        }
        self._json(response)

    # ---------------- JWT validation (with nested support) ----------------

    def _validate_token(self, token: str, depth: int):
        if depth > self.MAX_NESTING:
            return False, "nested JWT depth limit exceeded"

        allowed = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_."
        for ch in token:
            if ch not in allowed:
                return False, f"token has invalid base64url symbol '{ch}'"

        parts = token.split(".")
        if len(parts) != 3:
            return False, "token format invalid (expected 3 parts: header.payload.signature)"

        h64, p64, s64 = parts

        header_json = self._b64url_decode_to_text(h64)
        if header_json is None:
            return False, "header part is not valid base64url"

        try:
            header = json.loads(header_json)
        except Exception:
            return False, "header JSON invalid"

        if header.get("alg") != "HS256":
            return False, "unsupported alg (expected HS256)"

        expected_sig = self._sign(h64, p64)
        if not hmac.compare_digest(expected_sig, s64):
            return False, "signature invalid"

        # ---- Step 8 (nested JWT): cty=JWT ----
        cty = header.get("cty")
        if isinstance(cty, str) and cty.upper() == "JWT":
            inner_jwt = self._b64url_decode_to_text(p64)
            if inner_jwt is None or not inner_jwt.strip():
                return False, "nested JWT payload invalid (expected inner JWT string)"

            ok, info = self._validate_token(inner_jwt.strip(), depth=depth + 1)
            if not ok:
                return False, f"nested JWT invalid: {info}"

            info["nesting"] = info.get("nesting", 0) + 1
            return True, info

        # ---- Normal JWT (payload must be JSON) ----
        payload_json = self._b64url_decode_to_text(p64)
        if payload_json is None:
            return False, "payload part is not valid base64url"

        try:
            payload = json.loads(payload_json)
        except Exception:
            return False, "payload JSON invalid"

        exp = payload.get("exp")
        if not isinstance(exp, int):
            return False, "payload missing/invalid exp"

        now = int(time.time())
        if exp < now:
            return False, "token expired"

        # ---- Internal claims validation (this HW) ----
        ok, msg = self._validate_claims(payload)
        if not ok:
            return False, msg

        return True, {"header": header, "payload": payload, "nesting": 0}

    def _validate_claims(self, payload: dict):
        # sub UUID
        sub = payload.get("sub")
        if not isinstance(sub, str) or not self.UUID_RE.match(sub):
            return False, "invalid sub (must be UUID)"

        # iss exact
        iss = payload.get("iss")
        if iss != "Server-KN-P-221":
            return False, "invalid iss (must be 'Server-KN-P-221')"

        # name or email
        name = payload.get("name")
        email = payload.get("email")

        has_name = isinstance(name, str) and name.strip() != ""
        has_email = isinstance(email, str) and email.strip() != ""

        if not (has_name or has_email):
            return False, "invalid payload: must contain at least one of 'name' or 'email'"

        # email format if present
        if has_email and not self.EMAIL_RE.match(email.strip()):
            return False, "invalid email format"

        return True, "OK"

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
