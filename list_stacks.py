import requests

url = "https://docker.abraham16.com"
token = "ptr_Xy0TVAN137bnoANfCUMWpyNxx1NVukmo11OYwXe8wYI="
headers = {"X-API-Key": token}

stacks_req = requests.get(f"{url}/api/stacks", headers=headers, verify=False)
stacks = stacks_req.json()
print("Stacks:")
for s in stacks:
    print(s['Name'])
