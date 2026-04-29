import requests

URL = "https://docker.abraham16.com"
HEADERS = {"X-API-Key": "ptr_Xy0TVAN137bnoANfCUMWpyNxx1NVukmo11OYwXe8wYI="}

resp = requests.get(f"{URL}/api/endpoints/2/docker/containers/json?all=1", headers=HEADERS, verify=False)
containers = resp.json()
container_id = None
for c in containers:
    if c["Names"][0] == "/dashboard-app-sso":
        container_id = c["Id"]
        break

if container_id:
    resp = requests.get(f"{URL}/api/endpoints/2/docker/containers/{container_id}/logs?stdout=1&stderr=1&tail=100", headers=HEADERS, verify=False)
    # The output from docker logs API is a multiplexed stream. Let's just print it raw (removing the first 8 bytes of each frame)
    logs = resp.content
    i = 0
    while i < len(logs):
        if i + 8 > len(logs): break
        header = logs[i:i+8]
        size = int.from_bytes(header[4:8], 'big')
        print(logs[i+8:i+8+size].decode('utf-8', errors='replace'), end='')
        i += 8 + size
else:
    print("Container not found")
