import dns from 'dns';
import { promisify } from 'util';

const lookup = promisify(dns.lookup);

export async function isSafeUrl(urlString: string): Promise<boolean> {
  try {
    const urlObj = new URL(urlString);
    if (urlObj.protocol !== 'http:' && urlObj.protocol !== 'https:') return false;
    
    // Resolve DNS
    const { address } = await lookup(urlObj.hostname);
    
    // Check IPv4
    if (address.includes('.')) {
      const parts = address.split('.').map(Number);
      if (parts[0] === 127 || parts[0] === 0) return false; // Loopback
      if (parts[0] === 10) return false; // Private 10.x.x.x
      if (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) return false; // Private 172.16.x.x
      if (parts[0] === 192 && parts[1] === 168) return false; // Private 192.168.x.x
      if (parts[0] === 169 && parts[1] === 254) return false; // Link-local / Metadata
      if (parts[0] >= 224) return false; // Multicast / Reserved
      if (parts[0] === 100 && parts[1] >= 64 && parts[1] <= 127) return false; // Carrier-grade NAT 100.64.0.0/10
      if (parts[0] === 198 && parts[1] >= 18 && parts[1] <= 19) return false; // Benchmarking 198.18.0.0/15
    } 
    // Check IPv6
    else if (address.includes(':')) {
      if (address === '::1' || address === '::') return false; // Loopback / Unspecified
      if (address.toLowerCase().startsWith('fc') || address.toLowerCase().startsWith('fd')) return false; // Unique Local
      if (address.toLowerCase().startsWith('fe8') || address.toLowerCase().startsWith('fe9') || address.toLowerCase().startsWith('fea') || address.toLowerCase().startsWith('feb')) return false; // Link Local
    }

    return true;
  } catch (err) {
    return false; // DNS resolution failed or invalid URL
  }
}

export async function safeFetch(url: string, options: { maxSize?: number, expectedTypePrefix?: string, requireAuthzToken?: string } = {}) {
  const { maxSize = 10 * 1024 * 1024, expectedTypePrefix } = options; // 10MB default limit
  
  if (!(await isSafeUrl(url))) {
     throw new Error(`SSRF Blocked: URL is not safe or private IP detected: ${url}`);
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
  
  const headers: Record<string, string> = {};
  if (options.requireAuthzToken) {
     headers['Authorization'] = `Bearer ${options.requireAuthzToken}`;
  }

  try {
    const response = await fetch(url, { signal: controller.signal, headers, redirect: 'error' }); // disable redirects to prevent SSRF bypass
    
    if (!response.ok) throw new Error(`HTTP Error: ${response.status}`);
    
    const contentLength = response.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > maxSize) {
        throw new Error("Response too large");
    }

    const contentType = response.headers.get('content-type');
    if (expectedTypePrefix && (!contentType || !contentType.startsWith(expectedTypePrefix))) {
        throw new Error(`Invalid content type: expected ${expectedTypePrefix}, got ${contentType}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    if (arrayBuffer.byteLength > maxSize) {
        throw new Error("Response too large");
    }

    return arrayBuffer;
  } finally {
    clearTimeout(timeoutId);
  }
}
