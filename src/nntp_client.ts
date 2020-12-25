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
import {writeFile} from "./util/io.ts";
import {yenc_decode} from "./util/yenc.ts";
import {zlib_inflate} from "./util/deflate.ts";
import {ServerEntry} from "./util/config.ts";

const de = new TextDecoder("utf-8");
const en = new TextEncoder();

interface NNTPResponse {
    code: number,
    message: string,
    data?: Uint8Array,
}

interface GroupInfo {
    name: string,
    count: number,
    low: number,
    high: number,
}

async function readResponse(conn: Deno.Conn, codes: number[], isMultiline: boolean, isCompressed: boolean = false): Promise<NNTPResponse> {
    if (isCompressed) await writeText(conn, 'DATE');
    const p = new Uint8Array(1024*256);
    let xs = new Uint8Array(p.byteLength*4);
    let n = 0;
    for (;;) {
        const nn = await conn.read(p);
        if (!nn) break;
        if (n+nn >= xs.byteLength) {
            const ys = xs;
            xs = new Uint8Array(xs.byteLength*2)
            xs.set(ys, 0);
        }
        xs.set(p.subarray(0, nn), n);
        n += nn;

        const c0 = xs[n-1];
        const c1 = xs[n-2];
        const c2 = xs[n-3];
        const c3 = xs[n-4];
        const c4 = xs[n-5];

        const is_crlf = c1 === 0x0D && c0 === 0x0A;
        if (is_crlf) {
            if (!isMultiline) break;
            if (c2 === 0x2E && c3 === 0x0A && c4 === 0x0D) {
                n -= 5;
                break;
            }
            if (isCompressed) {
                const ys = xs.subarray(n-20, n);
                const a0 = ys[0];
                const a1 = ys[1];
                const a2 = ys[2];
                const a3 = ys[3];
                if (a0 === 0x31 && a1 === 0x31 && a2 === 0x31 && a3 === 0x20) {
                    n -= 20;
                    break;
                }
            }
        }
    }
    xs = xs.subarray(0, n);

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
        if (v.data[0] === 0x3D && v.data[1] === 0x79) {
            v.data = yenc_decode(v.data);
        }
        try {
            v.data = zlib_inflate(v.data);
        }
        catch (e) {
            console.log('>> err::inflate');
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
    isCompressed: boolean,
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

export async function nntp_date(c: NNTPClient) {
    await writeText(c.conn,'DATE');
    await print(readResponse(c.conn, [111], false));
}

function to_mb(n: number) {
    return Math.floor(n/1024/1024);
}

export async function nntp_group(c: NNTPClient, g: string) {
    await writeText(c.conn,`GROUP ${g}`);
    const r = await readResponse(c.conn, [211,411], false);
    await print(r);
    const xs = r.message.split(' ');

    c.group = g;
    const gi = {
        name: xs[3],
        count: Number(xs[0]),
        low: Number(xs[1]),
        high: Number(xs[2]),
    };
    console.log(`Estimated group header size: ${to_mb(gi.count*300)}-${to_mb(gi.count*500)}MB`);
    return gi;
}

export async function nntp_get(c: NNTPClient, cmd: string, code: number, isMultiline: boolean, idn: string) {
    let r;
    if (idn) {
        await writeText(c.conn,`${cmd} ${idn}`);
        if (idn[0] === '<') {
            r = readResponse(c.conn, [code,430], isMultiline);
        }
        else {
            r = readResponse(c.conn, [code,412,423], isMultiline);
        }
    }
    else {
        await writeText(c.conn,`${cmd}`);
        r = readResponse(c.conn, [code,412,420], isMultiline);
    }
    await print(r);
    return r;
}
export async function nntp_stat(c: NNTPClient, idn: string) {
    return nntp_get(c, 'STAT', 223, false, idn);
}

export async function nntp_body(c: NNTPClient, idn: string) {
    return nntp_get(c, 'BODY', 222, true, idn);
}

export async function nntp_head(c: NNTPClient, idn: string) {
    return nntp_get(c, 'HEAD', 221, true, idn);
}

export async function nntp_article(c: NNTPClient, idn: string) {
    return nntp_get(c, 'ARTICLE', 220, true, idn);
}

export async function nntp_xfeature_compress_gzip(c: NNTPClient) {
    await writeText(c.conn,'XFEATURE COMPRESS GZIP TERMINATOR');
    await print(readResponse(c.conn, [290], false));
    c.isCompressed = true;
}

export async function nntp_xover(c: NNTPClient, n: string) {
    await writeText(c.conn,`XOVER ${n}`);
    const df = await readResponse(c.conn, [224,412,420,502], true, c.isCompressed);
    if (df.data) {
        if (c.isCompressed || df.data.length > 1000) {
            writeFile(`./.cthulhu/headers/${c.group}/${c.se.url}/data.txt`, df.data);
        }
        else {
            await print(df);
        }
    }
}

export async function nntp_xzver(c: NNTPClient, n: string) {
    await writeText(c.conn,`XZVER ${n}`);
    const df = await readResponse(c.conn, [224,412,420,502], true, true);
    if (df.data) {
        writeFile(`./.cthulhu/headers/${c.group}/${c.se.url}/data.txt`, df.data);
    }
}

export async function nntp_connect(se: ServerEntry) {
    const isSecureConnection = !![443, 563].filter(x => x === se.port).length;
    const fn_connect =  isSecureConnection ? Deno.connectTls : Deno.connect;
    const conn = await fn_connect({ hostname: se.url, port: se.port });
    await print(readResponse(conn, [200, 201, 400, 502], false));

    return {
        conn: conn,
        se: se,
        isSecureConnection: isSecureConnection,
        isCompressed: false,
    };
}

