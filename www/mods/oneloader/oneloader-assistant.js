/*
    This file is part of the OneLoader project and is licensed under the same terms (MIT)
*/
{
    let spainMode = false;
    class OneLoaderWindowBase extends Window_Selectable {
        initialize() {
            // Make Options List
            this.makeOptionsList();
            // Super Call
            super.initialize(0, 0, this.windowWidth(), this.windowHeight());
            // Create Option Cursors
            this.createOptionCursors();
            this.select(0);
            this.refresh();
        }
        isUsingCustomCursorRectSprite() { return true; }
        standardPadding() { return 8; }
        windowWidth() { return Graphics.width -  20; }
        windowHeight() { return 318; }
        maxItems() { return this._optionsList.length;}
        maxCols() { return 1;}
        itemHeight() { return 75; }
        spacing() { return 5; }
        customCursorRectXOffset() { return 15; }
        customCursorRectYOffset() { return -18; }
        get height() { return this._height; }
        set height(value) {
            this._height = value;
            this._refreshAllParts();
            // If Option Cursors Exist
            if (this._optionCursors) {
              for (var i = 0; i < this._optionCursors.length; i++) {
                var sprite = this._optionCursors[i];
                sprite.visible = value >= (sprite.y + sprite.height)
              };
            }
        }
        _refreshArrows() {
            super._refreshArrows();
            var w = this._width;
            var h = this._height;
            var p = 28;
            var q = p/2;
            this._downArrowSprite.move(w - q, h - q);
            this._upArrowSprite.move(w - q, q);
        }
        processOptionCommand() {

        }
        createOptionCursors() {
            // Initialize Option Cursors
            this._optionCursors = [];
            // Create Cursor Sprites
            for (var i = 0; i < 4; i++) {
                // Create Sprite
                var sprite = new Sprite_WindowCustomCursor(undefined, this.customCursorRectBitmapName());
                sprite.deactivate();
                sprite.visible = false;
                sprite.setColorTone([-80, -80, -80, 255]);
                this._customCursorRectSpriteContainer.addChild(sprite);
                // Add Sprite to Option Cursors
                this._optionCursors[i] = sprite;
            };
        };
        _updateArrows() {
            super._updateArrows();
            this._downArrowSprite.visible = this._downArrowSprite.visible && !!this.active;
            this._upArrowSprite.visible = this._upArrowSprite.visible && !!this.active;
        }
        drawItem(index) {
            // Get Item Rect
            var rect = this.itemRect(index);
            // Get Data
            var data = this._optionsList[index];
            // If Data Exists
            if (data) {
                // Draw Option Segment
                this.drawOptionSegment(data.header, data.options, data.spacing, rect);
            };
        }
        drawOptionSegment(header, options, spacing, rect) {
            // Draw Header
            this.contents.drawText(header, rect.x + 50, rect.y, rect.width, 24);
            // Go Through Options
            for (var i = 0; i < options.length; i++) {
                // Draw Options
                this.contents.drawText(options[i], rect.x + (100 + (i * spacing)), rect.y + 35, rect.width, 24)
            };
        };
        update(index) {
            if(!!this._processDelay) {
                if(this._processDelay > 0) {
                    this._processDelay--;
                    if(this._processDelay === 8) {
                        this._optionsList[this.index()].index === 0 ? Graphics._requestFullScreen() : Graphics._cancelFullScreen();
                    }
                    if(this._processDelay <= 0) {
                        let gamepad = navigator.getGamepads()[Input._lastGamepad];
                        if(!gamepad) {return;}
                        for(let button of gamepad.buttons) {
                            let descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(button), "pressed");
                            Object.defineProperty(button, "pressed", descriptor);
                        }
                    }
                    return;
                }
            }
            super.update();
        }
        callUpdateHelp() {
            super.callUpdateHelp();
            if (this._helpWindow) {
                this._helpWindow.setText(this._optionsList[this.index()].helpText);
            };
        }
        cursorRight(wrap) {
            super.cursorRight(wrap);
            var data = this._optionsList[this.index()];
            // Get Data
           // if(this.index() === 0 && !Graphics._isFullScreen()) {
           //     SoundManager.playBuzzer();
           //     return;
           // } 
            if (data) {
                // Set Data Index
                data.index = (data.index + 1) % data.options.length;
                // Process Option Command
                this.processOptionCommand();
                // Update Cursor
                this.updateCursor();
            }
        }
        cursorLeft(wrap) {
            super.cursorLeft(wrap);
            var data = this._optionsList[this.index()];
            // Get Data
           // if(this.index() === 0 && !Graphics._isFullScreen()) {
            //    SoundManager.playBuzzer();
            //    return;
            //} 
            if (data) {
                // Get Max Items
                var maxItems = data.options.length;
                // Set Data Index
                data.index = (data.index - 1 + maxItems) % maxItems;
                // Process Option Command
                this.processOptionCommand();
                // Update Cursor
                this.updateCursor();
            };
        }
        updateCursor() {
            super.updateCursor();
            var topRow = this.topRow();
            // Get Index
            var index = this.index();
            // If Option cursors Exist
            if (this._optionCursors) {
                // Go through Option Cursors
                for (var i = 0; i < this._optionCursors.length; i++) {
                    // Get Sprite
                    var sprite = this._optionCursors[i];
                    // Get Real Index
                    var realIndex = topRow + i;
                    // Get Data
                    var data = this._optionsList[realIndex];
                    // Get Selected State
                    var selected = this.active ? realIndex === index : false;
                    // If Data Exists
                    if (data) {
                        // Get Item Rect
                        var rect = this.itemRect(realIndex);
                        // Set Sprite Color
                        sprite.setColorTone(selected ? [0, 0, 0, 0] : [-80, -80, -80, 255])
                        // Activate Selected Sprite
                        selected ? sprite.activate() : sprite.deactivate();
                        // Set Sprite Positions
                        sprite.x = (rect.x + 65) +  (data.index * data.spacing);
                        sprite.y = rect.y + 60;
                        // Make Sprite Visible
                        sprite.visible = this.height >= sprite.y + sprite.height;
                    } else {
                        // Deactivate Sprite
                        sprite.deactivate();
                        // Make Sprite Invisible
                        sprite.visible = false;
                    };
                };
            }
        }
    }

    class OneLoaderModList extends OneLoaderWindowBase {
        constructor() { super(...arguments); }

        makeOptionsList() {
            this._optionsList = [];
            for (let mod of $modLoader.allMods.values()) {
                this._optionsList.push({
                    header: mod.name + " | " + mod.version,
                    options: mod._flags && mod._flags.includes("prevent_disable") ? ["CANNOT BE DISABLED"] : ["ENABLE", "DISABLE"],
                    helpText: mod.description || "No description set",
                    spacing: 128,
                    index: mod._flags && mod._flags.includes("prevent_disable") ? 0 : ($modLoader.config[mod.id] ? 0 : 1),
                    _modId: mod.id
                })
            }
        }

        windowWidth() { return 620; }
        windowHeight() { return 274; }
        processOptionCommand() {
            $modLoader.config[ this._optionsList[this.index()]._modId ] = (this._optionsList[this.index()].index === 0);
            $modLoader.syncConfig();
        }

        update() {
            super.update();
            if (this.children[7]) {
                this.children[7].y = 16;
            }
            if(this.children[2]) {
                this.children[2].y = 24;
            }
        }
    }

    const rafResolve = () => new Promise(resolve => requestAnimationFrame(resolve));
    async function processDecryption(mode, patch, target) {
        const path = require('path');
        const util = require('util');
        const base = path.dirname(process.mainModule.filename);
        // we have to ship this lmao
        let baseGameIndexHTML = require('zlib').inflateSync(Buffer.from("eNqtlMFu1DAQhu9IvIPx3esrqpJeoEgc0KKqHDihiTNNZuvYlj3Z7fL0TDbdqqUgIdwc4snY/+cZjyfNu4/bDzffv16pkSd/+fZN8zAuFkIvlpKnmZBBuRFyQW71t5tP5r1+NhdgwlZDSh7NFDuS4YCdEYdxkKDzqJWLgTGI/ojln9WFgediOshiHp9hOg/uznCGUPzsxPUn6J7wkGLmJ7q5oMAc+CWsNsRHmadwpzL6VpMs1mrMeLvadnltUhi04mMSLE0woF0cL8VrHhxnN5q/g17qTvmVEZHPuzDes3WlnAm3kkKxgyS2WJtl5oxhYo+X2y/b68+NXT+khvahiGJ2sT+q0xZycnJwQ45z6I2LPuYLdTrLR1hxmRI/DWIHe1i9WpXsWr0r1lNXbKJ72uwkjsau8//JMCxVnyC9CiuR4zljLcv/lDuXKQy1IEpjDGgoSLHR7KnHuOlyPMhFrEDnNPxwsSrNBTFBkLucSyUmdjt0XEsp0sdYDUmZuJpyoNBLiSooyc8DhRrCBBR+lzd2aeW1qe3pd/0LUp/t+g==", "base64"));
        if (mode === 2) patch = 1;
        let overlay = document.createElement("div");
        overlay.style = "position: fixed; top: 0px; left: 0; right: 0; height: 128px; background: hsl(200, 85%, 35%); z-index: 999; display: flex; align-items: center; justify-content: center; color: white; font-family: sans-serif;";
        
        let text = document.createElement("p");
        text.style = "font-size: 16px; z-index: 1;";
        text.innerText = "Preparing decryption";

        let progress = document.createElement("div");
        progress.style = "position: absolute; top: 0; left: 0; height: 128px; width: 0%; background: #0008";
        
        overlay.appendChild(text);
        overlay.appendChild(progress);
        document.body.appendChild(overlay);

        let patchMV = (patch === 0);
        let planOfAction = [];

        async function buildPlanOfAction(driver, offset) {
            text.innerText = `Planning: ${offset}`;
            let async_fs = {
                readdir: util.promisify(driver.readdir),
                readFile: util.promisify(driver.readFile),
                stat: util.promisify(driver.stat)
            };

            let realPath = path.join(base, offset);
            let data = await async_fs.readdir(realPath);
            for (let file of data) {
                let vInnerPath = path.join(offset  , file);
                let rInnerPath = path.join(realPath, file);
                let bInnerPath = vInnerPath.replace(/\\/g, "/");

                if (bInnerPath.startsWith("/mods") || bInnerPath.startsWith("/adm-zip") || bInnerPath.startsWith("/JSON-Patch") || bInnerPath.startsWith("/gomori") || bInnerPath.startsWith("/modloader")) {
                    continue;
                }

                let stats = await async_fs.stat(rInnerPath);

                if (stats.isDirectory()) {
                    await buildPlanOfAction(driver, vInnerPath);
                } else {
                    planOfAction.push(vInnerPath);
                }
            }

            await rafResolve();
        }

        function mutateExt(a) {
            return a
                .replace(".KEL", ".json")
                .replace(".OMORI",".js")
                .replace(".HERO",".yaml")
                .replace(".AUBREY",".json")
                .replace(".PLUTO", ".yaml")
                .replace(".rpgmvp", ".png")
                .replace(".rpgmvm",".m4a")
                .replace(".rpgmvo",".ogg");
        }

        const decryptionMap = {
            ".KEL":window._modloader_encryption.decrypt,
            ".OMORI":window._modloader_encryption.decrypt,
            ".AUBREY":window._modloader_encryption.decrypt,
            ".HERO":window._modloader_encryption.decrypt,
            ".PLUTO":window._modloader_encryption.decrypt,
            ".xlsx":window._modloader_encryption.decrypt,
            ".rpgmvp":window._modloader_encryption.decryptAsset,
            ".rpgmvm":window._modloader_encryption.decryptAsset,
            ".rpgmvo":window._modloader_encryption.decryptAsset,
        }

        let async_native_mkdir = util.promisify($modLoader.native_fs.mkdir);
        let ensuranceCache = new Set();
        async function ensureDirTree(tpath) {
            let components = _overlay_fs_split_path(tpath);
            let base = "";
            for (let a of components) {
                base = path.join(base, a);
                if (ensuranceCache.has(base)) continue;
                try { await async_native_mkdir(base); } catch(e) {}
                ensuranceCache.add(base);
            }
        }

        async function go(driver) {
            let done = 0;
            let async_fs = {
                readdir: util.promisify(driver.readdir),
                readFile: util.promisify(driver.readFile),
                stat: util.promisify(driver.stat)
            };
            let async_native_write = util.promisify($modLoader.native_fs.writeFile);

            for (let el of planOfAction) {
                text.innerText = `${el}`;
                let inputData = await async_fs.readFile(path.join(base, el));

                let ext = el.match(/\.([^\.]+)$/) ? el.match(/\.([^\.]+)$/)[0] : "";
                if (decryptionMap[ext]) {
                    inputData = decryptionMap[ext].bind(window._modloader_encryption)(inputData);
                }

                el = mutateExt(el);
                await ensureDirTree(path.parse(path.join(target, el)).dir);
                await async_native_write(path.join(target, el), inputData);

                done++;
                progress.style.width = `${(done / planOfAction.length)*100}%`;
            }

            await async_native_write(path.join(target, "index.html"), baseGameIndexHTML);
        }


        if (mode === 0 || mode === 1) { // We can use regular fs drivers for this
            let fs = (mode === 0) ? require('fs') : $modLoader.native_fs;
            await buildPlanOfAction(fs, "/");
            await go(fs);
        }
        if (mode === 2) {
            async function dumpInner(block, offset) {        
                for (let entryName in block) {
                    let entry = block[entryName];
                    if (entry.type === "dir") {
                        await dumpInner(entry.children, path.join(offset, entry.ogName));
                    } else {
                        planOfAction.push(path.join(offset, entry.ogName));
                    }
                }
            }

            await dumpInner($modLoader.overlayFS, "/");
            await go(require('fs'));
        }

        if (patch === 0) {
            let nfs = $modLoader.native_fs;
            let rpgManagers = nfs.readFileSync(path.join(target, "js/rpg_managers.js"), "utf-8");
            rpgManagers = rpgManagers.split("(function() {");
            rpgManagers.pop();
            rpgManagers = rpgManagers.join("(function() {");
            nfs.writeFileSync(path.join(target, "js/rpg_managers.js"), rpgManagers);

            let systemJson = nfs.readFileSync(path.join(target, "data/System.json"), "utf-8");
            systemJson = JSON.parse(systemJson);
            systemJson.hasEncryptedImages = false;
            systemJson.hasEncryptedAudio = false;

            nfs.writeFileSync(path.join(target, "data/System.json"), JSON.stringify(systemJson, null, 2));
            nfs.writeFileSync(path.join(target, "Game.rpgproject"), "RPGMV 1.6.1");

            let plugins = nfs.readFileSync(path.join(target, "js/plugins.js"), "utf-8");
            eval(plugins.replace("var $plugins", "window.__tmp_plugins"));
            plugins = window.__tmp_plugins;
            for (let p of plugins) {
                if (p.name === "DisableMouse") {
                    p.status = false;
                }
                if (p.name === "YEP_Debugger" || p.name === "YEP_TestPlayAssist") {
                    p.status = true;
                }
            }
            nfs.writeFileSync(path.join(target, "js/plugins.js"), `// Generated by RPG Maker.
// Do not edit this file directly.
var $plugins =
${JSON.stringify(plugins, null, 2)}`);
        }

        overlay.remove();
        alert("Decrypted to " + target);
    }

    class OneLoaderDecrypt extends OneLoaderWindowBase {
        constructor() { super(...arguments); }

        makeOptionsList() {
            this._optionsList = [];
            this._optionsList.push({
                header: "Decryption mode",
                options: [
                    "EVERYTHING","BASE GAME","ONLY MODS"
                ],
                helpText: "What should be decrypted?",
                spacing: 180,
                index: 0
            });
            this._optionsList.push({
                header: "Generate as RpgMaker project?",
                options: [
                    "YES","NO"
                ],
                helpText: "Should changes needed to open in RpgMaker be made?",
                spacing: 128,
                index: 0
            });
            this._optionsList.push({
                header: "Start decryption",
                options: [
                    "CLICK HERE TO START"
                ],
                helpText: "Confirm your settings before starting. It takes a while!",
                spacing: 128,
                index: 0
            });
        }

        windowWidth() { return 620; }
        windowHeight() { return 274; }

        update() {
            super.update();
            if (this.children[7]) {
                this.children[7].y = 16;
            }
            if(this.children[2]) {
                this.children[2].y = 24;
            }
            if (this.active) {
                if (Input.isRepeated("ok")) {
                    if (this.index() === 2) {
                        if ($modLoader.isInTestMode) {
                            return alert("This does not work in Test Mode.");
                        }
                        Input.clear();
                        this.deactivate();
                        processDecryption(this._optionsList[0].index, this._optionsList[1].index, `www_${ this._optionsList[1].index === 0 ? "playtest" : "decrypt" }_${randomString(4)}`).then(() => {
                            this.activate();
                            this.select(0);
                            this.refresh();
                        });
                    }
                }
            }
        }
    }

    class OneLoaderSpecial extends OneLoaderWindowBase {
        constructor() { super(...arguments); }
        makeOptionsList() {
            this._optionsList = [];
            this._optionsList.push({
                header: "Automatic updating",
                options: [
                    "ALLOW", "DENY"
                ],
                helpText: "Should OneLoader automatically update?",
                spacing: 180,
                index: $modLoader.config._autoUpdater.check === "allow" ? 0 : 1
            })
            this._optionsList.push({
                header: "Reset priorities",
                options: [
                    "CLICK HERE TO RESET PRIORITIES"
                ],
                helpText: "Reset preferences for delta patching and asset priority",
                spacing: 180,
                index: 0
            });
            this._optionsList.push({
                header: "Restart game",
                options: [
                    "CLICK HERE TO RESTART THE GAME"
                ],
                helpText: "Restart the game (NOTE: May increase memory usage, old assets aren't cleared)",
                spacing: 180,
                index: 0
            });
            this._optionsList.push({
                header: "[DEBUG] Kill VFS",
                options: [
                    "CLICK HERE TO KILL VFS"
                ],
                helpText: "DO NOT DO THIS UNLESS ASKED TO BY ONELOADER DEVELOPERS!",
                spacing: 180,
                index: 0
            });
        }
        processOptionCommand() {
            if (this.index() === 0) {
                $modLoader.config._autoUpdater.check = this._optionsList[0].index === 0 ? "allow" : "deny";
                $modLoader.syncConfig();
                console.log($modLoader.config._autoUpdater);
            }
        }
        windowWidth() { return 620; }
        windowHeight() { return 274; }

        update() {
            super.update();
            if (this.children[7]) {
                this.children[7].y = 16;
            }
            if(this.children[2]) {
                this.children[2].y = 24;
            }
            if (this.active) {
                if (Input.isRepeated("ok")) {
                    if (this.index() === 1) {
                        Input.clear();
                        if (confirm("Reset preferences?")) {
                            $modLoader.config._conflictResolutions = {};
                            $modLoader.config._deltaPreference = {};
                            $modLoader.syncConfig();
                        }
                    }
                    if (this.index() === 2) {
                        Input.clear();
                        window.location.reload();
                    }
                    if (this.index() === 3) {
                        if (confirm("This will break mods until restart. Don't do this unless asked to by OneLoader developers or if you know what you are doing!")) {
                            __unload_web_vfs();
                            __unload_node_vfs();
                        }
                    }
                }
            }
        }
    }

    function randomString(l) {
        return crypto.randomBytes(l).toString("hex");
    }


    class OneLoaderOptionsWindow extends Window_OmoMenuOptionsCategory {
        constructor() {
            super(...arguments);
        }
        initialize() {
            super.initialize();
            this.setHandler("ok", this.onManageMods.bind(this));
            this._oneLoaderModList = new OneLoaderModList();
            this._oneLoaderModList.deactivate();
            this._oneLoaderModList.y = 44;
            this._oneLoaderModList.setHandler('cancel', this.onWindowCancel.bind(this));
            this.addChild(this._oneLoaderModList);

            if(!$modLoader.isInTestMode) {
                this._oneLoaderDecrypt = new OneLoaderDecrypt();
                this._oneLoaderDecrypt.deactivate();
                this._oneLoaderDecrypt.y = 44;
                this._oneLoaderDecrypt.setHandler('cancel', this.onWindowCancel.bind(this));
                this.addChild(this._oneLoaderDecrypt);
            }

            this._oneLoaderSpecial = new OneLoaderSpecial();
            this._oneLoaderSpecial.deactivate();
            this._oneLoaderSpecial.y = 44;
            this._oneLoaderSpecial.setHandler('cancel', this.onWindowCancel.bind(this));
            this.addChild(this._oneLoaderSpecial);

            if(!$modLoader.isInTestMode) {
                this._optionWindows = [this._oneLoaderModList, this._oneLoaderDecrypt, this._oneLoaderSpecial];
            } else {
                this._optionWindows = [this._oneLoaderModList, this._oneLoaderSpecial];
            }
        }

        makeCommandList() {
            this.addCommand("MANAGE MODS", 'ok', true);
            if (!$modLoader.isInTestMode) this.addCommand("DECRYPT", 'ok', true);
            this.addCommand("OPTIONS", 'ok', true);
        }
        maxCols() {
            return 3;
        }

        passHelpWindow(helpWindow) {
            this._oneLoaderModList._helpWindow = helpWindow;
            if (!$modLoader.isInTestMode) this._oneLoaderDecrypt._helpWindow = helpWindow;
            this._oneLoaderSpecial._helpWindow = helpWindow;
            this._helpWindow = helpWindow;
        }
        onManageMods() {
            this.deactivate();
            if (this.index() === 0) {
                this._oneLoaderModList.activate();
                this._oneLoaderModList.select(0);
            } else if (this.index() === 1) { 
                if (!$modLoader.isInTestMode) {
                    this._oneLoaderDecrypt.activate();
                    this._oneLoaderDecrypt.select(0);
                } else {
                    this._oneLoaderSpecial.activate();
                    this._oneLoaderSpecial.select(0);
                }
            } else if (this.index() === 2) { 
                this._oneLoaderSpecial.activate();
                this._oneLoaderSpecial.select(0);
            } else {
                this.activate();
            }
        }

        onWindowCancel() {
            if (this.index() === 0) {
                this._oneLoaderModList.select(0);
                this._oneLoaderModList.refresh();
            }
            if (this.index() === 1) {
                if (!$modLoader.isInTestMode) {
                    this._oneLoaderDecrypt.select(0);
                    this._oneLoaderDecrypt.refresh();
                } else {
                    this._oneLoaderSpecial.select(0);
                    this._oneLoaderSpecial.refresh();
                }
            }
            if (this.index() === 2) {
                this._oneLoaderSpecial.select(0);
                this._oneLoaderSpecial.refresh();
            }

            this._helpWindow.clear();
            this.activate();
        }

        callUpdateHelp() {
            super.callUpdateHelp();
            if (this.index() === 0) {
                if (this._helpWindow) {
                    this._helpWindow.setText("Enable and disable your mods");
                }
            } else if (this.index() === 1) {
                if (this._helpWindow) {
                    if (!$modLoader.isInTestMode)
                        this._helpWindow.setText("Decrypt the game here");
                    else
                        this._helpWindow.setText("General OneLoader options");
                }
            } else if (this.index() === 2) {
                if (this._helpWindow) {
                    this._helpWindow.setText("General OneLoader options");
                }
            }
        }
    }

    let _injection_point_title_screen = Scene_OmoriTitleScreen;
    window.Scene_OmoriTitleScreen = class Scene_OmoriTitleScreen extends _injection_point_title_screen {
        create() {
            super.create();
        }
        createSystemOptionsWindow() {
            super.createSystemOptionsWindow();
            this._oneLoaderWindow = new OneLoaderOptionsWindow();
            this._oneLoaderWindow.setHandler('cancel', this.onOptionWindowCancel.bind(this));
            this._oneLoaderWindow.deactivate();
            this._oneLoaderWindow.passHelpWindow(this._helpWindow);
            this._optionsWindowsContainer.addChild(this._oneLoaderWindow);
        }
        optionWindows() {
            let a = super.optionWindows();
            a.push(this._oneLoaderWindow);
            return a;
        }
    }

    let _injection_point_scene_menuoptions = Scene_OmoMenuOptions;
    window.Scene_OmoMenuOptions = class Scene_OmoMenuOptions extends _injection_point_scene_menuoptions {
        createSystemOptionsWindow() {
            super.createSystemOptionsWindow();
            if (!spainMode) {
                this._oneLoaderWindow = new OneLoaderOptionsWindow();
                this._oneLoaderWindow.setHandler('cancel', this.onOptionWindowCancel.bind(this));
                this._oneLoaderWindow.deactivate();
                this._oneLoaderWindow.passHelpWindow(this._helpWindow);
                this._oneLoaderWindow.visible = false;
                this._oneLoaderWindow.height = 0;
                this._oneLoaderWindow.x = 10;
                this.addChild(this._oneLoaderWindow);
            }
        }
        optionWindows() {
            let a = super.optionWindows();
            if (!spainMode) a.push(this._oneLoaderWindow);
            return a;
        }
    }

    let _injection_point_options_category = Window_OmoMenuOptionsCategory;
    window.Window_OmoMenuOptionsCategory = class Window_OmoMenuOptionsCategory extends _injection_point_options_category {
        makeCommandList() {
            super.makeCommandList();
            this.addCommand('MODS', 'ok');
        }
        maxCols() { return super.maxCols() + 1; }
    }

    window.Window_OmoMenuOptionsMods = new Proxy(OneLoaderOptionsWindow, {
        construct(target, args, newTarget) {
            spainMode = true;
            return Reflect.construct(target, args, newTarget);
        }
    });
}
