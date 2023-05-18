import { SocketClient } from "./libs/socket";
import { HEADLESS, NODE_ID, SERVER_URL, TOKEN } from './libs/config'
import { Socket } from "socket.io";
import puppeteer, { Browser, Page } from 'puppeteer';


var client: SocketClient
var browser: Browser
var { testLatencyClient1, testLatencyClient2, testLatencyClient3 } = require("./tests")
export async function initClient() {
    browser = await puppeteer.launch({ headless: HEADLESS });
    console.log(`Setting up client`)
    console.log(`Connecting to ${SERVER_URL} as ${NODE_ID}`)
    client = new SocketClient(NODE_ID, SERVER_URL, TOKEN, console.log, onEval)
    client.connect()
}

const onEval = async (code: string, ack?: (...args: any[]) => void) => {
    var res: any
    try {
        console.log("receive eval", code)
        res = eval(code)
    } catch (error) {
        res = error
    }
    if (res instanceof Promise)
        res = await res
    if (!res) return
    if (ack)
        ack(res)
    else
        client.socket.emit("messageServer", res)
}
