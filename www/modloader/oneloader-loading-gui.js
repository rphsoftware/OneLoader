window.$oneLoaderGui = new (class OneLoaderGui {
    constructor() {
        this.container = document.createElement("div");
        this.container.style = "background-color: hsla(0, 0%, 11%, 1); width: 100vw; height: 100vh; position: relative; display: flex; flex-direction: column; align-items: center; justify-content: center;";
        requestAnimationFrame(() => { this.tryMount(); });

        this.heading = document.createElement("h1");
        this.heading.style = "position: absolute; top: 0; left:0; right: 0; background-color: hsla(0, 0%, 19%, 1); font-weight: 100; margin: 0; font-family: Trebuchet MS; font-size: 24px; color: white; line-height: 48px; padding-left: 4px; text-align: center";
        this.heading.innerText = "OneLoader";

        this.statusText = document.createElement("code");
        this.statusText.style = "position: absolute; bottom: 0; left: 0; font-size: 16px; color: white; line-height: 24px;";
        this.statusText.innerText = "Preparing...";

        this.stt = new Set();

        this.progressInfoText = document.createElement("h1");
        this.progressInfoText.style = "color: white; font-family: Helvetica; font-weight: 500; margin: 0;";
        this.progressInfoText.innerText = "Preparing...";

        this.progress = document.createElement("div");
        this.progress.style = "overflow: hidden; width: 480px; background: #333; height: 16px; position: relative;";
        
        this.progressInner = document.createElement("div");
        this.progressInner.style = "width: 0%; position: absolute; background: hsl(200, 85%, 35%); top: 0; left:0; bottom: 0; transition: width .2s linear;";
        this.progress.appendChild(this.progressInner);

        this.pbMax = 100;
        this.pbCurr = 0;


        this.container.appendChild(this.progressInfoText);
        this.container.appendChild(this.heading);
        this.container.appendChild(this.statusText);
        this.container.appendChild(this.progress);
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
        let descriptor = [this.statusText, 0];
        this.stt.add(descriptor);
        for (let a of Array.from(this.stt)) {
            a[1] += 24;
            a[0].style.bottom = `${a[1]}px`;
        }

        setTimeout(() => {
            descriptor[0].remove();
            this.stt.delete(descriptor);
        }, 100);

        this.statusText = document.createElement("code");
        this.statusText.style = "position: absolute; bottom: 0; left: 0; font-size: 16px; color: white; line-height: 24px;";
        this.statusText.innerText = text;
        this.container.appendChild(this.statusText);
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
