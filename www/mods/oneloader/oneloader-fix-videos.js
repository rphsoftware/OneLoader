
if ($modLoader.$nwMajor < 45) {
    let old = PIXI.VideoBaseTexture.fromUrl;
    PIXI.VideoBaseTexture.fromUrl = function fromUrl(videoSrc, scaleMode, crossorigin, autoPlay) {
        if (typeof videoSrc === "string" && videoSrc.startsWith("movies/")) {
            window._logLine("YANFLY VIDEO " + videoSrc);
            let videoData = _vfs_resolve_file_sync(videoSrc);
            let b = new Blob([videoData], {type:"video/" + videoSrc.split(".")[videoSrc.split(".").length - 1]});
            let objectURL = URL.createObjectURL(b);
            let vidObj = old.call(this, {src: objectURL, mime: "video/" + videoSrc.split(".")[videoSrc.split(".").length - 1]}, scaleMode, crossorigin, autoPlay);
            let a = setInterval(function( ){
                if (!vidObj || !vidObj.source) {
                    window._logLine("YANFLY VIDEO some bullshit happened");
                    URL.revokeObjectURL(objectURL);
                    clearInterval(a);
                    return;
                }
            }, 300);
            return vidObj;
        } else {
            old.call(this, ...arguments);
        }
    };

    let oldDestroy = PIXI.VideoBaseTexture.destroy;
    PIXI.VideoBaseTexture.destroy = function() {
        let cs = this.source.src;
        console.log(cs);
        if (cs.startsWith("blob:")) {
            window._logLine("YANFLY VIDEO Revoking object url");
            URL.revokeObjectURL(cs);
        }
        oldDestroy.call(this, ...arguments);
    }

    let old_stock_playvideo = Graphics._playVideo;
    let old_onvideoend = Graphics._onVideoEnd;
    let ourl = Symbol("ObjectURL");
    let hasRevoked = Symbol("hasRevoked");

    Graphics._playVideo = function(src) {
        window._logLine("MV VIDEO " + src);
        let videoData = _vfs_resolve_file_sync(src);
        let b = new Blob([videoData], {type:"video/" + src.split(".")[src.split(".").length - 1]});
        if (this[ourl] && !this[hasRevoked]) URL.revokeObjectURL(this[ourl]);

        this[ourl] = URL.createObjectURL(b);
        this[hasRevoked] = false;

        old_stock_playvideo.call(this, this[ourl]);
    }

    Graphics._onVideoEnd = function() {
        if (!this[hasRevoked]) { 
            URL.revokeObjectURL(this[ourl]);
            this[hasRevoked] = true;
        
            window._logLine("MV VIDEO END");
            window._logLine("Revoking object url");
        }
        old_onvideoend.call(this);
    }

}