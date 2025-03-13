(function() {
    function OLD_modLoader_install_debugger_vfs(shadowfs, nativefs) {
        if ($modLoader.$nwMajor >= 45) { alert("Versions of NW newer than 0.45.0 are not supported!"); throw new Error();}

        async function buildResponseBody(data) {
            $modLoader.$vfsTrace("WEB REQUEST " + JSON.stringify(data));
            let url = new URL(data.request.url);

            if ($modLoader.isInTestMode) {
                if (url.origin === window.location.origin) {
                    let vfsPath = url.pathname;
                    try {
                        let rdata = await _vfs_resolve_file(vfsPath);
                        let hS = "";
                        for (let header in data.responseHeaders) {
                            hS = `${hS}${header}: ${data.responseHeaders[header]}\n`;
                        }

                        let responseBody = `HTTP/1.1 200 OK\n${hS}\n`;
                        responseBody = Buffer.concat([Buffer.from(responseBody), rdata]).toString("base64");
                        return {
                            interceptionId: data.interceptionId,
                            rawResponse: responseBody
                        };
                    } catch(e) {
                        window._logLine("Error occured when building response body: " + e.stack);
                        return {
                            interceptionId: data.interceptionId
                        }
                    }
                } else {
                    return {
                        interceptionId: data.interceptionId
                    }
                }
            } else {
                if (url.origin === window.location.origin && url.pathname.startsWith("/www/")) {
                    let vfsPath = url.pathname.replace(/^[\/\\]*www[\/\\]*/, "");
                    try {
                        let rdata = await _vfs_resolve_file(vfsPath);
                        let hS = "";
                        for (let header in data.responseHeaders) {
                            hS = `${hS}${header}: ${data.responseHeaders[header]}\n`;
                        }

                        let responseBody = `HTTP/1.1 200 OK\n${hS}\n`;
                        responseBody = Buffer.concat([Buffer.from(responseBody), rdata]).toString("base64");
                        return {
                            interceptionId: data.interceptionId,
                            rawResponse: responseBody
                        };
                    } catch(e) {
                        window._logLine("Error occured when building response body: " + e.stack);
                        return {
                            interceptionId: data.interceptionId
                        }
                    }
                } else {
                    return {
                        interceptionId: data.interceptionId
                    }
                }
            }
        }
        return new Promise(resolve => {
            window._logLine("Gathering chrome devtools remote debugging candidates");
            chrome.debugger.getTargets((t) => {
                let debugee = {targetId: ""};
                for (let candidate of t) {
                    if (candidate.url.endsWith("index.html")) {
                        debugee.targetId = candidate.id;
                    }
                }

                chrome.debugger.detach(debugee, () => {
                    if(chrome.runtime.lastError) {
                        console.warn(chrome.runtime.lastError.message);
                    }

                    chrome.debugger.attach(debugee, "1.2", () => {
                        window._logLine("[DEVTOOLS] Successfully attached!");
                        chrome.debugger.onEvent.addListener(async (debugee, event, data) => {
                            if (event === "Network.requestIntercepted") {
                                chrome.debugger.sendCommand(debugee, "Network.continueInterceptedRequest", await buildResponseBody(data));
                            }
                        });
                        if (!$modLoader.isInTestMode) {
                            chrome.debugger.sendCommand( 
                                debugee, 
                                "Network.setRequestInterception", 
                                {
                                    enabled: true, 
                                    patterns: [ 
                                        {
                                            urlPattern: window.location.origin + "/www/*",
                                            interceptionStage: "HeadersReceived"
                                        }
                                    ]
                                }
                            );
                        } else {
                            chrome.debugger.sendCommand( 
                                debugee, 
                                "Network.setRequestInterception", 
                                {
                                    enabled: true, 
                                    patterns: [ 
                                        {
                                            urlPattern: window.location.origin + "/*",
                                            interceptionStage: "HeadersReceived"
                                        }
                                    ]
                                }
                            );
                        }

                        setTimeout(resolve, 100);
                    });

                    window.__unload_web_vfs = function() {
                        chrome.debugger.detach(debugee);
                    };
                    window.addEventListener("beforeunload", function(e) {
                        chrome.debugger.detach(debugee);
                    });
                });
            })
        });
    }
    async function NEW_modLoader_install_debugger_vfs(shadowfs, nativefs) {

        $modLoader.serviceWorker = await window.$__1l_sw_pre_registration;
        window.$__1l_sw_pre_registration = undefined;

        await new Promise(async resolve => {
            function cb(event) {
                console.log("cb", event);
                if (event.data.msgType === "hello-ack") resolve();
                navigator.serviceWorker.removeEventListener("message", cb);
            }
            navigator.serviceWorker.addEventListener("message", cb);

            await navigator.serviceWorker.ready;

            $modLoader.serviceWorker.active.postMessage({
                msgType: "hello"
            });
        });

        navigator.serviceWorker.addEventListener("message", async ev => {
            if (ev.data.msgType !== "vfsGet") return;

            try {
                let vfsPath = $modLoader.isInTestMode ? ev.data.url.replace(/^[\/\\]/, "") : ev.data.url.replace(/^[\/\\]*www[\/\\]*/, "");

                let data = await _vfs_resolve_file(vfsPath);
                let ext = vfsPath.split(".")[vfsPath.split(".").length - 1];
                let mime = Mime.getType(ext);

                let ab = new ArrayBuffer(data.byteLength);
                new Uint8Array(ab).set(data);

                ev.source.postMessage({
                    msgType: "vfsResponse",
                    reqId: ev.data.reqId,
                    mimeType: mime, 
                    payload: ab
                }, [ab]);
            } catch(e) {
                ev.source.postMessage({
                    msgType: "vfsResponse",
                    reqId: ev.data.reqId,
                    payload: false
                }, []);
            }
        });

        try {
            const response = await fetch("224c69c2-cb60-49c9-bcb3-f0551ebfa5d7/5c4d7810-24a0-4772-86ad-97aa9a8127e8.3d08c9b4-eb47-4e96-b2fa-6b64b67fb139").then(res=>res.text())
            if (response !== "1d4eb7cb-64a3-4c21-a77e-254be18be709") {
                await $modLoader.serviceWorker.update();
                location.reload();
                return;
            }
        } catch(e) {
            await $modLoader.serviceWorker.update();
            location.reload();
            return;
        }
    }

    window._modLoader_install_debugger_vfs = function() {
        if (!window.legacyMode) {
            return NEW_modLoader_install_debugger_vfs();
        } else {
            return OLD_modLoader_install_debugger_vfs();
        }
    }
})();