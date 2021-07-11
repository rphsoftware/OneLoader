{
    const native_fs = require('fs');
    const util = require('util');
    const async_fs = { // old node polyfill bruh
        readdir: util.promisify(native_fs.readdir),
        readFile: util.promisify(native_fs.readFile),
        stat: util.promisify(native_fs.stat)
    };
    const path = require('path');
    const base = path.dirname(process.mainModule.filename);

    async function _vfs_resolve_file(relativePath) {
        $modLoader.$vfsTrace("[ResolveSyncStart] " + relativePath);
        relativePath = relativePath.toLowerCase();
        let dirTree = _overlay_fs_split_path(relativePath);
        let currentDir = $modLoader.overlayFS;
        let fileName = dirTree.pop();

        if (/\%[0-9A-Fa-f]{2,}/.test(fileName)) {
            try {
                window._logLine("Trying to decode URI component");
                fileName = decodeURIComponent(fileName);
                window._logLine("Decoded URI component for " + fileName);
            } catch(e) {}
        }

        let bail = false;
        let entry;
        while(dirTree.length > 0) {
            let nextDepth = dirTree.shift();
            if (currentDir[nextDepth] && currentDir[nextDepth].children) {
                currentDir = currentDir[nextDepth].children;
            } else {
                bail = true;
                break;
            }
        }

        if (!bail) {
            if (currentDir[fileName] && currentDir[fileName].type !== "dir") {
                entry = currentDir[fileName];
            } else {
                bail = true;
            }
        }

        if (bail) {
            $modLoader.$vfsTrace("[ResolveSyncBail] " + relativePath);
            if (/\%[0-9A-Fa-f]{2,}/.test(relativePath)) {
                let splitRelativePth = _overlay_fs_split_path(relativePath);
                let finrelp = [];
                try {
                    for (let a of splitRelativePth) {
                        finrelp.push(decodeURIComponent(a))
                    }

                    relativePath = path.join(...finrelp);
                } catch(e) {
                    window._logLine(e.stack);
                }
            }
            return await async_fs.readFile(path.join(base, relativePath));
        } else {
            $modLoader.$vfsTrace("[ResolveSyncVFS] " + relativePath);
            let data = await _read_file(entry.dataSource);
            if (entry.mode === "pass") return data;
            if (entry.mode === "rpgmaker") return _modloader_encryption.encryptAsset(data);
            if (entry.mode === "steam") return _modloader_encryption.encrypt(data);
            window._logLine("[VFS] Unable to read " + relativePath + " because the method used to encrypt/forward it is unknown.");
        }
    }

    function _vfs_resolve_file_sync(relativePath) {
        $modLoader.$vfsTrace("[ResolveSyncStart] " + relativePath);
        relativePath = relativePath.toLowerCase();
        let dirTree = _overlay_fs_split_path(relativePath);
        let currentDir = $modLoader.overlayFS;
        let fileName = dirTree.pop();

        if (/\%[0-9A-Fa-f]{2,}/.test(fileName)) {
            try {
                window._logLine("Trying to decode URI component");
                fileName = decodeURIComponent(fileName);
                window._logLine("Decoded URI component for " + fileName);
            } catch(e) {}
        }

        let bail = false;
        let entry;
        while(dirTree.length > 0) {
            let nextDepth = dirTree.shift();
            if (currentDir[nextDepth] && currentDir[nextDepth].children) {
                currentDir = currentDir[nextDepth].children;
            } else {
                bail = true;
                break;
            }
        }

        if (!bail) {
            if (currentDir[fileName] && currentDir[fileName].type !== "dir") {
                entry = currentDir[fileName];
            } else {
                bail = true;
            }
        }

        if (bail) {
            $modLoader.$vfsTrace("[ResolveSyncBail] " + relativePath);
            return native_fs.readFileSync(path.join(base, relativePath));
        } else {
            $modLoader.$vfsTrace("[ResolveSyncVFS] " + relativePath);
            let data = _read_file_sync(entry.dataSource);
            if (entry.mode === "pass") return data;
            if (entry.mode === "rpgmaker") return _modloader_encryption.encryptAsset(data);
            if (entry.mode === "steam") return _modloader_encryption.encrypt(data);
            window._logLine("[VFS] Unable to read " + relativePath + " because the method used to encrypt/forward it is unknown.");
        }
    }

    window._vfs_resolve_file = _vfs_resolve_file;
    window._vfs_resolve_file_sync = _vfs_resolve_file_sync;
}