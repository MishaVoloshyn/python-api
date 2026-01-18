from models.request import CgiRequest


class UsertestController:
    def __init__(self, request: CgiRequest):
        self.request = request

    def serve(self):
        action = (self.request.path_parts[1].lower()
                  if len(self.request.path_parts) > 1 and self.request.path_parts[1].strip()
                  else "index")
        getattr(self, action)()

    def index(self):
        with open("./views/_layout.html", "r", encoding="utf-8") as f:
            layout = f.read()

        with open("./views/usertest_index.html", "r", encoding="utf-8") as f:
            body = f.read()

        base = "/python-api/basics/13"
        html = layout.replace("{{BASE}}", base).replace("<!-- RenderBody -->", body)

        print("Content-Type: text/html; charset=utf-8")
        print()
        print(html)
