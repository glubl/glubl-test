
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
    .on('pageerror', ({ message }) => console.log(red(message)))
    .on('response', response =>
      console.log(green(`${response.status()} ${response.url()}`)))
    .on('requestfailed', request =>
      console.log(magenta(`${request.failure().errorText} ${request.url()}`)))
  return page
}

function randInt(min, max) {
  min = Math.ceil(min);
  max = Math.floor(max);
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randStr(length) {
  let result = '';
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const charactersLength = characters.length;
  let counter = 0;
  while (counter < length) {
    result += characters.charAt(Math.floor(Math.random() * charactersLength));
    counter += 1;
  }
  return result;
}

/** @type {{fn: () => void | undefined}}} */
var trigger1 = {}
/** @type {{fn: () => void | undefined}} */
var trigger2 = {}
;(async () => {
  const [browser1, browser2] = await Promise.all([
    puppeteer.launch({ headless: false, userDataDir: '/tmp/myChromeSession1' }),
    puppeteer.launch({ headless: false, userDataDir: '/tmp/myChromeSession2' })
  ]);
  const [page1, page2] = await Promise.all([
    browser1.newPage(),
    browser2.newPage()
  ])
  await Promise.all([
    page1.goto("http://localhost:5005"),
    page2.goto("http://localhost:5005")
  ])

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

  await Promise.all([
    page1.exposeFunction("trigger", () => {
      (trigger1.fn||(()=>{}))()
    }),
    page2.exposeFunction("trigger", () => {
      (trigger2.fn||(()=>{}))()
    }),
  ])

  await Promise.all([
    (async () => {
      var el = await page1.waitForSelector("#header .drawer-button")
      await new Promise(res => setTimeout(res, 500))
      await el.click()
      el = await page1.waitForSelector('[data-friend-id="S2rNZvrIJpZXMghRCsLZxmZ7rrsG2qduFu0b7GMTYRo.R4bnUEzLwU5EygJs1VmfLn0vF-j9lrv7X5-OeqQja_s"]')
      await new Promise(res => setTimeout(res, 500))
      await el.click()
      el = await page1.waitForSelector('button.cursor-pointer')
      await new Promise(res => setTimeout(res, 500))
      await el.click()
      await new Promise(res => setTimeout(res, 500))
      el = await page1.waitForSelector('#chat-screen input')
      await el.click()
    })(),
    (async () => {
      var el = await page2.waitForSelector("#header .drawer-button")
      await new Promise(res => setTimeout(res, 500))
      await el.click()
      el = await page2.waitForSelector('[data-friend-id="ngC4sqSfuue5V5V9h7QPI6I226tVCXnYZdahMX5YW8Q.GUetdEbN7Pbg17VovPsUDbQ1ne0Xtl5GHZB7KNuq3O0"]')
      await new Promise(res => setTimeout(res, 500))
      await el.click()
      el = await page2.waitForSelector('button.cursor-pointer')
      await new Promise(res => setTimeout(res, 500))
      await el.click()
      await new Promise(res => setTimeout(res, 500))
      el = await page2.waitForSelector('#chat-screen input')
      await el.click()
    })()
  ])

  await new Promise((res) => setTimeout(res, 500))

  for (var i = 0; i <= 500; i++) {
    await new Promise((res) => setTimeout(res, 500))
    let text = randStr(512)
    await send(page1, text)
    let t1 = +new Date()
    let t2 = await wait(page2, trigger2)
    console.log(`${t2 - t1},${text.length}`)
  }
})();

/**
 * @param { puppeteer.Page } page 
 * @param { string } msg
 */
async function send(page, msg) {
  await page.click('#chat-screen input')
  await page.type('#chat-screen input', msg);
  await page.keyboard.press("Enter")
}

/**
 * 
 * @param { puppeteer.Page } page 
 * @param { {fn: () => void | undefined} } trigger 
 * @returns 
 */
async function wait(page, trigger) {
  return new Promise((res) => {
    trigger.fn = res
    page.evaluate(() => {
      const observer = new MutationObserver(function(_, observer) {
        observer.disconnect();
        trigger()
      });
      const targetNode = document.querySelector('#contents');
      observer.observe(targetNode, {childList: true});
    })
  }).then(() => {
    trigger.fn = undefined
    return +new Date()
  })
}