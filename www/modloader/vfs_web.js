function _modLoader_install_debugger_vfs(shadowfs, nativefs) {
    async function buildResponseBody(data) {
        let url = new URL(data.request.url);

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

                    setTimeout(resolve, 100);
                });

                window.addEventListener("beforeunload", function(e) {
                    chrome.debugger.detach(debugee);
                });
            });
        })
    });
}