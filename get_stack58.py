import requests
url = "https://docker.server.mtcd.org/api/stacks/58"
headers = {"X-API-Key": "ptr_caKh16OVXC+3G4shu9s7TXtumDZY04R6wwaOYkq+Pls="}
resp = requests.get(url, headers=headers, verify=False)
try:
    print(resp.json().get("Name"))
except:
    print(resp.text)
