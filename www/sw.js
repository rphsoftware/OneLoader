const knownClients = [];

const handlers = new Map();

addEventListener("fetch", async fetchEvent => {
    if (!knownClients.includes(fetchEvent.clientId)) return;

    const req = fetchEvent.request;

    const url = new URL(req.url);
    const base = (new URL(self.registration.scope)).origin;

    if (url.origin !== base) {
        console.log("origin mismatch. fallthrough");
        return;
    }

    if (url.pathname === "/index.html" || url.pathname === "/www/index.html") {
        console.log("index dot eich tee em ell");
        return;
    }

    return fetchEvent.respondWith(new Promise(async (resolve) => {
        const client = await clients.get(fetchEvent.clientId);
        const reqId = `${Math.random()}.${Math.random()}.${Math.random()}`;
        await client.postMessage({
            msgType: "vfsGet",
            url: url.pathname,
            reqId
        });
        const { mimeType, payload } = await new Promise(resolve => handlers.set(reqId, resolve));
        if (!payload) {
            resolve(new Response(new ArrayBuffer(0), {
                headers: {
                    "Content-Length": 0
                },
                status: 404
            }));
        } else {
            resolve(new Response(payload, {
                headers: {
                    "Content-Type": mimeType,
                    "Content-Length": payload.byteLength
                },
                status: 200
            }));
        }
    }));
});

addEventListener("message", async messageEvent => {
    if (messageEvent.data.msgType === "hello") {
        knownClients.push(messageEvent.source.id);
        console.log("registered new client!");
        messageEvent.source.postMessage({
            msgType: "hello-ack"
        });

        return
    }

    if (messageEvent.data.msgType === "vfsResponse") {
        if (handlers.has(messageEvent.data.reqId)) {
            handlers.get(messageEvent.data.reqId)(messageEvent.data);
            handlers.delete(messageEvent.data.reqId);
        }
        return;
    }
})

addEventListener('activate', function(event) {
    return self.clients.claim();
});
