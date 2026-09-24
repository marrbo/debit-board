import { Schema, model, models, type Model } from "mongoose";

export const AI_EMBEDDING_COLLECTION = "ai_embeddings";

export interface IAiEmbedding {
  source: string; // "wiki" | "observation" | "project" | ...
  parentId: string; // _id do documento original
  chunkIndex: number; // 0, 1, 2...
  title: string;
  content: string;
  embedding: number[];
  metadata?: Record<string, unknown>;
  updatedAt: Date;
}

const AiEmbeddingSchema = new Schema<IAiEmbedding>(
  {
    source: { type: String, required: true, index: true },
    parentId: { type: String, required: true, index: true },
    chunkIndex: { type: Number, required: true },
    title: { type: String, required: true },
    content: { type: String, required: true },
    embedding: { type: [Number], required: true },
    metadata: { type: Schema.Types.Mixed },
    updatedAt: { type: Date, default: Date.now },
  },
  { collection: AI_EMBEDDING_COLLECTION },
);

AiEmbeddingSchema.index(
  { source: 1, parentId: 1, chunkIndex: 1 },
  { unique: true },
);

const AiEmbedding: Model<IAiEmbedding> =
  (models.AiEmbedding as Model<IAiEmbedding>) ||
  model<IAiEmbedding>("AiEmbedding", AiEmbeddingSchema);

export default AiEmbedding;
