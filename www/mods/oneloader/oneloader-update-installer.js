let GH_AUTH = "";
const fs = require('fs');
const StreamZip = require('./modloader/lib/node_stream_zip.js');
if ($modLoader.isInTestMode) return;

if ($modLoader.config && $modLoader.config._autoUpdater && $modLoader.config._autoUpdater.check === "allow" && $modLoader.config._autoUpdater.performUpdate && $modLoader.config._autoUpdater.updateBundleURL) {
    try {
        let headers = {};
        if (GH_AUTH.length > 0) {
            headers["Authorization"] = GH_AUTH;
        }
        window._logLine("Downloading update");
        let bundle = await fetch($modLoader.config._autoUpdater.updateBundleURL, { headers }).then(res => res.arrayBuffer());
        fs.writeFileSync("_oneloader_update.zip", Buffer.from(bundle));
        let zip = new StreamZip.async({ file: "_oneloader_update.zip" });
        let entries = await zip.entries();
        for (let el in entries) {
            try { if (entries[el].isDirectory) { fs.mkdirSync(el); } } catch (e) { }
            if (entries[el].isDirectory) continue;
            fs.writeFileSync(el, await zip.entryData(el));
        }
        $modLoader.config._autoUpdater.performUpdate = false;
        $modLoader.config._autoUpdater.updateBundleURL = undefined;
        $modLoader.config._autoUpdater.lastCheck = Date.now();
        $modLoader.syncConfig();

        fs.unlinkSync("_oneloader_update.zip");
        await zip.close();

        setTimeout(function () {
            $modLoader.syncConfig();
        }, 500);
        setTimeout(function () {
            window.location.reload();
        }, 1000);
    } catch (E) {
        console.log(E);
        window._logLine("Failed to fetch or install update");
    }
}