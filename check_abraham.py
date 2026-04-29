import requests

URL = "https://docker.abraham16.com"
HEADERS = {"X-API-Key": "ptr_Xy0TVAN137bnoANfCUMWpyNxx1NVukmo11OYwXe8wYI="}

resp = requests.get(f"{URL}/api/endpoints/2/docker/containers/json?all=1", headers=HEADERS, verify=False)
try:
    containers = resp.json()
    for c in containers:
        if "dashboard" in c.get("Names", [""])[0]:
            print(c["Names"][0], c["State"], c["Status"], c["Image"], c["ImageID"])
except Exception as e:
    print(resp.status_code, resp.text)
