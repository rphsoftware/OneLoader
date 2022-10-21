async function _modLoader_install_node_vfs(shadowfs, nativefs) {
    const old_require = window.require;
    const path = old_require("path");
    const base = path.dirname(process.mainModule.filename).toLowerCase().replace(/[\\\/]/g, "/");

    class BogusStats {
        constructor(directory, size) {
            this.dir = directory;
            this.size = size || 69;
        }

        isDirectory() {
            return this.dir;
        }

        isFile() {
            return !this.dir;
        }
    }


    let hide_from_root_ls = [
        "modloader",
        "mods"
    ];

    function absolutify_path(p) {
        p = path.normalize(p);
        p = p.replace(/[\\\/]/g, "/");
        if (path.isAbsolute(p)) return p;
        else {
            return path.join(process.cwd(), p).replace(/[\\\/]/g, "/");
        }
    }

    function determine_location(p) {
        let abs_path = absolutify_path(p).toLowerCase();
        if (abs_path.startsWith(base + "/")) {
            let relPath = abs_path.replace(base, "");
            let components = _overlay_fs_split_path(relPath);
            if (components[0] === "save") return [0];
            else {
                return [1, components];
            }
        }

        return [0];
    }

    function exec_vfs_readdir(components) {
        let current = $modLoader.overlayFS;
        let files = new Set();
        let _lowercase_name_lock = new Set();

        try {
            for (let c of components) {
                current = current[c].children;
            }
            for (let file in current) {
                files.add(current[file].ogName);
                _lowercase_name_lock.add(file);
            }
        } catch(e) {}

        let _native_fs_location = path.join(base, ...components);
        let _native_fs_files = [];
        try {
            _native_fs_files = nativefs.readdirSync(_native_fs_location);
        } catch(e) {
            window._logLine("vfs_node.js: Failed to nativefs.readdirSync: " + _native_fs_location + ", because it doesn't exist!");
        }
        for (let file of _native_fs_files) {
            if (_lowercase_name_lock.has(file.toLowerCase())) continue;

            files.add(file);
        }

        files = Array.from(files);
        if (components.length === 0) {
            files = files.filter(a => !hide_from_root_ls.includes(a));
        }

        return files;
    }

    function exec_vfs_stat(components) {
        let file = components.pop();
        try {
            let current = $modLoader.overlayFS;
            for (let c of components) {
                current = current[c].children;
            }

            if (current[file].type === "dir") {
                return new BogusStats(true, 0);
            }
            if (current[file].dataSource) {
                return new BogusStats(false, 0);
            }

            throw new Error("What even the fuck happened");
        } catch(e) {
            let _native_fs_location = path.join(path.join(base, ...components), file);
            return nativefs.statSync(_native_fs_location);
        }
    }

    async function _exec_vfs_stat_async(components) {
        let file = components.pop();
        let nfsstat = require('util').promisify(nativefs.stat);
        try {
            let current = $modLoader.overlayFS;
            for (let c of components) {
                current = current[c].children;
            }

            if (current[file].type === "dir") {
                return new BogusStats(true, 0);
            }
            if (current[file].dataSource) {
                return new BogusStats(false, 0);
            }

            throw new Error("What even the fuck happened");
        } catch(e) {
            let _native_fs_location = path.join(path.join(base, ...components), file);
            return await nfsstat(_native_fs_location);
        }
    }
    window._exec_vfs_readdir = exec_vfs_readdir;
    window._exec_vfs_stat = exec_vfs_stat;

    const fakeFsApi = {
        async readFile() {
            let path, options, callback;
            if (arguments.length === 2) { [path, callback] = arguments; }
            if (arguments.length === 3) { [path, options, callback] = arguments; }

            let [mode, components] = determine_location(path);
            if (mode === 0) return nativefs.readFile(...arguments);
            else {
                $modLoader.$vfsTrace("[NODEJS READ] " + path);
                try {
                    let fileData = await _vfs_resolve_file(components.join("/"));
                    if (options) {
                        if(typeof options === "string") {
                            fileData = fileData.toString(options);
                        } else {
                            if (options.encoding) {
                                fileData = fileData.toString(options.encoding);
                            }
                        }
                    }

                    callback(null, fileData);
                } catch(e) {
                    callback(e, fileData);
                }
            }
        },
        readFileSync() {
            let path, options;
            if (arguments.length === 1) { [path] = arguments; }
            if (arguments.length === 2) { [path, options] = arguments; }

            let [mode, components] = determine_location(path);
            if (mode === 0) return nativefs.readFileSync(...arguments);
            else {
                $modLoader.$vfsTrace("[NODEJS READ] " + path);
                let fileData = _vfs_resolve_file_sync(components.join("/"));
                if (options) {
                    if(typeof options === "string") {
                        fileData = fileData.toString(options);
                    } else {
                        if (options.encoding) {
                            fileData = fileData.toString(options.encoding);
                        }
                    }
                }

                return fileData;
            }
        },
        async writeFile() {
            let file, data, options, callback;
            if (arguments.length === 3) { [file, data, callback] = arguments; }
            if (arguments.length === 4) { [file, data, options, callback] = arguments; }

            if (typeof data === "number") { data = data.toString(); arguments[1] = data; }

            let [mode] = determine_location(file);
            if (mode === 0) return nativefs.writeFile(...arguments);
            else {
                window._logLine("Something tried to write to a virtual/overlayed directory. The write was ignored. Path: " + file);
                callback();
            }
        },
        writeFileSync() {
            let file, data, options;
            if (arguments.length === 2) { [file, data] = arguments; }
            if (arguments.length === 3) { [file, data, options] = arguments; }

            if (typeof data === "number") { data = data.toString(); arguments[1] = data; }

            let [mode] = determine_location(file);
            if (mode === 0) return nativefs.writeFileSync(...arguments);
            else {
                window._logLine("Something tried to write to a virtual/overlayed directory. The write was ignored. Path: " + file);
            }
        },
        async readdir() {
            let path, options, callback;
            if (arguments.length === 2) { [path, callback] = arguments; }
            if (arguments.length === 3) { [path, options, callback] = arguments; }
            
            let [mode, components] = determine_location(path);
            if (mode === 0) return nativefs.readdir(...arguments);
            else {
                $modLoader.$vfsTrace("[NODEJS READDIR] " + path);
                callback(null, _exec_vfs_readdir(components));
            }
        },
        readdirSync() {
            let path, options;
            if (arguments.length === 1) { [path] = arguments; }
            if (arguments.length === 2) { [path, options] = arguments; }
            
            let [mode, components] = determine_location(path);
            if (mode === 0) return nativefs.readdirSync(...arguments);
            else {
                $modLoader.$vfsTrace("[NODEJS READDIR] " + path);
                return _exec_vfs_readdir(components);
            }
        },
        async unlink() {
            let file, callback;
            if (arguments.length === 2) { [file, callback] = arguments; }

            let [mode] = determine_location(file);
            if (mode === 0) return nativefs.unlink(...arguments);
            else {
                window._logLine("Something tried to delete from a virtual/overlayed directory. The delete was ignored. Path: " + file);
                callback();
            }
        },
        unlinkSync() {
            let file;
            if (arguments.length === 1) { [file] = arguments; }

            let [mode] = determine_location(file);
            if (mode === 0) return nativefs.unlinkSync(...arguments);
            else {
                window._logLine("Something tried to delete from a virtual/overlayed directory. The delete was ignored. Path: " + file);
            }
        },
        async stat() {
            let path, options, callback;
            if (arguments.length === 2) { [path, callback] = arguments; }
            if (arguments.length === 3) { [path, options, callback] = arguments; }

            let [mode, components] = determine_location(path);
            if (mode === 0) return nativefs.stat(...arguments);
            else {
                callback(null, await _exec_vfs_stat_async(components));
            }
        },
        statSync() {
            let path, options;
            if (arguments.length === 1) { [path] = arguments; }
            if (arguments.length === 2) { [path, options] = arguments; }

            let [mode, components] = determine_location(path);
            if (mode === 0) return nativefs.statSync(...arguments);
            else {
                return _exec_vfs_stat(components);
            }
        },
        existsSync(path) {
            let [mode, components] = determine_location(path);
            if (mode === 0) return nativefs.existsSync(path);
            else {
                try {
                    _exec_vfs_stat(components);
                    return true;
                } catch(e) {
                    return false;
                }
            }
        },
        async mkdir() {
            let file, options, callback;
            if (arguments.length === 2) { [file, callback] = arguments; }
            if (arguments.length === 3) { [file, options, callback] = arguments; }

            let [mode] = determine_location(file);
            if (mode === 0) return nativefs.mkdir(...arguments);
            else {
                window._logLine("Something tried to mkdir to a virtual/overlayed directory. The write was ignored. Path: " + file);
                callback();
            }
        },
        mkdirSync(file) {
            let [mode] = determine_location(file);
            if (mode === 0) return nativefs.mkdirSync(...arguments);
            else {
                window._logLine("Something tried to mkdir to a virtual/overlayed directory. The write was ignored. Path: " + file);
            }
        },
        async lstat() {
            let path, options, callback;
            if (arguments.length === 2) { [path, callback] = arguments; }
            if (arguments.length === 3) { [path, options, callback] = arguments; }

            let [mode, components] = determine_location(path);
            if (mode === 0) return nativefs.stat(...arguments);
            else {
                callback(null, _exec_vfs_stat(components));
            }
        },
        lstatSync() {
            let path, options;
            if (arguments.length === 1) { [path] = arguments; }
            if (arguments.length === 2) { [path, options] = arguments; }

            let [mode, components] = determine_location(path);
            if (mode === 0) return nativefs.statSync(...arguments);
            else {
                return _exec_vfs_stat(components);
            }
        },
        async rename(o, n, callback) {
            let [mode_1] = determine_location(o);
            let [mode_2] = determine_location(n);
            if (mode_1 === 0 && mode_2 === 0) {
                if (callback) return nativefs.rename(...arguments);
                else return nativefs.rename(o, n, () => {});
            } else {
                window._logLine("Something tried to rename to or from a virtual/overlayed directory. The write was ignored. Path: " + file);
                callback();
            }
        },
        renameSync(o, n) {
            let [mode_1] = determine_location(o);
            let [mode_2] = determine_location(n);
            if (mode_1 === 0 && mode_2 === 0) return nativefs.renameSync(...arguments);
            else {
                window._logLine("Something tried to rename to or from a virtual/overlayed directory. The write was ignored. Path: " + file);
            }
        },
    }

    window.require = function(what) {
        if (what === "fs") { // intercept require fs
            return fakeFsApi;
        } else {
            return old_require.call(this, what);
        }
    }

    window.__unload_node_vfs = function() {
        window.require = old_require;
    }
}