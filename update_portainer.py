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
    github_sha = os.environ.get("GITHUB_SHA")
    if github_sha:
        content = re.sub(r'image:\s*mtcdtech/home-?dashboard:[^\s]+', f'image: mtcdtech/homedashboard:{github_sha}', content)
    elif app_version:
        content = re.sub(r'image:\s*mtcdtech/home-?dashboard:[^\s]+', f'image: mtcdtech/homedashboard:v{app_version}', content)

    # Replace REDEPLOY_DATE to trigger restart
    if 'REDEPLOY_DATE=' in content:
        content = re.sub(r'REDEPLOY_DATE=\d+', f'REDEPLOY_DATE={int(time.time())}', content)
    else:
        content = content.replace('environment:', f'environment:\n      - REDEPLOY_DATE={int(time.time())}')

    # Inject npx prisma db push into the command for Church Synology AND Abraham
    if "Church" in name or "Abraham" in name:
        content = re.sub(r'command:\s*node\s+server\.js', 'command: sh -c "npx prisma db push && node server.js"', content)

    # Merge current_env with global_secrets
    env_dict = {item["name"]: item["value"] for item in current_env}
    
    # We only update vars that are already in the stack, OR explicitly push AUTH_SECRET / Entra
    if "AUTH_SECRET" in global_secrets:
        env_dict["AUTH_SECRET"] = global_secrets["AUTH_SECRET"]
    if "AUTH_MICROSOFT_ENTRA_ID_SECRET" in global_secrets:
        env_dict["AUTH_MICROSOFT_ENTRA_ID_SECRET"] = global_secrets["AUTH_MICROSOFT_ENTRA_ID_SECRET"]
        
    # For Authentik, we push them if they exist in global_secrets AND it's Church Synology only
    # Abraham uses Synology SSO — no Authentik secrets needed
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


def deploy_abraham_container(portainer_url, api_key, github_sha):
    """Deploy Abraham dashboard by pulling new image and recreating the container while preserving existing env & host config.
    Abraham runs dashboard-app as a standalone container (no Portainer stack).
    Once a multi-arch image is available, this will be migrated to a stack."""
    name = "Abraham Mac Mini"
    if not api_key:
        print(f"[{name}] Skipping deployment (Missing API Key)")
        return

    headers = {"X-API-Key": api_key}
    docker_api = f"{portainer_url}/api/endpoints/3/docker"

    # Build the image tag to use
    image_tag = f"mtcdtech/homedashboard:{github_sha}" if github_sha else "mtcdtech/homedashboard:latest"

    # Minimal fallback env used only if key is missing or container does not exist
    fallback_env = {
        "NODE_ENV": "production",
        "DATABASE_URL": "postgresql://user:password@dashboard-db:5432/dashboard?schema=public",
        "NEXTAUTH_URL": "https://home.abraham16.com",
        "AUTH_URL": "https://home.abraham16.com",
        "AUTH_TRUST_HOST": "true",
    }

    fallback_host_config = {
        "PortBindings": {"4000/tcp": [{"HostPort": "4001"}]},
        "Binds": ["/Users/benny2168/Dockers/dashboard-uploads:/app/public/uploads"],
        "RestartPolicy": {"Name": "unless-stopped"},
        "NetworkMode": "dashboard_default",
    }

    fallback_networking_config = {
        "EndpointsConfig": {
            "dashboard_default": {},
            "proxynet": {}
        }
    }

    # 1. Inspect existing container before stopping/removing it
    print(f"[{name}] Inspecting existing container 'dashboard-app'...")
    try:
        r_inspect = requests.get(
            f"{docker_api}/containers/dashboard-app/json",
            headers=headers, verify=False, timeout=30
        )
    except Exception as e:
        print(f"[{name}] Failed to inspect container: {e}")
        r_inspect = None

    env_dict = {}
    preserved_keys = []
    injected_defaults = []

    if r_inspect and r_inspect.status_code == 200:
        inspect_data = r_inspect.json()
        config = inspect_data.get("Config", {})
        raw_env = config.get("Env", [])
        for item in raw_env:
            if '=' in item:
                k, v = item.split('=', 1)
                env_dict[k] = v
        preserved_keys = list(env_dict.keys())

        # Ensure minimal defaults if any are missing
        for k, v in fallback_env.items():
            if k not in env_dict:
                env_dict[k] = v
                injected_defaults.append(k)

        host_config = inspect_data.get("HostConfig") or fallback_host_config

        networks = inspect_data.get("NetworkSettings", {}).get("Networks", {})
        if networks:
            networking_config = {"EndpointsConfig": {net: {} for net in networks.keys()}}
        else:
            networking_config = fallback_networking_config

        cmd = config.get("Cmd") or ["sh", "-c", "npx prisma db push && node server.js"]
        exposed_ports = config.get("ExposedPorts") or {"4000/tcp": {}}
    else:
        status_str = str(r_inspect.status_code) if r_inspect else "N/A"
        print(f"[{name}] Existing container not found (status {status_str}). Initializing with fallback configuration.")
        env_dict = dict(fallback_env)
        injected_defaults = list(fallback_env.keys())
        host_config = fallback_host_config
        networking_config = fallback_networking_config
        cmd = ["sh", "-c", "npx prisma db push && node server.js"]
        exposed_ports = {"4000/tcp": {}}

    # Always overwrite REDEPLOY_DATE with current epoch
    redeploy_date = int(time.time())
    env_dict["REDEPLOY_DATE"] = str(redeploy_date)

    print(f"[{name}] Preserved env keys ({len(preserved_keys)}): {preserved_keys}")
    print(f"[{name}] Injected default env keys ({len(injected_defaults)}): {injected_defaults}")

    new_env_list = [f"{k}={v}" for k, v in env_dict.items()]

    try:
        # 2. Pull the new image
        print(f"[{name}] Pulling image {image_tag}...")
        r = requests.post(
            f"{docker_api}/images/create?fromImage=mtcdtech/homedashboard&tag={github_sha or 'latest'}",
            headers=headers, verify=False, timeout=300
        )
        print(f"[{name}] Pull status: {r.status_code}")

        # 3. Stop and remove old container
        for container in ["dashboard-app"]:
            print(f"[{name}] Stopping {container}...")
            requests.post(f"{docker_api}/containers/{container}/stop", headers=headers, verify=False, timeout=30)
            print(f"[{name}] Removing {container}...")
            requests.delete(f"{docker_api}/containers/{container}", headers=headers, verify=False, timeout=30)

        # 4. Create new container with updated image and preserved config
        container_config = {
            "Image": image_tag,
            "Cmd": cmd,
            "Env": new_env_list,
            "HostConfig": host_config,
            "ExposedPorts": exposed_ports,
            "NetworkingConfig": networking_config
        }
        print(f"[{name}] Creating new dashboard-app container with {image_tag}...")
        r = requests.post(
            f"{docker_api}/containers/create?name=dashboard-app",
            headers=headers, json=container_config, verify=False, timeout=60
        )
        if r.status_code not in (200, 201):
            print(f"[{name}] Container create failed: {r.status_code} {r.text[:300]}")
            return
        container_id = r.json().get("Id", "")
        print(f"[{name}] Container created: {container_id[:12]}")

        # 5. Start the new container
        r = requests.post(f"{docker_api}/containers/{container_id}/start", headers=headers, verify=False, timeout=30)
        print(f"[{name}] Start status: {r.status_code}")
        print(f"[{name}] Deployment triggered successfully!")

    except Exception as e:
        print(f"[{name}] Deployment failed: {e}")

