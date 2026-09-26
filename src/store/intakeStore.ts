// 本地记录：localStorage 持久化，只管读写，不含业务判定

import { seedSnapshot, type IntakeSnapshot } from "../data/intakeData";

const STORAGE_KEY = "hxwl-10-intake-ledger-v1";

export function loadSnapshot(): IntakeSnapshot {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return seedSnapshot;
    const parsed = JSON.parse(raw) as IntakeSnapshot;
    if (!Array.isArray(parsed.intakes) || !Array.isArray(parsed.repairs) || !Array.isArray(parsed.storage)) {
      return seedSnapshot;
    }
    return parsed;
  } catch {
    return seedSnapshot;
  }
}

export function saveSnapshot(snapshot: IntakeSnapshot): void {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
}

export function resetSnapshot(): IntakeSnapshot {
  localStorage.removeItem(STORAGE_KEY);
  return seedSnapshot;
}

export function nextId(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export function today(): string {
  return new Date().toISOString().slice(0, 10);
}
