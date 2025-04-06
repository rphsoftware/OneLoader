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

        let injections = Array.from(new Array($plugins.length + 1), () => ([]));
        console.log(injections);

        for (let [name, {rule}] of $modLoader.pluginOrderingRules.entries()) {
            if (rule.after) {
                let point = $plugins.indexOf($plugins.find(a => a.name.toLowerCase() === rule.after.toLowerCase()));
                console.log(point);
                rule.at = point + 1;
            }
            
            if (rule.at < 0) continue;
            if (rule.at >= injections.length) rule.at = (injections.length - 1);
            
            injections[rule.at].push({
                name,
                status: true,
                description: "Modded plugin",
                parameters: {},
                _w: rule.weight || 0
            });
        }

        for (let i = (injections.length - 1); i >= 0; i--) {
            if (injections[i].length === 0) continue;

            injections[i].sort((a,b)=>(b._w - a._w));
            $plugins.splice(i, 0, ...injections[i]);
        }

        
        
        let postPluginsNeg = [];
        let postPlugins = [];
        let postPluginsPos = [];

        for (let name of Array.from($modLoader.pluginLocks)) {
            let orderingRule = $modLoader.pluginOrderingRules.get(name);
            
            let wght = orderingRule.rule.weight || 0;

            if (!game_supplied_plugins.includes(name) && orderingRule.rule.at === -1) {
                if (wght < 0) {
                    postPluginsNeg.push({
                        name,
                        status: true,
                        description: "Modded plugin",
                        parameters: {},
                        _w: wght
                    });
                }
                if (wght > 0) {
                    postPluginsPos.push({
                        name,
                        status: true,
                        description: "Modded plugin",
                        parameters: {},
                        _w: wght
                    });
                }
                if (wght === 0) {
                    postPlugins.push({
                        name,
                        status: true,
                        description: "Modded plugin",
                        parameters: {}
                    });
                }
                window._logLine("[PLUGIN_LOADER] Injected " + name);
            }
        }

        postPluginsNeg = postPluginsNeg.sort((a, b) => (b._w - a._w))
        postPluginsPos = postPluginsPos.sort((a, b) => (b._w - a._w))

        $plugins.push(...postPluginsPos, ...postPlugins, ...postPluginsNeg);

        $modLoader.knownMods.forEach(mod => {
            if (mod.json.plugin_parameters) {
                for (let plugin in mod.json.plugin_parameters) {
                    let filtered = $plugins.filter(a => a.name.toLowerCase() === plugin.toLowerCase());

                    if (filtered.length < 1) {
                        window._logLine("[PLUGIN PARAMETER PATCHER] Ignored " + plugin + " from  " + mod.json.id + " because no such plugin was found in the game");
                        continue;
                    }

                    let pluginObject = filtered[0];
                    pluginObject.parameters = jsonpatch.applyPatch(pluginObject.parameters, mod.json.plugin_parameters[plugin]).newDocument;
                }
            }
        });
    }
}