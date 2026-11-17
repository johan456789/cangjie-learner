import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { findSimilarFormsComparison } from "../src/js/state/similarForms.js";

const image = (file) => ({ type: "image", file });

const groups = [
  {
    forms: [
      { shape: image("cjrm-j2.svg"), code: "j", shuo_ming: "頂上有直點" },
      { shape: image("cjrm-b11.svg"), code: "b", shuo_ming: "頂上無點" },
      { shape: image("cjrm-n4.svg"), code: "n", shuo_ming: "首筆爲撇" },
    ],
  },
  {
    forms: [
      { shape: image("cjrm-u2.svg"), code: "u", shuo_ming: "上鉤" },
      { shape: image("cjrm-v7.svg"), code: "v", shuo_ming: "必須作鉤" },
      { shape: image("cjrm-v6.svg"), code: "v", shuo_ming: "無上鉤" },
    ],
  },
  {
    forms: [
      { shape: image("cjrm-n4.svg"), code: "n", shuo_ming: "上方或左上方" },
      { shape: image("Cjwm-hs.svg"), code: "hs", shuo_ming: "竹尸組合" },
      { shape: { type: "text", text: "巳" }, code: "ru", shuo_ming: "口山組合" },
    ],
  },
];

describe("findSimilarFormsComparison", () => {
  it("returns the target and the form whose key was pressed", () => {
    const comparison = findSimilarFormsComparison(groups, "cjrm-j2.svg", "b");
    expect(comparison.target.shape.file).toBe("cjrm-j2.svg");
    expect(comparison.confusedForms.map((form) => form.shape.file)).toEqual([
      "cjrm-b11.svg",
    ]);
  });

  it("returns every counterpart that shares the pressed key", () => {
    const comparison = findSimilarFormsComparison(groups, "cjrm-u2.svg", "v");
    expect(comparison.confusedForms.map((form) => form.shape.file)).toEqual([
      "cjrm-v7.svg",
      "cjrm-v6.svg",
    ]);
  });

  it("returns null when the pressed key is not a counterpart", () => {
    expect(findSimilarFormsComparison(groups, "cjrm-j2.svg", "y")).toBeNull();
  });

  it("returns null when the target is in no group", () => {
    expect(findSimilarFormsComparison(groups, "cjrm-a3.svg", "b")).toBeNull();
  });

  it("searches every group the target appears in", () => {
    const comparison = findSimilarFormsComparison(groups, "cjrm-n4.svg", "s");
    expect(comparison.target.shuo_ming).toBe("上方或左上方");
    expect(comparison.confusedForms[0].code).toBe("hs");
  });

  it("matches any key of a combination and text shapes", () => {
    const comparison = findSimilarFormsComparison(groups, "cjrm-n4.svg", "u");
    expect(comparison.confusedForms[0].shape.text).toBe("巳");
  });

  it("matches the target file case-insensitively", () => {
    expect(findSimilarFormsComparison(groups, "CJRM-J2.svg", "n")).not.toBeNull();
  });

  it("tolerates missing data", () => {
    expect(findSimilarFormsComparison(null, "cjrm-j2.svg", "b")).toBeNull();
    expect(findSimilarFormsComparison(groups, undefined, "b")).toBeNull();
    expect(findSimilarFormsComparison(groups, "cjrm-j2.svg", "")).toBeNull();
  });
});

describe("experiment/similar_forms.json", () => {
  const exported = JSON.parse(
    readFileSync(new URL("../experiment/similar_forms.json", import.meta.url))
  );

  it("has a shape, a lowercase code and a clean note for every form", () => {
    expect(exported.length).toBeGreaterThan(0);
    for (const group of exported) {
      expect(group.forms.length).toBeGreaterThanOrEqual(2);
      for (const form of group.forms) {
        expect(form.shape.file || form.shape.text).toBeTruthy();
        expect(form.code).toMatch(/^[a-y]+$/);
        expect(form.shuo_ming).toBeTruthy();
        expect(form.shuo_ming).not.toMatch(/\{\{|-\{|<ref/);
      }
    }
  });

  it("explains 十 vs 月 for the dotted cover shape", () => {
    const comparison = findSimilarFormsComparison(exported, "cjrm-j2.svg", "b");
    expect(comparison.target.shuo_ming).toContain("頂上有直點");
    expect(comparison.confusedForms[0].shuo_ming).toContain("頂上無點");
  });
});
