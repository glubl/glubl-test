import path from "path"
import { Browser, Page } from "puppeteer"
import { Server } from "socket.io"
import { Socket } from "socket.io"
import { SocketClient } from "../libs/socket"
import { uuid } from "../libs/uuid"
import { SocketConnections } from "../types"
import { DeferredPromise } from "../libs/defer"
import { blue, cyan, green, magenta, red, yellow } from 'colorette'

type NTP = {
    t1: number
    t2: number
    t3: number
    t4: number
}

function roundTrip(ntp: NTP) {
    return (ntp.t4 - ntp.t1) - (ntp.t3 - ntp.t2)
}

export async function testLatencyServer(SEA: any, io: Server, connections: SocketConnections, client1?: string, client2?: string, times?: number, alternate?: boolean) {
    var [pair1, pair2] = await Promise.all([SEA.pair(), SEA.pair()])
    let [ _c1, _c2 ] = Object.values(connections)
    var [ conn1, conn2 ] = [ 
        (client1 && connections[client1]) || _c1, 
        (client2 && connections[client2]) || _c2
    ]
    if (!conn1 || !conn2)
        throw "There must be at least 2 connections!"

    let results: number[] = []
    let deferMap: {[peerId: string]: DeferredPromise<void>} = {}
    let cb = (peerId: string, res?: NTP) => {
        if (res) {
            let latency = roundTrip(res) / 2
            console.log(`Latency ${latency}`)
            results.push(latency)
        }
        deferMap[peerId].resolve()
    }
    conn1.socket.on("testLatencyResponse", cb)
    conn2.socket.on("testLatencyResponse", cb)
    var i = times || 5
    alternate ??= true
    console.log(`Starting latency test for ${i} times`)
    while(i > 0) {
        let testId = uuid()
        deferMap[conn1.peerId] = new DeferredPromise()
        deferMap[conn2.peerId] = new DeferredPromise()

        io.to(conn1.socketId).emit("eval", `testLatencyClient("${testId}", client, browser, ${JSON.stringify(pair1)}, ${JSON.stringify(pair2)}, "https://gun.dirtboll.com/gun")`)
        io.to(conn2.socketId).emit("eval", `testLatencyClient("${testId}", client, browser, ${JSON.stringify(pair2)}, ${JSON.stringify(pair1)}, "https://gun.dirtboll.com/gun")`)
        
        await deferMap[conn1.peerId]
        await deferMap[conn2.peerId]

        if (alternate) {
            // ;([pair1, pair2] = [pair2, pair1])
            ;([conn1, conn2] = [conn2, conn1])
        }
        i--
    }
    conn1.socket.off("testLatencyResponse", cb)
    conn2.socket.off("testLatencyResponse", cb)
    console.log(`Average latency: `, results.reduce((a, b) => a + b, 0)/results.length)
}

export async function testLatencyClient(testId: string, sc: SocketClient, browser: Browser, pair: any, friend: any, peer: string) {
    console.log(path.join(process.cwd(), "public/latency.html"))
    console.log(browser.isConnected())
    let page = await browser.newPage()
    listenPage(page)
    await page.goto(`file://${path.join(process.cwd(), "public/latency.html")}`)
    var window, init, SEA, secret, addFriend, user, sendRes, start: any
    let prom = await new Promise<NTP | undefined>(async (res, rej) => {
        await page.exposeFunction("sendRes", (msg?: NTP) => {
            res(msg)
        })
        await page.evaluate((pair, friend, peer, testId) => {
            init(peer, pair, friend)
                .then(() => start([pair.pub, friend.pub].sort()[0] === pair.pub, testId))
                .then(sendRes)
        }, pair, friend, peer, testId)
    })
    console.log(prom)
    await page.close()
    sc.socket.emit("testLatencyResponse", sc.peerId, prom)
    // return "EEEE"
}

function listenPage(page: Page) {
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
}