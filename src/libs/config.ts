import { uuid } from "./uuid";

type NodeType = 'CLIENT' | 'SERVER'

export const HEADLESS = process.env.HEADLESS === undefined ? false : 'new'
export const HOST = process.env.HOST || 'localhost'
export const PORT = parseInt(process.env.PORT || '3030');
export const DEV = process.env.NODE_ENV === "development";
export const TOKEN = process.env.TOKEN || '';
export const NODE_TYPE: NodeType = ['CLIENT', 'SERVER']
    .indexOf((process.env.NODE_TYPE||'').toUpperCase()) > -1 
        ? process.env.NODE_TYPE as NodeType
        : 'CLIENT'
export const NODE_ID = process.env.NODE_ID || uuid()
export const SERVER_URL = process.env.SERVER_URL || "http://localhost:3030"