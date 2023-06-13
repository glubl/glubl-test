// Import puppeteer
const puppeteer = require('puppeteer');
const path = require('path');
const { blue, cyan, green, magenta, red, yellow } = require('colorette')
const readline = require('readline')

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
    // .on('pageerror', ({ message }) => console.log(red(message)))
    // .on('response', response =>
    //   console.log(green(`${response.status()} ${response.url()}`)))
    // .on('requestfailed', request =>
    //   console.log(magenta(`${request.failure().errorText} ${request.url()}`)))
  return page
}

const NUM_PEER = 2

/** @type {{fn: () => void | undefined}} */
var trigger1 = {}
/** @type {{fn: () => void | undefined}} */
var trigger2 = {}
;(async () => {
  const [browser1] = await Promise.all([
    puppeteer.launch({ headless: 'new' })
  ]);
  const pages = await Promise.all(Array.from({length: NUM_PEER}, () => browser1.newPage().then(listenPage)))
  await Promise.all(pages.map(p => p.goto("http://127.0.0.1:5500/public/latency-rtc.html")))

  async function close() {
    await Promise.all([
      browser1.close(),
      browser2.close(),
      rl.close()
    ])
  }

  rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
  });
  rl.on('line', async (line) => {
    let cmds = line.split(" ")
    switch (cmds[0]) {
      case "close":
        await close()
        break;
      default:
        console.log("Unknown command")
        break;
    }
  })
  .on('close', close)
  .setPrompt('> ')

})();
