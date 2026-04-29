import requests

PORTAINER_URL = "http://mtcd-server.tail654dd.ts.net:9000"
HEADERS = {"X-API-Key": "ptr_caKh16OVXC+3G4shu9s7TXtumDZY04R6wwaOYkq+Pls="}
ep_id = 2

# Find container ID
cnt_resp = requests.get(f"{PORTAINER_URL}/api/endpoints/{ep_id}/docker/containers/json?all=1", headers=HEADERS, verify=False)
cid = [c["Id"] for c in cnt_resp.json() if "app" in c.get("Names", [])[0] and "homedashboard" in c.get("Names", [])[0]][0]

import subprocess
subprocess.run(["docker", "-H", "tcp://mtcd-server.tail654dd.ts.net:2375", "cp", f"{cid}:/app/.next/server/chunks", "./chunks"])
