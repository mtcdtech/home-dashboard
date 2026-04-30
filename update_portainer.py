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
                        val = val.strip().strip('"\'')
                        env_vars[key.strip()] = val
    return env_vars

def get_secret(env_vars, key):
    return os.environ.get(key) or env_vars.get(key)

def deploy_to_portainer(name, url, api_key, entra_secret, auth_secret):
    if not api_key:
        print(f"[{name}] Skipping deployment (Missing API Key)")
        return

    headers = {"X-API-Key": api_key}

    try:
        r = requests.get(url.replace("?endpointId=2", "/file"), headers=headers, verify=False)
        r.raise_for_status()
        content = r.json()["StackFileContent"]
    except Exception as e:
        print(f"[{name}] Failed to fetch stack file from Portainer: {e}")
        return

    # Replace REDEPLOY_DATE to trigger restart
    content = re.sub(r'REDEPLOY_DATE=\d+', f'REDEPLOY_DATE={int(time.time())}', content)

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
        print(f"[{name}] Sending deploy request to Portainer...")
        r_put = requests.put(url, headers=headers, json=payload, verify=False)
        r_put.raise_for_status()
        print(f"[{name}] Status: {r_put.status_code}")
        print(f"[{name}] Deployment triggered successfully!")
    except Exception as e:
        print(f"[{name}] Failed to deploy stack: {e}")
        if 'r_put' in locals():
            print(f"[{name}] Response:", r_put.text)

def deploy():
    env_vars = load_env()
    
    entra_secret = get_secret(env_vars, "AUTH_MICROSOFT_ENTRA_ID_SECRET")
    auth_secret = get_secret(env_vars, "AUTH_SECRET")
    
    if not entra_secret or not auth_secret:
        print("Missing global AUTH secrets. Deployment aborted.")
        return

    targets = [
        {
            "name": "Church Synology",
            "url": "https://docker.server.mtcd.org/api/stacks/58?endpointId=2",
            "api_key": get_secret(env_vars, "PORTAINER_API_KEY_CHURCH") or get_secret(env_vars, "PORTAINER_API_KEY")
        },
        {
            "name": "Abraham Synology",
            "url": "https://docker.abraham16.com/api/stacks/75?endpointId=2",
            "api_key": get_secret(env_vars, "PORTAINER_API_KEY_ABRAHAM")
        }
    ]

    for target in targets:
        deploy_to_portainer(target["name"], target["url"], target["api_key"], entra_secret, auth_secret)

if __name__ == "__main__":
    # Disable insecure request warnings for self-signed certificates
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    deploy()
