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
    page1.goto("https://web.whatsapp.com"),
    page2.goto("https://web.whatsapp.com")
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
    page1.waitForSelector('[data-testid="message-yourself-row"]')
      .then(() => page1.click('[data-testid="message-yourself-row"]')),
    page2.waitForSelector('[data-testid="message-yourself-row"]')
      .then(() => page2.click('[data-testid="message-yourself-row"]'))
  ])

  /**
   * 100 to 100_000
   */
  await new Promise((res) => setTimeout(res, 500))
  const BASE_N = 200
  var n = 0
  for (var i = 0; i <= 500; i++) {
    await new Promise((res) => setTimeout(res, 500))
    n += BASE_N
    let len = await send(page1, BASE_N)
    let t1 = +new Date()
    let t2 = await wait(page2, trigger2)
    console.log(`${t2 - t1},${len}`)
  }
})();

/**
 * @param { puppeteer.Page } page 
 * @param { number } n
 */
async function send(page, n) {
  var len = await page.$eval(`#main div[contenteditable="true"]`, (el, n) => {
    window.msg = (window.msg||'') + 'a'.repeat(n)
    window.dt = window.dt ??= new DataTransfer();
    window.dt.setData('text/plain', window.msg);
    el.focus()
    el.dispatchEvent(
      new ClipboardEvent('paste', {
        clipboardData: window.dt,
  
        // need these for the event to reach Draft paste handler
        bubbles: true,
        cancelable: true
      })
    );
    window.dt.clearData();
    return window.msg.length
  }, n)
  await page.click('[class="_3Uu1_"]')
  await page.keyboard.press("Enter")
  return len
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
      const targetNode = document.querySelector('[role="application"]');
      observer.observe(targetNode, {childList: true});
    })
  }).then(() => {
    trigger.fn = undefined
    return +new Date()
  })
}