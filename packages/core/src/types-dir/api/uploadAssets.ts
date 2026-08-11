// Project assets (e.g., fonts) uploaded once and reused across translation jobs.
// Distinct from per-file source uploads (uploadFiles.ts): assets are persistent
// and locale-invariant, so they go to /v2/project/assets rather than the file
// upload endpoints.

export type AssetUpload = {
  assetType: 'FONT';
  // Base64-encoded asset bytes (fonts are binary, so the caller base64-encodes
  // them; the SDK sends this through as-is).
  content: string;
  fileName: string;
};

export type UploadAssetsOptions = {
  timeout?: number;
};

export type UploadedAsset = {
  id: string;
  assetKey: string;
  fileName: string;
  // True when this exact asset was already stored, so it wasn't uploaded again.
  deduped: boolean;
};

export type UploadAssetsResponse = {
  assets: UploadedAsset[];
  count: number;
};
