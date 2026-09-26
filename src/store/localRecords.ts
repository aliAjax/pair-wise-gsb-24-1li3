// 本地记录：台帐在 localStorage 的读写，损坏时回退到种子数据

import { seedState } from "../data/acceptance";
import type { WorkbenchState } from "../types";

const STORAGE_KEY = "hxwl10-intake-workbench-v1";

export function loadState(): WorkbenchState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return structuredClone(seedState);
    const parsed = JSON.parse(raw) as WorkbenchState;
    if (!Array.isArray(parsed.intakes) || !Array.isArray(parsed.repairs) || !Array.isArray(parsed.accessions)) {
      return structuredClone(seedState);
    }
    return parsed;
  } catch {
    return structuredClone(seedState);
  }
}

export function saveState(state: WorkbenchState): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function resetState(): WorkbenchState {
  const fresh = structuredClone(seedState);
  saveState(fresh);
  return fresh;
}
