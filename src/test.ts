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
import {
    nntp_article,
    nntp_auth,
    nntp_body,
    nntp_caps,
    nntp_connect,
    nntp_date,
    nntp_group,
    nntp_quit,
    nntp_xover,
    nntp_xzver,
    nntp_xfeature_compress_gzip, nntp_activate_compression
} from "./nntp_client.ts";
import {nzb_stat} from "./nzb.ts";
import {xml_parse} from "./util/xml.ts";
import {dump_hex, readFile, readTextFile, to_utf8, writeTextFile} from "./util/io.ts";
import {config_read, ServerEntry} from "./util/config.ts";
import {zlib_inflate} from "./util/deflate.ts";

export async function test() {
    const cfg = config_read();
    const se = cfg.servers[cfg.reader];
    const g = GROUPS[0];

/*
    xml_test();
    deflate_test();
    await nzb_test();
    await nntp_test_groups(se);
    await nntp_test_article(se);
    await nntp_test_body(se);
    await nntp_test_xover(se, g);
    await nntp_test_xzver(se, g);
    await nntp_test_xfeature_compress_gzip(se, g);
    await nntp_test_caps(cfg.servers);
    await nntp_test_xover(se, g);
    await nntp_test_compress(se);
    await nntp_test_response(cfg.servers);
 */
}

export function xml_test() {
    console.log(xml_parse('<foo><bar attr-name="value">some text</bar></foo>'));
    const xml = xml_parse(readTextFile('./.ignore/a.nzb'));
    writeTextFile('./.ignore/a.nzb.json', JSON.stringify(xml));
}

async function nzb_test(se: ServerEntry) {
    nzb_stat(se,'./.ignore/a.nzb');
}

const GROUPS = [
    'comp.lang.ada',
    'comp.lang.c',
    'comp.lang.c.moderated',
    'comp.lang.c++',
    'comp.lang.c++.moderated',
    'comp.lang.forth',
    'comp.lang.lisp',
    'comp.lang.python',
    'comp.lang.ml',
    'comp.lang.scheme',
    'comp.os.minix',
    'comp.os.plan9',
    'comp.graphics.api.opengl',
    'news.groups.proposals',
    'news.software.readers',
    'news.software.nntp',
    'alt.binaries.pictures',
];

async function nntp_test_response(xs: ServerEntry[]) {
    for (const se of xs) {
        if (se.disable) continue;
        console.log(`--------------------------------`);
        console.log(`[${se.url}:${se.port}]`);
        const c = await nntp_connect(se);
        await nntp_quit(c);
    }
}

async function nntp_test_caps(xs: ServerEntry[]) {
    for (const se of xs) {
        if (se.disable) continue;
        console.log(`--------------------------------`);
        console.log(`[${se.url}:${se.port}]`);
        const c = await nntp_connect(se);
        await nntp_auth(c);
        await nntp_caps(c);
        await nntp_date(c);
        await nntp_quit(c);
    }
}

async function nntp_test_article(se: ServerEntry) {
    const c = await nntp_connect(se);
    await nntp_auth(c);
    await nntp_date(c);
    const g = GROUPS[Math.floor(Math.random() * GROUPS.length)];
    const gi = await nntp_group(c, g);
    await nntp_article(c, `${gi.high}`);
    //await nntp_article(c, '');
    await nntp_quit(c);
}

async function nntp_test_body(se: ServerEntry) {
    const c = await nntp_connect(se);
    await nntp_auth(c);
    await nntp_date(c);
    const g = GROUPS[Math.floor(Math.random() * GROUPS.length)];
    const gi = await nntp_group(c, g);
    await nntp_body(c, `${gi.high}`);
    //await nntp_body(c, '');
    await nntp_quit(c);
}

async function nntp_test_xfeature_compress_gzip(se: ServerEntry, g: string) {
    const c = await nntp_connect(se);
    await nntp_auth(c);
    await nntp_xfeature_compress_gzip(c);
    const gi = await nntp_group(c, g);
    await nntp_xover(c, `${gi.low}-${gi.high}`);
    await nntp_quit(c);
}

async function nntp_test_xover(se: ServerEntry, g: string) {
    const c = await nntp_connect(se);
    await nntp_auth(c);
    const gi = await nntp_group(c, g);
    await nntp_xover(c, `${gi.low}-${gi.high}`);
    await nntp_quit(c);
}

