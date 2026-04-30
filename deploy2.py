import requests
import time

def deploy_to_portainer(url, token, stack_name):
    headers = {"X-API-Key": token}
    
    endpoints_req = requests.get(f"{url}/api/endpoints", headers=headers, verify=False)
    endpoints = endpoints_req.json()
    endpoint_id = endpoints[0]['Id']
    
    stacks_req = requests.get(f"{url}/api/stacks", headers=headers, verify=False)
    stacks = stacks_req.json()
    stack = next((s for s in stacks if s['Name'] == stack_name), None)
    
    if not stack:
        print(f"Stack {stack_name} not found")
        return

    stack_id = stack['Id']
    print(f"Found stack {stack_name} with ID {stack_id}")
    
    file_req = requests.get(f"{url}/api/stacks/{stack_id}/file", headers=headers, verify=False)
    stack_file = file_req.json()['StackFileContent']
    
    update_data = {
        "StackFileContent": stack_file,
        "Env": stack.get('Env', []),
        "Prune": True,
        "PullImage": True
    }
    
    update_req = requests.put(f"{url}/api/stacks/{stack_id}?endpointId={endpoint_id}", headers=headers, json=update_data, verify=False)
    print(f"Update response: {update_req.status_code} {update_req.text}")

print("Deploying to Abraham...")
deploy_to_portainer("https://docker.abraham16.com", "ptr_Xy0TVAN137bnoANfCUMWpyNxx1NVukmo11OYwXe8wYI=", "home-dashboard-sso")

