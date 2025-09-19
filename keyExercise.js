// Minimal shim for backward compatibility
const questCheck = (function () {
  const controller = (window.CJL && window.CJL.controller) || null;
  return {
    check: function (string) {
      return controller ? controller.check(string) : false;
    },
    setMode: function (newIsRadicalMode, categoryKey) {
      if (controller) controller.setMode(!!newIsRadicalMode, categoryKey);
    },
    isRadical: function () {
      return controller ? controller.isRadical() : false;
    },
  };
})();
