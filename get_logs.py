import urllib.request
import json
import ssl
import os

TOKEN = "ptr_gApxPW/riEq8Kszyab2O76VXCQcLuIiazyOPFjOFJro=" 
HEADERS = {"X-API-Key": TOKEN, "Content-Type": "application/json"}
BASE_URL = "https://docker.server.mtcd.org/api"
ENDPOINT = "2"

def _request(method, path, payload=None, stream=False):
    url = f"{BASE_URL}{path}"
    data = json.dumps(payload).encode('utf-8') if payload else None
    req = urllib.request.Request(url, headers=HEADERS, data=data, method=method)
    try:
        ctx = ssl.create_default_context()
        ctx.check_hostname = False
        ctx.verify_mode = ssl.CERT_NONE
        with urllib.request.urlopen(req, context=ctx) as response:
            if stream:
                return response.read()
            return response.read().decode('utf-8')
    except Exception as e:
        return None

containers = json.loads(_request('GET', f'/endpoints/{ENDPOINT}/docker/containers/json?all=1'))
hd_cid = None
for c in containers:
    name = "".join(c.get('Names', [''])).lower()
    if 'homedashboard' in name and 'db' not in name:
        hd_cid = c['Id']
        break

if hd_cid:
    logs = _request('GET', f'/endpoints/{ENDPOINT}/docker/containers/{hd_cid}/logs?stdout=1&stderr=1&tail=50')
    if logs:
        # Docker logs have an 8-byte header per line we need to strip
        import struct
        lines = []
        i = 0
        while i < len(logs):
            header = logs[i:i+8]
            if len(header) < 8:
                break
            _, size = struct.unpack('>BxxxI', header.encode('latin1') if isinstance(header, str) else header)
            i += 8
            content = logs[i:i+size]
            lines.append(content.decode('utf-8', errors='ignore') if isinstance(content, bytes) else content)
            i += size
        print("".join(lines))
