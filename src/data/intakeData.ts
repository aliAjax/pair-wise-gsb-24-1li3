// 验收资料：移交单底账与初始业务数据，只放数据，不写判断逻辑

export interface TransferManifest {
  manifestNo: string; // 移交单号
  batchNo: string; // 送检批号
  trench: string; // 探方
  layer: string; // 地层
  coordinates: string; // 坐标
  expectedCount: number; // 移交件数
}

export type IntakeStatus = "待核" | "待入库" | "修复中" | "已入库";

export interface IntakeRecord {
  id: string;
  batchNo: string; // 送检批号
  trench: string; // 探方
  layer: string; // 地层
  coordinates: string; // 坐标
  count: number; // 实收件数
  condition: string; // 保存状况
  receiver: string; // 接收人
  receivedAt: string; // 接收日期
  status: IntakeStatus;
  mismatchReasons: string[]; // 与移交单对不上的原因
}

export interface RepairOrder {
  id: string;
  intakeId: string;
  batchNo: string;
  missingPart: string; // 缺失部位
  handler: string; // 处理人
  note: string;
  status: "修复中" | "复验通过";
  createdAt: string;
}

export interface StorageVersion {
  version: number;
  count: number; // 入库件数
  location: string; // 库位
  reason: string; // 初始入库或更正原因
  changedBy: string;
  changedAt: string;
}

export interface StorageEntry {
  intakeId: string;
  batchNo: string;
  current: StorageVersion;
  history: StorageVersion[]; // 旧版本继续可查
}

export interface IntakeSnapshot {
  intakes: IntakeRecord[];
  repairs: RepairOrder[];
  storage: StorageEntry[];
}

// 工地移交单底账：接收登记时逐批核对
export const transferManifests: TransferManifest[] = [
  { manifestNo: "YJ-2026-041", batchNo: "PJ-041", trench: "T0203", layer: "第3层", coordinates: "E3N4", expectedCount: 12 },
  { manifestNo: "YJ-2026-042", batchNo: "PJ-042", trench: "T0204", layer: "H12灰坑", coordinates: "E5N2", expectedCount: 7 },
  { manifestNo: "YJ-2026-043", batchNo: "PJ-043", trench: "T0301", layer: "F2房址", coordinates: "E1N6", expectedCount: 5 },
  { manifestNo: "YJ-2026-044", batchNo: "PJ-044", trench: "T0203", layer: "第4层", coordinates: "E4N4", expectedCount: 9 },
];

export const conditionOptions = ["完整", "基本完整", "残损可拼对", "破碎待修复"];

export const seedSnapshot: IntakeSnapshot = {
  intakes: [
    {
      id: "js-001",
      batchNo: "PJ-041",
      trench: "T0203",
      layer: "第3层",
      coordinates: "E3N4",
      count: 12,
      condition: "残损可拼对",
      receiver: "王凯",
      receivedAt: "2026-09-24",
      status: "待入库",
      mismatchReasons: [],
    },
    {
      id: "js-002",
      batchNo: "PJ-042",
      trench: "T0204",
      layer: "H12灰坑",
      coordinates: "E5N3",
      count: 7,
      condition: "基本完整",
      receiver: "李岚",
      receivedAt: "2026-09-24",
      status: "待核",
      mismatchReasons: ["坐标与移交单不符：登记 E5N3，移交单 E5N2"],
    },
    {
      id: "js-003",
      batchNo: "PJ-099",
      trench: "T0301",
      layer: "F2房址",
      coordinates: "E1N6",
      count: 4,
      condition: "破碎待修复",
      receiver: "李岚",
      receivedAt: "2026-09-25",
      status: "待核",
      mismatchReasons: ["批号 PJ-099 不在移交单底账中"],
    },
  ],
  repairs: [
    {
      id: "xf-001",
      intakeId: "js-004",
      batchNo: "PJ-043",
      missingPart: "陶罐口沿缺失约三分之一",
      handler: "赵修复",
      note: "先拼对，缺口暂不补配",
      status: "修复中",
      createdAt: "2026-09-25",
    },
  ],
  storage: [
    {
      intakeId: "js-000",
      batchNo: "PJ-040",
      current: {
        version: 2,
        count: 8,
        location: "A架-02-03",
        reason: "复点发现两件为同一器残片，件数由9更正为8",
        changedBy: "王凯",
        changedAt: "2026-09-23",
      },
      history: [
        {
          version: 1,
          count: 9,
          location: "A架-02-03",
          reason: "初始入库",
          changedBy: "李岚",
          changedAt: "2026-09-22",
        },
      ],
    },
  ],
};
