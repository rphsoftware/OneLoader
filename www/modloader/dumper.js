window._dump_overlay_fs_to_disk = async function() {
    const util = require('util');
    const async_fs = { // old node polyfill bruh
        readdir: util.promisify($modLoader.native_fs.readdir),
        readFile: util.promisify($modLoader.native_fs.readFile),
        writeFile: util.promisify($modLoader.native_fs.writeFile),
        stat: util.promisify($modLoader.native_fs.stat),
        mkdir: util.promisify($modLoader.native_fs.mkdir)
    };
    const path = require('path');

    let jid = new Date().getTime();
    let _ofs_dmp_tgt = path.join(process.cwd(), jid.toString(16));
    $oneLoaderGui.setHt("Dumping overlay");
    await async_fs.mkdir(_ofs_dmp_tgt);
    async function dumpInner(block, dirOffset) {
        await async_fs.mkdir(path.join(_ofs_dmp_tgt, dirOffset));

        for (let entryName in block) {
            let entry = block[entryName];
            $oneLoaderGui.pst(path.join(dirOffset, entry.ogName));
            if (entry.type === "dir") {
                await dumpInner(entry.children, path.join(dirOffset, entry.ogName));
            } else {
                let data = await _read_file(entry.dataSource);
                if (entry.mode === "rpgmaker") data = _modloader_encryption.encryptAsset(data);
                if (entry.mode === "steam") data = _modloader_encryption.encrypt(data);
                await async_fs.writeFile(path.join(_ofs_dmp_tgt, dirOffset, entry.ogName), data);
            }
        }
    }

    await dumpInner($modLoader.overlayFS, "www");

    alert("Dumped overlay to " + _ofs_dmp_tgt);
}