const fs = require('fs');
const path = require('path');
const base = path.dirname(process.mainModule.filename);
const hash = a => require('crypto').createHash('sha256').update(a).digest('hex');

if (!fs.existsSync(path.join(base, "icon", "icon-oneloader-backup.png"))) {
    fs.writeFileSync(
        path.join(base, "icon", "icon-oneloader-backup.png"),
        fs.readFileSync(path.join(base, "icon", "icon.png"))
    );
}

let ki = [];
for (let [key, value] of params.knownMods.entries()) {
    if (value.json.game_icon) {
        ki.push(await _read_file(await value._raw.resolveDataSource(value.json.game_icon)));
    }
}

if (ki.length > 1) {
    ki = [];
    alert("More than 1 mod wants to change game icon, will use default");
}


let currIconHash = hash(fs.readFileSync(path.join(base, "icon", "icon.png")));

if (ki.length < 1) {
    let backupHash = hash(fs.readFileSync(path.join(base, "icon", "icon-oneloader-backup.png")));
    if (currIconHash != backupHash) {
        fs.writeFileSync(
            path.join(base, "icon", "icon.png"),
            fs.readFileSync(path.join(base, "icon", "icon-oneloader-backup.png"))
        );
        chrome.runtime.reload();
    }
} else {
    let candidateHash = hash(ki[0]);
    if (currIconHash != candidateHash) {
        fs.writeFileSync(
            path.join(base, "icon", "icon.png"),
            ki[0]
        );
        chrome.runtime.reload();
    }
}