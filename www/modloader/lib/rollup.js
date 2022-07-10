// This sucks hoping we move to ES Modules soon!
const fs = require('fs');

window._loadRollup = async function () {
  const data = fs.readFileSync('./modloader/lib/rollup.browser.js');

  let scriptBlob = new Blob([data.toString("utf-8")], { type: "application/javascript" });
  let url = URL.createObjectURL(scriptBlob);

  const { rollup } = await import(url);
  URL.revokeObjectURL(url);

  return rollup;
}
