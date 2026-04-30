import os
import re
import time
import requests
from pathlib import Path

def load_env():
    env_vars = {}
    env_path = Path('.env')
    if env_path.exists():
        with open(env_path) as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith('#'):
                    if '=' in line:
                        key, val = line.split('=', 1)
                        # Remove quotes if present
                        val = val.strip().strip('"\'')
                        env_vars[key.strip()] = val
    return env_vars

def deploy():
    env_vars = load_env()
    
    # Required secrets
    entra_secret = env_vars.get("AUTH_MICROSOFT_ENTRA_ID_SECRET")
    auth_secret = env_vars.get("AUTH_SECRET")
    api_key = env_vars.get("PORTAINER_API_KEY")

    if not all([entra_secret, auth_secret, api_key]):
        print("Missing required secrets in .env file (AUTH_MICROSOFT_ENTRA_ID_SECRET, AUTH_SECRET, PORTAINER_API_KEY)")
        return

    url = "https://docker.server.mtcd.org/api/stacks/58?endpointId=2"
    headers = {"X-API-Key": api_key}

    # Get current file
    try:
        r = requests.get("https://docker.server.mtcd.org/api/stacks/58/file", headers=headers, verify=False)
        r.raise_for_status()
        content = r.json()["StackFileContent"]
    except Exception as e:
        print(f"Failed to fetch stack file from Portainer: {e}")
        return

    # Replace REDEPLOY_DATE to trigger restart
    content = re.sub(r'REDEPLOY_DATE=\d+', f'REDEPLOY_DATE={int(time.time())}', content)

    # In Portainer, environment variables can be provided as an array of dicts
    payload = {
        "StackFileContent": content,
        "Env": [
            {"name": "AUTH_MICROSOFT_ENTRA_ID_SECRET", "value": entra_secret},
            {"name": "AUTH_SECRET", "value": auth_secret}
        ],
        "Prune": True,
        "PullImage": True
    }

    try:
        print("Sending deploy request to Portainer...")
        r_put = requests.put(url, headers=headers, json=payload, verify=False)
        r_put.raise_for_status()
        print("Status:", r_put.status_code)
        print("Deployment triggered successfully!")
    except Exception as e:
        print(f"Failed to deploy stack: {e}")
        if 'r_put' in locals():
            print("Response:", r_put.text)

if __name__ == "__main__":
    deploy()
