import mongoose from "mongoose";

export function normalizeProjectIds(ids: any[]): mongoose.Types.ObjectId[] {
  const flat = Array.isArray(ids) ? ids.flat() : [];
  return flat
    .map((id) => {
      if (typeof id === "string" && mongoose.Types.ObjectId.isValid(id)) {
        return new mongoose.Types.ObjectId(id);
      }
      if (id instanceof mongoose.Types.ObjectId) return id;
      return null;
    })
    .filter((id): id is mongoose.Types.ObjectId => id !== null);
}
