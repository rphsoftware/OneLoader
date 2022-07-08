const crypto = require('crypto');
if (window.nw.App.argv[0] !== "test")
{
    window._modloader_encryption = new (class Encryption {
        constructor() {
            this.STEAM_KEY = window.nw.App.argv[0].replace("--", "");

            if (this.STEAM_KEY.length === 0) {
                alert("OMORI must be launched directly from Steam.");
                process.exit(0);
            }

            window._logLine("Encryption: Extracting asset key");

            const path = require('path');
            const base = path.dirname(process.mainModule.filename);
            const fs = require('fs');

            let systemJson = JSON.parse(this.decrypt(
                fs.readFileSync(
                    path.join(base, "data", "System.KEL")
                )
            ).toString("utf-8"));

            this.assetKeyBytes = [];
            let keyString = systemJson.encryptionKey;
            while (keyString.length > 0) {
                let byte = keyString.substring(0, 2);
                keyString = keyString.substring(2);
                this.assetKeyBytes.push(parseInt(byte, 16));
            }

            window._logLine("Encryption: Extracting decrypter from rpg_core.js");
            let rpg_core = fs.readFileSync(path.join(base, "js", "rpg_core.js")).toString("utf-8");
            let re = (/Decrypter\.([A-Za-z]+) *\= *\"([0-9a-fA-F]+)\";/g);
            this.decrypterLut = {};
            while(1) {
                let val = re.exec(rpg_core);
                if (val) {
                    this.decrypterLut[val[1]] = val[2];
                } else {
                    break;
                }
            }

            this.headerBytes = [];
            this.headerHex = this.decrypterLut["SIGNATURE"] + this.decrypterLut["VER"] + this.decrypterLut["REMAIN"];
            while (this.headerHex.length > 0) {
                let byte = this.headerHex.substring(0, 2);
                this.headerHex = this.headerHex.substring(2);
                this.headerBytes.push(parseInt(byte, 16));
            }

            this.headerBytes = Buffer.from(this.headerBytes);
        }

        decrypt(buffer) {
            const iv = buffer.slice(0, 16);
            buffer = buffer.slice(16);
            const cipherStream = crypto.createDecipheriv("aes-256-ctr", this.STEAM_KEY, iv);
            return Buffer.concat([cipherStream.update(buffer), cipherStream.final()]);
        }

        encrypt(buffer) {
            const iv = Buffer.from("EpicGamerMoment!");
            const cipherStream = crypto.createCipheriv("aes-256-ctr", this.STEAM_KEY, iv);
            return Buffer.concat([iv, cipherStream.update(buffer), cipherStream.final()]);
        }

        decryptAsset(buffer) {
            buffer = buffer.slice(16);
            for (let i = 0; i < 16; i++) {
                buffer[i] = buffer[i] ^ this.assetKeyBytes[i];
            }

            return buffer;
        }

        encryptAsset(buffer) {
            for (let i = 0; i < 16; i++) {
                buffer[i] = buffer[i] ^ this.assetKeyBytes[i];
            }

            return Buffer.concat([this.headerBytes, buffer]);
        }
    })();
} else {
    console.log("Loading fallback encryption system for test mode");
    window._modloader_encryption = new (class BSEncryption {
        decrypt(buffer) { return buffer; }
        encrypt(buffer) { return buffer; }
        decryptAsset(buffer) { return buffer; }
        encryptAsset(buffer) { return buffer; }
    });
}