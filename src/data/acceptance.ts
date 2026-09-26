// 验收资料：移交单、可选项与初始台帐，只放数据不放判定

import type { Condition, TransferSlip, WorkbenchState } from "../types";

export const project = {
  id: "hxwl-10",
  port: 5110,
  title: "考古整理入库台",
  subtitle: "送检批接收登记、待核、修复复验与入库版本管理",
  domain: "考古发掘",
};

/** 移交单底账：接收登记时逐字段比对 */
export const transferSlips: TransferSlip[] = [
  { batchNo: "YP-2026-014", trench: "T0203", layer: "第3层", coordinates: "E3N4", count: 12, deliverer: "发掘一队" },
  { batchNo: "YP-2026-015", trench: "T0204", layer: "H12灰坑", coordinates: "E5N2", count: 7, deliverer: "发掘一队" },
  { batchNo: "YP-2026-016", trench: "T0301", layer: "F2房址", coordinates: "E8N6", count: 5, deliverer: "发掘二队" },
];

export const conditions: Condition[] = ["完好", "残损", "缺件", "待清理"];

export const receivers = ["资料整理员·王岚", "资料整理员·陈树"];

export const repairHandlers = ["修复室·赵启", "修复室·李暮"];

export const storageLocations = ["库房A-01架", "库房A-02架", "库房B-陶片柜3", "库房B-骨器柜1"];

/** 初始台帐：演示一条待核、一条修复中、一条已入库（含更正历史） */
export const seedState: WorkbenchState = {
  intakes: [
    {
      id: "RK-0001",
      batchNo: "YP-2026-014",
      trench: "T0203",
      layer: "第3层",
      coordinates: "E3N4",
      count: 12,
      condition: "完好",
      receiver: "资料整理员·王岚",
      receivedAt: "2026-09-20 09:40",
      holdReasons: [],
    },
    {
      id: "RK-0002",
      batchNo: "YP-2026-015",
      trench: "T0204",
      layer: "H12灰坑",
      coordinates: "E5N2",
      count: 7,
      condition: "缺件",
      receiver: "资料整理员·陈树",
      receivedAt: "2026-09-21 14:05",
      holdReasons: [],
    },
    {
      id: "RK-0003",
      batchNo: "YP-2026-017",
      trench: "T0302",
      layer: "第2层",
      coordinates: "E4N7",
      count: 9,
      condition: "残损",
      receiver: "资料整理员·王岚",
      receivedAt: "2026-09-24 10:22",
      holdReasons: ["批号 YP-2026-017 不在移交单底账中"],
    },
  ],
  repairs: [
    {
      id: "XF-0001",
      intakeId: "RK-0002",
      missingPart: "陶罐口沿缺失约1/4，腹部裂隙两道",
      handler: "修复室·赵启",
      createdAt: "2026-09-21 15:10",
      state: "repairing",
      note: "先拼对粘接，补配部分做旧前需拍照",
    },
  ],
  accessions: [
    {
      intakeId: "RK-0001",
      versions: [
        {
          version: 1,
          count: 11,
          location: "库房B-陶片柜3",
          reason: "首次入库",
          operator: "资料整理员·王岚",
          at: "2026-09-22 11:00",
        },
        {
          version: 2,
          count: 12,
          location: "库房B-陶片柜3",
          reason: "更正：清点时一片夹砂陶压在衬纸下，补记1件",
          operator: "资料整理员·陈树",
          at: "2026-09-23 16:35",
        },
      ],
    },
  ],
};
