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
import {to_utf8, from_utf8, writeFile, dump_hex_16, dump_hex, debug_print} from "./util/io.ts";
import {yenc_decode} from "./util/yenc.ts";
import {
    zlib_deflate,
    zlib_inflate,
    zlib_raw_inflate_init,
    zlib_raw_inflate_process,
    zlib_raw_inflate_term
} from "./util/deflate.ts";
import {ServerEntry} from "./util/config.ts";

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

async function readCompressedResponse(c: NNTPClient, codes: number[], isMultiline: boolean): Promise<Uint8Array> {
    const xp = zlib_raw_inflate_init();

    const p = new Uint8Array(1024*16);
    for (;;) {
        let nn = await c.conn.read(p);
        debug_print(`compressed-nn: ${nn}`);
        dump_hex(p.subarray(0, nn || 0));
        nn = nn || 0;
        zlib_raw_inflate_process(xp, p.slice(0, nn));
        if (xp.eos) break;
    }
    let xs =  zlib_raw_inflate_term(xp);
    dump_hex(xs);
    if (!verifyTail(xs, xs.length, isMultiline)) {
        const ys = await readCompressedResponse(c, codes, false);
        const zs = new Uint8Array(xs.length+(await ys).length);
        zs.set(xs);
        zs.set(ys);
        xs = zs;
    }
    xs = xs.subarray(0, isMultiline ? xs.length - 5 : xs.length - 2);
    dump_hex(xs);
    debug_print(to_utf8(xs));
    return xs;
}

function verifyTail(xs: Uint8Array, n: number, isMultiline: boolean) {
    const c0 = xs[n-1];
    const c1 = xs[n-2];
    const c2 = xs[n-3];
    const c3 = xs[n-4];
    const c4 = xs[n-5];

    debug_print(`${c0}, ${c1}, ${c2}, ${c3}, ${c4}`);
    const is_crlf = c0 === 0x0A && c1 === 0x0D;
    return isMultiline ? is_crlf && c2 === 0x2E && c3 === 0x0A && c4 === 0x0D : is_crlf;
}

async function readResponse(c: NNTPClient, codes: number[], isMultiline: boolean): Promise<NNTPResponse> {
    const is_deflate = c.activeCompressionType === COMPRESSION_COMPRESS_DEFLATE;
    const is_gzip = c.activeCompressionType === COMPRESSION_XFEATURE_COMPRESSION_GZIP_TERMINATOR;
    let xs;
    if (is_deflate || is_gzip) {
        xs = await readCompressedResponse(c, codes, isMultiline);
    }
    else {
        const p = new Uint8Array(1024*16);
        xs = new Uint8Array(p.byteLength*4);
        let n = 0;
        for (;;) {
            const nn = await c.conn.read(p);
            if (!nn) break;
            if (n+nn >= xs.byteLength) {
                const ys = xs;
                xs = new Uint8Array(xs.byteLength*2)
                xs.set(ys, 0);
            }
            xs.set(p.subarray(0, nn), n);
            n += nn;

            debug_print(`nn: ${nn}`);

            if (verifyTail(xs, n, isMultiline)) {
                xs = xs.subarray(0, isMultiline ? n - 5 : n);
                break;
            }
        }
    }

    // get first line of multiline response
    let a = xs.indexOf(0x0D);
    const x = to_utf8(xs.subarray(0, a));
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
    return v;
}

async function writeText(c: NNTPClient, x: string) {
    let y = from_utf8(`${x}\r\n`);
    y = c.activeCompressionType === COMPRESSION_COMPRESS_DEFLATE ? zlib_deflate(y) : y;
    const n = await c.conn.write(y);
    if (n !== y.byteLength) throw new Error();
}

async function print(r: Promise<NNTPResponse>|NNTPResponse) {
    const rr: NNTPResponse = (r as NNTPResponse).code ? r as NNTPResponse: await r;
    console.log(`${rr.code}: ${rr.message}`);
    if (rr.data) {
        const x = to_utf8(rr.data).trim();
        if (x.length) console.log(`${x}`);
    }
}

const COMPRESSION_NONE = 0;
const COMPRESSION_COMPRESS_DEFLATE = 1;
const COMPRESSION_XZVER = 2;
const COMPRESSION_XFEATURE_COMPRESSION_GZIP_TERMINATOR = 3;

export interface NNTPClient {
    conn: Deno.Conn,
    se: ServerEntry,
    isSecureConnection: boolean,
    supportedCompressionType: number,
    activeCompressionType: number,
    group?: string,
}

export async function nntp_auth(c: NNTPClient) {
    if (c.isSecureConnection && c.se.user) {
        await writeText(c,`AUTHINFO USER ${c.se.user}`);
        const rr = await readResponse(c, [281, 381, 481, 482, 502], false);
        await print(rr);
        if (rr.code === 381) {
            await writeText(c,`AUTHINFO PASS ${c.se.pass}`);
            await print(readResponse(c, [281, 481, 482, 502], false));
        }
    }
    await nntp_caps(c, false);
}

