(function b(){
    window._logLine("-=-=-= Early loader =-=-=-");

    const MAX_MANIFEST_VERSION = 1;
    const ID_BLACKLIST = ["gomori"];
    const EXTENSION_RULES = {
        "png":{"encrypt":"rpgmaker", "target_extension":"rpgmvp"},
        "ogg":{"encrypt":"rpgmaker", "target_extension":"rpgmvo"}
    };

    const DATA_RULES = [
        {
            jsonKeys: [
                "data", "data_delta", "data_pluto","data_pluto_delta"
            ],
            formatMap: {
                "json":{target: "KEL", delta: false, encrypt: true},
                "jsond":{target: "KEL", delta: true,delta_method:"json", encrypt: true},
                "kel":{target:"KEL", delta: false, encrypt: false},
                "yml":{target:"PLUTO",delta:false, encrypt: true},
                "ymld":{target:"PLUTO",delta:true,delta_method:"yaml", encrypt: true},
                "yaml":{target:"PLUTO", delta:false, encrypt: true},
                "yamld":{target:"PLUTO",delta:true,delta_method:"yaml", encrypt: true},
                "pluto":{target:"PLUTO", delta: false, encrypt: false}
            },
            mountPoint: "data"
        },
        {
            jsonKeys: [
                "text", "text_delta"
            ],
            formatMap: {
                "yml":{target:"HERO",delta:false, encrypt: true},
                "ymld":{target:"HERO",delta:true,delta_method:"yaml", encrypt: true},
                "yaml":{target:"HERO", delta:false, encrypt: true},
                "yamld":{target:"HERO",delta:true,delta_method:"yaml", encrypt: true},
                "hero":{target:"HERO",delta:false,encrypt:false}
            },
            mountPoint: "languages/en"
        },
        {
            jsonKeys: [
                "maps","maps_delta"
            ],
            formatMap: {
                "json":{target: "AUBREY", delta: false, encrypt: true},
                "jsond":{target: "AUBREY", delta: true,delta_method:"json", encrypt: true},
                "aubrey":{target:"AUBREY",delta:false,encrypt:false}
            },
            mountPoint: "maps"
        },
        {
            jsonKeys: [
                "plugins","plugins_delta"
            ],
            formatMap: {
                "js":{target:"OMORI",delta:false,encrypt:true},
                "jsd":{target:"OMORI",delta:true,delta_method:"append",encrypt:true},
                "omori":{target:"OMORI",delta:false,encrypt:false}
            },
            mountPoint: "js/plugins",
            pluginList: true
        }
    ];

    const StreamZip = require('./modloader/node_stream_zip.js');
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

    function randomString() {
        return crypto.randomBytes(32).toString("hex");
    }

    function escapeRegex(input) {
        return input.replace(/[[\](){}?*+^$\\.|]/g, '\\$&');
    }
    
    function fileName(input) {
        input = input.replace(/\/$/, "");
        return input.match(/[^\/]+$/)[0];
    }

    $modLoader = {
        $log: window._logLine,
        $execScripts: {
            "pre_stage_2":[],
            "post_stage_2":[],
            "pre_game_start":[],
            "pre_plugin_injection":[],
            "pre_window_onload":[],
            "when_discovered_2":[],
            "when_discovered_3":[]
        },
        async $runRequire(data, p) {
            native_fs.writeFileSync(path.join(base, "temp_ONELOADER.js"), data);
            let module = require('./temp_ONELOADER.js');
            await module($modLoader, window, p);
            native_fs.unlinkSync(path.join(base, "temp_ONELOADER.js"));
        },
        async $runEval(data, p) {
            let fun = eval("(async function evalScript(params){" + data + "})");
            await fun(p);
        },
        async $runScripts(place, p) {
            for (let s of $modLoader.$execScripts[place]) {
                if (s.req) {
                    await $modLoader.$runRequire(s.data, p);
                } else {
                    await $modLoader.$runEval(s.data, p);
                }
            }
        }
    }; // BaseModLoader object

    /* Install the argv handler and shadow the true argv object to allow the base game to work normally */ { 
        let key = window.nw.App.argv[0];
        $modLoader.realArgv = window.nw.App.argv;
        window.nw.App = new Proxy(window.nw.App, {
            get(t, p, r) {
                if (p === "argv") {
                    return [key];
                } else {
                    return Reflect.get(...arguments);
                }
            }
        });
    }

    if ($modLoader.realArgv.includes("--no-mods")) {
        $modLoader.$log("Starting with no mods");
        _start_game();
        return
    }

    class Mod {
        constructor(basePath) {
            this.basePath = basePath;
            this.innerRoot = "/";
            this.rootPath = null;
            this.json = {};
            this.files = [];
            this.plugins = [];
            this.pluginsDelta = [];
            this.start();
        }
        start() {}
        async init() {
            await this.mainInit();
            await this.locateModJson();
            await this.readModJson();
        }
        async filesInDir(dir) {
            let files = await this.readDir(path.join(this.rootPath, dir));
            let realFiles = [];
            for (let file of files) {
                if (!await this.isDir(path.join(this.rootPath, dir, file))) {
                    realFiles.push(file);
                }
            }
            return realFiles;
        }
        async processListEntryV1(entry) {
            if (entry.endsWith("/")) {
                let files = await this.filesInDir(entry);
                return files.map(a => {return {base: entry, file: a}});
            } else {
                let split = entry.split("/");
                let file = split.pop();
                return [
                    { base: split.join("/"), file }
                ]
            }
        }
        async processAssetsV1(list) {
            for (let el of list) {
                let patchedFiles = await this.processListEntryV1(el);
                for (let {base, file: oogName} of patchedFiles) {
                    let extension = "";
                    let ogName = oogName;
                    try {
                        extension = ogName.match(/.([^\.]*$)/)[1].toLowerCase();
                    } catch(e) {}
                    let injectionPoint = path.join(base, ogName).replace(/\\/g, "/").toLowerCase();
                    if (EXTENSION_RULES[extension] && EXTENSION_RULES[extension].target_extension) {
                        let target = EXTENSION_RULES[extension].target_extension;
                        injectionPoint = injectionPoint.replace(new RegExp(extension + "$"), target);
                        ogName = ogName.replace(new RegExp(extension + "$", "i"), target);
                    }

                    let fileData = {
                        injectionPoint,
                        ogName,
                        mode: (EXTENSION_RULES[extension] && EXTENSION_RULES[extension].encrypt) ? EXTENSION_RULES[extension].encrypt : "pass",
                        dataSource: await this.resolveDataSource(path.join(base, oogName)),
                        delta: false
                    };

                    this.files.push(fileData);
                }
            }
        }
        async processDataRulesV1(rules) {
            let {jsonKeys, formatMap, mountPoint, pluginList} = rules;
            let allEntries = new Set();
            let doneEntries = new Set();
            for (let k of jsonKeys) {
                if (this.json.files[k]) {
                    for (let entry of this.json.files[k]) {
                        allEntries.add(entry);
                    }
                }
            }
            for (let entry of Array.from(allEntries)) {
                let f = await this.processListEntryV1(entry);
                for (let {base, file: oogName} of f) {
                    let extension = "";
                    let ogName = oogName;
                    let fileName = oogName.toLowerCase();
                    try {
                        extension = ogName.match(/.([^\.]*$)/)[1].toLowerCase();
                    } catch(e) {}
                    if (pluginList && this.json._flags.includes("randomize_plugin_name")) {
                        let rs = randomString();
                        fileName = rs + "." + extension;
                        ogName = rs + "." + extension;
                    }
                    if (formatMap[extension]) {
                        let format = formatMap[extension];
                        let fileData = {
                            injectionPoint: mountPoint + "/" + fileName.replace(new RegExp(extension + "$"), format.target),
                            ogName: oogName.replace(new RegExp(extension + "$", "i"), format.target),
                            mode: format.encrypt ? "steam" : "pass",
                            dataSource: await this.resolveDataSource(path.join(base, oogName)),
                            delta: format.delta
                        };
                        if (fileData.delta) {
                            fileData.delta_method = format.delta_method;
                        }
                        if (doneEntries.has(fileData.injectionPoint)) {
                            $modLoader.$log(`${this.json.id} + ${mountPoint} + ${entry} | ${fileData.injectionPoint} can't be patched twice`);
                            continue;
                        }
                        doneEntries.add(fileData.injectionPoint);
                        if (pluginList) {
                            if (format.delta) {
                                this.pluginsDelta.push(fileData.injectionPoint);
                            } else {
                                this.plugins.push(fileData.injectionPoint);
                            }
                        }
                        this.files.push(fileData);
                    } else {
                        $modLoader.$log(`${this.json.id} + ${mountPoint} + ${entry} | ${oogName} skipped, unknown extension`)
                    }
                }
            }
        }
        async processAsyncExecV1() {
            if (this.json.asyncExec) {
                for(let {file, runat} of this.json.asyncExec) {
                    let fileData = await _read_file(await this.resolveDataSource(file));
                    if (runat === "when_discovered") {
                        $modLoader.$runEval(fileData, {
                            mod: this
                        });
                    } else {
                        let data = fileData.toString("utf-8");
                        let req = false;
                        if ((/\_require$/).test(runat)) {
                            runat = runat.match(/(.*)\_require$/)[1];
                            req = true;
                        }
                        $modLoader.$execScripts[runat].push({
                            data, req
                        });
                    }
                }
            }
        }
        async processV1Mod() {
            await this.processAsyncExecV1();
            if (this.json.files.assets) {
                await this.processAssetsV1(this.json.files.assets);
            }
            await $modLoader.$runScripts("when_discovered_2", {
                mod: this
            });
            for (let rule of DATA_RULES) {
                await this.processDataRulesV1(rule);
            }
            await $modLoader.$runScripts("when_discovered_3", {
                mod: this
            });
        }
        async processMod() {
            if (this.json.manifestVersion === 1) {
                await this.processV1Mod();
            } else {
                throw new Error("Unable to process: Invalid manifest version " + this.json.manifestVersion);
            }
        }
        async mainInit() {}
        async readFile() { throw new Error("Unimplemented"); }
        async readDir() { throw new Error("Unimplemented"); }
        async isDir() { throw new Error("Unimplemented"); }
        async exists() { throw new Error("Unimplemented"); }
        async resolvePatchedEntry() { throw new Error("Unimplemented"); }
        async resolveDataSource() { throw new Error("Unimplemented"); }
        get type() { return "Unimplemented"; }
        get entry() { return {}; }
        async locateModJson(base = "/", crashOnFail = true) {
            let entries = await this.readDir(base);
            if (entries.includes("mod.json")) {
                this.rootPath = base;
                return true;
            }
            for (let entry of entries) {
                if (this.isDir(path.join(base + entry))) {
                    if (await this.locateModJson(path.join(base + entry), false)) {
                        return true;
                    }
                }
            }
            if (crashOnFail) throw new Error("Unable to find mod.json");
            else return false;
        }
        async readModJson() {
            let modJson = await this.readFile(path.join(this.rootPath, "mod.json"));
            modJson = modJson.toString("utf-8");
            try {
                modJson = JSON.parse(modJson);
            } catch(e) {
                throw new Error("Failed to decode mod.json");
            }
            if (!modJson.manifestVersion) modJson.manifestVersion = 1;
            if (!modJson._flags) modJson._flags = [];
            if (modJson.manifestVersion > MAX_MANIFEST_VERSION) throw new Error("ModLoader too old to load this mod");

            this.json = modJson;
        }
    }

    class ZipMod extends Mod {
        start() { this.sz = null; }
        async mainInit() {
            $modLoader.$log("Initializing a zip mod from " + this.basePath);
            this.fd = native_fs.openSync(this.basePath, "r");
            this.sz = new StreamZip.async({fd: this.fd});
            this.sz.resolvedStreamZip = await this.sz[Object.getOwnPropertySymbols(this.sz)[0]];
            this._entryCache = await this.sz.entries();
            this._rootsCache = new Set();
        }

        async readFile(sPath) {
            sPath = sPath.replace(/\\/g,"/");
            let e = this._resolveEntry(sPath);
            return await this.sz.entryData(e);
        }
        async readDir(sPath) {
            sPath = sPath.replace(/\\/g,"/");
            sPath = sPath.replace(/^\//, "");
            if (!sPath.endsWith("/")) sPath = sPath + "/";
            if (sPath.length === 1) {
                let roots = new Set();
                for (const entry of Object.values(this._entryCache)) {
                    let root = entry.name.match(/^\/*([^\/]+)/)[1];
                    roots.add(root);
                    this._rootsCache.add(root);
                    this._rootsCache.add("/" + root);
                    this._rootsCache.add("/" + root + "/");
                }
                return Array.from(roots);
            } else {
                let validPathRe = new RegExp(
                    "^/*" +
                    escapeRegex(sPath) +
                    "[^/]+/*$"
                );
                let results = [];
                for (const entry of Object.values(this._entryCache)) {
                    let pathMatcher = new RegExp(
                        validPathRe.source, validPathRe.flags
                    );
                    if (pathMatcher.test(entry.name)) {
                        results.push(fileName(entry.name));
                    }
                }
                return results;
            }
        }
        async resolveDataSource(sPath) {
            return {
                type: "zip",
                entry: this._resolveEntry(path.join(this.rootPath, sPath)),
                sz: this.sz
            };
        }
        isDir(sPath) {
            sPath = sPath.replace(/\\/g,"/");
            if (this._rootsCache.has(sPath)) {
                return true;
            }
            let e = this._resolveEntry(sPath);
            return !e.isFile;
        }
        exists(sPath) {
            sPath = sPath.replace(/\\/g,"/");
            try { this._resolveEntry(sPath); return true; } catch(e) { return false; }
        }
        _resolveEntry(sPath) {
            sPath = sPath.replace(/\\/g,"/");
            let cleanupRegexps = [/$^/,/^\//,/^\/|\/$/g,/\/$/];
            let addSlashRegexps = [/$^/, /^/, /$/, /^|$/g];
            for (let a of cleanupRegexps) {
                for (let b of addSlashRegexps) {
                    let aa = new RegExp(a.source,a.flags);
                    let bb = new RegExp(b.source,b.flags);
                    let mangled = sPath.replace(aa, "").replace(bb, "/");
                    if (this._entryCache[mangled]) {
                        return this._entryCache[mangled];
                    }
                }
            }
            for (let a of addSlashRegexps) {
                if (this._entryCache[sPath.replace(a, "/")]) {
                    return this._entryCache[sPath.replace(a, "/")];
                }
            }
            throw new Error("Entry unresolvable");
        }
        get type() { return "zip"; }
        get entry() {
            return {
                type: "zip",
                fd: this.fd,
                zipInstance: this.sz,
                json: this.json,
                files: this.files,
                plugins: this.plugins,
                pluginsDelta: this.pluginsDelta
            };
        }
    }

    class DirectoryMod extends Mod {
        async mainInit() {
            this._statCache = new Map();
        }
        async readFile(sPath) { 
            return await async_fs.readFile(path.join(this.basePath, sPath));
        }
        async readDir(sPath) {
            return await async_fs.readdir(path.join(this.basePath, sPath));
        }
        async isDir(sPath) { 
            if (this._statCache.has(sPath)) {
                return this._statCache.get(sPath).isDirectory();
            } else {
                let stats = await async_fs.stat(path.join(this.basePath, sPath));
                this._statCache.set(sPath, stats);
                return stats.isDirectory();
            }
        }
        async exists(sPath) { 
            return native_fs.existsSync(path.join(this.basePath, sPath))
        }
        async resolveDataSource(sPath) { 
            return {
                type: "filesystem",
                path: path.join(this.basePath, sPath)
            }
        }
        get type() { return "dir"; }
        get entry() {
            return {
                type: "dir",
                directory: this.basePath,
                json: this.json,
                files: this.files,
                plugins: this.plugins,
                pluginsDelta: this.pluginsDelta
            };
        }
    }

    async function run() {
        if (!native_fs.existsSync(path.join(base, "mods"))) {
            native_fs.mkdirSync(path.join(base, "mods"));
        }

        let debasilificationCounter = 0;
        let currentLoader = document.createElement("h1");
        currentLoader.style = "position: fixed; top: 0; margin: 0; padding: 0; left: 0; right: 0; font-size: 18px; color: white; background: hsl(200, 85%, 35%, 0.2); line-height: 40px; text-align:center;";

        async function debasilify(directory) {
            let files = await async_fs.readdir(directory);
            for (let file of files) {
                let stats = await async_fs.stat(path.join(directory, file));
                if (stats.isDirectory()) {
                    await debasilify(path.join(directory, file));
                } else {
                    if (file.toLowerCase().endsWith(".basil")) {
                        let name = file.split(/\.basil$/i)[0];
                        await async_fs.writeFile(
                            path.join(directory, name),
                            await async_fs.readFile(
                                path.join(directory, file)
                            )
                        );
                        native_fs.unlinkSync(path.join(directory, file));

                        debasilificationCounter++;
                        currentLoader.innerText = `Undoing GOMORI-based patching ${debasilificationCounter}`;
                    }
                }
            }
        }

        // Initialize on-screen logging framework
        window._logLine("Loading configuration");
        if (!native_fs.existsSync(path.join(base, "save"))) {
            native_fs.mkdir(path.join(base, "save"));
        }
        if (!native_fs.existsSync(path.join(base, "save", "mods.json"))) {
            native_fs.writeFileSync(path.join(base, "save", "mods.json"), "{}"); // gomori compatibility, otherwise it would be elsewhere
        }



        let config = JSON.parse(native_fs.readFileSync(path.join(base, "save", "mods.json"), "utf-8"));

        window._logLine("Inspecting mods");

        let mod_files = await async_fs.readdir(path.join(base, "mods"));
        window._logLine(mod_files.length + " entries in mods/");

        let errorCount = 0;
        let knownMods = new Map();

        let progressBar = document.createElement("progress");
        progressBar.max = mod_files.length;
        progressBar.value = 0;
        progressBar.style = "position: fixed; top: 40px; height: 16px; left: 0; right: 0; width: 640px; font-size: 18px;";

        let b = setInterval(function() {
            if (document.body) {
                document.body.appendChild(progressBar);
                document.body.appendChild(currentLoader);
                clearInterval(b);
            }
        }, 30);
        let allMods = new Map();

        if (config._basilFiles) { //Debasilification procedure
            window._logLine("Gomori-derived mods.json detected, finding, restoring and removing basil files");
            progressBar.removeAttribute("value");
            currentLoader.innerText = "Undoing GOMORI-derived patches";

            try {
            await debasilify(base);
            }catch(e) {alert(e);}
            config._basilFiles = undefined;
            progressBar.value = 0;
            alert("The modloader tried its best to undo GOMORI-derived changes after an upgrade, however it could have missed something. For an optimal experience, it's advised to reinstall the game.");
            native_fs.writeFileSync(path.join(base, "save", "mods.json"), JSON.stringify(config, null, 2));
        }


        for (let mod_file of mod_files) {
            currentLoader.innerText = "Early loading: " + mod_file;
            progressBar.value++;
            if (mod_file.startsWith("_")) {
                window._logLine("> Skipping: " + mod_file + " because name starts with _");
                continue;
            }
            window._logLine("> Now inspecting: " + mod_file);
            try {
            let mod_stats = await async_fs.stat(path.join(base, "mods", mod_file));
            let mod;

            if (mod_stats.isDirectory()) {
                mod = new DirectoryMod(path.join(base, "mods", mod_file));
            } else {
                if (!mod_file.endsWith(".zip")) {
                    window._logLine("| [ERROR] Skipping, not directory and extension isn't zip");
                    errorCount++;
                    continue;
                }
                mod = new ZipMod(path.join(base, "mods", mod_file));
            }
            await mod.init();

            if (mod.json.exec && mod.json.exec.length > 0) {
                alert(mod.json.id + " makes use of exec. That feature is unsupported and the mod WILL NOT be loaded.");
                continue;
            }

            if (knownMods.has(mod.json.id)) {
                window._logLine("| [ERROR] Unable to load " + mod_file + ", Duplicate ID");
                errorCount++;
                continue;
            }

            allMods.set(mod.json.id, mod.json);
            let flags = mod.json._flags || [];
            if (ID_BLACKLIST.includes(mod.json.id)) {
                window._logLine("[ERROR] ID blacklisted, skipping");
                errorCount++;
                continue;
            }
            if (config[mod.json.id] === false) {
                if (!flags.includes("prevent_disable")) {
                    window._logLine("| Mod disabled, skipping");
                    continue;
                }
            } else {
                config[mod.json.id] = true;
            }

            mod.json._enabled = true;
                            
            window._logLine("| Name: " + mod.json.name);
            window._logLine("| ID: " + mod.json.id);
            window._logLine("| Version: " + mod.json.version);
            window._logLine("| Description: " + mod.json.description);

            await mod.processMod();
            knownMods.set(mod.json.id, mod.entry);
            } catch(e) {
                window._logLine("| [ERROR] Catastrophic failure when processing " + mod_file + "! " + e.toString() +"\n" + e.stack);
                errorCount++;
            }
        }

        clearInterval(b);
        progressBar.remove();
        currentLoader.remove();

        window._logLine("Early loading complete, starting loader stage 2");
        native_fs.writeFileSync(path.join(base, "save", "mods.json"), JSON.stringify(config, null, 2));
        if (errorCount > 0) {
            alert("Early loading complete with " + errorCount + " errors. Please look into latest.log and searching for [ERROR] to identify what the erorrs were.");
        }
        await _modloader_stage2(config, knownMods);

        window._logLine("Creating GOMORI API backwards compatibility");
        let _gomori_compat_mods = new Map();
        $modLoader.knownMods = knownMods;
        $modLoader.allMods = allMods;
        $modLoader.config = JSON.parse(native_fs.readFileSync(path.join(base, "save", "mods.json"), "utf-8"));
        $modLoader.syncConfig = function() {
            native_fs.writeFileSync(path.join(base, "save", "mods.json"), JSON.stringify($modLoader.config, null, 2));
        }

        for (let mod of knownMods.values()) {
            _gomori_compat_mods.set(mod.json.id, {
                enabled: true,
                meta: mod.json,
                id: mod.json.id // compatibility fix for ModHistory - GOMORI version
            });
        }

        $modLoader.mods = _gomori_compat_mods;
        $modLoader.native_fs = native_fs;
        window.$modLoader = new Proxy($modLoader, {
            get(target, param, receiver) {
                if (param === "mods") {
                    window._logLine("[WARNING] DEPRECATED USE OF $modLoader.mods DETECTED. PLEASE USE $modLoader.knownMods OR $modLoader.allMods INSTEAD");
                }
                if (param === "native_fs") {
                    window._logLine("[WARNING] Usage of the native_fs provider is highly discouraged. Please use the shadowed require('fs')");
                }
                return Reflect.get(...arguments);
            }
        });

        // Some software requires GOMORI's original index.html to be present ( https://mods.one/mod/playtest )
        // Install GOMORI's original index.html into the overlayfs
        // https://github.com/Gilbert142/gomori/blob/1802acc41225f085f7d5b4349c5feb857e6ed036/www/index.html
        let gomori_index_html = Buffer.from("eNqtlE1v2zAMhu/5FZruiq5DYeeyD2CHIsPQHXYaJJm1meoLEp00+/Wj4wXI1g0o7Plg0pTfR6QoqXnzfv/u4dvnD2Kg4HebZjZswXS7jeCnCUBGuMGUCtTKrw8f1Vt5OxRNgFaanD2okCyyOYFVHFDOZGM9SOFSJIgsP0N9rbiSobEqawq7598o1hv3pKiYWP3oOPQX5hHhlFOhG9lYgVnO+CmpNqarymN8EgV8K5H/lWIo8Dj7enptc+yloHNmKgbTg54CL7RzEZRGN6h/c17ILrXVAYCucxA8k3a1XgGPnH/VPVc1edtp5BeFkDzs9vf7L58aPX9sGj33btPY1J3FBc8rxgvWlzTGTrnkU7kTlzW8gqormOl2/oM5mjkqRS2ulYeqPdqqMz7j9sApNHoeX4ZQxL0OJv8PVEZHY4GVKP+D91nB2K/kYB5SBIWRewzqiB2krS3pxJtvObnk/rtLa2qcCMFE3r6lrqMkewBHKyGVjy2sZeSCtBZywthxc5ZDsh97jEsBfQqpoJ7N8iSCwfiHutHTBTBdBHq+1X8CtEoELw==", "base64");
        $modLoader.overlayFS["index.html"] = {
            injectionPoint: "index.html",
            ogName: "index.html",
            mode: "pass",
            dataSource: {
                type: "zlib",
                stream: gomori_index_html
            }
        };

        window._logLine("Looking for plugin conflicts...");
        let pluginLocks = new Set();
        for (let modEntry of $modLoader.knownMods.values()) {
            for (let pluginName of modEntry.pluginsDelta) {
                let fileName = pluginName.match(/[^\/\\]*$/)[0].toLowerCase();
                fileName = fileName.match(/(.*)\.[a-z]*$/)[1];
                pluginLocks.add(fileName);
            }
        }
        for (let modEntry of $modLoader.knownMods.values()) {
            for (let pluginName of modEntry.plugins) {
                let fileName = pluginName.match(/[^\/\\]*$/)[0].toLowerCase();
                fileName = fileName.match(/(.*)\.[a-z]*$/)[1];
                if (pluginLocks.has(fileName)) {
                    alert("Plugin conflict: " + fileName + " was already replaced when " + modEntry.json.id + " tried to replace it.");
                    throw new Error("Plugin conflicts can't be auto-resolved.");
                }
                pluginLocks.add(fileName);
            }
        }

        $modLoader.pluginLocks = pluginLocks;

        window._logLine("Installing VFS handler (1/2) [Chrome DevTools mode]");
        await _modLoader_install_debugger_vfs($modLoader.shadowFS, native_fs);

        window._logLine("Installing VFS handler (2/2) [node.js]");
        await _modLoader_install_node_vfs($modLoader.shadowFS, native_fs);

        $modLoader.success = true;

        if ($modLoader.realArgv.includes("--dump-overlay")) {
            if (confirm("Are you sure you want to dump the ENTIRE OVERLAYFS TO DISK? This may take a non-trivial amount of time and WILL cause disk writes.")) {
                await window._dump_overlay_fs_to_disk();
            }
        }

        window._logLine("Starting game");

        $modLoader.$runScripts("pre_game_start", {});

        await _start_game();
    };

    run().catch(e => {
        alert("A catastrophic failure occured while loading the modloader. The game will attempt to start in safe mode, although it may be unstable. If this persists, report the issue on github. You can also try starting the game with the --no-mods launch argument.\n"+ e.stack);
        _start_game();
    });
})();