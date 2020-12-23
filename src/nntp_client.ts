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
import { unzlib, inflate } from "https://deno.land/x/denoflate/mod.ts";
import {exists, readTextFile, writeFile, writeTextFile} from "./io.ts";

const de = new TextDecoder("utf-8");
const en = new TextEncoder();

const CONFIG_FILE = './.cthulhu/config/client.json'

interface NNTPResponse {
    code: number,
    message: string,
    data?: Uint8Array,
}

interface ServerEntry {
    url: string,
    port: number,
    user: string,
    pass: string,
    maxCons?: number,
}

interface ClientConfig {
    servers: ServerEntry[],
    reader: number,
}

interface GroupInfo {
    name: string,
    count: number,
    low: number,
    high: number,
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

function read_config(): ClientConfig {
    const cfg = exists(CONFIG_FILE) ? JSON.parse(readTextFile(CONFIG_FILE)) : DEFAULT_CONFIG;
    writeTextFile(CONFIG_FILE, JSON.stringify(cfg));
    return cfg;
}

export function yEncDecode(encoded: Uint8Array) {
    const a = encoded.indexOf(0x0D)+2;
    const b = encoded.lastIndexOf(0x79)-3; // 'y'
    const data = encoded.subarray(a, b);

    let i = 0;
    const out = new Uint8Array(data.byteLength+2);
    let j = 0;
    let esc = false;
    while (i < data.length) {
        let b = data[i];
        if (b === 0x3D) {
            esc = true;
            i++;
            continue;
        }
        else if (b === 0x0D || b === 0x0A) {
            i++;
            continue;
        }
        else if (esc) {
            b = ((b - (64+42)) & 0xff);
            esc = false;
        }
        else {
            b = ((b - 42) & 0xff);
        }
        i++;
        out[j] = b;
        j++;
    }
    return out.subarray(0, j);
}

async function readResponse(conn: Deno.Conn, codes: number[], isMultiline: boolean, isCompressed: boolean = false): Promise<NNTPResponse> {
    const p = new Uint8Array(2);
    let xs = new Uint8Array(32);
    let i = 0;
    for (;;) {
        const n = i;
        if (isMultiline) {
            if (n >= 5 && xs[n-3] === 0x2E && xs[n-5] === 0x0D && xs[n-4] === 0x0A && xs[n-2] === 0x0D && xs[n-1] === 0x0A) {
                xs = xs.subarray(0, n-5);
                break;
            }
        }
        else {
            if (n >= 2 && xs[n-2] === 0x0D && xs[n-1] === 0x0A) {
                break;
            }
        }

        const nn = await conn.read(p);
        if (!nn) break;

        xs.set(p.subarray(0, nn), i);
        i += nn;
        if (nn < p.byteLength) break;

        if (i >= xs.byteLength) {
            const ys = xs;
            xs = new Uint8Array(xs.byteLength*2)
            xs.set(ys, 0);
        }
    }
    xs = xs.subarray(0, i);

    const a = xs.indexOf(0x0D);
    const x = de.decode(xs.subarray(0, a));
    if (isMultiline && xs.byteLength <= a+2) throw new Error(`${xs.byteLength}:${x}`);
    xs = xs.subarray(a+2);
    if (!isMultiline && xs.byteLength) throw new Error(`${xs.byteLength}:${x}`);
    const v: NNTPResponse = {
        code: Number(x.substring(0, 3)),
        message: x.substring(3).trim(),
        data: isMultiline ? xs : undefined,
    };
    if (!codes.filter(x => x === v.code).length) throw new Error(`Expected: one of ${codes.join(',')}. Found: ${v.code} (${x})`);
    if (!isMultiline) return v;
    if (!v.data) throw new Error();

    if (isCompressed) {
        if (v.data[0] === 0x78 && v.data[1] === 0x1) {
            v.data = unzlib(v.data);
        }
        else if (v.data[0] === 0x3D && v.data[1] === 0x79) {
            v.data = inflate(yEncDecode(v.data));
        }
        else {
            throw new Error('DEFLATE error');
        }
    }
    return v;
}

async function writeText(conn: Deno.Conn, x: string) {
    const y = en.encode(`${x}\r\n`);
    const n = await conn.write(y);
    if (n !== y.byteLength) throw new Error();
}

async function print(r: Promise<NNTPResponse>|NNTPResponse) {
    const rr: NNTPResponse = (r as NNTPResponse).code ? r as NNTPResponse: await r;
    console.log(`${rr.code}: ${rr.message}`);
    if (rr.data) {
        const x = de.decode(rr.data).trim();
        if (x.length) console.log(`${x}`);
    }
}

export interface NNTPClient {
    conn: Deno.Conn,
    se: ServerEntry,
    isSecureConnection: boolean,
    group?: string,
}

export async function nntp_auth(c: NNTPClient) {
    if (c.isSecureConnection && c.se.user) {
        await writeText(c.conn,`AUTHINFO USER ${c.se.user}`);
        const rr = await readResponse(c.conn, [281, 381, 481, 482, 502], false);
        await print(rr);
        if (rr.code === 381) {
            await writeText(c.conn,`AUTHINFO PASS ${c.se.pass}`);
            await print(readResponse(c.conn, [281, 481, 482, 502], false));
        }
    }
}

export async function nntp_caps(c: NNTPClient) {
    await writeText(c.conn,'CAPABILITIES');
    await print(readResponse(c.conn, [101], true));
}

export async function nntp_quit(c: NNTPClient) {
    await writeText(c.conn,'QUIT');
    await print(readResponse(c.conn, [205], false));

    await c.conn.close();
}

export async function nntp_group(c: NNTPClient, g: string) {
    await writeText(c.conn,`GROUP ${g}`);
    const r = await readResponse(c.conn, [211,411], false);
    await print(r);
    const xs = r.message.split(' ');

    c.group = g;
    return {
        name: xs[3],
        count: Number(xs[0]),
        low: Number(xs[1]),
        high: Number(xs[2]),
    };
}

export async function nntp_stat(c: NNTPClient, idn: string) {
    if (idn[0] === '<') {
        await writeText(c.conn,`STAT ${idn}`);
        return await readResponse(c.conn, [223,430], false);
    }
    else {
        await writeText(c.conn,`STAT ${idn}`);
        return await readResponse(c.conn, [223,412,423], false);
    }
}

export async function nntp_head(c: NNTPClient, idn: string) {
    if (idn[0] === '<') {
        await writeText(c.conn,`HEAD ${idn}`);
        await print(readResponse(c.conn, [221,430], true));
    }
    else {
        await writeText(c.conn,`HEAD ${idn}`);
        await print(readResponse(c.conn, [221,412,423], true));
    }
}

export async function nntp_xover(c: NNTPClient, n: string) {
    await writeText(c.conn,`XOVER ${n}`);
    await print(readResponse(c.conn, [224,412,420,502], true));
}

export async function nntp_xzver(c: NNTPClient, n: string) {
    await writeText(c.conn,`XZVER ${n}`);
    const df = await readResponse(c.conn, [224,412,420,502], true, true);
    if (df.data) {
        writeFile(`./.cthulhu/headers/${c.group}/${c.se.url}/data.txt`, df.data);
    }
}

export function nntp_init() {
    const cfg = read_config();
    return cfg.servers[cfg.reader];
}

export async function nntp_connect(mse?: ServerEntry) {
    const cfg = read_config();
    const se = mse ? mse! : cfg.servers[cfg.reader];
    const isSecureConnection = !![443, 563].filter(x => x === se.port).length;
    const fn_connect =  isSecureConnection ? Deno.connectTls : Deno.connect;
    const conn = await fn_connect({ hostname: se.url, port: se.port });
    await print(readResponse(conn, [200, 201, 400, 502], false));

    return {
        conn: conn,
        se: se,
        isSecureConnection: isSecureConnection,
    };
}

