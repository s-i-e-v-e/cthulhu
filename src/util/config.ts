import {exists, readTextFile, writeTextFile} from "./io.ts";

/**
 * Copyright (C) 2020 Sieve
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as published by
 * the Free Software Foundation, either version 3 of the License, or
 * (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program.  If not, see <https://www.gnu.org/licenses/>.
 **/
const CONFIG_FILE = './.cthulhu/config/client.json'

export interface ServerEntry {
    url: string,
    port: number,
    user: string,
    pass: string,
    maxCons?: number,
    disable?: boolean,
}

interface ClientConfig {
    servers: ServerEntry[],
    reader: number,
}

const DEFAULT_CONFIG = {
    servers: [
        {
            url: 'news.neodome.net',
            port: 119,
        },
        {
            url: 'news.eternal-september.org',
            port: 443,
        },
        {
            url: 'nntp.aioe.org',
            port: 119,
        },
    ],
    reader: 0,
};

export function config_read(): ClientConfig {
    if (!exists(CONFIG_FILE)) {
        writeTextFile(CONFIG_FILE, JSON.stringify(DEFAULT_CONFIG));
    }
    return JSON.parse(readTextFile(CONFIG_FILE));
}