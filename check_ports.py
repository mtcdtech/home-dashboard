import requests
URL = "https://docker.abraham16.com"
HEADERS = {"X-API-Key": "ptr_Xy0TVAN137bnoANfCUMWpyNxx1NVukmo11OYwXe8wYI="}
resp = requests.get(f"{URL}/api/endpoints/2/docker/containers/json?all=1", headers=HEADERS, verify=False)
containers = resp.json()
for c in containers:
    ports = c.get("Ports", [])
    for p in ports:
        if p.get("PublicPort") in [4000, 4001] or p.get("PrivatePort") in [4000, 4001]:
            print(c["Names"][0], c["State"], p)
