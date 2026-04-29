import requests
URL = "https://docker.abraham16.com"
HEADERS = {"X-API-Key": "ptr_Xy0TVAN137bnoANfCUMWpyNxx1NVukmo11OYwXe8wYI="}
resp = requests.get(f"{URL}/api/endpoints/2/docker/containers/json?all=1", headers=HEADERS, verify=False)
containers = resp.json()
for c in containers:
    name = c["Names"][0]
    image = c["Image"]
    if "dashboard" in image.lower() or "dashboard" in name.lower():
        print(name, c["State"], image)
