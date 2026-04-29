import requests

URL = "https://docker.server.mtcd.org"
HEADERS = {"X-API-Key": "ptr_caKh16OVXC+3G4shu9s7TXtumDZY04R6wwaOYkq+Pls="}

resp = requests.get(f"{URL}/api/endpoints/2/docker/containers/json?all=1", headers=HEADERS, verify=False)
try:
    containers = resp.json()
    for c in containers:
        if "dashboard" in c.get("Names", [""])[0]:
            print(c["Names"][0], c["State"], c["Status"], c["Image"])
except Exception as e:
    print(resp.status_code, resp.text)
