import requests
import time

def deploy_to_portainer(url, token, stack_name):
    headers = {"X-API-Key": token}
    
    # 1. Get endpoints
    endpoints_req = requests.get(f"{url}/api/endpoints", headers=headers, verify=False)
    if endpoints_req.status_code != 200:
        print(f"Failed to get endpoints: {endpoints_req.text}")
        return
    endpoints = endpoints_req.json()
    endpoint_id = endpoints[0]['Id']
    
    # 2. Get stacks
    stacks_req = requests.get(f"{url}/api/stacks", headers=headers, verify=False)
    stacks = stacks_req.json()
    stack = next((s for s in stacks if s['Name'] == stack_name), None)
    
    if not stack:
        print(f"Stack {stack_name} not found")
        # Try to find webhooks
        webhooks_req = requests.get(f"{url}/api/webhooks", headers=headers, verify=False)
        webhooks = webhooks_req.json()
        print("Webhooks:", webhooks)
        return

    stack_id = stack['Id']
    print(f"Found stack {stack_name} with ID {stack_id}")
    
    # 3. Get stack file
    file_req = requests.get(f"{url}/api/stacks/{stack_id}/file", headers=headers, verify=False)
    stack_file = file_req.json()['StackFileContent']
    
    # 4. Update stack (forces pull if we specify PullImage)
    update_data = {
        "StackFileContent": stack_file,
        "Env": stack.get('Env', []),
        "Prune": True,
        "PullImage": True
    }
    
    update_req = requests.put(f"{url}/api/stacks/{stack_id}?endpointId={endpoint_id}", headers=headers, json=update_data, verify=False)
    print(f"Update response: {update_req.status_code} {update_req.text}")

print("Deploying to Church...")
deploy_to_portainer("https://docker.server.mtcd.org", "ptr_caKh16OVXC+3G4shu9s7TXtumDZY04R6wwaOYkq+Pls=", "homedashboard")

print("Deploying to Abraham...")
deploy_to_portainer("https://docker.abraham16.com", "ptr_Xy0TVAN137bnoANfCUMWpyNxx1NVukmo11OYwXe8wYI=", "homedashboard")

