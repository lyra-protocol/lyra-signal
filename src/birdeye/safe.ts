import { BirdeyeHttpError } from "./client.js";

export async function safeBirdeye<T>(task: () => Promise<T>): Promise<T | null> {
  try {
    return await task();
  } catch (error) {
    if (error instanceof BirdeyeHttpError) {
      const level = error.status === 429 || error.status === 403 || error.status === 401 ? "warn" : "error";
      console[level](`[birdeye] ${error.path} ${error.status}: ${error.message}`);
      return null;
    }
    console.error("[birdeye] request failed", error);
    return null;
  }
}
