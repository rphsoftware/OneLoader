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

    let progressBar = document.createElement("progress");
    progressBar.max = headAppendix.length + scripts.length;
    progressBar.value = 0;
    progressBar.style = "position: fixed; top: 40px; height: 16px; left: 0; right: 0; width: 640px; font-size: 18px;";

    let currentLoader = document.createElement("h1");
    currentLoader.style = "position: fixed; top: 0; margin: 0; padding: 0; left: 0; right: 0; font-size: 18px; color: white; background: hsl(200, 85%, 35%, 0.2); line-height: 40px; text-align:center;";
    currentLoader.innerText = "Starting the game";
    try {
        document.body.appendChild(progressBar);
        document.body.appendChild(currentLoader);
    } catch(e) {
        setTimeout(function() {
            document.body.appendChild(progressBar);
            document.body.appendChild(currentLoader);
        }, 500);
    }

    async function prepareIconData() {
        return "data:image/png;base64," + (await _vfs_resolve_file("icon/icon.png")).toString("base64");
    }

    for (let a of headAppendix) {
        progressBar.value++;
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
        progressBar.value++;
        currentLoader.innerText = "This may take up to 25 seconds";
        await rafResolve();
        let s = document.createElement("script");
        s.src = script;
        document.body.appendChild(s);
        await new Promise(resolve => {
            s.onload = resolve;
        })
    }

    progressBar.remove();
    currentLoader.remove();
    window.onload();
}