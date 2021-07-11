
let old = PIXI.VideoBaseTexture.fromUrl;
PIXI.VideoBaseTexture.fromUrl = function fromUrl(videoSrc, scaleMode, crossorigin, autoPlay) {
    if (typeof videoSrc === "string" && videoSrc.startsWith("movies/")) {
        let videoData = _vfs_resolve_file_sync(videoSrc);
        let b = new Blob([videoData], {type:"video/" + videoSrc.split(".")[videoSrc.split(".").length - 1]});
        let objectURL = URL.createObjectURL(b);
        let vidObj = old.call(this, {src: objectURL, mime: "video/" + videoSrc.split(".")[videoSrc.split(".").length - 1]}, scaleMode, crossorigin, autoPlay);
        let a = setInterval(function( ){
            if (vidObj.source.readyState === 4 && (vidObj.source.buffered.end(0) >= vidObj.source.duration) && vidObj.source.ended) {
                window._logLine("Revoking object url");
                URL.revokeObjectURL(objectURL);
                clearInterval(a);
            }
        }, 300);
        return vidObj;
    } else {
        old.call(this, ...arguments);
    }
};
