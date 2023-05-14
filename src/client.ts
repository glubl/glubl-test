import { SocketClient } from "./libs/socket-client";
import { NODE_ID, SERVER_URL, TOKEN } from './libs/config'

var client: SocketClient

export async function initClient() {
    client = new SocketClient(NODE_ID, SERVER_URL, TOKEN, onMessage)
    client.connect()
}

function onMessage(this: SocketClient, message: any) {
    console.log(message)
}