import { SocketClient } from "./libs/socket-client";
import { NODE_ID, SERVER_URL, TOKEN } from './libs/config'
import { Socket } from "socket.io";
import type { ThenableWebDriver } from 'selenium-webdriver'
import type { Builder } from 'selenium-webdriver'

var client: SocketClient
var driver: ThenableWebDriver
export async function initClient() {
    require('chromedriver');
    var webdriver = require('selenium-webdriver');
    driver = (new webdriver.Builder() as Builder)
        .forBrowser('chrome')
        .build();

    console.log(`Setting up client`)
    console.log(`Connecting to ${SERVER_URL} as ${NODE_ID}`)
    client = new SocketClient(NODE_ID, SERVER_URL, TOKEN, onMessage, onEval)
    client.connect()
}

function onMessage(this: Socket, message: any) {
    console.log(message)
}

function onEval(this: Socket, code: string) {
    try {
        console.log("receive eval", code)
        eval(code)
    } catch (error) {
        this.emit("messageServer", ""+error)
    }
}