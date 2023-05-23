// Import puppeteer
const puppeteer = require('puppeteer');
const path = require('path');
const { blue, cyan, green, magenta, red, yellow } = require('colorette')

async function listenPage(page) {
    page.on('console', message => {
        const type = message.type().substr(0, 3).toUpperCase()
        const colors = {
            LOG: text => text,
            ERR: red,
            WAR: yellow,
            INF: cyan
        }
        const color = colors[type] || blue
        console.log(color(`${type} ${message.text()}`))
    })
        .on('pageerror', ({ message }) => console.log(red(message)))
        .on('response', response => console.log(green(`${response.status()} ${response.url()}`)))
        .on('requestfailed', request => console.log(magenta(`${request.failure().errorText} ${request.url()}`)))
}

var http = require('http');
var finalhandler = require('finalhandler');
var serveStatic = require('serve-static');
var serve = serveStatic("./public");
var server = http.createServer(function(req, res) {
  var done = finalhandler(req, res);
  serve(req, res, done);
});
server.listen(8000, '127.0.0.1', undefined, start);

async function start() {
    const browser = await puppeteer.launch({ headless: 'new', protocolTimeout: 0 });

    const page = await browser.newPage();

    await listenPage(page)
    await page.goto(`http://localhost:8000/latency-indexeddb.html`)

    let re = await new Promise(async (resolve) => {
        await page.exposeFunction("sendRes", (msg) => {
            resolve(msg)
        })
        page.evaluate(async () => {
            async function doTest(size) {
                console.log("Size: ", size)
                await new Promise(res => indexedDB.deleteDatabase("radata").onsuccess = res)
                g = Gun({ localStorage: false })
                DAT = "a".repeat(size || 1024)
                res = []
                let finish = false;
                setTimeout(() => finish = true, 10 * 1000)
                fn = async () => {
                    return new Promise((resolve) => {
                        let t1 = +new Date
                        g.get("t").get("d").put(DAT, ({ err }) => {
                            if (err) { console.log(err); resolve(false) }
                            else { res[res.length] = +new Date() - t1; resolve(true) }
                        })
                    })
                }
                while (!finish && await fn());
                let lat = res.reduce((t, v) => t + v, 0) / res.length
                console.log("Average latency: ", lat)
                return { arr: res, avg: lat }
            }

            let map = {}
            console.log("start")
            for (num of Array.from({ length: 16 }, (_, i) => 1024 * 2 ** i)) {
                let { avg } = await doTest(num)
                map['' + num] = avg
            }
            sendRes(map)
        });
    })

    console.log(re);

    // Close browser.
    await browser.close();
    exit(0);
};