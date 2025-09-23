export { BaseDocumentMerger } from './BaseDocumentMerger';
export { BaseDocumentSerializer } from './serialize';
export { BaseDocumentDeserializer } from './deserialize/BaseDocumentDeserializer';
export {
  defaultStopTypes,
  customSerializers,
  customBlockDeserializers,
} from './BaseSerializationConfig';

export type {
  SerializedDocument,
  Serializer,
  SerializerClosure,
  Deserializer,
  Merger,
} from './types';
