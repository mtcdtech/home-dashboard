"use client";

let cached: string[] | null = null;
let inflight: Promise<string[]> | null = null;

async function loadFromSources(): Promise<string[]> {
  try {
    const [dashRes, selfRes] = await Promise.all([
      fetch("https://raw.githubusercontent.com/homarr-labs/dashboard-icons/main/tree.json"),
      fetch("https://cdn.jsdelivr.net/gh/selfhst/icons/index.json"),
    ]);
    const [dashData, selfData] = await Promise.all([dashRes.json(), selfRes.json()]);

    let allIcons: string[] = [];

    if (Array.isArray(dashData)) {
      allIcons = dashData.map((item: any) => (typeof item === "string" ? item : item.name));
    } else if (dashData && typeof dashData === "object") {
      const list = (dashData as any).png || (dashData as any).icons || [];
      if (Array.isArray(list)) allIcons = list.map((n: string) => n.replace(".png", ""));
    }

    if (Array.isArray(selfData)) {
      const selfIcons = selfData.map(
        (item: any) => `https://cdn.jsdelivr.net/gh/selfhst/icons/png/${item.id}.png`,
      );
      allIcons = [...allIcons, ...selfIcons];
    } else if (selfData && typeof selfData === "object") {
      const selfIcons = Object.keys(selfData).map(
        (id) => `https://cdn.jsdelivr.net/gh/selfhst/icons/png/${id}.png`,
      );
      allIcons = [...allIcons, ...selfIcons];
    }

    return allIcons;
  } catch (e) {
    console.error("Failed to load icon catalog:", e);
    return [];
  }
}

export async function getIconRegistry(): Promise<string[]> {
  if (cached) return cached;
  if (inflight) return inflight;
  inflight = loadFromSources().then((icons) => {
    cached = icons;
    inflight = null;
    return icons;
  });
  return inflight;
}

export function getCachedIconRegistry(): string[] | null {
  return cached;
}
