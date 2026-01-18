#!C:/python/python.exe
# -*- coding: utf-8 -*-

DEV_MODE = True

import io
import os
import sys
import importlib
from models.request import CgiRequest

# твой проект лежит по URL:
# http://localhost/python-api/basics/13/...
BASE_PREFIX = "/python-api/basics/13"


def header_name(hdr: str) -> str:
    # HTTP_CUSTOM_HEADER -> Custom-Header
    return "-".join(s[:1].upper() + s[1:].lower() for s in hdr.split("_") if s)


def send_error(message: str, code=404, phrase="Not Found"):
    print(f"Status: {code} {phrase}")
    print("Content-Type: text/plain; charset=utf-8")
    print()
    print(message)
    sys.stdout.flush()
    os._exit(0)


# --- force utf-8 output (fixes "кракозябры" and unicode errors) ---
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", newline="\n")

server = {k: v for k, v in os.environ.items() if k in ("REQUEST_URI", "QUERY_STRING", "REQUEST_METHOD")}

query_string = server.get("QUERY_STRING", "")
query_params = {}
if query_string:
    for item in query_string.split("&"):
        if "=" in item:
            k, v = item.split("=", 1)
            query_params[k] = v
        else:
            query_params[item] = None

# must be present (added by .htaccess)
if "htctrl" not in query_params:
    send_error("Forbidden: request must pass .htaccess (missing htctrl)", 403, "Forbidden")

# path without query
request_uri = server.get("REQUEST_URI", "/")
path = request_uri.split("?", 1)[0]

# strip BASE_PREFIX so routing works like in archive (/order, /home, /ordertest)
if path.startswith(BASE_PREFIX):
    path = path[len(BASE_PREFIX):]
if not path.startswith("/"):
    path = "/" + path
if path == "":
    path = "/"

# --- static files: /static/css/site.css, /static/js/site.js, /static/img/...
if not path.endswith("/") and "." in path:
    ext = path.rsplit(".", 1)[-1].lower()
    allowed_media_types = {
        "png": "image/png",
        "jpg": "image/jpeg",
        "jpeg": "image/jpeg",
        "css": "text/css",
        "js": "text/javascript",
        "ico": "image/x-icon",
    }

    if ext in allowed_media_types:
        # read from ./static/ + path after /static/
        # example: path=/static/css/site.css -> ./static/css/site.css
        local_path = os.path.abspath("." + path)
        if os.path.exists(local_path):
            with open(local_path, "rb") as f:
                sys.stdout.buffer.write(f"Content-Type: {allowed_media_types[ext]}\n\n".encode("utf-8"))
                sys.stdout.buffer.write(f.read())
                sys.stdout.flush()
                os._exit(0)
        else:
            send_error(f"Static not found: {path}", 404, "Not Found")

# headers (HTTP_*)
headers = {header_name(k[5:]): v for k, v in os.environ.items() if k.startswith("HTTP_")}
# sometimes Authorization arrives differently:
if "Authorization" not in headers and os.environ.get("HTTP_AUTHORIZATION"):
    headers["Authorization"] = os.environ.get("HTTP_AUTHORIZATION")

# routing: /Controller/action/...
parts = path.split("/", 3)  # ['', controller, action, ...]
controller = parts[1] if len(parts) > 1 and parts[1].strip() else "Home"
module_name = controller.lower() + "_controller"     # order_controller
class_name = controller.capitalize() + "Controller"  # OrderController

# allow import from current directory
sys.path.append("./")

try:
    controller_module = importlib.import_module(f"controllers.{module_name}")
except Exception as ex:
    send_error(f"Controller not found: controllers.{module_name}\n{ex}", 404, "Not Found")

controller_class = getattr(controller_module, class_name, None)
if controller_class is None:
    send_error(f"Controller class not found: {class_name} in {module_name}", 404, "Not Found")

request_obj = CgiRequest(
    server=server,
    query_params=query_params,
    headers=headers,
    path=path,
    controller=controller,
    path_parts=parts[1:]  # [controller, action, ...]
)

controller_object = controller_class(request_obj)

serve_action = getattr(controller_object, "serve", None)
if serve_action is None:
    send_error(f"Controller has no serve(): {class_name}", 500, "Internal Server Error")

try:
    serve_action()
except Exception as ex:
    msg = "Request processing error:\n" + (str(ex) if DEV_MODE else "Internal error")
    send_error(msg, 500, "Internal Server Error")
