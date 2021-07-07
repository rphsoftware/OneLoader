const { config } = require('process');

(async function run() {
    const StreamZip = require('./modloader/node_stream_zip.js');
    const MAX_MANIFEST_VERSION = 1;
    window._logLine("-=-=-= Early loader =-=-=-");
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

    let key = window.nw.App.argv[0];
    window.realArgv = window.nw.App.argv;
    window.nw.App = new Proxy(window.nw.App, {
        get(t, p, r) {
            if (p === "argv") {
                return [key];
            } else {
                return Reflect.get(...arguments);
            }
        }
    });

    function randomString() {
        return crypto.randomBytes(128).toString("hex");
    }

    if (!native_fs.existsSync(path.join(base, "mods"))) {
        native_fs.mkdirSync(path.join(base, "mods"));
    }

    if (realArgv.includes("--no-mods") || !native_fs.existsSync(path.join(base, "mods"))) {

        window._logLine("Starting game with mods disabled");
        await _start_game();
        return;
    }
    try {

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
    ]


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

    function escapeRegex(input) {
        return input.replace(/[[\](){}?*+^$\\.|]/g, '\\$&');
    }

    async function zipDirContents(sz, path) {
        let entries = await sz.entries();
        let results = [];
        if (!path.endsWith("/")) path = path + "/";
        for (const entry of Object.values(entries)) {
            let pathMatcher = new RegExp(
                "^/*" +
                escapeRegex(path) +
                "[^/]+$"
            );
            if (pathMatcher.test(entry.name)) {
                results.push(entry);
            }
        }

        return results;
    }

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
        if (mod_stats.isDirectory()) {
            window._logLine("| Directory mode");
            if (!native_fs.existsSync(path.join(base, "mods", mod_file, "mod.json"))) {
                window._logLine("| [ERROR] Skipping, mod.json missing");
                errorCount++;
                continue;
            }
            let modJson;
            try {
                modJson = await async_fs.readFile(path.join(base, "mods", mod_file, "mod.json"));
                modJson = JSON.parse(modJson.toString("utf-8"));
            } catch(e) {
                window._logLine("| [ERROR] Unable to read mod.json: " + e.toString());
                errorCount++;
                continue;
            }

            if (modJson.files.exec && modJson.files.exec.length > 0) {
                alert(modJson.id + " makes use of exec. That feature is unsupported and the mod WILL NOT be loaded.");
                continue;
            }

            if (knownMods.has(modJson.id)) {
                window._logLine("| [ERROR] Unable to load " + mod_file + ", Duplicate ID");
                errorCount++;
                continue;
            }

            allMods.set(modJson.id, modJson);
            let flags = modJson._flags || [];
            if (config[modJson.id] === false) {
                if (!flags.includes("prevent_disable")) {
                    window._logLine("| Mod disabled, skipping");
                    continue;
                }
            } else {
                config[modJson.id] = true;
            }

            if (!modJson.manifestVersion) modJson.manifestVersion = 1;
            if (modJson.manifestVersion > MAX_MANIFEST_VERSION) {
                window._logLine("| [ERROR] Unable to load " + mod_file + ", Mod Loader out of date!");
                errorCount++;
                continue;
            }
            modJson._enabled = true;

            window._logLine("| Name: " + modJson.name);
            window._logLine("| ID: " + modJson.id);
            window._logLine("| Version: " + modJson.version);
            window._logLine("| Description: " + modJson.description);

            let modEntry = {
                type: "dir",
                directory: path.join(base, "mods", mod_file),
                json: modJson,
                files: [],
                plugins: [],
                pluginsDelta: []
            };
            if (modJson.files.assets) {
                window._logLine("| Loading assets");
                for (let entry of modJson.files.assets) {
                    entry = entry.replace(/^[\/|\\]+/g, "");
                    window._logLine("| | " + entry);
                    if (entry.endsWith("/")) {
                        window._logLine("| | | Directory, subpatch required");
                        let directory_contents = await async_fs.readdir(path.join(modEntry.directory, entry));
                        window._logLine("| | | " + directory_contents.length + " entries!");
                        for (let file of directory_contents) {
                            let fullPath = path.join(modEntry.directory, entry, file);
                            if ((await async_fs.stat(fullPath)).isDirectory()) continue;
                            let ogName = file;
                            let injectionPoint = path.join(entry, file).toLowerCase();
                            let extension = injectionPoint.match(/[\/|\\][^\/\\]*\.([^\.]*$)/)[1];
                            if (EXTENSION_RULES[extension] && EXTENSION_RULES[extension].target_extension) {
                                injectionPoint = injectionPoint.replace(new RegExp(
                                    extension + "$"
                                ), EXTENSION_RULES[extension].target_extension);
                                ogName = ogName.replace(new RegExp(
                                    extension + "$",
                                    "i"
                                ), EXTENSION_RULES[extension].target_extension);
                            }

                            let fileData = {
                                injectionPoint,
                                ogName,
                                mode: (EXTENSION_RULES[extension] && EXTENSION_RULES[extension].encrypt) ? EXTENSION_RULES[extension].encrypt : "pass",
                                dataSource: {
                                    type: "filesystem",
                                    path: fullPath
                                },
                                delta: false
                            };
                            modEntry.files.push(fileData);
                        }
                    } else {
                        let ogName = entry.match(/[^\/\\]*$/)[0];
                        let fullPath = path.join(modEntry.directory, entry);
                        let injectionPoint = entry.toLowerCase();
                        let extension = injectionPoint.match(/[\/|\\][^\/\\]*\.([^\.]*$)/)[1];
                        if (EXTENSION_RULES[extension] && EXTENSION_RULES[extension].target_extension) {
                            injectionPoint = injectionPoint.replace(new RegExp(
                                extension + "$"
                            ), EXTENSION_RULES[extension].target_extension);
                            ogName = ogName.replace(new RegExp(
                                extension + "$",
                                "i"
                            ), EXTENSION_RULES[extension].target_extension);
                        }
                        let fileData = {
                            injectionPoint,
                            ogName,
                            mode: (EXTENSION_RULES[extension] && EXTENSION_RULES[extension].encrypt) ? EXTENSION_RULES[extension].encrypt : "pass",
                            dataSource: {
                                type: "filesystem",
                                path: fullPath
                            },
                            delta: false
                        };
                        modEntry.files.push(fileData);
                    }
                }
            }

            window._logLine("| Processing patching rules");
            let thisModPatched = new Set();
            for (let {jsonKeys, formatMap, mountPoint, pluginList} of DATA_RULES) { for (let jsonKey of jsonKeys) {
                if (modJson.files[jsonKey]) {
                    let thisKey = modJson.files[jsonKey];
                    window._logLine("| | Processing JSON key: " + jsonKey + " ( " + thisKey.length + " elements )");
                    for (let entry of thisKey) {
                        if (entry.endsWith("/")) { // directory handling
                            window._logLine("| | | Directory, subpatch required");
                            let directory_contents = await async_fs.readdir(path.join(modEntry.directory, entry));
                            window._logLine("| | | " + directory_contents.length + " entries!");
                            for (let file of directory_contents) {
                                let fullPath = path.join(modEntry.directory, entry, file);
                                if ((await async_fs.stat(fullPath)).isDirectory()) continue;
                                let ogName = fullPath.match(/[^\/\\]*$/)[0];
                                let fileName = fullPath.match(/[^\/\\]*$/)[0].toLowerCase();
                                let extension = fileName.match(/.+\.([^\.]*)$/)[1];
                                if (pluginList && flags.includes("randomize_plugin_name")) {
                                    fileName = randomString() + "." + extension;
                                    ogName = randomString() + "." + extension;
                                }
                                if (formatMap[extension]) {
                                    let fileData = {
                                        injectionPoint: mountPoint + "/" + fileName.replace(
                                            new RegExp(extension + "$"),
                                            formatMap[extension].target
                                        ),
                                        ogName: ogName.replace(
                                            new RegExp(extension + "$", "i"),
                                            formatMap[extension].target
                                        ),
                                        mode: formatMap[extension].encrypt ? "steam" : "pass",
                                        dataSource: {
                                            type: "filesystem",
                                            path: fullPath
                                        },
                                        delta: formatMap[extension].delta
                                    };
                                    if (fileData.delta) {
                                        fileData.delta_method = formatMap[extension].delta_method;
                                    }
                                    if (thisModPatched.has(fileData.injectionPoint)) {
                                        window._logLine("| | | [WARNING] Skipping inclusion of: " + jsonKey + "/" + entry + ": Duplicate");
                                        continue;
                                    }
                                    thisModPatched.add(fileData.injectionPoint);
                                    if (pluginList) {
                                        if ( formatMap[extension].delta) {
                                            modEntry.pluginsDelta.push(fileData.injectionPoint);
                                        } else {
                                            modEntry.plugins.push(fileData.injectionPoint);
                                        }
                                    }
                                    modEntry.files.push(fileData);
                                } else {
                                    window._logLine("| | | [WARNING] Skipping inclusion of: " + jsonKey + "/" + entry + ": Invalid extension");
                                    continue;
                                }
                            }
                        } else {
                            let fullPath = path.join(modEntry.directory, entry);
                            let ogName = fullPath.match(/[^\/\\]*$/)[0];
                            let fileName = fullPath.match(/[^\/\\]*$/)[0].toLowerCase();
                            let extension = fileName.match(/.+\.([^\.]*)$/)[1];
                            if (pluginList && flags.includes("randomize_plugin_name")) {
                                fileName = randomString() + "." + extension;
                                ogName = randomString() + "." + extension;
                            }
                            if (formatMap[extension]) {
                                let fileData = {
                                    injectionPoint: mountPoint + "/" + fileName.replace(
                                        new RegExp(extension + "$"),
                                        formatMap[extension].target
                                    ),
                                    ogName: ogName.replace(
                                            new RegExp(extension + "$", "i"),
                                            formatMap[extension].target
                                    ),
                                    mode: formatMap[extension].encrypt ? "steam" : "pass",
                                    dataSource: {
                                        type: "filesystem",
                                        path: fullPath
                                    },
                                    delta: formatMap[extension].delta
                                };
                                if (fileData.delta) {
                                    fileData.delta_method = formatMap[extension].delta_method;
                                }
                                if (thisModPatched.has(fileData.injectionPoint)) {
                                    window._logLine("| | | [WARNING] Skipping inclusion of: " + jsonKey + "/" + entry + ": Duplicate");
                                    continue;
                                }
                                thisModPatched.add(fileData.injectionPoint);
                                if (pluginList) {
                                    if ( formatMap[extension].delta) {
                                        modEntry.pluginsDelta.push(fileData.injectionPoint);
                                    } else {
                                        modEntry.plugins.push(fileData.injectionPoint);
                                    }
                                }
                                modEntry.files.push(fileData);
                            } else {
                                window._logLine("| | | [WARNING] Skipping inclusion of: " + jsonKey + "/" + entry + ": Invalid extension");
                                continue;
                            }
                        }
                    }
                }
            }}

            knownMods.set(modJson.id, modEntry);
        } else {
            if (!mod_file.endsWith(".zip")) {
                window._logLine("| [ERROR] Skipping, not directory and extension isn't zip");
                errorCount++;
                continue;
            }
            window._logLine("| Zip mode");
            window._logLine("| Opening a persistent file descriptor");
            let fd = native_fs.openSync(path.join(base, "mods", mod_file), "r");
            let sz = new StreamZip.async({fd});
            let entries = await sz.entries();
            let entryMap = new Map();

            sz.resolvedStreamZip = await sz[Object.getOwnPropertySymbols(sz)[0]];

            window._logLine("| Looking for a 1 directory deep mod.json file");
            
            let folderBase = null;
            for (const entry of Object.values(entries)) {
                let ens = entry.name.split("/");
                entryMap.set(entry.name, entry);
                if (ens.length === 2 && (/^mod\.json$/g).test(ens[1])) {
                    folderBase = ens[0];
                    break;
                }
            }
            
            if (!folderBase) {
                window._logLine("| [ERROR] Skipping, unable to locate mod.json");
                errorCount++;
                continue;
            }
            window._logLine("| Loading from " + mod_file + ":" + folderBase + "/");

            let modJson;
            try {
                modJson = await sz.entryData(folderBase + "/mod.json");
                modJson = JSON.parse(modJson.toString("utf-8"));
            } catch(e) {
                window._logLine("| [ERROR] Unable to read mod.json: " + e.toString());
                errorCount++;
                continue;
            }

            if (modJson.files.exec && modJson.files.exec.length > 0) {
                alert(modJson.id + " makes use of exec. That feature is unsupported and the mod WILL NOT be loaded.");
                continue;

            }

            if (knownMods.has(modJson.id)) {
                window._logLine("| [ERROR] Unable to load " + mod_file + ", Duplicate ID");
                errorCount++;
                continue;
            }

            allMods.set(modJson.id, modJson);
            let flags = modJson._flags || [];
            if (config[modJson.id] === false) {
                if (!flags.includes("prevent_disable")) {
                    window._logLine("| Mod disabled, skipping");
                    continue;
                }
            } else {
                config[modJson.id] = true;
            }

            modJson._enabled = true;

            if (!modJson.manifestVersion) modJson.manifestVersion = 1;
            if (modJson.manifestVersion > MAX_MANIFEST_VERSION) {
                window._logLine("| [ERROR] Unable to load " + mod_file + ", Mod Loader out of date!");
                errorCount++;
                continue;
            }
            window._logLine("| Name: " + modJson.name);
            window._logLine("| ID: " + modJson.id);
            window._logLine("| Version: " + modJson.version);
            window._logLine("| Description: " + modJson.description);



            let modEntry = {
                type: "zip",
                fd,
                zipInstance: sz,
                json: modJson,
                files: [],
                plugins: [],
                pluginsDelta: []
            };

            // first handle assets, they are the easiest
            if (modJson.files.assets) {
                window._logLine("| Loading assets");
                for (let entry of modJson.files.assets) {
                    entry = entry.replace(/^[\/|\\]+/g, "");
                    window._logLine("| | " + entry);
                    if (entry.endsWith("/")) {
                        window._logLine("| | | Directory, subpatch required");
                        let entries = await zipDirContents(sz, folderBase + "/" + entry);
                        window._logLine("| | | " + entries.length + " entries!");
                        for (let dirEntry of entries) {
                            let fullZipPath = dirEntry.name;
                            let ogName = fullZipPath.match(/[^\/\\]*$/)[0];
                            let extension = fullZipPath.match(/[\/|\\][^\/\\]*\.([^\.]*$)/)[1].toLowerCase();
                            let injectionPoint = entry + fullZipPath.split("/")[fullZipPath.split("/").length - 1];
                            injectionPoint = injectionPoint.toLowerCase();

                            if (EXTENSION_RULES[extension] && EXTENSION_RULES[extension].target_extension) {
                                injectionPoint = injectionPoint.replace(new RegExp(
                                    extension + "$"
                                ), EXTENSION_RULES[extension].target_extension);
                                ogName = ogName.replace(new RegExp(
                                    extension + "$", "i"
                                ), EXTENSION_RULES[extension].target_extension);
                            }

                            let fileData = {
                                injectionPoint,
                                ogName,
                                mode: (EXTENSION_RULES[extension] && EXTENSION_RULES[extension].encrypt) ? EXTENSION_RULES[extension].encrypt : "pass",
                                dataSource: {
                                    type: "zip",
                                    entry: dirEntry,
                                    sz
                                },
                                delta: false
                            };
                            modEntry.files.push(fileData);
                        }
                    } else {
                        let fullZipPath = folderBase + "/" + entry;
                        let ogName = fullZipPath.match(/[^\/\\]*$/)[0];
                        let dirEntry = await sz.entry(fullZipPath);
                        let extension = fullZipPath.match(/[\/|\\][^\/\\]*\.([^\.]*$)/)[1].toLowerCase();
                        let injectionPoint = entry + fullZipPath.split(/[\/|\\]/)[fullZipPath.split(/[\/|\\]/).length - 1];
                        injectionPoint = injectionPoint.toLowerCase();

                        if (EXTENSION_RULES[extension] && EXTENSION_RULES[extension].target_extension) {
                            injectionPoint = injectionPoint.replace(new RegExp(
                                extension + "$"
                            ), EXTENSION_RULES[extension].target_extension);
                            ogName = ogName.replace(new RegExp(
                                extension + "$", "i"
                            ), EXTENSION_RULES[extension].target_extension);
                        }

                        let fileData = {
                            injectionPoint,
                            ogName,
                            mode: (EXTENSION_RULES[extension] && EXTENSION_RULES[extension].encrypt) ? EXTENSION_RULES[extension].encrypt : "pass",
                            dataSource: {
                                type: "zip",
                                entry: dirEntry,
                                sz
                            },
                            delta: false
                        };
                        modEntry.files.push(fileData);
                    }
                }
            }

            window._logLine("| Processing patching rules");
            let thisModPatched = new Set();
            for (let {jsonKeys, formatMap, mountPoint, pluginList} of DATA_RULES) { for (let jsonKey of jsonKeys) {
                if (modJson.files[jsonKey]) {
                    let thisKey = modJson.files[jsonKey];
                    window._logLine("| | Processing JSON key: " + jsonKey + " ( " + thisKey.length + " elements )");
                    for (let entry of thisKey) {
                        if (entry.endsWith("/")) { // directory handling
                            window._logLine("| | | Directory, subpatch required");
                            let directory_contents = await zipDirContents(sz, folderBase + "/" + entry);
                            window._logLine("| | | " + directory_contents.length + " entries!");
                            for (let dirEntry of directory_contents) {
                                let fullZipPath = dirEntry.name;
                                let ogName = fullZipPath.match(/[^\/\\]*$/)[0];
                                let fileName = fullZipPath.match(/[^\/\\]*$/)[0].toLowerCase();
                                let extension = fileName.match(/.+\.([^\.]*)$/)[1];
                                if (pluginList && flags.includes("randomize_plugin_name")) {
                                    fileName = randomString() + "." + extension;
                                    ogName = randomString() + "." + extension;
                                }
                                if (formatMap[extension]) {
                                    let fileData = {
                                        injectionPoint: mountPoint + "/" + fileName.replace(
                                            new RegExp(extension + "$"),
                                            formatMap[extension].target
                                        ),
                                        ogName: ogName.replace(
                                            new RegExp(extension + "$", "i"),
                                            formatMap[extension].target
                                        ),
                                        mode: formatMap[extension].encrypt ? "steam" : "pass",
                                        dataSource: {
                                            type: "zip",
                                            entry: dirEntry,
                                            sz
                                        },
                                        delta: formatMap[extension].delta
                                    };
                                    if (fileData.delta) {
                                        fileData.delta_method = formatMap[extension].delta_method;
                                    }
                                    if (thisModPatched.has(fileData.injectionPoint)) {
                                        window._logLine("| | | [WARNING] Skipping inclusion of: " + jsonKey + "/" + dirEntry.name + ": Duplicate");
                                        continue;
                                    }
                                    thisModPatched.add(fileData.injectionPoint);
                                    if (pluginList) {
                                        if ( formatMap[extension].delta) {
                                            modEntry.pluginsDelta.push(fileData.injectionPoint);
                                        } else {
                                            modEntry.plugins.push(fileData.injectionPoint);
                                        }
                                    }
                                    modEntry.files.push(fileData);
                                } else {
                                    window._logLine("| | | [WARNING] Skipping inclusion of: " + jsonKey + "/" + dirEntry.name + ": Invalid extension");
                                    continue;
                                }
                            }
                        } else {
                            let fullZipPath = folderBase + "/" + entry;
                            let ogName = fullZipPath.match(/[^\/\\]*$/)[0];
                            let dirEntry = await sz.entry(fullZipPath);
                            let fileName = fullZipPath.match(/[^\/\\]*$/)[0].toLowerCase();
                            let extension = fileName.match(/.+\.([^\.]*)$/)[1];
                            if (pluginList && flags.includes("randomize_plugin_name")) {
                                fileName = randomString() + "." + extension;
                                ogName = randomString() + "." + extension;
                            }
                            if (formatMap[extension]) {
                                let fileData = {
                                    injectionPoint: mountPoint + "/" + fileName.replace(
                                        new RegExp(extension + "$"),
                                        formatMap[extension].target
                                    ),
                                    ogName: ogName.replace(
                                        new RegExp(extension + "$", "i"),
                                        formatMap[extension].target
                                    ),
                                    mode: formatMap[extension].encrypt ? "steam" : "pass",
                                    dataSource: {
                                        type: "zip",
                                        entry: dirEntry,
                                        sz
                                    },
                                    delta: formatMap[extension].delta
                                };
                                if (fileData.delta) {
                                    fileData.delta_method = formatMap[extension].delta_method;
                                }
                                if (thisModPatched.has(fileData.injectionPoint)) {
                                    window._logLine("| | | [WARNING] Skipping inclusion of: " + jsonKey + "/" + dirEntry.name + ": Duplicate");
                                    continue;
                                }
                                thisModPatched.add(fileData.injectionPoint);
                                if (pluginList) {
                                    if ( formatMap[extension].delta) {
                                        modEntry.pluginsDelta.push(fileData.injectionPoint);
                                    } else {
                                        modEntry.plugins.push(fileData.injectionPoint);
                                    }
                                }
                                modEntry.files.push(fileData);
                            } else {
                                window._logLine("| | | [WARNING] Skipping inclusion of: " + jsonKey + "/" + dirEntry.name + ": Invalid extension");
                                continue;
                            }
                        }
                    }
                }
            }}

            if (modJson.files.plugins) {
                window._logLine("| Processing plugins");

            }

            knownMods.set(modJson.id, modEntry);
        }
        } catch(e) {
            window._logLine("| [ERROR] Catastrophic failure when processing " + mod_file + "! " + e.toString());
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
            meta: mod.json
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

    if (window.realArgv.includes("--dump-overlay")) {
        if (confirm("Are you sure you want to dump the ENTIRE OVERLAYFS TO DISK? This may take a non-trivial amount of time and WILL cause disk writes.")) {
            await window._dump_overlay_fs_to_disk();
        }
    }

    window._logLine("Starting game");
    await _start_game();
    } catch(e) {
        alert("Catastrophic failure while loading the modloader. The game will attempt to start in safe mode. Please send this error report to the mod loader developers.\n" + e.stack);
        _start_game();
    }
})();