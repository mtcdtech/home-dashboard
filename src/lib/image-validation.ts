export const ALLOWED_IMAGE_EXTENSIONS = new Set(['png', 'jpg', 'jpeg', 'webp', 'gif', 'ico']);
export const MAX_UPLOAD_BYTES = 5 * 1024 * 1024; // 5 MB

export function isMagicImage(buffer: Buffer): boolean {
  if (!buffer || buffer.length < 4) return false;

  // PNG: 89 50 4E 47
  if (buffer[0] === 0x89 && buffer[1] === 0x50 && buffer[2] === 0x4e && buffer[3] === 0x47) {
    return true;
  }

  // JPEG: FF D8 FF
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) {
    return true;
  }

  // GIF: GIF8 (GIF87a / GIF89a)
  if (buffer[0] === 0x47 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x38) {
    return true;
  }

  // WEBP: RIFF....WEBP
  if (
    buffer.length >= 12 &&
    buffer[0] === 0x52 && buffer[1] === 0x49 && buffer[2] === 0x46 && buffer[3] === 0x46 &&
    buffer[8] === 0x57 && buffer[9] === 0x45 && buffer[10] === 0x42 && buffer[11] === 0x50
  ) {
    return true;
  }

  // ICO: 00 00 01 00 or 00 00 02 00
  if (
    buffer[0] === 0x00 && buffer[1] === 0x00 &&
    (buffer[2] === 0x01 || buffer[2] === 0x02) &&
    buffer[3] === 0x00
  ) {
    return true;
  }

  return false;
}

export function sanitizeImageFilename(originalName: string): { filename: string; ext: string } {
  const parts = originalName.split('.');
  const ext = (parts.length > 1 ? parts.pop() : '')?.toLowerCase().trim() || '';
  const base = parts.join('.');
  const cleanBase = base.replace(/[^a-zA-Z0-9_-]/g, '-').replace(/-+/g, '-').substring(0, 80) || 'upload';
  return {
    filename: `${Date.now()}-${cleanBase}.${ext}`,
    ext
  };
}
