// 判定：核对、流转、入库与更正的纯函数规则，不碰存储和页面

import type {
  IntakeRecord,
  IntakeSnapshot,
  RepairOrder,
  StorageEntry,
  StorageVersion,
  TransferManifest,
} from "../data/intakeData";

export interface IntakeDraft {
  batchNo: string;
  trench: string;
  layer: string;
  coordinates: string;
  count: number;
  condition: string;
  receiver: string;
  receivedAt: string;
}

// 接收登记：与移交单底账逐批核对，批号或坐标对不上即留待核区
export function registerIntake(
  draft: IntakeDraft,
  manifests: TransferManifest[],
  existing: IntakeRecord[],
  id: string
): IntakeRecord {
  const reasons: string[] = [];
  const manifest = manifests.find((m) => m.batchNo === draft.batchNo.trim());

  if (!manifest) {
    reasons.push(`批号 ${draft.batchNo} 不在移交单底账中`);
  } else {
    if (draft.coordinates.trim() !== manifest.coordinates) {
      reasons.push(`坐标与移交单不符：登记 ${draft.coordinates}，移交单 ${manifest.coordinates}`);
    }
    if (draft.trench.trim() !== manifest.trench) {
      reasons.push(`探方与移交单不符：登记 ${draft.trench}，移交单 ${manifest.trench}`);
    }
    if (draft.layer.trim() !== manifest.layer) {
      reasons.push(`地层与移交单不符：登记 ${draft.layer}，移交单 ${manifest.layer}`);
    }
    if (draft.count !== manifest.expectedCount) {
      reasons.push(`件数与移交单不符：实收 ${draft.count}，移交 ${manifest.expectedCount}`);
    }
  }

  if (existing.some((r) => r.batchNo === draft.batchNo.trim())) {
    reasons.push(`批号 ${draft.batchNo} 已登记过，疑似重复接收`);
  }

  return {
    id,
    batchNo: draft.batchNo.trim(),
    trench: draft.trench.trim(),
    layer: draft.layer.trim(),
    coordinates: draft.coordinates.trim(),
    count: draft.count,
    condition: draft.condition,
    receiver: draft.receiver.trim(),
    receivedAt: draft.receivedAt,
    status: reasons.length > 0 ? "待核" : "待入库",
    mismatchReasons: reasons,
  };
}

// 待核区复核：核对移交单后人工放行
export function reconcileIntake(record: IntakeRecord, note: string): IntakeRecord {
  return {
    ...record,
    status: "待入库",
    mismatchReasons: note.trim() ? [...record.mismatchReasons, `复核说明：${note.trim()}`] : record.mismatchReasons,
  };
}

// 缺件转修复单：写明缺失部位和处理人，批次转入修复中
export function createRepairOrder(
  record: IntakeRecord,
  missingPart: string,
  handler: string,
  note: string,
  id: string,
  today: string
): { record: IntakeRecord; order: RepairOrder } {
  return {
    record: { ...record, status: "修复中" },
    order: {
      id,
      intakeId: record.id,
      batchNo: record.batchNo,
      missingPart: missingPart.trim(),
      handler: handler.trim(),
      note: note.trim(),
      status: "修复中",
      createdAt: today,
    },
  };
}

// 复验通过：修复单销号，批次回到待入库
export function passReinspection(
  order: RepairOrder,
  record: IntakeRecord
): { order: RepairOrder; record: IntakeRecord } {
  return {
    order: { ...order, status: "复验通过" },
    record: { ...record, status: "待入库" },
  };
}

// 入库闸口：待核、修复中（复验前）一律不能进正式库位
export function canStore(record: IntakeRecord, repairs: RepairOrder[]): string | null {
  if (record.status === "待核") return "批号或坐标与移交单未核清，留在待核区";
  if (record.status === "修复中") return "修复单未复验，不能进正式库位";
  if (record.status === "已入库") return "该批已入库";
  const open = repairs.some((r) => r.intakeId === record.id && r.status === "修复中");
  if (open) return "存在未复验的修复单，不能进正式库位";
  return null;
}

// 确认入库：件数与库位定版，记为第 1 版
export function storeIntake(
  record: IntakeRecord,
  location: string,
  operator: string,
  today: string
): { record: IntakeRecord; entry: StorageEntry } {
  const first: StorageVersion = {
    version: 1,
    count: record.count,
    location: location.trim(),
    reason: "初始入库",
    changedBy: operator.trim(),
    changedAt: today,
  };
  return {
    record: { ...record, status: "已入库" },
    entry: { intakeId: record.id, batchNo: record.batchNo, current: first, history: [] },
  };
}

// 更正：另建原因版本，旧值压入历史继续可查
export function correctStorage(
  entry: StorageEntry,
  count: number,
  location: string,
  reason: string,
  operator: string,
  today: string
): StorageEntry {
  const next: StorageVersion = {
    version: entry.current.version + 1,
    count,
    location: location.trim(),
    reason: reason.trim(),
    changedBy: operator.trim(),
    changedAt: today,
  };
  return { ...entry, current: next, history: [entry.current, ...entry.history] };
}

// 看板指标
export function summarize(snapshot: IntakeSnapshot) {
  const pending = snapshot.intakes.filter((r) => r.status === "待核").length;
  const repairing = snapshot.repairs.filter((r) => r.status === "修复中").length;
  const storedBatches = snapshot.storage.length;
  const storedPieces = snapshot.storage.reduce((sum, e) => sum + e.current.count, 0);
  return { pending, repairing, storedBatches, storedPieces };
}
