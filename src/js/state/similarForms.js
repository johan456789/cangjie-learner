// Pure lookup for 相近字形辨析: groups of easily confused shapes

/**
 * findSimilarFormsComparison
 * Find the group of similar shapes that explains why `typedKey` was pressed
 * for the auxiliary form `targetFile`.
 *
 * @param {Array<{forms: Array<{shape: {type: string, file?: string, text?: string}, code: string, shuo_ming: string}>}>} groups
 * @param {string} targetFile auxiliary form file of the current quest, e.g. "cjrm-j2.svg"
 * @param {string} typedKey the (wrong) key the user pressed, e.g. "b"
 * @returns {{target: Object, confusedForms: Object[]}|null} null when the typed key is not a known counterpart
 */
export function findSimilarFormsComparison(groups, targetFile, typedKey) {
  if (!Array.isArray(groups) || !targetFile || !typedKey) return null;
  const targetFileKey = String(targetFile).toLowerCase();
  for (const group of groups) {
    const forms = group?.forms ?? [];
    const target = forms.find(
      (form) => form.shape?.file?.toLowerCase() === targetFileKey
    );
    if (!target) continue;
    const confusedForms = forms.filter(
      (form) => form !== target && String(form.code ?? "").includes(typedKey)
    );
    if (confusedForms.length > 0) return { target, confusedForms };
  }
  return null;
}
