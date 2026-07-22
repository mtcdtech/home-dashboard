import requests
import string
import random

token = 'JJ1JgYWgXLSTaI025sTb9h4fAbI8SsR4xGmL9JGX4yQppWKptUf9kczqfOAi'
headers = {'Authorization': f'Bearer {token}', 'Accept': 'application/json'}
base_url = 'https://auth.server.mtcd.org/api/v3'

r = requests.get(f"{base_url}/core/applications/", headers=headers, verify=False)
apps = r.json().get('results', [])
ms_app = next((a for a in apps if a['slug'] == 'home-dashboard-ms'), None)

if not ms_app:
    print("Could not find home-dashboard-ms app!")
    exit(1)

provider_id = ms_app['provider']
r = requests.get(f"{base_url}/providers/oauth2/{provider_id}/", headers=headers, verify=False)
ms_provider = r.json()

cc_provider_name = 'home-dashboard-cc'

# check if it exists
r = requests.get(f"{base_url}/providers/oauth2/", headers=headers, verify=False)
providers = r.json().get('results', [])
cc_provider = next((p for p in providers if p['name'] == cc_provider_name), None)

if cc_provider:
    client_id = cc_provider['client_id']
    cc_provider_pk = cc_provider['pk']
    print(f"Provider already exists: {cc_provider_name}")
else:
    client_id = ''.join(random.choices(string.ascii_letters + string.digits, k=40))
    client_secret = ''.join(random.choices(string.ascii_letters + string.digits, k=128))
    
    redirect_uris = ms_provider['redirect_uris']
    if isinstance(redirect_uris, list):
        for uri in redirect_uris:
            if 'url' in uri:
                uri['url'] = uri['url'].replace('authentik-ms', 'authentik-cc')
            if 'matching_mode' not in uri:
                uri['matching_mode'] = 'strict'
        
    payload = {
        "name": cc_provider_name,
        "authorization_flow": ms_provider['authorization_flow'],
        "invalidation_flow": ms_provider.get('invalidation_flow', ms_provider['authorization_flow']),
        "client_type": "confidential",
        "client_id": client_id,
        "client_secret": client_secret,
        "redirect_uris": redirect_uris,
        "property_mappings": ms_provider['property_mappings'],
        "sub_mode": ms_provider['sub_mode'],
        "issuer_mode": ms_provider['issuer_mode'],
        "signing_key": ms_provider.get('signing_key')
    }
    
    r = requests.post(f"{base_url}/providers/oauth2/", headers=headers, json=payload, verify=False)
    if r.status_code == 201:
        cc_provider_pk = r.json()['pk']
        print(f"Created provider: {cc_provider_name}")
    else:
        print(f"Failed to create provider: {r.text}")
        exit(1)

cc_app = next((a for a in apps if a['slug'] == cc_provider_name), None)

if not cc_app:
    app_payload = {
        "name": "Home Dashboard (Church Center)",
        "slug": cc_provider_name,
        "provider": cc_provider_pk,
        "policy_engine_mode": ms_app['policy_engine_mode']
    }
    r = requests.post(f"{base_url}/core/applications/", headers=headers, json=app_payload, verify=False)
    if r.status_code == 201:
        print("Created Application")
    else:
        print(f"Failed to create app: {r.text}")

print("---SECRETS---")
print(f"AUTHENTIK_CC_CLIENT_ID={client_id}")
if 'client_secret' in locals():
    print(f"AUTHENTIK_CC_CLIENT_SECRET={client_secret}")
print(f"AUTHENTIK_CC_ISSUER=https://auth.server.mtcd.org/application/o/{cc_provider_name}/")

