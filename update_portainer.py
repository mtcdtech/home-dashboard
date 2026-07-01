import os
import re
import time
import requests
import json
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

def deploy_to_portainer(name, url, api_key, global_secrets):
    if not api_key:
        print(f"[{name}] Skipping deployment (Missing API Key)")
        return

    headers = {"X-API-Key": api_key}

    try:
        r_stack = requests.get(url, headers=headers, verify=False)
        r_stack.raise_for_status()
        stack_info = r_stack.json()
        current_env = stack_info.get("Env", [])
    except Exception as e:
        print(f"[{name}] Failed to fetch stack info from Portainer: {e}")
        return

    try:
        r_file = requests.get(url.replace("?endpointId=2", "/file"), headers=headers, verify=False)
        r_file.raise_for_status()
        content = r_file.json()["StackFileContent"]
    except Exception as e:
        print(f"[{name}] Failed to fetch stack file from Portainer: {e}")
        return

    # Extract version from package.json
    app_version = None
    try:
        with open('package.json', 'r') as f:
            pkg = json.load(f)
            app_version = pkg.get('version')
    except Exception as e:
        print(f"[{name}] Warning: Could not read package.json version: {e}")

    # Force explicit version tag if provided to bypass Portainer caching issues
    if app_version:
        content = re.sub(r'image:\s*mtcdtech/home-?dashboard:[^\s]+', f'image: mtcdtech/homedashboard:v{app_version}', content)

    # Replace REDEPLOY_DATE to trigger restart
    if 'REDEPLOY_DATE=' in content:
        content = re.sub(r'REDEPLOY_DATE=\d+', f'REDEPLOY_DATE={int(time.time())}', content)
    else:
        content = content.replace('environment:', f'environment:\n      - REDEPLOY_DATE={int(time.time())}')

    # Merge current_env with global_secrets
    env_dict = {item["name"]: item["value"] for item in current_env}
    
    # We only update vars that are already in the stack, OR explicitly push AUTH_SECRET / Entra
    if "AUTH_SECRET" in global_secrets:
        env_dict["AUTH_SECRET"] = global_secrets["AUTH_SECRET"]
    if "AUTH_MICROSOFT_ENTRA_ID_SECRET" in global_secrets:
        env_dict["AUTH_MICROSOFT_ENTRA_ID_SECRET"] = global_secrets["AUTH_MICROSOFT_ENTRA_ID_SECRET"]
        
    # For Authentik, we push them if they exist in global_secrets AND it's Church Synology
    if "Church" in name:
        for k in [
            "AUTHENTIK_PCO_CLIENT_ID", "AUTHENTIK_PCO_CLIENT_SECRET", "AUTHENTIK_PCO_ISSUER",
            "AUTHENTIK_MS_CLIENT_ID", "AUTHENTIK_MS_CLIENT_SECRET", "AUTHENTIK_MS_ISSUER",
            "AUTHENTIK_CC_CLIENT_ID", "AUTHENTIK_CC_CLIENT_SECRET", "AUTHENTIK_CC_ISSUER"
        ]:
            if k in global_secrets and global_secrets[k]:
                env_dict[k] = global_secrets[k]

    new_env = [{"name": k, "value": v} for k, v in env_dict.items()]

    payload = {
        "stackFileContent": content,
        "env": new_env,
        "prune": True,
        "pullImage": True
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
        
    global_secrets = {
        "AUTH_SECRET": auth_secret,
        "AUTH_MICROSOFT_ENTRA_ID_SECRET": entra_secret,
        "AUTHENTIK_PCO_CLIENT_ID": get_secret(env_vars, "AUTHENTIK_PCO_CLIENT_ID"),
        "AUTHENTIK_PCO_CLIENT_SECRET": get_secret(env_vars, "AUTHENTIK_PCO_CLIENT_SECRET"),
        "AUTHENTIK_PCO_ISSUER": get_secret(env_vars, "AUTHENTIK_PCO_ISSUER"),
        "AUTHENTIK_MS_CLIENT_ID": get_secret(env_vars, "AUTHENTIK_MS_CLIENT_ID"),
        "AUTHENTIK_MS_CLIENT_SECRET": get_secret(env_vars, "AUTHENTIK_MS_CLIENT_SECRET"),
        "AUTHENTIK_MS_ISSUER": get_secret(env_vars, "AUTHENTIK_MS_ISSUER"),
        "AUTHENTIK_CC_CLIENT_ID": get_secret(env_vars, "AUTHENTIK_CC_CLIENT_ID"),
        "AUTHENTIK_CC_CLIENT_SECRET": get_secret(env_vars, "AUTHENTIK_CC_CLIENT_SECRET"),
        "AUTHENTIK_CC_ISSUER": get_secret(env_vars, "AUTHENTIK_CC_ISSUER"),
    }

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
        deploy_to_portainer(target["name"], target["url"], target["api_key"], global_secrets)

if __name__ == "__main__":
    # Disable insecure request warnings for self-signed certificates
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)
    
    deploy()
