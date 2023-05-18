import path from "path"
import { Browser, Page } from "puppeteer"
import { Server } from "socket.io"
import { Socket } from "socket.io"
import { SocketClient } from "../libs/socket"
import { uuid } from "../libs/uuid"
import { SocketConnections } from "../types"
import { DeferredPromise } from "../libs/defer"
import { blue, cyan, green, magenta, red, yellow } from 'colorette'
import { randomInt } from "crypto"
import { SEA } from "gun"

type NTP = {
    t1: number
    t2: number
    t3: number
    t4: number
}

function roundTrip(ntp: NTP) {
    return (ntp.t4 - ntp.t1) - (ntp.t3 - ntp.t2)
}

export async function testLatencyServer(SEA: any, io: Server, connections: SocketConnections, mode: 'ONE' | 'ALL', times?: number, randomize?: boolean, initClientId?: string) {
    var [pair1, pair2] = await Promise.all([SEA.pair(), SEA.pair()])
    if (Object.keys(connections).length < 2)
        throw "There must be at least 2 connections!"
    var _c1: SocketConnections[keyof SocketConnections] | undefined
    if (initClientId) {
        _c1 = connections[initClientId||'']
        if (!_c1) {
            console.log("Init clientId doesn't exists, reverting to randomize")
            randomize = true
        }
    }
    randomize ??= true
    let peers = Object.values(connections)
    let results: number[][] = []
    let deferMap: {[peerId: string]: DeferredPromise<void>} = {}
    const cb = (peerId: string, res?: NTP[]) => {
        if (!(peerId in deferMap)) return
        if (res) {
            results.push(res.map(ntp => {
                let latency = roundTrip(ntp) / 2
                console.log(`Latency ${(''+latency).padEnd(6)} ${peerId}`)
                return latency
            }))
        }
        deferMap[peerId].resolve()
    }
    peers.forEach(p => p.socket.on("testLatencyResponse", cb))
    times ??= 5
    var i = mode === 'ALL' ? 1 : times 
    var maxI = i
    randomize ??= true
    console.log(`Starting latency test for ${i} times`, mode === 'ALL' ? "all at once" : '')
    while(i > 0) {
        console.log(`Test ${maxI - i + 1}`)
        let testId = uuid()
        peers.forEach(p => deferMap[p.peerId] = new DeferredPromise())

        if (mode === 'ALL') {
            io.emit("eval", `testLatencyClient2("${testId}", client, browser, "https://gun.dirtboll.com/gun", ${times}, ${peers.length})`)
        } else {
            var initiator: SocketConnections[keyof SocketConnections]
            if (randomize) {
                initiator = peers[randomInt(peers.length)]
            } else {
                initiator = _c1 || peers[0]
            }
            console.log(`Initiator: ${initiator.peerId}`)

            initiator.socket.broadcast.emit("eval", `testLatencyClient1("${testId}", client, browser, "https://gun.dirtboll.com/gun", ${peers.length})`)
            io.to(initiator.socketId).emit("eval", `testLatencyClient1("${testId}", client, browser, "https://gun.dirtboll.com/gun", ${peers.length}, ${JSON.stringify(await SEA.pair())}, true)`)
        }

        await Promise.all(Object.values(deferMap))
        i--
    }
    peers.forEach(p => p.socket.off("testLatencyResponse", cb))
    let tmp: number[]
    console.log(
        `Average latency: `, 
        (tmp = results.reduce((arr, v) => arr.concat(v), []))
            .reduce((a, b) => a + b, 0)/tmp.length
    )
}

export async function testLatencyClient1(testId: string, sc: SocketClient, browser: Browser, gunPeer: string, peerNum: number | string, pair?: any, initiator?: boolean) {
    console.log(path.join(process.cwd(), "public/latency.html"))
    let page = await browser.newPage()
    await listenPage(page)
    await page.goto(`file://${path.join(process.cwd(), "public/latency.html")}`)


    var init, sendRes, start: any
    let res = await new Promise<NTP[] | undefined>(async (res, rej) => {
        await page.exposeFunction("sendRes", (msg?: NTP[]) => {
            res(msg)
        })
        await page.evaluate((testId, gunPeer, pair, peerNum, initiator) => {
            init(gunPeer, pair)
                .then(() => start(initiator, testId, peerNum))
                .then(sendRes)
        }, testId, gunPeer, pair, peerNum, initiator ??= false)
    })
    console.log(res)
    sc.socket.emit("testLatencyResponse", sc.peerId, res)


    await page.close()
    // return "EEEE"
}

export async function testLatencyClient2(testId: string, sc: SocketClient, browser: Browser, gunPeer: string, times: number, peerNum: number) {
    console.log(path.join(process.cwd(), "public/latency.html"))
    let [page, pair] = await Promise.all([
        browser.newPage(),
        SEA.pair()
    ])
    await listenPage(page)
    await page.goto(`file://${path.join(process.cwd(), "public/latency.html")}`)

    var init, sendRes, start2: any
    let res = await new Promise<NTP[]>(async (res) => {
        await page.exposeFunction("sendRes", (msg: NTP[]) => {
            res(msg)
        })
        await page.evaluate((testId, gunPeer, pair, times, peerNum) => {
            init(gunPeer, pair)
                .then(() => start2(testId, times, peerNum))
                .then(sendRes)
        }, testId, gunPeer, pair, times, peerNum)
    })
    console.log(res)
    sc.socket.emit("testLatencyResponse", sc.peerId, res)

    await page.close()
    // return "EEEE"
}

async function listenPage(page: Page) {
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
    // let f12 = await page.target().createCDPSession();
    // await f12.send('Network.enable');
    // await f12.send('Page.enable');
    // f12.on('Network.webSocketFrameReceived', ({response}) => console.log(`V[[WS]] ${response.payloadData}`));
    // f12.on('Network.webSocketFrameSent', ({response}) => console.log(`^[[WS]] ${response.payloadData}`));
}
