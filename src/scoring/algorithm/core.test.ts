import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { computePumpScore } from "./core.js";
import { DEFAULT_WEIGHTS } from "./config.js";
import type { PumpFeatureVector } from "./types.js";

describe("computePumpScore", () => {
  it("clamps score to 0–100", () => {
    const f: PumpFeatureVector = {
      action: "create",
      log10UsdPlus1: 12,
      usd: 1_000_000,
      mcapSol: 500,
      vSolInBondingCurve: 40,
      nameLen: 10,
      symbolLen: 4,
      initialBuyTokens: 1e9,
    };
    const r = computePumpScore(f, DEFAULT_WEIGHTS, {});
    assert.ok(r.score >= 0 && r.score <= 100);
  });

  it("scores create higher than sell for same notional", () => {
    const base: Omit<PumpFeatureVector, "action"> = {
      log10UsdPlus1: 3,
      usd: 100,
      mcapSol: null,
      vSolInBondingCurve: null,
      nameLen: 0,
      symbolLen: 0,
      initialBuyTokens: null,
    };
    const sell = computePumpScore(
      { ...base, action: "sell" },
      DEFAULT_WEIGHTS,
      {},
    );
    const create = computePumpScore(
      { ...base, action: "create" },
      DEFAULT_WEIGHTS,
      {},
    );
    assert.ok(create.score > sell.score);
  });
});
