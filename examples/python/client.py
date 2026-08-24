import json
import os
import urllib.request

BASE_URL = os.getenv("CENTRUM_BASE_URL", "http://localhost:3000").rstrip("/")
API_KEY = os.environ["CENTRUM_API_KEY"]

def request(method, path, body=None, extra_headers=None):
    headers = {"x-ai-interface-key": API_KEY, **(extra_headers or {})}
    if body is not None:
        headers["content-type"] = "application/json"
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(BASE_URL + path, data=data, headers=headers, method=method)
    with urllib.request.urlopen(req, timeout=60) as response:
        return json.loads(response.read())

live = request("POST", "/v1/execute", {
    "instruction": "Return my in-stock products under 100 EUR as JSON",
})
print("live response:")
print(json.dumps(live, indent=2))

slug = "python-featured-products"
created = request("POST", "/v1/persisted-apis", {
    "slug": slug,
    "instruction": "Return my first three products as JSON",
}, {"idempotency-key": slug + "-v1"})
print("persisted API:")
print(json.dumps(created, indent=2))

persisted = request("GET", "/v1/persisted/" + slug)
print("persisted response without another LLM call:")
print(json.dumps(persisted, indent=2))
