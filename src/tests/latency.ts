import type { ISEA, ISEAPair } from "gun/types/sea"
import path from "path"
import { Page } from "puppeteer"
import { Server } from "socket.io"
import { Socket } from "socket.io"
import { SocketClient } from "../libs/socket-client"
import { uuid } from "../libs/uuid"
import { SocketConnections } from "../types"

export async function testLatencyServer(SEA: ISEA, io: Server, connections: SocketConnections, client1?: string, client2?: string) {
    let [pair1, pair2] = await Promise.all([SEA.pair(), SEA.pair()])
    
    var [ conn1, conn2 ] = !client1 || !client2 
        ? Object.values(connections)
        : [connections[client1], connections[client2]]
    if (!conn1 || !conn2)
        throw "There must be at least 2 connections!"
    let cb = (socket: Socket) => {
        let _cb = (peerId: string, res: any) => {
            console.log(peerId, res)
            socket.off("testLatencyResponse", _cb)
        }
        return _cb
    }
    conn1.socket.on("testLatencyResponse", cb(conn1.socket))
    conn2.socket.on("testLatencyResponse", cb(conn2.socket))
    let testId = uuid()
    io.to(conn1.socketId).emit("eval", `testLatencyClient("${testId}", client, page, ${JSON.stringify(pair1)}, ${JSON.stringify(pair2)}, "https://gun.dirtboll.com/gun")`)
    io.to(conn2.socketId).emit("eval", `testLatencyClient("${testId}", client, page, ${JSON.stringify(pair2)}, ${JSON.stringify(pair1)}, "https://gun.dirtboll.com/gun")`)
}

type NTP = {
    t1: number
    t2: number
    t3: number
    t4: number
}

export async function testLatencyClient(testId: string, sc: SocketClient, page: Page, pair: ISEAPair, friend: ISEAPair, peer: string) {
    console.log(path.join(process.cwd(), "public/latency.html"))
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
    sc.socket.emit("testLatencyResponse", sc.peerId, prom)
    // return "EEEE"
}