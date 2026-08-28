// Compatibility input: the published font shape intentionally omits the
// generated API's optional family/style metadata.
export type AssetUpload = {
  assetType: 'FONT';
  content: string;
  fileName: string;
};

export type UploadAssetsOptions = {
  timeout?: number;
};

export type UploadedAsset =
  import('@generaltranslation/api').UploadAssetsResponse['assets'][number];

export type UploadAssetsResponse =
  import('@generaltranslation/api').UploadAssetsResponse;
