import * as dotenv from 'dotenv' 
dotenv.config()

import { NODE_TYPE } from "./libs/config";
import { initServer } from "./server";
import { initClient } from './client';

switch (NODE_TYPE) {
    case 'SERVER':
        initServer()
        break;
    default:
        initClient()
        break;
}