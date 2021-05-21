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
import {readTextFile, writeTextFile} from "./util/io.ts";
import {config_read, ServerEntry} from "./util/config.ts";

export async function test() {
    const cfg = config_read();
    const se = cfg.servers[cfg.reader];
    const g = GROUPS[2];


    xml_test();

    await nzb_test(se);
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
    const x = gi.high - 100;
    await nntp_xover(c, `${gi.low > x ? gi.low : x}-${gi.high}`);
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