(function b() {
    window._logLine("-=-=-= Early loader =-=-=-");


    const { MAX_MANIFEST_VERSION, ID_BLACKLIST, EXTENSION_RULES, DATA_RULES } = $ONELOADER_CONFIG;

    const StreamZip = require('./modloader/lib/node_stream_zip.js');
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
            "pre_stage_2": [],
            "post_stage_2": [],
            "pre_game_start": [],
            "pre_plugin_injection": [],
            "pre_window_onload": [],
            "when_discovered_2": [],
            "when_discovered_3": []
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
        },
        $vfsTrace(message) {
            if ($modLoader.realArgv.includes("--trace-vfs")) {
                window._logLine("[TRACING] " + message);
            }
        },
        $nwMajor: parseInt(process.versions.nw.match(/^\d*\.(\d*)\.\d*$/)[1]),
        isInTestMode: window.nw.App.argv[0] === "test",
        $parsers: new Map(),
        $rollup: null,
        $packageJsonPatchset: []
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

    /*
     * Abstract class for parsing mod file data sources BEFORE they are handed off to the VFS.
     * These Mod File Parsers are responsible for providing a Buffer that the Mod File then hands off to the VFS in a dataSource.
     */
    class ModFileParser {
        constructor(modFile, config = {}) {
            this.modFile = modFile;
            this.config = config;
        }

        async parse() {
            throw new Error('Unimplemented');
        }
    }

    /*
     * Mod File Parser for ES Module plugins. Parses ES Modules with rollup and returns a Buffer.
     */
    class ESModuleParser extends ModFileParser {
        async parse() {
            const rollupInstance = await $modLoader.$rollup({
                input: this.entryPointRollupFileId,
                plugins: [this.rollupPlugin],
            });

            const result = await rollupInstance.generate({});
            const generatedCode = result.output[0].code;

            return ESModuleParser.bufferFromGeneratedCode(generatedCode, !this.config.noIIFE);
        }

        get entryPointRollupFileId() {
            return ESModuleParser.buildRollupFileId("mod", this.modFile.srcFile);
        }

        get rollupPlugin() {
            return {
                name: "OneloaderResolver",
                resolveId: (source, importer) => {
                    if (importer) {
                        const { fingerprint, filename } = ESModuleParser.parseRollupFileId(importer);
                        if (fingerprint && filename) return ESModuleParser.buildRollupFileId(fingerprint, path.join(path.dirname(filename), source));
                    } else if (ESModuleParser.parseRollupFileId(source).filename) {
                        return source;
                    }
                    return null;
                },
                load: async id => {
                    const { fingerprint, filename } = ESModuleParser.parseRollupFileId(id);
                    if (fingerprint !== "mod") return;

                    const buffer = await this.modFile.mod.readFile(path.join(this.modFile.mod.rootPath, this.modFile.srcPath, filename));
                    return buffer.toString("utf-8");
                },
            };
        }

        static bufferFromGeneratedCode(generatedCode, useIIFE) {
            const wrappedCode = `(function(){${generatedCode}})()`;
            if (useIIFE)
                return Buffer.from(wrappedCode);
            else
                return Buffer.from(generatedCode);
        }

        static buildRollupFileId(fingerprint, filename) {
            const extension = path.extname(filename);
            return `${fingerprint}:${filename}${extension ? "" : ".js"}`;
        }

        static parseRollupFileId(id) {
            const parsedId = id.match(/^([^\:]+)\:(.+)$/);
            if (!parsedId) return { fingerprint: null, filename: null };

            const [unused, fingerprint, filename] = parsedId;
            return { fingerprint, filename };
        }
    }

    class ESModuleNoIIFEParser extends ESModuleParser {
        constructor(modFile) {
            super(modFile, {
                noIIFE: true
            })
        }
    }

    $modLoader.$parsers.set("esm", ESModuleParser);
    $modLoader.$parsers.set("esm_no_iife", ESModuleNoIIFEParser);

    /*
     * Representation of a file as declared by a Mod.
     * Each entry in the Mod's JSON manifest is first parsed by `Mod.processListEntryV1`.
     * The resulting file declarations are used to construct instances of this class, which further parses it into fileData the VFS can use.
     */
    class ModFile {
        constructor(mod, fileDeclaration, dataRule) {
            this.mod = mod;
            this.srcFile = fileDeclaration.file;
            this.srcPath = fileDeclaration.base;
            this.rule = dataRule;

            try {
                this.srcExtension = this.srcFile.match(/.([^\.]*$)/)[1].toLowerCase();
            } catch (e) {
                this.srcExtension = '';
            }

            // Destination file name in the VFS, without extension.
            this.destFileName = this.srcFile.replace(new RegExp(`\.${this.srcExtension}$`), "");
            // Randomize the destination plugin name if flag is enabled + this is a plugin file
            if (this.rule && this.rule.pluginList && this.mod.json._flags.includes("randomize_plugin_name")) this.destFileName = randomString();
        }

        get format() {
            if (!this.rule) return null;
            return this.rule.formatMap[this.srcExtension];
        }

        /*
         * Generates the path where this mod file's data will be injected into the VFS.
         */
        get injectionPoint() {
            return `${this.rule.mountPoint}/${this.destFileName.toLowerCase()}.${this.format.target}`;
        }

        async resolveDataSource() {
            const parserId = this.format.parser;
            if (parserId && $modLoader.$parsers.has(parserId)) {
                const Parser = $modLoader.$parsers.get(parserId);
                const parser = new Parser(this);

                const buffer = await parser.parse();
                return {
                    type: "zlib",
                    stream: zlib.deflateSync(buffer),
                };
            }

            return this.mod.resolveDataSource(path.join(this.srcPath, this.srcFile));
        }

        /*
         * Builds the data object used by the VFS to represent the file.
         */
        async buildFileData() {
            const format = this.format;

            const fileData = {
                injectionPoint: this.injectionPoint,
                ogName: `${this.destFileName}.${format.target}`,
                mode: format.encrypt ? "steam" : "pass",
                dataSource: await this.resolveDataSource(),
                delta: format.delta,
            };
            if (fileData.delta) fileData.delta_method = format.delta_method;

            return fileData;
        }
    }

    class RawAsset extends ModFile {
        get targetExtension() {
            return this.srcExtension;
        }
        get injectionPoint() {
            return `${path.join(this.srcPath, this.destFileName).replace(/\\/g, "/").toLowerCase()}.${this.targetExtension}`;
        }
        get extensionRule() {
            return null;
        }
        async buildFileData() {
            return {
                injectionPoint: this.injectionPoint,
                ogName: `${this.destFileName}.${this.targetExtension}`,
                mode: "pass",
                dataSource: await this.mod.resolveDataSource(path.join(this.srcPath, this.srcFile)),
                delta: false,
            };
        }
    }

    class ModAsset extends ModFile {
        get targetExtension() {
            return this.extensionRule ? this.extensionRule.target_extension : this.srcExtension;
        }

        get injectionPoint() {
            return `${path.join(this.srcPath, this.destFileName).replace(/\\/g, "/").toLowerCase()}.${this.targetExtension}`;
        }

        async buildFileData() {
            const extensionRule = this.extensionRule;

            return {
                injectionPoint: this.injectionPoint,
                ogName: `${this.destFileName}.${this.targetExtension}`,
                mode: (extensionRule && extensionRule.encrypt) ? extensionRule.encrypt : "pass",
                dataSource: await this.mod.resolveDataSource(path.join(this.srcPath, this.srcFile)),
                delta: false,
            };
        }

        get extensionRule() {
            return EXTENSION_RULES[this.srcExtension] || null;
        }
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
            this.imageDelta = [];
            this.priority = 0;
            this.start();
        }
        start() { }
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
                return files.map(a => { return { base: entry, file: a } });
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
                for (let fileDeclaration of patchedFiles) {
                    const modAsset = new ModAsset(this, fileDeclaration, null);

                    this.files.push(await modAsset.buildFileData());
                }
            }
        }

        async processRawV1(list) {
            for (let el of list) {
                let patchedFiles = await this.processListEntryV1(el);
                for (let fileDeclaration of patchedFiles) {
                    const modAsset = new RawAsset(this, fileDeclaration, null);

                    this.files.push(await modAsset.buildFileData());
                }
            }
        }

        async processDataRulesV1(rules) {
            let { jsonKeys, mountPoint, pluginList } = rules;
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
                let fileDeclarations = await this.processListEntryV1(entry);
                for (let fileDeclaration of fileDeclarations) {
                    try {
                        const modFile = new ModFile(this, fileDeclaration, rules);
                        if (!modFile.format) {
                            $modLoader.$log(`${this.json.id} + ${mountPoint} + ${entry} | ${modFile.srcFile} skipped, unknown extension`);
                            continue;
                        }

                        const fileData = await modFile.buildFileData();

                        if (doneEntries.has(fileData.injectionPoint)) {
                            $modLoader.$log(`${this.json.id} + ${mountPoint} + ${entry} | ${fileData.injectionPoint} can't be patched twice`);
                            continue;
                        }
                        doneEntries.add(fileData.injectionPoint);

                        if (pluginList) {
                            if (modFile.format.delta) {
                                this.pluginsDelta.push(fileData.injectionPoint);
                            } else {
                                this.plugins.push(fileData.injectionPoint);
                            }
                        }

                        this.files.push(fileData);
                    } catch (e) {
                        $modLoader.$log(`[WARN] Failed to resolve ${fileDeclaration.base} ${fileDeclaration.file} when processing ${this.json.id}`);
                        console.warn(e);
                    }
                }
            }
        }
        async processAsyncExecV1() {
            if (this.json.asyncExec) {
                for (let { file: file_name, runat } of this.json.asyncExec) {
                    let fileData = await _read_file(await this.resolveDataSource(file_name));
                    if (runat === "when_discovered") {
                        if (file_name.endsWith(".mjs")) {
                            $modLoader.$log("[ERROR] Cannot have ES Modules in when_discovered");
                            alert(`AsyncExec: Cannot use when_discovered with ESM, @${this.json.id}:${file_name}`);
                            continue;
                        }
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
                        if (file_name.endsWith(".mjs")) {
                            if (req) {
                                $modLoader.$log("[ERROR] Cannot have ES Modules with requre");
                                alert(`AsyncExec: Cannot use require with ESM, @${this.json.id}:${file_name}`);
                                continue;
                            }
                            let split = file_name.split("/");
                            let file = split.pop();
                            let mf = new ModFile(this, {
                                base: split.join("/"), file
                            }, {
                                formatMap: {
                                    "mjs": { target: "ks", delta: false, encrypt: false, parser: "esm_no_iife" }
                                }
                            });
                            let ds = await mf.resolveDataSource();
                            fileData = await _read_file(ds);
                            data = fileData.toString("utf-8");
                        }
                        $modLoader.$execScripts[runat].push({
                            data, req
                        });
                    }
                }
            }
        }

        async processImageDeltaEntry(target, file) {
            this.imageDelta.push({
                target,
                path: file,
                file: await this.resolveDataSource(file)
            });
        }

        async processImageDeltas() {
            if (this.json.image_deltas) {
                for (let { patch: target, with: file, dir } of this.json.image_deltas) {
                    if (!dir) await this.processImageDeltaEntry(target, file);
                    else {
                        let files = await this.filesInDir(file);
                        for (let f of files) {
                            await this.processImageDeltaEntry(
                                `${target}${f.replace(/\.olid$/, '.png')}`,
                                `${file}${f}`);
                        }
                    }
                }
            } else {
                $modLoader.$log(`${this.json.id} requested olid patching but no olid declarations were found`);
            }
        }

        async processV1Mod() {
            if (this.json._flags && this.json._flags.includes("package_json_editing")) {
                if (!this.json.packagejson_delta) {
                    $modLoader.$log("Are you high? You asked for package json editing and then didn't provide any deltas! Get a grip!");
                } else {
                    $modLoader.$packageJsonPatchset.push(...this.json.packagejson_delta);
                }
            }

            await this.processAsyncExecV1();
            if (this.json.files.assets) {
                await this.processAssetsV1(this.json.files.assets);
            }
            if (this.json.files.raw) {
                await this.processRawV1(this.json.files.raw);
            }
            await $modLoader.$runScripts("when_discovered_2", {
                mod: this
            });
            for (let rule of DATA_RULES) {
                await this.processDataRulesV1(rule);
            }
            console.log(this.json._flags);
            if (this.json._flags.includes("do_olid")) {
                await this.processImageDeltas();
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
        async mainInit() { }
        async readFile() { throw new Error("Unimplemented"); }
        async readDir() { throw new Error("Unimplemented"); }
        async isDir() { throw new Error("Unimplemented"); }
        async exists() { throw new Error("Unimplemented"); }
        async resolvePatchedEntry() { throw new Error("Unimplemented"); }
        async resolveDataSource() { throw new Error("Unimplemented"); }
        get type() { return "Unimplemented"; }
        get entry() { return {}; }
        async locateModJson(base = "/", crashOnFail = true) {
            try {
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
            } catch (e) {
                $modLoader.$log(e.message);
                if (crashOnFail) throw new Error("Unable to find mod.json");
                else return false;
            }
        }
        async readModJson() {
            let modJson = await this.readFile(path.join(this.rootPath, "mod.json"));
            modJson = modJson.toString("utf-8");
            try {
                modJson = JSON.parse(modJson);
            } catch (e) {
                throw new Error("Failed to decode mod.json");
            }
            if (!modJson.manifestVersion) modJson.manifestVersion = 1;
            if (!modJson._flags) modJson._flags = [];
            if (modJson.manifestVersion > MAX_MANIFEST_VERSION) throw new Error("ModLoader too old to load this mod");

            if (modJson.priority) this.priority = parseInt(modJson.priority) || 0;
            this.json = modJson;

            if (this.json.id === "oneloader") {
                $oneLoaderGui.setVersionNumber(this.json.version);
            }
        }
    }

    class ZipMod extends Mod {
        start() { this.sz = null; }
        async mainInit() {
            $modLoader.$log("Initializing a zip mod from " + this.basePath);
            this.fd = native_fs.openSync(this.basePath, "r");
            this.sz = new StreamZip.async({ fd: this.fd });
            let sym = Object.getOwnPropertySymbols(this.sz);
            sym = sym.filter(a => a.toString() === "Symbol(zip)");
            this.sz.resolvedStreamZip = await this.sz[sym[0]];
            this._entryCache = await this.sz.entries();
            this._rootsCache = new Set();
        }

        async readFile(sPath) {
            sPath = sPath.replace(/\\/g, "/");
            let e = this._resolveEntry(sPath);
            return await this.sz.entryData(e);
        }
        async readDir(sPath) {
            sPath = sPath.replace(/\\/g, "/");
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
            sPath = sPath.replace(/\\/g, "/");
            if (this._rootsCache.has(sPath)) {
                return true;
            }
            let e = this._resolveEntry(sPath);
            return !e.isFile;
        }
        exists(sPath) {
            sPath = sPath.replace(/\\/g, "/");
            try { this._resolveEntry(sPath); return true; } catch (e) { return false; }
        }
        _resolveEntry(sPath) {
            sPath = sPath.replace(/\\/g, "/");
            let cleanupRegexps = [/$^/, /^\//, /^\/|\/$/g, /\/$/];
            let addSlashRegexps = [/$^/, /^/, /$/, /^|$/g];
            $modLoader.$log("ZIPMOD, _resolveEntry: " + sPath)
            for (let a of cleanupRegexps) {
                for (let b of addSlashRegexps) {
                    let aa = new RegExp(a.source, a.flags);
                    let bb = new RegExp(b.source, b.flags);
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
                pluginsDelta: this.pluginsDelta,
                imageDelta: this.imageDelta,
                _raw: this
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
                path: path.join(this.basePath, this.rootPath, sPath)
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
                pluginsDelta: this.pluginsDelta,
                imageDelta: this.imageDelta,
                _raw: this
            };
        }
    }

    async function run() {
        $modLoader.$rollup = await window._loadRollup();

        if (!native_fs.existsSync(path.join(base, "mods"))) {
            native_fs.mkdirSync(path.join(base, "mods"));
        }

        let debasilificationCounter = 0;

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
                        $oneLoaderGui.setHt(`Undoing GOMORI-based patching ${debasilificationCounter}`);
                    }
                }
            }
        }

        // Initialize on-screen logging framework
        window._logLine("Loading configuration");
        $oneLoaderGui.pst("Loading...");
        if (!native_fs.existsSync(path.join(base, "save"))) {
            native_fs.mkdirSync(path.join(base, "save"));
        }
        if (!native_fs.existsSync(path.join(base, "save", "mods.json"))) {
            native_fs.writeFileSync(path.join(base, "save", "mods.json"), "{}"); // gomori compatibility, otherwise it would be elsewhere
        }



        $modLoader.config = JSON.parse(native_fs.readFileSync(path.join(base, "save", "mods.json"), "utf-8"));
        $modLoader.syncConfig = function () {
            native_fs.writeFileSync(path.join(base, "save", "mods.json"), JSON.stringify($modLoader.config, null, 2));
        }

        window._logLine("Inspecting mods");

        let mod_files = await async_fs.readdir(path.join(base, "mods"));
        window._logLine(mod_files.length + " entries in mods/");

        $oneLoaderGui.setPbCurr(0);
        $oneLoaderGui.setPbMax(mod_files.length);

        let errorCount = 0;
        let knownMods = new Map();

        let allMods = new Map();

        if ($modLoader.config._basilFiles) { //Debasilification procedure
            window._logLine("Gomori-derived mods.json detected, finding, restoring and removing basil files");
            try {
                await debasilify(base);
            } catch (e) { alert(e); }
            $modLoader.config._basilFiles = undefined;
            alert("The modloader tried its best to undo GOMORI-derived changes after an upgrade, however it could have missed something. For an optimal experience, it's advised to reinstall the game.");
            $modLoader.syncConfig();
        }

        $oneLoaderGui.setHt("Loading wasm");

        await wasm_bindgen("./modloader/lib/imagediff2_bg.wasm");

        $oneLoaderGui.setHt("Inspecting mods");

        for (let mod_file of mod_files) {
            $oneLoaderGui.pst("Early loading: " + mod_file);
            $oneLoaderGui.inc();

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
                if ($modLoader.config[mod.json.id] === false) {
                    if (!flags.includes("prevent_disable")) {
                        window._logLine("| Mod disabled, skipping");
                        continue;
                    }
                } else {
                    $modLoader.config[mod.json.id] = true;
                }

                mod.json._enabled = true;

                window._logLine("| Name: " + mod.json.name);
                window._logLine("| ID: " + mod.json.id);
                window._logLine("| Version: " + mod.json.version);
                window._logLine("| Description: " + mod.json.description);

                await mod.processMod();
                knownMods.set(mod.json.id, mod.entry);
            } catch (e) {
                window._logLine("| [ERROR] Catastrophic failure when processing " + mod_file + "! " + e.toString() + "\n" + e.stack);
                errorCount++;
            }
        }

        window._logLine("Checking for package.json changes");
        $oneLoaderPackageJsonPatchingSubsystem.ensureBackups();
        $oneLoaderPackageJsonPatchingSubsystem.apply($modLoader.$packageJsonPatchset);

        window._logLine("Early loading complete, starting loader stage 2");
        $modLoader.syncConfig();
        if (errorCount > 0) {
            alert("Early loading complete with " + errorCount + " errors. Please look into latest.log and searching for [ERROR] to identify what the erorrs were.");
        }

        // process require/exclude
        {
            let exclusions = new Map();
            let requirements = new Map();

            let satisfaction = new Map();
            let skipChecks = new Map();

            window._logLine("Starting compatiblity check block");

            for (let [id, { json }] of knownMods.entries()) {
                window._logLine("Performing satisfaction and skip check building for " + id);

                if (!satisfaction.has(id.toLowerCase())) {
                    satisfaction.set(id.toLowerCase(), []);
                }
                satisfaction.get(id.toLowerCase()).push(json.name);
                if (json.satisfies) {
                    for (let s of json.satisfies) {
                        if (!satisfaction.has(s.toLowerCase())) {
                            satisfaction.set(s.toLowerCase(), []);
                        }
                        satisfaction.get(s.toLowerCase()).push(json.name);
                    }
                }

                if (json.skip_checks) {
                    for (let victimMod in json.skip_checks) {
                        if (!skipChecks.has(victimMod.toLowerCase()))
                            skipChecks.set(victimMod.toLowerCase(), new Set());

                        for (let skippable of json.skip_checks[victimMod])
                            skipChecks.get(victimMod.toLowerCase()).add(skippable.toLowerCase());
                    }
                }
            }

            window._logLine("Satisfaction: " + JSON.stringify(Array.from(satisfaction.entries())));
            window._logLine("SkipChecks: " + JSON.stringify(Array.from(skipChecks.entries())));

            for (let mod of knownMods.values()) {

                window._logLine("Starting real building of exclusion and inclusion maps. Mod: " + mod.json.id);
                if (!skipChecks.has(mod.json.id.toLowerCase()))
                    skipChecks.set(mod.json.id.toLowerCase(), new Set());

                let skips = /* skipChecks.get(mod.json.id.toLowerCase()); */ new Set();
                for (let a of skipChecks.get(mod.json.id.toLowerCase())) {
                    skips.add(a);
                }
                if (mod.json.satisfies) {
                    for (let innerSatisfaction of mod.json.satisfies) {
                        if (!skipChecks.has(innerSatisfaction.toLowerCase()))
                            skipChecks.set(innerSatisfaction.toLowerCase(), new Set());

                        for (let a of skipChecks.get(innerSatisfaction.toLowerCase())) {
                            skips.add(a);
                        }
                    }
                }

                window._logLine("Skips for " + mod.json.id + " are: " + JSON.stringify(Array.from(skips)));

                if (mod.json.excludes) {
                    window._logLine("This mod has excludes");
                    for (let exclude of mod.json.excludes) {
                        window._logLine("Now processing " + exclude);
                        if (skips.has(exclude.toLowerCase())) continue;
                        window._logLine("Not skipped");
                        if (exclusions.has(exclude.toLowerCase())) {
                            exclusions.get(exclude.toLowerCase()).push(mod.json.name);
                        } else {
                            exclusions.set(exclude.toLowerCase(), [mod.json.name]);
                        }
                    }
                }
                if (mod.json.requires) {
                    window._logLine("This mod has requirements");
                    for (let req of mod.json.requires) {
                        window._logLine("Now processing " + req);
                        if (skips.has(req.toLowerCase())) continue;
                        window._logLine("Not skipped");
                        if (requirements.has(req.toLowerCase())) {
                            requirements.get(req.toLowerCase()).push(mod.json.name);
                        } else {
                            requirements.set(req.toLowerCase(), [mod.json.name]);
                        }
                    }
                }
            }

            window._logLine("Exclusions: " + JSON.stringify(Array.from(exclusions.entries())));
            window._logLine("Rquirements: " + JSON.stringify(Array.from(requirements.entries())));

            let exclusionFailures = [];
            let requirementFailures = [];

            for (let [key, value] of exclusions.entries()) {
                if (satisfaction.has(key)) {
                    exclusionFailures.push(`${satisfaction.get(key).join(", ")} ${satisfaction.get(key).length > 1 ? "are" : "is"} excluded by ${value.join(", ")}`);
                }
            }

            for (let [key, value] of requirements.entries()) {
                if (!satisfaction.has(key)) {
                    requirementFailures.push(`${value.join(", ")} require${value.length === 1 ? "s" : ""} ${key} but it's not installed.`);
                }
            }

            console.log(exclusionFailures, requirementFailures);
            console.log(exclusions, requirements);

            window._logLine("Exclusion failures: " + JSON.stringify(exclusionFailures));
            window._logLine("Requirement failures: " + JSON.stringify(requirementFailures));

            let message = "Some issues occured while checking mod requirements:\n";
            let fucked = false;
            if (exclusionFailures.length > 0) {
                message = message + "\n" + exclusionFailures.map(a => "- " + a).join("\n");
                fucked = true;
            }
            if (requirementFailures.length > 0) {
                message = message + "\n" + requirementFailures.map(a => "- " + a).join("\n");
                fucked = true;
            }


            if (fucked) {
                message = message + "\n\nAs a result, we will try to start the game in safe mode, with no mods loaded.";
                alert(message);
                window._logLine("The user is dumb and has mod conflicts. Everyone point and laugh. Anyway, we have to do the whole safe mode shit.");
                _start_game();
                return;
            }

            window._logLine("Ending compatiblity check block");
        }
        // end process require/exclude

        await _modloader_stage2(knownMods);

        window._logLine("Creating GOMORI API backwards compatibility");
        let _gomori_compat_mods = new Map();
        $modLoader.knownMods = knownMods;
        $modLoader.allMods = allMods;


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

        await $modLoader.$runScripts("pre_game_start", {});

        await _start_game();
    };

    run().catch(e => {
        alert("A catastrophic failure occured while loading the modloader. The game will attempt to start in safe mode, although it may be unstable. If this persists, report the issue on github. You can also try starting the game with the --no-mods launch argument.\n" + e.stack);
        _start_game();
    });
})();
