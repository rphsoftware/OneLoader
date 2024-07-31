if (window.nw.App.argv[0] !== "test") {
    console.log("Loading basic oneloader configuration.");
    const MAX_MANIFEST_VERSION = 1;
    const ID_BLACKLIST = ["gomori"];
    const EXTENSION_RULES = {
        "png": { "encrypt": "rpgmaker", "target_extension": "rpgmvp" },
        "ogg": { "encrypt": "rpgmaker", "target_extension": "rpgmvo" }
    };

    let LANGUAGE = "en";
    try {
        const fs = require("fs");
        const js = fs.readFileSync("www/js/plugins.js", "utf8")
        eval(js.replace("var $plugins", "window.___tmp_plugins"))
        LANGUAGE = window.___tmp_plugins.filter(
            a => a.name.toLowerCase() === "text_language_processor"
        )[0].parameters["Default Language"];
    } catch (error) {
        console.log("Failed to read default language.");
        console.log(error);
    } finally {
        window.___tmp_plugins = undefined;
    }

    const DATA_RULES = [
        {
            jsonKeys: [
                "data", "data_delta", "data_pluto", "data_pluto_delta"
            ],
            formatMap: {
                "json": { target: "KEL", delta: false, encrypt: true },
                "jsond": { target: "KEL", delta: true, delta_method: "json", encrypt: true },
                "kel": { target: "KEL", delta: false, encrypt: false },
                "yml": { target: "PLUTO", delta: false, encrypt: true },
                "ymld": { target: "PLUTO", delta: true, delta_method: "yaml", encrypt: true },
                "yaml": { target: "PLUTO", delta: false, encrypt: true },
                "yamld": { target: "PLUTO", delta: true, delta_method: "yaml", encrypt: true },
                "pluto": { target: "PLUTO", delta: false, encrypt: false }
            },
            mountPoint: "data"
        },
        {
            jsonKeys: [
                "text", "text_delta"
            ],
            formatMap: {
                "yml": { target: "HERO", delta: false, encrypt: true },
                "ymld": { target: "HERO", delta: true, delta_method: "yaml", encrypt: true },
                "yaml": { target: "HERO", delta: false, encrypt: true },
                "yamld": { target: "HERO", delta: true, delta_method: "yaml", encrypt: true },
                "hero": { target: "HERO", delta: false, encrypt: false }
            },
            mountPoint: "languages/" + LANGUAGE
        },
        {
            jsonKeys: [
                "maps", "maps_delta"
            ],
            formatMap: {
                "json": { target: "AUBREY", delta: false, encrypt: true },
                "jsond": { target: "AUBREY", delta: true, delta_method: "json", encrypt: true },
                "aubrey": { target: "AUBREY", delta: false, encrypt: false }
            },
            mountPoint: "maps"
        },
        {
            jsonKeys: [
                "plugins", "plugins_delta"
            ],
            formatMap: {
                "js": { target: "OMORI", delta: false, encrypt: true },
                "jsd": { target: "OMORI", delta: true, delta_method: "append", encrypt: true },
                "mjs": { target: "OMORI", delta: false, encrypt: true, parser: "esm" },
                "omori": { target: "OMORI", delta: false, encrypt: false }
            },
            mountPoint: "js/plugins",
            pluginList: true
        }
    ];

    window.$ONELOADER_CONFIG = {
        MAX_MANIFEST_VERSION, ID_BLACKLIST, EXTENSION_RULES, DATA_RULES
    };
} else {
    console.log("Loading playtest configuration");
    const MAX_MANIFEST_VERSION = 1;
    const ID_BLACKLIST = ["gomori"];
    const EXTENSION_RULES = {
        "png": { "encrypt": "rpgmaker", "target_extension": "png" },
        "ogg": { "encrypt": "rpgmaker", "target_extension": "ogg" }
    };

    const DATA_RULES = [
        {
            jsonKeys: [
                "data", "data_delta", "data_pluto", "data_pluto_delta"
            ],
            formatMap: {
                "json": { target: "json", delta: false, encrypt: true },
                "jsond": { target: "json", delta: true, delta_method: "json", encrypt: true },
                "kel": { target: "KEL", delta: false, encrypt: false }, // Mods that ship encrypted files WILL fail. Don't do that. Not cool.
                "yml": { target: "yaml", delta: false, encrypt: true },
                "ymld": { target: "yaml", delta: true, delta_method: "yaml", encrypt: true },
                "yaml": { target: "yaml", delta: false, encrypt: true },
                "yamld": { target: "yaml", delta: true, delta_method: "yaml", encrypt: true },
                "pluto": { target: "PLUTO", delta: false, encrypt: false }
            },
            mountPoint: "data"
        },
        {
            jsonKeys: [
                "text", "text_delta"
            ],
            formatMap: {
                "yml": { target: "yaml", delta: false, encrypt: true },
                "ymld": { target: "yaml", delta: true, delta_method: "yaml", encrypt: true },
                "yaml": { target: "yaml", delta: false, encrypt: true },
                "yamld": { target: "yaml", delta: true, delta_method: "yaml", encrypt: true },
                "hero": { target: "HERO", delta: false, encrypt: false } // Mods that ship encrypted files WILL fail. Don't do that. Not cool.
            },
            mountPoint: "languages/en"
        },
        {
            jsonKeys: [
                "maps", "maps_delta"
            ],
            formatMap: {
                "json": { target: "json", delta: false, encrypt: true },
                "jsond": { target: "json", delta: true, delta_method: "json", encrypt: true },
                "aubrey": { target: "AUBREY", delta: false, encrypt: false } // Mods that ship encrypted files WILL fail. Don't do that. Not cool.
            },
            mountPoint: "maps"
        },
        {
            jsonKeys: [
                "plugins", "plugins_delta"
            ],
            formatMap: {
                "js": { target: "js", delta: false, encrypt: true },
                "jsd": { target: "js", delta: true, delta_method: "append", encrypt: true },
                "mjs": { target: "js", delta: false, encrypt: true, parser: "esm" },
                "omori": { target: "OMORI", delta: false, encrypt: false } // Mods that ship encrypted files WILL fail. Don't do that. Not cool.
            },
            mountPoint: "js/plugins",
            pluginList: true
        }
    ];

    window.$ONELOADER_CONFIG = {
        MAX_MANIFEST_VERSION, ID_BLACKLIST, EXTENSION_RULES, DATA_RULES
    };
}