def deploy():
    env_vars = load_env()

    entra_secret = get_secret(env_vars, "AUTH_MICROSOFT_ENTRA_ID_SECRET")
    auth_secret = get_secret(env_vars, "AUTH_SECRET")
    github_sha = os.environ.get("GITHUB_SHA")
    branch = os.environ.get("GITHUB_REF_NAME", "main")

    print(f"[deploy] Branch: {branch} | SHA: {github_sha}")

    global_secrets = {
        "AUTH_SECRET": auth_secret or "",
        "AUTH_MICROSOFT_ENTRA_ID_SECRET": entra_secret or "",
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

    # --- MTCD Church Synology: only on main branch ---
    if branch == "main":
        if entra_secret and auth_secret:
            church_key = get_secret(env_vars, "PORTAINER_API_KEY_CHURCH") or get_secret(env_vars, "PORTAINER_API_KEY")
            deploy_to_portainer(
                "Church Synology",
                "https://docker.server.mtcd.org/api/stacks/58?endpointId=2",
                church_key,
                global_secrets
            )
        else:
            print("[Church Synology] Skipping — missing AUTH_MICROSOFT_ENTRA_ID_SECRET or AUTH_SECRET")
    else:
        print(f"[Church Synology] Skipping — branch is '{branch}', not 'main'")

    # --- Abraham Mac Mini: only on abraham-prod branch ---
    if branch == "abraham-prod":
        abraham_key = get_secret(env_vars, "PORTAINER_API_KEY_ABRAHAM")
        deploy_abraham_container(
            "https://docker.abraham16.com",
            abraham_key,
            github_sha
        )
    else:
        print(f"[Abraham Mac Mini] Skipping — branch is '{branch}', not 'abraham-prod'")


if __name__ == "__main__":
    # Disable insecure request warnings for self-signed certificates
    import urllib3
    urllib3.disable_warnings(urllib3.exceptions.InsecureRequestWarning)

    deploy()
