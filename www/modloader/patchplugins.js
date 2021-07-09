{
    if (window.$modLoader && window.$modLoader.success) {
        // Per-mod regression fixes
        // This needs to be done to fix a performance regression in https://mods.one/mod/enabledebug
        PluginManager._parameters["yep_debugger"] = $plugins.filter(a => a.name.toLowerCase() === "yep_debugger")[0].parameters;

        $modLoader.$runScripts("pre_plugin_injection", {
            PluginManager, $plugins
        });
        
        window._logLine("Patching $plugins");
        let game_supplied_plugins = $plugins.map( a=>a.name.toLowerCase());
        for (let name of Array.from($modLoader.pluginLocks)) {
            if (!game_supplied_plugins.includes(name)) {
                $plugins.push({
                    name,
                    status: true,
                    description: "Modded plugin",
                    parameters: {}
                });
                window._logLine("[PLUGIN_LOADER] Injected " + name);
            }
        }
    }
}