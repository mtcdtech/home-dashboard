import requests
url = "https://docker.server.mtcd.org/api/endpoints/2/docker/containers/json"
headers = {"X-API-Key": "ptr_caKh16OVXC+3G4shu9s7TXtumDZY04R6wwaOYkq+Pls="}
resp = requests.get(url, headers=headers, verify=False)
for c in resp.json():
    if "homedashboard" in c.get("Names", [""])[0]:
        print(f"Name: {c['Names'][0]}, State: {c['State']}, Status: {c['Status']}, Image: {c['Image']}")
