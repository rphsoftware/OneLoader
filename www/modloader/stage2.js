function _safe_prompt(option1, option2, message) {
    let container = document.createElement("div");

    container.style = "position: fixed; margin: 0; font-family: sans-serif; color: white; top: 0; left: 0; bottom: 0; right: 0; background: #000e; z-index: 5; display: flex; align-items: center; justify-content: center; flex-direction: column;";

    let prompt = document.createElement("h1");
    prompt.innerText = message;
    prompt.style = "margin: 0; font-size: 16px; text-align: center;"

    let opt1btn = document.createElement("a");
    opt1btn.style = "padding: 8px 16px; margin-top: 16px; cursor: pointer; background: hsl(200, 85%, 35%); color: white; font-size: 16px;";
    opt1btn.innerText = option1;

    let opt2btn = document.createElement("a");
    opt2btn.style = "padding: 8px 16px; margin-top: 16px; cursor: pointer; background: hsl(200, 85%, 35%); color: white; font-size: 16px;";
    opt2btn.innerText = option2;

    container.appendChild(prompt);
    container.appendChild(opt1btn);
    container.appendChild(opt2btn);
    document.body.appendChild(container);

    return new Promise(resolve => {
        opt1btn.addEventListener("click", function () {
            prompt.remove();
            opt1btn.remove();
            opt2btn.remove();
            container.remove();

            resolve(1);
        });
        opt2btn.addEventListener("click", function () {
            prompt.remove();
            opt1btn.remove();
            opt2btn.remove();
            container.remove();

            resolve(2);
        });
    });
}

