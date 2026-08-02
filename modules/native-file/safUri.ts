const decodeUriComponent = (value: string) => {
  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
};

/** Converts react-native-saf-x's virtual tree path into an Android document URI. */
export const toSafDocumentUri = (uri: string) => {
  const treeMarker = '/tree/';
  const treeIndex = uri.indexOf(treeMarker);
  if (treeIndex === -1 || uri.includes('/document/')) return uri;

  const prefix = uri.slice(0, treeIndex);
  const virtualPath = uri.slice(treeIndex + treeMarker.length);
  const [treeIdSegment, ...relativeSegments] = virtualPath.split('/');
  if (!treeIdSegment) return uri;

  const treeId = decodeUriComponent(treeIdSegment);
  const relativePath = relativeSegments
    .filter(Boolean)
    .map(decodeUriComponent)
    .join('/');
  const documentId = relativePath ? `${treeId}/${relativePath}` : treeId;

  return `${prefix}${treeMarker}${encodeURIComponent(
    treeId,
  )}/document/${encodeURIComponent(documentId)}`;
};