export async function nntp_caps(c: NNTPClient, echo: boolean = true) {
    await writeText(c,'CAPABILITIES');
    const r = await readResponse(c, [101], true);
    if (echo) await print(r);
    const x = to_utf8(r.data!);
    if (x.indexOf('COMPRESS DEFLATE') >= 0) {
        c.supportedCompressionType = COMPRESSION_COMPRESS_DEFLATE;
    }
    else if (x.indexOf('XFEATURE-COMPRESS GZIP TERMINATOR') >= 0) {
        c.supportedCompressionType = COMPRESSION_XFEATURE_COMPRESSION_GZIP_TERMINATOR;
    }
    else if (x.indexOf('XZVER') >= 0) {
        c.supportedCompressionType = COMPRESSION_XZVER;
    }
    else {
        c.supportedCompressionType = COMPRESSION_NONE;
    }
}

export async function nntp_quit(c: NNTPClient) {
    //await writeText(c,'QUIT');
    //await print(readResponse(c, [205], false));

    await c.conn.close();
}

export async function nntp_date(c: NNTPClient) {
    await writeText(c,'DATE');
    await print(readResponse(c, [111], false));
}

function to_mb(n: number) {
    return Math.floor(n/1024/1024);
}

export async function nntp_group(c: NNTPClient, g: string) {
    await writeText(c,`GROUP ${g}`);
    const r = await readResponse(c, [211,411], false);
    await print(r);
    const xs = r.message.split(' ');

    c.group = g;
    const gi = {
        name: xs[3],
        count: Number(xs[0]),
        low: Number(xs[1]),
        high: Number(xs[2]),
    };
    console.log(`Estimated uncompressed group header size: ${to_mb(gi.count*300)}-${to_mb(gi.count*500)}MB`);
    return gi;
}

export async function nntp_get(c: NNTPClient, cmd: string, code: number, isMultiline: boolean, idn: string) {
    let r;
    if (idn) {
        await writeText(c,`${cmd} ${idn}`);
        if (idn[0] === '<') {
            r = readResponse(c, [code,430], isMultiline);
        }
        else {
            r = readResponse(c, [code,412,423], isMultiline);
        }
    }
    else {
        await writeText(c,`${cmd}`);
        r = readResponse(c, [code,412,420], isMultiline);
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

export async function nntp_compress_deflate(c: NNTPClient) {
    await writeText(c,'COMPRESS DEFLATE');
    await print(readResponse(c, [206, 403, 502], false));
}

export async function nntp_xfeature_compress_gzip(c: NNTPClient) {
    await writeText(c,'XFEATURE COMPRESS GZIP TERMINATOR');
    await print(readResponse(c, [290], false));
}

export async function nntp_xzver(c: NNTPClient, n: string) {
    await nntp_xover(c, n);
}

export async function nntp_activate_compression(c: NNTPClient) {
    if (c.activeCompressionType != c.supportedCompressionType) {
        if (c.supportedCompressionType === COMPRESSION_COMPRESS_DEFLATE) {
            await nntp_compress_deflate(c);
        }
        else if (c.supportedCompressionType === COMPRESSION_XFEATURE_COMPRESSION_GZIP_TERMINATOR) {
            await nntp_xfeature_compress_gzip(c);
        }
        else {
            throw new Error();
        }
        c.activeCompressionType = c.supportedCompressionType;
    }
}

export async function nntp_xover(c: NNTPClient, n: string) {
    let cmd;
    switch (c.supportedCompressionType) {
        case COMPRESSION_NONE:
        case COMPRESSION_COMPRESS_DEFLATE: {
            await nntp_activate_compression(c);
            cmd = 'XOVER';
            break;
        }
        case COMPRESSION_XFEATURE_COMPRESSION_GZIP_TERMINATOR: {
            await nntp_activate_compression(c);
            cmd = 'XOVER';
            break;
        }
        case COMPRESSION_XZVER: {
            // cmd = 'XZVER';
            throw new Error('not implemented');
            break;
        }
        default: {
            throw new Error();
        }
    }
    await writeText(c,`${cmd} ${n}`);
    const df = await readResponse(c, [224,412,420,502], true);
    if (df.data) {
        writeFile(`./.cthulhu/headers/${c.group}/${c.se.url}/data.txt`, df.data);
    }
}

export async function nntp_over(c: NNTPClient, n: string) {
    await writeText(c,`XOVER ${n}`);
    const df = await readResponse(c, [224,412,420,502], true);
    if (df.data) {
        writeFile(`./.cthulhu/headers/${c.group}/${c.se.url}/data.txt`, df.data);
    }
}

export async function nntp_connect(se: ServerEntry): Promise<NNTPClient> {
    const isSecureConnection = !![443, 563].filter(x => x === se.port).length;
    const fn_connect =  isSecureConnection ? Deno.connectTls : Deno.connect;
    const conn = await fn_connect({ hostname: se.url, port: se.port });
    const c = {
        conn: conn,
        se: se,
        isSecureConnection: isSecureConnection,
        supportedCompressionType: COMPRESSION_NONE,
        activeCompressionType: COMPRESSION_NONE,
        compressionIsActive: false,
    };
    await print(readResponse(c, [200, 201, 400, 502], false));
    return c;
}