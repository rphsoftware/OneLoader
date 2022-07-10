// This sucks hoping we move to ES Modules soon!
// For now we shouldn't pollute the global with things defined as const
{
  const path = require('path');
  const base = path.dirname(process.mainModule.filename);
  const fs = require('fs');

  window._loadRollup = async function () {
    const data = fs.readFileSync(path.join(base, 'modloader/lib/rollup.browser.js'));

    let scriptBlob = new Blob([data.toString("utf-8")], { type: "application/javascript" });
    let url = URL.createObjectURL(scriptBlob);

    const { rollup } = await import(url);
    URL.revokeObjectURL(url);

    return rollup;
  }
}