async function nntp_test_xzver(se: ServerEntry, g: string) {
    const c = await nntp_connect(se);
    await nntp_auth(c);
    const gi = await nntp_group(c, g);
    await nntp_xzver(c, `${gi.low}-${gi.high}`);
    await nntp_quit(c);
}

async function nntp_test_groups(se: ServerEntry) {
    const c = await nntp_connect(se);
    await nntp_auth(c);
    for (const g of GROUPS) {
        await nntp_group(c, g);
    }
    await nntp_quit(c);
}

async function nntp_test_compress(se: ServerEntry) {
    const c = await nntp_connect(se);
    await nntp_auth(c);
    await nntp_activate_compression(c);
    await nntp_quit(c);
}

function deflate_test() {
    const xs = zlib_inflate(new Uint8Array([0x33, 0x32, 0x30, 0x55, 0x70, 0xAA, 0x4C, 0x55, 0xE4, 0xE5, 0x02, 0x08]));
    dump_hex(xs);
    if (to_utf8(xs) !== '205 Bye!\r\n') throw new Error();

    const ys1 = zlib_inflate(new Uint8Array([0x73, 0x04, 0x00]));
    dump_hex(ys1);
    if (ys1[0] !== 0x41) throw new Error();

    const ys2 = zlib_inflate(new Uint8Array([0x8B, 0x02, 0x00]));
    dump_hex(ys2);
    if (ys2[0] !== 0x5A) throw new Error();

    const ys3 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x72, 0x76, 0x74, 0x72, 0x06, 0x00]));
    dump_hex(ys3);
    if (to_utf8(ys3) !== 'ABCABC') throw new Error();

    const ys4 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x72, 0x76, 0x71, 0x8D, 0x77, 0x04, 0x91, 0x00]));
    dump_hex(ys4);
    if (to_utf8(ys4) !== 'ABCDE_ABCDE') throw new Error();

    const ys5 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x72, 0x76, 0x71, 0x75, 0x73, 0xF7, 0x88, 0x77, 0x74, 0x72, 0x06, 0x00]));
    dump_hex(ys5);
    if (to_utf8(ys5) !== 'ABCDEFGH_ABC') throw new Error();

    const ys6 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x72, 0x76, 0x71, 0x75, 0x73, 0xF7, 0x88, 0x77, 0x74, 0x72, 0x06, 0x61, 0x00]));
    dump_hex(ys6);
    if (to_utf8(ys6) !== 'ABCDEFGH_ABC_ABC') throw new Error();

    const ys7 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x72, 0x76, 0x71, 0x75, 0x8C, 0x77, 0x04, 0x51, 0x10, 0x12, 0x00]));
    dump_hex(ys7);
    if (to_utf8(ys7) !== 'ABCDEA_ABCDE_ABCDE') throw new Error();

    const ys8 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x72, 0x76, 0x71, 0x75, 0x8C, 0x77, 0x76, 0x89, 0x77, 0x72, 0x06, 0x00]));
    dump_hex(ys8);
    if (to_utf8(ys8) !== 'ABCDEA_CD_BC') throw new Error();

    const ys9 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x74, 0x04, 0x00]));
    dump_hex(ys9);
    if (to_utf8(ys9) !== 'AAA') throw new Error();

    const ys10 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x74, 0x74, 0x04, 0x00]));
    dump_hex(ys10);
    if (to_utf8(ys10) !== 'AAAA') throw new Error();

    const ys11 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x04, 0x02, 0x00]));
    dump_hex(ys11);
    if (to_utf8(ys11) !== 'AAAAA') throw new Error();

    const ys12 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x04, 0x01, 0x00]));
    dump_hex(ys12);
    if (to_utf8(ys12) !== 'AAAAAA') throw new Error();

    const ys13 = zlib_inflate(new Uint8Array([0x73, 0x74, 0x72, 0x76, 0x71, 0x8D, 0x77, 0x44, 0x90, 0x00]));
    dump_hex(ys13);
    if (to_utf8(ys13) !== 'ABCDE_ABCDE_ABCDE') throw new Error();
    console.log('---');
}