import requests
import urllib3
urllib3.disable_warnings()

PORTAINER_URL = "http://mtcd-server.tail654dd.ts.net:9000"
HEADERS = {"X-API-Key": "ptr_caKh16OVXC+3G4shu9s7TXtumDZY04R6wwaOYkq+Pls="}
ep_id = 2
cnt_resp = requests.get(f"{PORTAINER_URL}/api/endpoints/{ep_id}/docker/containers/json?all=1", headers=HEADERS, verify=False)
for c in cnt_resp.json():
    names = c.get("Names", [])
    if any("homedashboard" in n for n in names) and "app" in names[0]:
        cid = c["Id"]
        logs = requests.get(f"{PORTAINER_URL}/api/endpoints/{ep_id}/docker/containers/{cid}/logs?stdout=1&stderr=1&tail=300", headers=HEADERS, verify=False)
        cleaned = "".join(chr(b) for b in logs.content if 32 <= b < 127 or b == 10)
        print(cleaned)
