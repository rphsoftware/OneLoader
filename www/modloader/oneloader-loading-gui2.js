// Image credit: Bajamaid
const hot_catgirl = `data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAZlBMVEX///8yNz5AQlGVqMEAAAD1+f/rv66/cV4cHSSetM/99+52WUcqLD7B0uCut8KAk8f/3NZwcHD++/X029LM4PXNwdY+VXCSs9x9nMKszOxqdd0hLFQdITCZsP/q+P/D1N1vfpI8SXYiyUzWAAAAAXRSTlMAQObYZgAAANtJREFUeNp0jIUWBCEIAA10e6+78P9/8rAuYTaMmYf6ILxXlnALdRWCazTkr2KACTnARwJRCIqPieDvxd/5AslkHlLwRg5QCqJHAPAY/w8MgQlg3qzAw/54gnC7BS5YrQFgKwUW5uUSetgdD3CJ/i+wAND3Pf0vZzYgmoi1XIDR6nGcxtFiODMDmsZ7bZxzxqL/913X9T0FxhkKmn/vXOeHIQda/dNN0zBYq7XThOKKhSVv4oQ4ggOrF4voK1r2ciEG70K/NedjUlESjffxVSKtMfFVMm37HAiRBgAiGRaKlPJ1XQAAAABJRU5ErkJggg==`;

window.$oneLoaderGui = new (class OneLoaderGui {
    constructor() {
        this.easterEgg = {
            month: 6,
            day: 6,
            text: "Happy Birthday SJ and Jakey"
        }
        this.container = document.createElement("div");
        this.container.style = "font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background: #222; color: white; width: 100vw; height: 100vh; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;";
        requestAnimationFrame(() => { this.tryMount(); });

        let catgirlScale = Math.floor(Math.floor(Math.min(window.innerWidth, window.innerHeight) / 3) / 32);

        let catgirlAnimationOptions = [
            ["__oneloader_catgirl__1_", "2s linear"],
            ["__oneloader_catgirl__2_", "2s cubic-bezier(0.68, 1.1, 0.59, 0.79)"],
            ["__oneloader_catgirl__3_", "1s ease"]
        ];

        let pickedOption = catgirlAnimationOptions[Math.floor(Math.random() * catgirlAnimationOptions.length)];

        this.container.innerHTML = `
        <div class="header-container" style="display: flex; justify-content: center; position: fixed; top: 0; left: 0; right: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif">
        <span class="e" style="font-size: 2em; font-weight: 900; margin: 0; position: relative;"><span style="color: #0089D7">One</span>Loader</span>
    </div>
    <div class="circle-container">
        <div data-ol="circle" style="width: 180px; height: 180px; --percentage: 50; position: relative;">
            <svg width="180" height="180">
                <circle
                    stroke-width="12"
                    stroke="#444"
                    r="80"
                    cx="90"
                    cy="90"
                    fill="transparent"
                >
                </circle>
                <circle
                    stroke-width="12"
                    stroke="#0089D7"
                    r="80"
                    cx="90"
                    cy="90"
                    fill="transparent"
                    style="stroke-dasharray: calc(calc(160 * 3.14159265) * calc(var(--percentage) / 100)), 99999; transform: rotate(-90deg); transform-origin: 50% 50%;"
                >
                </circle>
            </svg>
            <div style="position: absolute; top: 0; left: 0; right: 0; bottom: 0; display: flex; align-items: center; justify-content: center;">
                <h2 data-ol="percentage">50%</h2>
            </div>
        </div>
    </div>
    <h2 data-ol="pbi" style="margin-top: 0; margin-bottom: 0;">a</h2>
    <h4 data-ol="psi" style="margin-top: 0; margin-bottom: 0; font-weight: 400;">a</h4>
    <div style="position: fixed; bottom: 0; left: 0; color: #666; ">
        v<span data-ol="vernum">???</span>
    </div>
    <style>
        #__oneloader_catgirl__ {
            animation: ${pickedOption[0]} ${pickedOption[1]} infinite;
            transform-origin: center;
        }
        @keyframes __oneloader_catgirl__1_ {
            0% {
                transform: rotateY(0deg);
            }
            100% {
                transform: rotateY(360deg);
            }
        }
        @keyframes __oneloader_catgirl__2_ {
            0% {
                transform: scale(1);
            }
            50% {
                transform: scale(0);
            }
            100% {
                transform: scale(1);
            }
        }
        @keyframes __oneloader_catgirl__3_ { /* Credit: @kodicraft */
            0% {
                transform: translate(0px, 0px) scale(1.0, 1.0);
            }
            25% {
                transform: translate(0px, -128px) scale(1.0, 1.0);
            }
            50% {
                transform: translate(0px, 0px) scale(1.0, 1.0);
            }
        }
    </style>
    <img id="__oneloader_catgirl__" width="${catgirlScale * 32}" height="${catgirlScale * 32}" src="${hot_catgirl}" style="position: fixed; bottom: 0; right: 0; image-rendering: pixelated; z-index: 0;">
        `;
        this.vernum = this.container.querySelector("[data-ol=vernum]");
        this.percentage = this.container.querySelector("[data-ol=percentage]");
        this.progressInfoText = this.container.querySelector("[data-ol=pbi]");
        this.statusText = this.container.querySelector("[data-ol=psi]");
        this.circle = this.container.querySelector("[data-ol=circle]");
    }

    setVersionNumber(v) {
        if ((new Date()).getDate() === this.easterEgg.day && (new Date()).getMonth() === this.easterEgg.month) {
            v = v + " || " + this.easterEgg.text;
        }
        v = v + " || OneLoader catgirl by bajamaid"
        this.vernum.innerText = v;
    }

    redrawProgress() {
        if(Number.isNaN(((this.pbCurr / this.pbMax) * 100))) {
            this.circle.style.setProperty("--percentage", 100);
            this.percentage.innerText = "100%";
            return;
        }
        this.circle.style.setProperty("--percentage", (this.pbCurr / this.pbMax) * 100);
        this.percentage.innerText = `${((this.pbCurr / this.pbMax) * 100).toFixed(0)}%`
    }

    setPbMax(pbMax) {
        this.pbMax = pbMax;
        this.redrawProgress();
    }

    setPbCurr(pbCurr) {
        this.pbCurr = pbCurr;
        this.redrawProgress();
    }

    inc() {
        this.pbCurr++;
        this.redrawProgress();
    }

    setHt(text, nd) {
        this.progressInfoText.innerText = text;
        if (!nd) this.pbCurr = 0;
        this.statusText.innerText = "";
        this.redrawProgress();
    }

    pst(text) {
        this.statusText.innerText = text;
    }

    tryMount() {
        if (document.body) {
            document.body.appendChild(this.container);
            document.body.style.margin = 0;
        } else {
            requestAnimationFrame(() => { this.tryMount(); });
        }
    }
})();