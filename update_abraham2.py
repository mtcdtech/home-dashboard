import requests
import time

URL = "https://docker.abraham16.com"
HEADERS = {
    "X-API-Key": "ptr_Xy0TVAN137bnoANfCUMWpyNxx1NVukmo11OYwXe8wYI=",
    "Content-Type": "application/json"
}

STACK_ID = 75
ENDPOINT_ID = 2

resp = requests.get(f"{URL}/api/stacks/{STACK_ID}/file", headers=HEADERS, verify=False)
content = resp.json()["StackFileContent"]

# Update image name
content = content.replace("mtcdtech/home-dashboard:latest", "mtcdtech/homedashboard:abraham")
content = content.replace("mtcdtech/homedashboard:latest", "mtcdtech/homedashboard:abraham")

resp = requests.get(f"{URL}/api/stacks/{STACK_ID}", headers=HEADERS, verify=False)
stack = resp.json()

env_vars = stack.get("Env", [])
found = False
for var in env_vars:
    if var["name"] == "REDEPLOY_DATE":
        var["value"] = str(int(time.time()))
        found = True

if not found:
    env_vars.append({"name": "REDEPLOY_DATE", "value": str(int(time.time()))})

update_payload = {
    "Env": env_vars,
    "StackFileContent": content,
    "Prune": True,
    "PullImage": True
}

resp = requests.put(f"{URL}/api/stacks/{STACK_ID}?endpointId={ENDPOINT_ID}", headers=HEADERS, json=update_payload, verify=False)
print(resp.status_code, resp.text)
