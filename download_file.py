import requests
import tarfile
import io

PORTAINER_URL = "http://mtcd-server.tail654dd.ts.net:9000"
HEADERS = {"X-API-Key": "ptr_caKh16OVXC+3G4shu9s7TXtumDZY04R6wwaOYkq+Pls="}
ep_id = 2

cnt_resp = requests.get(f"{PORTAINER_URL}/api/endpoints/{ep_id}/docker/containers/json?all=1", headers=HEADERS, verify=False)
cid = [c["Id"] for c in cnt_resp.json() if "app" in c.get("Names", [])[0] and "homedashboard" in c.get("Names", [])[0]][0]

url = f"{PORTAINER_URL}/api/endpoints/{ep_id}/docker/containers/{cid}/archive?path=/app/.next/server/chunks/ssr"
resp = requests.get(url, headers=HEADERS, verify=False)
with open("chunks.tar", "wb") as f:
    f.write(resp.content)