async function _modloader_stage2(knownMods) {
    const native_fs = require('fs');
    const util = require('util');
    const async_fs = { // old node polyfill bruh
        readdir: util.promisify(native_fs.readdir),
        readFile: util.promisify(native_fs.readFile),
        stat: util.promisify(native_fs.stat)
    };
    const path = require('path');
    const base = path.dirname(process.mainModule.filename);
    const zlib = require('zlib');
    const deflate = util.promisify(zlib.deflate);
    const rafResolve = () => new Promise(resolve => requestAnimationFrame(resolve));
    const yaml = require('./js/libs/js-yaml-master');

    await $modLoader.$runScripts("pre_stage_2", {
        knownMods, $modLoader
    });

    let sortedMods = Array.from(knownMods).sort((a, b) => (a[1]._raw.priority - b[1]._raw.priority)).map(a => a[1]);
    console.log(sortedMods);

    const PROTECTED_FILES = [
        "js/libs/pixi.js",
        "js/libs/pixi-tilemap.js",
        "js/libs/pixi-picture.js",
        "js/libs/lz-string.js",
        "js/libs/iphone-inline-video.browser.js",
        "js/rpg_core.js",
        "js/rpg_managers.js",
        "js/rpg_objects.js",
        "js/rpg_scenes.js",
        "js/rpg_sprites.js",
        "js/rpg_windows.js",
        "js/plugins.js",
        "modloader/early_loader.js",
        "modloader/logging.js",
        "modloader/lib/node_stream_zip.js",
        "modloader/stage2.js",
        "js/main.js",
    ];

    $oneLoaderGui.setHt("Normalizing paths");
    $oneLoaderGui.setPbMax(knownMods.size);
    $oneLoaderGui.setPbCurr(0);

    window._logLine("Normalizing injection paths");
    sortedMods.forEach(function (v) {
        $oneLoaderGui.inc();
        for (let file of v.files) {
            file.injectionPoint = file.injectionPoint.replace(/\\/g, "/");
            file.injectionPoint = file.injectionPoint.replace(/^\/+/, "");
            file.injectionPoint = file.injectionPoint.toLowerCase();
        }
    });

    window._logLine("Looking for conflicted files");

    $oneLoaderGui.setHt("Looking for conflicted files");

    let conflictFiles = new Map();
    let deltaFiles = new Map();

    sortedMods.forEach(function (v) {
        let nf = [];
        for (let file of v.files) {
            if (PROTECTED_FILES.includes(file.injectionPoint)) {
                window._logLine("IGNORING " + file.injectionPoint + " BECAUSE IT'S PROTECTED.");
            }
            nf.push(file);
        }
        v.files = nf;
        for (let file of v.files) {
            if (!file.ogName) {
                throw new Error("An error occured during early loading. Please report the error to Rph. Error Code: NO_OG_NAME");
            }
            if (file.delta) {
                if (deltaFiles.has(file.injectionPoint)) {
                    deltaFiles.get(file.injectionPoint).push({
                        mod: v,
                        file
                    });
                } else {
                    deltaFiles.set(file.injectionPoint, [{
                        mod: v,
                        file
                    }]);
                }
                if (conflictFiles.has(file.injectionPoint)) {
                    conflictFiles.get(file.injectionPoint).push({
                        delta: true
                    });
                } else {
                    conflictFiles.set(file.injectionPoint, [{
                        delta: true
                    }]);
                }
            } else {
                if (conflictFiles.has(file.injectionPoint)) {
                    conflictFiles.get(file.injectionPoint).push({
                        mod: v,
                        file,
                        delta: false
                    });
                } else {
                    conflictFiles.set(file.injectionPoint, [{
                        mod: v,
                        file,
                        delta: false
                    }]);
                }
            }
        }
    });

    $oneLoaderGui.setHt("Resolving conflicts");

    if (!$modLoader.config._conflictResolutions) {
        $modLoader.config._conflictResolutions = {};
    }

    if (!$modLoader.config._deltaPreference) {
        $modLoader.config._deltaPreference = {};
    }

    for (let k of conflictFiles.keys()) {
        let newArray = [];
        let hadDelta = false;
        for (let a of conflictFiles.get(k)) {
            if (a.delta) hadDelta = true;
            else newArray.push(a);
        }

        conflictFiles.set(k, newArray);
        if (newArray.length === 0) {
            conflictFiles.delete(k);
        }
    }

    for (let k of conflictFiles.keys()) {
        let e = conflictFiles.get(k);

        while (e.length > 1) {
            let m0 = e[0].mod.json.id;
            let m1 = e[1].mod.json.id;

            let crid = `${m0}\u0000${m1}`;
            if ($modLoader.config._conflictResolutions[crid]) {
                if ($modLoader.config._conflictResolutions[crid] === 2) { // prefer second?
                    e.splice(0, 1); // remove first
                } else { // prefer first?
                    e.splice(1, 1); // remove second
                }
            } else {
                $modLoader.config._conflictResolutions[crid] = await _safe_prompt(
                    e[0].mod.json.name,
                    e[1].mod.json.name,
                    "The following mods alter some of the same files. Which mod would you like to prioritize?"
                );
            }
        }
    }

    $modLoader.syncConfig();

    for (let k of deltaFiles.keys()) {
        if (conflictFiles.has(k)) {
            // well we have to deal with that shit now, so hey
            let crid = `${conflictFiles.get(k)[0].mod.json.id}\u0000\u0001\u0000${deltaFiles.get(k).map(a => a.mod.json.id).join("\u0000")}`;
            if ($modLoader.config._deltaPreference[crid]) {
                if ($modLoader.config._deltaPreference[crid] === 1) {
                    deltaFiles.delete(k);
                } else {
                    conflictFiles.delete(k);
                }
            } else {
                $modLoader.config._deltaPreference[crid] = await _safe_prompt(
                    conflictFiles.get(k)[0].mod.json.name,
                    "Deltas from: " + deltaFiles.get(k).map(a => a.mod.json.name).join(", "),
                    "There is a file which can either be delta patched by 1 or more mods (" + deltaFiles.get(k).map(a => a.mod.json.name).join(", ") + ") or entirely replaced by " + conflictFiles.get(k)[0].mod.json.name + ". Which do you prefer?"
                );;
                if ($modLoader.config._deltaPreference[crid] === 1) {
                    deltaFiles.delete(k);
                } else {
                    conflictFiles.delete(k);
                }
            }
        }
    }

    $modLoader.syncConfig();

    window._logLine("Building overlayFS image");

    $oneLoaderGui.setHt("Building base overlay");
    $oneLoaderGui.setPbMax(conflictFiles.size);
    $oneLoaderGui.setPbCurr(0);

    let overlayFS = {};


    for (let k of conflictFiles.keys()) {
        $oneLoaderGui.inc();
        let file = conflictFiles.get(k)[0].file;
        if ($oneLoaderGui.pbCurr % 500 === 0) await rafResolve();

        let oDeep = _ensure_overlay_path(overlayFS, file.injectionPoint);
        let bruh = _overlay_fs_split_path(file.injectionPoint);
        let lastFile = bruh[bruh.length - 1];
        oDeep[lastFile] = file;
    }

    window._logLine("Applying delta patches");

    $oneLoaderGui.setHt("Delta patching");
    $oneLoaderGui.setPbMax(deltaFiles.size);
    $oneLoaderGui.setPbCurr(0);

    let deltaSkip = [];
    for (let k of deltaFiles.keys()) {
        $oneLoaderGui.inc();
        try {
            window._logLine("Delta patching: " + k);
            window._logLine("| Reading base from the game");

            let base_file = _modloader_encryption.decrypt(
                await async_fs.readFile(
                    path.join(base, k)
                )
            ).toString("utf-8");
            let files = deltaFiles.get(k);
            let method = "";
            let patchData = [];
            for (let b of files) {
                let { file } = b;
                if (method.length === 0) method = file.delta_method;
                if (method !== file.delta_method) {
                    throw new TypeError("Delta method mis-match");
                }

                patchData.push(
                    [(await _read_file(file.dataSource)).toString("utf-8"), b.mod.json.id]
                );
            }

            window._logLine("| Applying patches with method: " + method);
            let documentBase;
            if (method === "yaml") {
                documentBase = yaml.safeLoad(base_file);
            }
            if (method === "json") {
                documentBase = JSON.parse(base_file);
            }

            if (method === "yaml" || method === "json") {
                for (let [patchset, modid] of patchData) {
                    window._logLine("| | " + modid);
                    documentBase = jsonpatch.applyPatch(documentBase, JSON.parse(patchset), true).newDocument;
                }
            }
            if (method === "append") {
                documentBase = base_file;
                for (let [patchset, modid] of patchData) {
                    window._logLine("| | " + modid);
                    documentBase = documentBase + "\n" + patchset + "\n";
                }
            }
            let oDeep = _ensure_overlay_path(overlayFS, k);
            let bruh = _overlay_fs_split_path(k);
            let lastFile = bruh[bruh.length - 1];

            let fin = "";
            if (method === "yaml") {
                fin = yaml.dump(documentBase);
            }
            if (method === "json") {
                fin = JSON.stringify(documentBase);
            }
            if (method === "append") {
                fin = documentBase;
            }
            oDeep[lastFile] = {
                injectionPoint: files[0].file.injectionPoint,
                ogName: files[0].file.ogName,
                mode: "steam",
                dataSource: {
                    type: "zlib",
                    stream: zlib.deflateSync(Buffer.from(fin))
                }
            };
        } catch (E) {
            deltaSkip.push([E, k]);
            window._logLine("| Patching skipped: " + E.toString());
        }
    }
    if (deltaSkip.length > 0) {
        alert("Please note that SOME patching was skipped due to errors. The following files will remain vanilla: " + deltaSkip.map(a => a[1]).join(",") + "\nError detalis can be found in latest.log");
    }

    window.$modLoader.overlayFS = overlayFS;

    await __modloader_image_delta(knownMods);

    await $modLoader.$runScripts("post_stage_2", {
        knownMods, $modLoader, overlayFS, deltaSkip, conflictFiles, deltaFiles
    });


    if (global && global.gc) global.gc();
}