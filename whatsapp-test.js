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
      .on('response', response =>
        console.log(green(`${response.status()} ${response.url()}`)))
      .on('requestfailed', request =>
        console.log(magenta(`${request.failure().errorText} ${request.url()}`)))
    return page
}

(async () => {
  const [browser1, browser2] = await Promise.all([
    puppeteer.launch({headless: false}),
    puppeteer.launch({headless: false})
  ]);
  const [page1, page2] = await Promise.all([
    browser1.goto("https://web.whatsapp.com"),
    browser2.goto("https://web.whatsapp.com")
  ])
})();