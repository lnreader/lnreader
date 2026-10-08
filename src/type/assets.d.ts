// Android vector drawables bundled by Metro resolve to numeric asset ids.
declare module '*.xml' {
  const assetId: number;
  export default assetId;
}

declare module '*.png' {
  const assetId: number;
  export default assetId;
}
