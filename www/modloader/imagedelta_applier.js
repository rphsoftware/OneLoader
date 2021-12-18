async function __modloader_image_delta(knownMods) {
    const e = wasm_bindgen.tile_size();
    function imgToCanvas(img) {
        let width = Math.ceil(img.width / e) * e;
        let height = Math.ceil(img.height / e) * e;

        let canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;

        let ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        return ctx;
    }

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
    const shaDigest = a => require('crypto').createHash("sha256").update(a).digest("hex");

    const cache_base = path.join(base, '..', '.oneloader-image-cache');

    if (!native_fs.existsSync(cache_base)) {
        native_fs.mkdirSync(cache_base);
    }

    $oneLoaderGui.setHt("Patching images");

    const patched_images = {};
    knownMods.forEach(function(v,k) {
        for (let e of v.imageDelta) {
            if (!patched_images[e.target]) patched_images[e.target] = [];
            
            patched_images[e.target].push({
                mod: v,
                delta: e.file,
                path: e.path
            });
        }
    });

    $oneLoaderGui.setPbMax(Object.keys(patched_images).length);
    $oneLoaderGui.setPbCurr(0);

    for (let image in patched_images) {
        $oneLoaderGui.pst(image);
        let job_id = `${image}`;
        let deltas = [];

        let targetWidth = 0;
        let targetHeight = 0;

        for (let description of patched_images[image]) {
            let deltaData = await _read_file(description.delta);
            
            let ab = new Uint8Array(deltaData);
            let dv = new DataView(ab.buffer);
        
            if (dv.getUint32(0) !== 0xFEFFD808  && dv.getUint32(4) !== 0xDD21) {
                $modLoader.$log(`${description.path} in ${description.mod.id} was not a valid olid`);
                continue;
            }

            targetWidth  = Math.max(targetWidth,  dv.getUint32(6));
            targetHeight = Math.max(targetHeight, dv.getUint32(10));
            
            let salt = Buffer.from(ab.slice(14, 22)).toString("hex");
            let compressedBitstream = ab.slice(26);

            deltas.push({
                salt,
                compressedBitstream
            });
        }

        if (deltas.length < 1) continue;

        const image_data = _modloader_encryption.decryptAsset(await _vfs_resolve_file(image.replace(/\.png$/g, '.rpgmvp')));
        
        job_id = `${job_id}+${shaDigest(image_data)}`;
        job_id = `${job_id}:${deltas.sort((a, b) => {return a.salt > b.salt?1:-1}).map(a => a.salt).join(":")}`;
        job_id = shaDigest(job_id);

        if (!native_fs.existsSync(path.join(cache_base, `${job_id}.png`))) {
            // Load initial file
            const sourceURL = URL.createObjectURL(new Blob([image_data], {type: 'image/png'}));
            const sourceImg = await new Promise(resolve => {const img = new Image();img.onload = () => resolve(img);img.src = sourceURL;});
            URL.revokeObjectURL(sourceURL);

            let ctx = imgToCanvas(sourceImg);
            let targetCanvas = document.createElement("canvas");
            targetCanvas.width = Math.ceil(targetWidth / 16) * 16;
            targetCanvas.height = Math.ceil(targetHeight / 16) * 16;
            let targetCtx = targetCanvas.getContext("2d");
            targetCtx.drawImage(sourceImg, 0, 0);
            
            for (let delta of deltas) {
                // Decompress compressed bitstream
                const deltaBitstream = zlib.inflateSync(Buffer.from(delta.compressedBitstream));
                const deltaBitstreamU8 = new Uint8Array(deltaBitstream);
                const deltaBitstreamDV = new DataView(deltaBitstreamU8.buffer);

                let deltaBitstreamPtr = 0;

                // Apply bitstream to canvas
                while (deltaBitstreamPtr < deltaBitstreamU8.byteLength) {
                    const tileX = deltaBitstreamDV.getUint16(deltaBitstreamPtr);
                    const tileY = deltaBitstreamDV.getUint16(deltaBitstreamPtr + 2);
                    const tileBitstreamLen = deltaBitstreamDV.getUint32(deltaBitstreamPtr + 4);
                    deltaBitstreamPtr += 8;

                    const tileBitstream = deltaBitstreamU8.slice(deltaBitstreamPtr, deltaBitstreamPtr + tileBitstreamLen);
                    deltaBitstreamPtr += tileBitstreamLen;

                    let sourceBitmap;
                    if (sourceImg.width < (tileX * e) || sourceImg.height < (tileY * e)) {
                        sourceBitmap = new ArrayBuffer(e * e * 4);
                    } else {
                        sourceBitmap = targetCtx.getImageData(tileX * e, tileY * e, e, e).data.buffer;
                    }

                    let targetBitmap = wasm_bindgen.apply_diff(new Uint32Array(sourceBitmap), tileBitstream);
                    let imgData = new ImageData(new Uint8ClampedArray(targetBitmap.buffer), e, e);

                    targetCtx.putImageData(imgData, tileX * e, tileY * e);
                }
            }

            if (targetCanvas.width != targetWidth || targetCanvas.height != targetHeight) {
                let fc = document.createElement("canvas");
                fc.width = targetWidth;
                fc.height = targetHeight;

                fc.getContext("2d").drawImage(targetCanvas, 0, 0);
                targetCanvas.remove();

                targetCanvas = fc;
            }

            let blob = await new Promise(resolve => targetCanvas.toBlob(resolve, "image/png"));
            let blobUrl = URL.createObjectURL(blob);
            let data = await fetch(blobUrl).then(r => r.arrayBuffer());
            URL.revokeObjectURL(blobUrl);

            native_fs.writeFileSync(path.join(cache_base, `${job_id}.png`), Buffer.from(data));

            // Cleanup
            sourceImg.remove();
            ctx.canvas.remove();
            targetCanvas.remove();
        }

        $oneLoaderGui.inc();

        let oDeep = _ensure_overlay_path($modLoader.overlayFS, image.replace(/\.png$/g, '.rpgmvp').toLowerCase());
        let bruh = _overlay_fs_split_path(image.replace(/\.png$/g, '.rpgmvp').toLowerCase());
        let lastFile = bruh[bruh.length - 1];

        oDeep[lastFile] = {
            dataSource: {
                path: path.join(cache_base, `${job_id}.png`),
                type: "filesystem"
            },
            delta: false,
            injectionPoint: image.replace(/\.png$/g, '.rpgmvp').toLowerCase(),
            mode: "rpgmaker",
            ogName: path.basename(image.replace(/\.png$/g, '.rpgmvp'))
        };
    }
}