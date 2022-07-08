async function _start_game() {
    const rafResolve = () => new Promise(resolve => requestAnimationFrame(resolve));

    let scripts = [
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
        "modloader/patchplugins.js",
        "js/main.js"
    ];

    let headAppendix = [
        {rel: "icon",href:"icon/icon.png",type:"image/png"},
        {rel: "apple-touch-icon", href:"icon/icon.png"},
        {rel: "stylesheet", type:"text/css", href:"fonts/gamefont.css"}
    ];

    $oneLoaderGui.setHt("Starting the game");
    $oneLoaderGui.setPbCurr(0);
    $oneLoaderGui.setPbMax(headAppendix.length + scripts.length);

    async function prepareIconData() {
        return "data:image/png;base64," + (await _vfs_resolve_file("icon/icon.png")).toString("base64");
    }

    for (let a of headAppendix) {
        $oneLoaderGui.inc();
        await rafResolve();
        if (a.rel === "icon" && !a.href) { a.href = await prepareIconData(); }
        let l = document.createElement("link");
        for (let k in a) {
            l.setAttribute(k, a[k]);
        }
        document.body.appendChild(l);
        if (a.rel && a.rel === "stylesheet") {
            let p = new Promise(resolve => {
                l.onload = resolve;
            });
            await p;
        }
    }
    for (let script of scripts) {
        $oneLoaderGui.inc();
        $oneLoaderGui.setHt("This may take up to 25 seconds", true);
        await rafResolve();
        let s = document.createElement("script");
        s.src = script;
        document.body.appendChild(s);
        await new Promise(resolve => {
            s.onload = resolve;
        })
    }

    await $modLoader.$runScripts("pre_window_onload", {});

    if ($modLoader.isInTestMode) {
        $oneLoaderGui.setHt("Playtest: Giving the game time to load plugins.");
        $oneLoaderGui.setPbMax(5);
        $oneLoaderGui.pst("Because of that, this loading screen WILL stutter. Have patience.");

        for (let i = 0; i < 5; i++) {
            await new Promise(r => setTimeout(r, 1000));
            $oneLoaderGui.setPbCurr(i + 1);
        }
    }
    window.onload();

    $oneLoaderGui.container.style.opacity = 0;
}