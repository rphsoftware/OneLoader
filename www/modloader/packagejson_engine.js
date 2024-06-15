{
    const zlib = require('zlib');
    const native_fs = require('fs');
    const util = require('util');
    const async_fs = { // old node polyfill bruh
        readdir: util.promisify(native_fs.readdir),
        readFile: util.promisify(native_fs.readFile),
        writeFile: util.promisify(native_fs.writeFile),
        stat: util.promisify(native_fs.stat)
    };
    const path = require('path');
    const base = path.dirname(process.mainModule.filename);
    const crypto = require('crypto');

    let packageJsonLocation = path.join(base, "package.json");
    let backupLocation = path.join(base, ".oneloader.package.json.backup");
    if (location.pathname.startsWith("/www/")) { // we are in retail mode
        packageJsonLocation = path.resolve(path.join(base, "..", "package.json"));
        backupLocation = path.resolve(path.join(base, "..", ".oneloader.package.json.backup"));
    }

    function ensureBackups() {
        if (!native_fs.existsSync(backupLocation)) {
            window._logLine("Backing up package.json");
            native_fs.writeFileSync(backupLocation, native_fs.readFileSync(packageJsonLocation));
        }
    }

    function objectCompare(o1, o2) {
        let h1 = crypto.createHash('sha256').update(JSON.stringify(typeof o1 === "string" ? JSON.parse(o1) : o1)).digest('hex');
        let h2 = crypto.createHash('sha256').update(JSON.stringify(typeof o2 === "string" ? JSON.parse(o2) : o2)).digest('hex');
        return h1 === h2;
    }

    function apply(patchset) {
        let baseDocument = JSON.parse(native_fs.readFileSync(backupLocation), "utf-8");
        let onDiskDocument = JSON.parse(native_fs.readFileSync(packageJsonLocation), "utf-8");

        let morphedDocument = jsonpatch.applyPatch(baseDocument, patchset, true).newDocument;

        if (!objectCompare(onDiskDocument, morphedDocument)) {
            console.log("Writing new file");
            native_fs.writeFileSync(packageJsonLocation, JSON.stringify(morphedDocument, null, 2));

            // Editing the package.json file can change the Chromium launch arguments.
            // nwjs doesn't support restarting the Chromium instance without full process restart and
            // NodeJS doesn't support something like execve(), hence there is no
            // way for us to replace the Chromium instance in-process.
            // (chromium.runtime.reload() is closer to reloading a tab than restarting the whole browser)
            // Spawning and detaching a child process will cause Steam to stop tracking play time.
            // Just tell the user to restart the game to avoid surprises why the changes don't apply.
            alert("Please restart the game.");
            nw.App.quit();
        }
    }

    window.$oneLoaderPackageJsonPatchingSubsystem = {
        ensureBackups, apply
    }
}