{
    let fs = require('fs');
    let fd = fs.openSync("latest.log", "w");
    let startTime = new Date().getTime();
    window._logLine = function(text) {
        let currTime = new Date().getTime();
        let diff = currTime - startTime;
        diff /= 1000;
        logLine = `[${diff.toFixed(3).padStart(10, " ")}] ${text}\n`;
        fs.writeSync(fd, logLine);
    }
}