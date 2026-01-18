class CgiRequest:
    def __init__(self, server: dict, query_params: dict, headers: dict, path: str,
                 controller: str, path_parts: list[str]):
        self.server = server
        self.query_params = query_params
        self.headers = headers
        self.request_method = server.get("REQUEST_METHOD", "GET")
        self.path = path
        self.controller = controller
        # path_parts includes controller at [0], then remaining segments
        self.path_parts = path_parts
