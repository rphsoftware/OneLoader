{
    const fs = require('fs');
    const util = require('util');
    const asyncRF = util.promisify(fs.readFile);
    const zlib = require('zlib');
    const path = require('path');

    const unlinux_cache = new Map();

    window.__fs_unlinuxFile = (f) => {
        if (process.platform !== "linux") return f;

        let base = path.dirname(f).toLowerCase();
        let fname = path.basename(f).toLowerCase();

        if (base.split("/").length > 2) {
            base = __fs_unlinuxFile(base);
        }

        const list = (unlinux_cache.has(base) ? unlinux_cache.get(base) : (() => {
            const l = fs.readdirSync(base);
            unlinux_cache.set(base, l);
            return l;
        })());

        const index = list.map(a => a.toLowerCase()).indexOf(fname);
        const resolved = list[index];

        return `${base}/${resolved}`;
    }

    function _overlay_fs_split_path(path) {
        let pathComponentRe = /[\/\\]*([^\\\/]+)[\/\\]*/g;
        let pathComponents = [];

        while(1) {
            let val = pathComponentRe.exec(path);
            if (val) {
                pathComponents.push(val[1]);
            } else {
                break;
            }
        }

        return pathComponents;
    }
    window._overlay_fs_split_path = _overlay_fs_split_path;

    function _ensure_overlay_path(overlay, path) {
        let components = _overlay_fs_split_path(path);
        components.pop();
        for (let component of components) {
            if (!overlay[component]) {
                overlay[component] = {
                    type: "dir",
                    ogName: component,
                    children: {}
                };
            }
            if (!overlay[component].children) {
                window._logLine("[BUG!] Children didn't exist for " + path + ", creating.");
                overlay[component].children = {};
            }
            overlay = overlay[component].children;
        }

        return overlay;
    }
    window._ensure_overlay_path = _ensure_overlay_path;

    async function _read_file(dataSource) {
        $modLoader.$vfsTrace("[READFILE] " + dataSource.type);
        if (dataSource.type === "filesystem") {
            return await asyncRF(__fs_unlinuxFile(dataSource.path));
        }
        if (dataSource.type === "zip") {
            return await dataSource.sz.entryData(dataSource.entry);
        }
        if (dataSource.type === "zlib") {
            if (dataSource.buffer) {
                return zlib.inflateSync(dataSource.buffer)
            } else {
                return zlib.inflateSync(dataSource.stream)
            }
        }
    }

    function _read_file_sync(dataSource) {
        $modLoader.$vfsTrace("[READFILE] " + dataSource.type);
        if (dataSource.type === "filesystem") {
            return fs.readFileSync(__fs_unlinuxFile(dataSource.path));
        }
        if (dataSource.type === "zip") {
            return dataSource.sz.resolvedStreamZip.entryDataSync(dataSource.entry);
        }
        if (dataSource.type === "zlib") {
            if (dataSource.buffer) {
                return zlib.inflateSync(dataSource.buffer)
            } else {
                return zlib.inflateSync(dataSource.stream)
            }
        }
    }

    window._read_file = _read_file;
    window._read_file_Sync = _read_file_sync;
}