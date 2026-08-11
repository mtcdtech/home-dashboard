import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export function isLucideIconName(value: string | null | undefined): boolean {
  if (!value) return false;
  return /^[A-Z][a-zA-Z0-9_-]*$/.test(value) && !value.includes('/') && !value.includes('.') && !value.startsWith('http');
}

export function isExternalUrl(value: string | null | undefined): boolean {
  if (!value) return false;
  if (!/^https?:\/\//i.test(value)) return false;
  return !value.includes('/uploads/') && !value.includes('/api/uploads/');
}

export function sniffImageType(buffer: Buffer, contentType?: string | null): { ext: string; mime: string } | null {
  if (!buffer || buffer.length === 0) return null;

  // PNG: 89 50 4E 47
  if (buffer.length >= 4 && buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return { ext: 'png', mime: 'image/png' };
  }

  // JPEG: FF D8 FF
  if (buffer.length >= 3 && buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return { ext: 'jpg', mime: 'image/jpeg' };
  }

  // GIF: 47 49 46 38 ("GIF8")
  if (buffer.length >= 4 && buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return { ext: 'gif', mime: 'image/gif' };
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return { ext: 'webp', mime: 'image/webp' };
  }

  // ICO: 00 00 01 00 or 00 00 02 00
  if (
    buffer.length >= 4 &&
    buffer[0] === 0x00 && buffer[1] === 0x00 &&
    (buffer[2] === 0x01 || buffer[2] === 0x02) &&
    buffer[3] === 0x00
  ) {
    return { ext: 'ico', mime: 'image/x-icon' };
  }

  // Check SVG: text containing <svg
  const textSample = buffer.slice(0, Math.min(buffer.length, 4096)).toString('utf-8').toLowerCase();
  if (textSample.includes('<svg') || (contentType && contentType.includes('image/svg+xml'))) {
    return { ext: 'svg', mime: 'image/svg+xml' };
  }

  // Fallback content-type checks
  if (contentType) {
    const ct = contentType.toLowerCase();
    if (ct.includes('image/png')) return { ext: 'png', mime: 'image/png' };
    if (ct.includes('image/jpeg') || ct.includes('image/jpg')) return { ext: 'jpg', mime: 'image/jpeg' };
    if (ct.includes('image/svg+xml')) return { ext: 'svg', mime: 'image/svg+xml' };
    if (ct.includes('image/webp')) return { ext: 'webp', mime: 'image/webp' };
    if (ct.includes('image/gif')) return { ext: 'gif', mime: 'image/gif' };
    if (ct.includes('image/x-icon') || ct.includes('image/vnd.microsoft.icon') || ct.includes('image/ico')) {
      return { ext: 'ico', mime: 'image/x-icon' };
    }
  }

  return null;
}

export function sanitizeSvg(buffer: Buffer): Buffer {
  let str = buffer.toString('utf-8');
  // Strip <script> tags
  str = str.replace(/<script[\s\S]*?<\/script>/gi, '');
  // Strip on* event handlers: e.g. onclick="...", onload='...', onerror=...
  str = str.replace(/\b(on[a-z]+)\s*=\s*(?:"[^"]*"|'[^']*'|[^\s>]+)/gi, '');
  return Buffer.from(str, 'utf-8');
}

export async function downloadIconToDisk(sourceUrl: string): Promise<{ localPath?: string; error?: string }> {
  if (!sourceUrl || typeof sourceUrl !== 'string') {
    return { error: 'Invalid URL provided' };
  }

  // If already a local upload path, return it directly
  if (sourceUrl.startsWith('/uploads/') || sourceUrl.startsWith('/api/uploads/')) {
    return { localPath: sourceUrl };
  }

  try {
    const res = await fetch(sourceUrl, {
      signal: AbortSignal.timeout(5000),
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; HomeDashboardIconFetcher/1.0)',
      },
    });

    if (!res.ok) {
      return { error: `HTTP error ${res.status}: ${res.statusText}` };
    }

    const contentLength = res.headers.get('content-length');
    if (contentLength && parseInt(contentLength, 10) > 2 * 1024 * 1024) {
      return { error: 'Image exceeds 2MB limit' };
    }

    const arrayBuffer = await res.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    if (buffer.length > 2 * 1024 * 1024) {
      return { error: 'Image exceeds 2MB limit' };
    }

    const contentType = res.headers.get('content-type');
    const typeInfo = sniffImageType(buffer, contentType);
    if (!typeInfo) {
      return { error: 'Invalid or unsupported image format' };
    }

    let finalBuffer = buffer;
    if (typeInfo.ext === 'svg') {
      finalBuffer = sanitizeSvg(buffer);
    }

    const hash = crypto.createHash('sha256').update(sourceUrl.trim()).digest('hex');
    const relativePath = `/api/uploads/icons/${hash}.${typeInfo.ext}`;
    const fullPath = path.join(process.cwd(), 'public', 'uploads', 'icons', `${hash}.${typeInfo.ext}`);

    if (fs.existsSync(fullPath)) {
      return { localPath: relativePath };
    }

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, finalBuffer);

    return { localPath: relativePath };
  } catch (err: any) {
    console.error(`downloadIconToDisk failed for ${sourceUrl}:`, err);
    if (err.name === 'AbortError' || err.name === 'TimeoutError' || err.message?.includes('timeout')) {
      return { error: 'Fetch timed out (5s limit)' };
    }
    return { error: err.message || 'Download failed' };
  }
}

export async function saveBase64IconToDisk(dataUri: string): Promise<string | null> {
  if (!dataUri || typeof dataUri !== 'string') return null;
  try {
    let buffer: Buffer;
    let contentType = '';

    if (dataUri.startsWith('data:')) {
      const match = dataUri.match(/^data:([^;,]+)?(;base64)?,(.*)$/s);
      if (!match) return null;
      contentType = match[1] || '';
      const isBase64 = Boolean(match[2]);
      const dataStr = match[3];

      if (isBase64) {
        buffer = Buffer.from(dataStr, 'base64');
      } else {
        buffer = Buffer.from(decodeURIComponent(dataStr), 'utf-8');
      }
    } else {
      return null;
    }

    if (buffer.length > 2 * 1024 * 1024) {
      console.warn('saveBase64IconToDisk failed: size > 2MB');
      return null;
    }

    const typeInfo = sniffImageType(buffer, contentType);
    if (!typeInfo) {
      console.warn('saveBase64IconToDisk failed: unrecognized image format');
      return null;
    }

    let finalBuffer = buffer;
    if (typeInfo.ext === 'svg') {
      finalBuffer = sanitizeSvg(buffer);
    }

    const hash = crypto.createHash('sha256').update(dataUri).digest('hex');
    const relativePath = `/api/uploads/icons/${hash}.${typeInfo.ext}`;
    const fullPath = path.join(process.cwd(), 'public', 'uploads', 'icons', `${hash}.${typeInfo.ext}`);

    if (fs.existsSync(fullPath)) {
      return relativePath;
    }

    await fs.promises.mkdir(path.dirname(fullPath), { recursive: true });
    await fs.promises.writeFile(fullPath, finalBuffer);

    return relativePath;
  } catch (err) {
    console.error('saveBase64IconToDisk error:', err);
    return null;
  }
}
