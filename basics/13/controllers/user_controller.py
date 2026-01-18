from models.request import CgiRequest
import json
import time
import base64
import hmac
import hashlib


class UserController:
    """
    GET /user
    GET /user?mode=expired
    GET /user?mode=nested          -> returns outer JWT with header cty=JWT and payload=inner JWT
    GET /user?mode=nested_expired  -> nested, but inner token expired
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

        if mode == "nested" or mode == "nested_expired":
            token, inner, hdr_outer, hdr_inner, payload_inner = self._make_nested_token(expired_inner=(mode == "nested_expired"))
            response = {
                "status": {"is_ok": True, "code": 200, "message": "OK"},
                "meta": {
                    "service": "User API: authentication",
                    "requestMethod": method,
                    "serverTime": time.time(),
                    "mode": mode
                },
                "data": {
                    "token": token,
                    "outerHeader": hdr_outer,
                    "innerToken": inner,
                    "innerHeader": hdr_inner,
                    "innerPayload": payload_inner
                }
            }
            self._json(response)
            return

        # normal / expired
        now = int(time.time())
        exp = now + 3600
        if mode == "expired":
            exp = now - 30

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
                "serverTime": time.time(),
                "mode": mode
            },
            "data": {
                "token": token,
                "header": header,
                "payload": payload
            }
        }

        self._json(response)

    # ---------------- JWT creation ----------------

    def _make_nested_token(self, expired_inner: bool):
        # inner token (normal JWT)
        now = int(time.time())
        exp_inner = (now - 30) if expired_inner else (now + 3600)

        header_inner = {"alg": "HS256", "typ": "JWT"}
        payload_inner = {
            "sub": "296c7f07-ba1a-11f0-83b6-62517600596c",
            "iss": "Server-KN-P-221",
            "aud": "admin",
            "iat": now,
            "exp": exp_inner,
            "name": "Default Administrator",
            "email": "change.me@fake.net",
        }
        inner_token = self._jwt_encode(header_inner, payload_inner)

        # outer token: header has cty=JWT, payload is inner_token as STRING (not JSON)
        header_outer = {"alg": "HS256", "typ": "JWT", "cty": "JWT"}
        outer_token = self._jwt_encode(header_outer, inner_token)  # payload is str

        return outer_token, inner_token, header_outer, header_inner, payload_inner

    def _b64url_encode(self, b: bytes) -> str:
        return base64.urlsafe_b64encode(b).decode("ascii").rstrip("=")

    def _jwt_encode(self, header: dict, payload):
        # payload can be dict (JSON) OR string (nested JWT case)
        h = self._b64url_encode(json.dumps(header, separators=(",", ":"), ensure_ascii=False).encode("utf-8"))

        if isinstance(payload, dict):
            p_bytes = json.dumps(payload, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
        elif isinstance(payload, str):
            p_bytes = payload.encode("utf-8")
        else:
            p_bytes = str(payload).encode("utf-8")

        p = self._b64url_encode(p_bytes)

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
