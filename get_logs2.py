import requests
import urllib3
urllib3.disable_warnings()

PORTAINER_URL = "http://mtcd-server.tail654dd.ts.net:9000"
HEADERS = {"X-API-Key": "ptr_caKh16OVXC+3G4shu9s7TXtumDZY04R6wwaOYkq+Pls="}

ep_id = 2
cnt_resp = requests.get(f"{PORTAINER_URL}/api/endpoints/{ep_id}/docker/containers/json?all=1", headers=HEADERS, verify=False)
for c in cnt_resp.json():
    names = c.get("Names", [])
    if any("homedashboard" in n for n in names):
        if "app" in names[0]:
            cid = c["Id"]
            print(f"Container: {names} State: {c['State']} Status: {c['Status']}")
            exec_req = requests.post(f"{PORTAINER_URL}/api/endpoints/{ep_id}/docker/containers/{cid}/exec", headers=HEADERS, json={
                "AttachStdout": True, "AttachStderr": True, "Cmd": ["cat", "entrypoint.sh"]
            }, verify=False)
            exec_id = exec_req.json()["Id"]
            start_req = requests.post(f"{PORTAINER_URL}/api/endpoints/{ep_id}/docker/exec/{exec_id}/start", headers=HEADERS, json={"Detach": False, "Tty": False}, verify=False)
            print("entrypoint.sh contents:")
            cleaned = "".join(chr(b) for b in start_req.content if 32 <= b < 127 or b == 10)
            print(cleaned)
