import { describe, it, expect } from "vitest";
import {
  PROJECT_STATUSES,
  PROJECT_PRIORITIES,
  TASK_STATUSES,
  TASK_PRIORITIES,
  WORKSPACE_ROLES,
  PROJECT_STATUS_LABEL,
  PRIORITY_LABEL,
  TASK_STATUS_LABEL,
  PROJECT_STATUS_BADGE,
  PRIORITY_BADGE,
  TASK_STATUS_BADGE,
} from "@/lib/constants";

describe("constants", () => {
  it("defines the expected project statuses", () => {
    expect(PROJECT_STATUSES).toEqual([
      "ACTIVE",
      "PLANNING",
      "COMPLETED",
      "ON_HOLD",
      "CANCELLED",
    ]);
  });

  it("defines the expected task statuses", () => {
    expect(TASK_STATUSES).toEqual(["TODO", "IN_PROGRESS", "REVIEW", "DONE"]);
  });

  it("defines the expected priorities", () => {
    expect(PROJECT_PRIORITIES).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
    expect(TASK_PRIORITIES).toEqual(["LOW", "MEDIUM", "HIGH", "CRITICAL"]);
  });

  it("defines the expected workspace roles", () => {
    expect(WORKSPACE_ROLES).toEqual(["OWNER", "ADMIN", "MEMBER"]);
  });

  it("has a label for every project status", () => {
    for (const s of PROJECT_STATUSES) {
      expect(PROJECT_STATUS_LABEL[s]).toBeTruthy();
      expect(PROJECT_STATUS_BADGE[s]).toBeTruthy();
    }
  });

  it("has a label + badge for every priority", () => {
    for (const p of PROJECT_PRIORITIES) {
      expect(PRIORITY_LABEL[p]).toBeTruthy();
      expect(PRIORITY_BADGE[p]).toBeTruthy();
    }
  });

  it("has a label + badge for every task status", () => {
    for (const s of TASK_STATUSES) {
      expect(TASK_STATUS_LABEL[s]).toBeTruthy();
      expect(TASK_STATUS_BADGE[s]).toBeTruthy();
    }
  });

  it("uses no indigo/blue in badge classes", () => {
    const allBadges = [
      ...Object.values(PROJECT_STATUS_BADGE),
      ...Object.values(PRIORITY_BADGE),
      ...Object.values(TASK_STATUS_BADGE),
    ];
    for (const cls of allBadges) {
      expect(cls).not.toMatch(/indigo|blue/);
    }
  });
});
