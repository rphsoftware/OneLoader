if ($modLoader.isInTestMode) return;

let GH_AUTH="";
let repo_base="rphsoftware/oneloader";

async function fetchLatestReleaseMeta() {
    let headers = {};
    if (GH_AUTH.length > 0) {
        headers["Authorization"] = GH_AUTH;
    }

    let resp = await fetch("https://api.github.com/repos/" + repo_base + "/releases", {
        headers
    }).then(res => res.json());
    let meta = resp[0];
    let uid = meta.body.match(/auid\=(.+)/)[1];
    
    $modLoader.config._autoUpdater.lastCheck = Date.now();
    $modLoader.syncConfig();
    
    if (uid !== $modLoader.knownMods.get("oneloader").json.version) {
        if (!$modLoader.config._autoUpdater.performUpdate) {
            $modLoader.config._autoUpdater.performUpdate = true;
            $modLoader.config._autoUpdater.lastCheckVersion = uid;
            $modLoader.config._autoUpdater.lastCheck = Date.now();
            $modLoader.config._autoUpdater.updateBundleURL = meta.assets[0].browser_download_url;
            $modLoader.syncConfig();
        }
    }
}

async function updateChecker() {
    if ($modLoader.config._autoUpdater && $modLoader.config._autoUpdater.check === "allow") {
        if (((Date.now() - $modLoader.config._autoUpdater.lastCheck) / 1000) > 600) {
            await fetchLatestReleaseMeta();
        }
    }
}

if (!$modLoader.config._autoUpdater) {
    $modLoader.config._autoUpdater = {
        askedYet: false,
        check: "deny",
        lastCheck: Date.now(),
        lastCheckVersion: $modLoader.knownMods.get("oneloader").json.version
    };
    $modLoader.syncConfig();
}

setTimeout(function() {
    if (!$modLoader.config._autoUpdater.askedYet) {
        $modLoader.config._autoUpdater.askedYet = true;
        $modLoader.syncConfig();
        let prompt = document.createElement("div");
        prompt.style = "position: fixed; top: 12px; position: fixed; font-family: GameFont; font-display: block; left: 12px; color: white; width: 400px; border-radius: 16px; padding-bottom: 32px; background: hsl(200, 85%, 35%); z-index: 99";
        let u = setInterval(function() {
            prompt.style.zIndex = 99;
        }, 500);
        prompt.innerHTML = `<h2 style="margin: 0; text-align: Center;">OneLoader auto-updating</h2>
    <p style="margin: 0; text-align: Center; font-size: 20px;">Would you like to enable automating updates? You can always change this in the settings.</p><p data-oneloader-countdown="2222" style="margin: 0; text-align: Center; font-size: 16px;">This prompt will automatically disappear and default to disabling in 15s</p>`;
let denyBtn = document.createElement("a");
denyBtn.style = "border-bottom-left-radius: 16px; position: absolute; bottom: 0; left: 0; background: #000a; text-decoration: none; color: white; width: 50%; font-size: 24px; height: 32px; line-height: 32px; text-align: center;";
denyBtn.innerText = "Disable";
let allowBtn = document.createElement("a");
allowBtn.style = "border-bottom-right-radius: 16px; position: absolute; bottom: 0; right: 0; background: #0008; text-decoration: none; color: white; width: 50%; font-size: 24px; height: 32px; line-height: 32px; text-align: center;";
allowBtn.innerText = "Enable";
prompt.appendChild(denyBtn);
prompt.appendChild(allowBtn);
        let alreadyGone = false;
        let secondsLeft = 15;
        function eatPrompt() {
            if (!alreadyGone) {
                alreadyGone = true;
                prompt.remove();
            }
        }
        function deny_click() {
            eatPrompt();
            $modLoader.config._autoUpdater = {
                check: "deny",
                askedYet: true,
                lastCheck: 0,
                lastCheckVersion: $modLoader.knownMods.get("oneloader").json.version
            };
            $modLoader.syncConfig();
        }
        function allow_click() {
            eatPrompt();
            $modLoader.config._autoUpdater = {
                check: "allow",
                askedYet: true,
                lastCheck: 0,
                lastCheckVersion: $modLoader.knownMods.get("oneloader").json.version
            };
            $modLoader.syncConfig();
            updateChecker();
        }
        allowBtn.addEventListener("click", allow_click);
        denyBtn.addEventListener("click", deny_click);
        let denyCnt = setInterval(function() {
            secondsLeft--;
            if (!alreadyGone)
                document.querySelector('p[data-oneloader-countdown="2222"]').innerText = `This prompt will automatically disappear and default to disabling in ${secondsLeft}s`;
            if (secondsLeft < 1) {
                if (!alreadyGone)
                    deny_click();
                clearInterval(denyCnt);
            }
        }, 1000);
        document.body.appendChild(prompt);
    }
}, 10000);


updateChecker();