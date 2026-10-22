export type Orientation = "portrait" | "landscape" | "square";
export type Person = "groom" | "bride";
export type Stage = "identity" | "childhood" | "school" | "dating" | "daily" | "distance" | "travel" | "proposal" | "wedding" | "chinese" | "reference";
export type ShotKind = "solo" | "couple" | "detail" | "wide" | "reference";
export type TextSpace = "left" | "right" | "top" | "none";
export type Variant = "photo" | "watercolor";

/** Project metadata; absent narrative tags are not inferred from a photo's filename. */
export interface PoolPhoto {
  id: string;
  /** Relative to this project's public directory. */
  file: string;
  width: number;
  height: number;
  orientation: Orientation;
  faces?: [number, number, number, number][];
  focus?: [number, number];
  aspect?: string;
  stage?: Stage;
  stageName?: string;
  date?: string;
  age?: Partial<Record<Person, number>>;
  people?: Person[];
  shot?: ShotKind;
  era?: string;
  caption?: string;
  textSpace?: TextSpace;
  notes?: string;
  set?: string;
  setName?: string;
  isToneShot?: boolean;
  look?: string;
  variant?: Variant;
  source?: string;
}

export class AssetError extends Error {
  constructor(public readonly code: "VVV_ASSET_UNKNOWN" | "VVV_ASSET_MANIFEST_INVALID", message: string) {
    super(`${code}: ${message}`);
    this.name = "AssetError";
  }
}

export function createAssetRegistry(raw: unknown) {
  const fail = (message: string): never => { throw new AssetError("VVV_ASSET_MANIFEST_INVALID", message); };
  if (!raw || typeof raw !== "object") fail("Expected an assets.json object.");
  const value = raw as { version?: unknown; items?: unknown };
  if (value.version !== "0.1" || !Array.isArray(value.items)) fail("Expected version 0.1 and an items array.");
  const photos: PoolPhoto[] = [];
  const byId = new Map<string, PoolPhoto>();
  for (const entry of value.items as unknown[]) {
    if (!entry || typeof entry !== "object") fail("Each asset must be an object.");
    const p = entry as PoolPhoto;
    if (typeof p.id !== "string" || !p.id.trim() || byId.has(p.id)) fail("Asset IDs must be nonempty and unique.");
    if (typeof p.file !== "string" || !p.file || p.file.includes("\\") || /[:?#\u0000-\u001f]/.test(p.file) || p.file.split("/").some((part) => !part || part === "." || part === "..")) {
      fail(`Asset ${p.id} needs a safe path relative to public/.`);
    }
    if (!Number.isFinite(p.width) || !Number.isFinite(p.height) || p.width <= 0 || p.height <= 0) fail(`Asset ${p.id} needs positive image dimensions.`);
    if (!["portrait", "landscape", "square"].includes(p.orientation)) fail(`Asset ${p.id} has an invalid orientation.`);
    photos.push(p);
    byId.set(p.id, p);
  }
  return {
    photos: photos as readonly PoolPhoto[],
    getPhoto(id: string): PoolPhoto {
      const photo = byId.get(id);
      if (!photo) throw new AssetError("VVV_ASSET_UNKNOWN", `Photo ${JSON.stringify(id)} is not declared in this project's assets.json.`);
      return photo;
    },
  };
}
