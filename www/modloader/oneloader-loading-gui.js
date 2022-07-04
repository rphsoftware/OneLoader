window.$oneLoaderGui = new (class OneLoaderGui {
    constructor() {
        this.container = document.createElement("div");
        this.container.style = "width: 100vw; height: 100vh; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;";
        requestAnimationFrame(() => { this.tryMount(); });

        this.heading = document.createElement("h1");
        this.heading.style = "position: absolute; top: 0; left:0; right: 0; background: linear-gradient(hsl(230, 85%, 35%), hsl(200, 85%, 35%)); margin: 0; font-family: Helvetica; font-size: 24px; color: white; line-height: 48px; border-bottom: 4px solid hsl(200, 85%, 35%); padding-left: 4px;";
        this.heading.innerText = "OneLoader";

        this.statusText = document.createElement("code");
        this.statusText.style = "font-size: 16px; color: white; line-height: 24px;";
        this.statusText.innerText = "Preparing";

        this.progressInfoText = document.createElement("h1");
        this.progressInfoText.style = "color: white; font-family: Helvetica; font-weight: 900; margin: 0;";
        this.progressInfoText.innerText = "Preparing";

        this.progress = document.createElement("div");
        this.progress.style = "overflow: hidden; width: 480px; background: #333; height: 16px; position: relative;";
        
        this.progressInner = document.createElement("div");
        this.progressInner.style = "width: 0%; position: absolute; background: hsl(200, 85%, 35%); top: 0; left:0; bottom: 0; transition: width .2s linear;";
        this.progress.appendChild(this.progressInner);

        this.pbMax = 100;
        this.pbCurr = 0;


        this.container.appendChild(this.progressInfoText);
        this.container.appendChild(this.heading);
        this.container.appendChild(this.progress);
        this.container.appendChild(this.statusText);
    }

    redrawProgress() {
        this.progressInner.style.width = `${(this.pbCurr / this.pbMax) * 100}%`;
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