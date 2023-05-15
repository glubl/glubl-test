import * as dotenv from 'dotenv' 
dotenv.config()

import { NODE_TYPE } from "./libs/config";
import { initServer } from "./server";
import { initClient } from './client';
import { prompt } from './libs/prompter';

switch (NODE_TYPE) {
    case 'SERVER':
        initServer().then(({io, connections}) => prompt(io, connections))
        break;
    default:
        initClient()
        break;
}