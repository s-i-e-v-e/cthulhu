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
import {exists, readTextFile, writeTextFile} from "./io.ts";

const de = new TextDecoder("utf-8");
const en = new TextEncoder();

const CONFIG_FILE = './.cthulhu/config/client.json'

interface ServerEntry {
    url: string,
    port: number,
    user: string,
    pass: string,
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
            port: 119,
        },
    ],
    reader: 0,
};

function read_config(): ClientConfig {
    const cfg = exists(CONFIG_FILE) ? JSON.parse(readTextFile(CONFIG_FILE)) : DEFAULT_CONFIG;
    writeTextFile(CONFIG_FILE, JSON.stringify(cfg));
    return cfg;
}

async function readInfo(conn: Deno.Conn): Promise<string> {
    const xs = [];
    const p = new Uint8Array(1024*8);
    while (true) {
        const n = await conn.read(p);
        if (n) xs.push(de.decode(p));
        if (!n || n < p.byteLength) break;
    }
    return xs.join('');
}

async function readTextResponse(conn: Deno.Conn): Promise<string> {
    const xs = [];
    const p = new Uint8Array(1024*4);
    xs.push('<$');
    while (true) {
        const n = await conn.read(p);
        console.log(`n: ${n}`);
        const x = de.decode(p);
        xs.push(x);

        if (n) {
            if (x.length >= 5) {
                const nn = x.length;
                if (x[nn-1] === '\n' && x[nn-2] === '\r' && x[nn-3] === '.' && x[nn-4] === '\n' && x[nn-5] === '\r') break;
            }
        }
        if (!n || n < p.byteLength) break;
    }
    xs.push('$>');
    return xs.join('');
}

async function writeText(conn: Deno.Conn, x: string) {
    const y = en.encode(`${x}\r\n`);
    const n = await conn.write(y);
    if (n !== y.byteLength) throw new Error();
}

function print(x: string) {
    console.log(x);
}

export async function nntp_connect() {
    const cfg = read_config();
    const se = cfg.servers[cfg.reader];
    const fn_connect = se.port === 119 ? Deno.connect : Deno.connectTls;
    const conn = await fn_connect({ hostname: se.url, port: se.port });

    print(await readInfo(conn));

    //await writeText(conn,'LIST ACTIVE');
    await writeText(conn,'CAPABILITIES');
    print(await readTextResponse(conn));
    print(await readTextResponse(conn));

    await writeText(conn,'QUIT');
    print(await readTextResponse(conn));

    print('>> close');
    await conn.close();
}