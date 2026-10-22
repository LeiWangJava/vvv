/** Photo references are manifest IDs, never paths or guessed filenames. */
export function photoIdFromToken(token: string): string {
  const id = token.startsWith("@") ? token.slice(1) : token;
  if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(id)) {
    throw new Error(`Invalid photo token ${JSON.stringify(token)}; use @asset-id from assets.json`);
  }
  return id;
}

export function parsePages(value: string): string[][] {
  if (typeof value !== "string") throw new Error("Photo tokens must be a string");
  return value.split("|").map((page) => page.split(/[,，\s]+/).filter(Boolean).map((token) => {
    photoIdFromToken(token);
    return token;
  })).filter((page) => page.length > 0);
}

export function validatePhotoTokens(photos: Record<string, string>, hasPhoto: (id: string) => boolean): void {
  for (const [slot, value] of Object.entries(photos)) {
    for (const token of parsePages(value).flat()) {
      const id = photoIdFromToken(token);
      if (!hasPhoto(id)) throw new Error(`Photo slot "${slot}" references missing asset "${id}"`);
    }
  }
}
