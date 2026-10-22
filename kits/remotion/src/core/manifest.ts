import { staticFile } from "remotion";
import raw from "../../assets.json";
import { createAssetRegistry, type PoolPhoto } from "./asset-registry";

export type { PoolPhoto, Person, Stage, ShotKind, Orientation, TextSpace, Variant } from "./asset-registry";

const registry = createAssetRegistry(raw);
export const PHOTOS = registry.photos;
export const PHOTO_IDS = PHOTOS.map((p) => p.id);
export const getPhoto = registry.getPhoto;

/** Resolve only assets declared by this project, directly below public/. */
export const photoSrc = (p: PoolPhoto | string): string => staticFile(getPhoto(typeof p === "string" ? p : p.id).file);
