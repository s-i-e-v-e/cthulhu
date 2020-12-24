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
import {nntp_auth, nntp_caps, nntp_connect, nntp_group, nntp_quit, nntp_xover, nntp_xzver} from "./nntp_client.ts";
import {nzb_stat} from "./nzb.ts";
import {xml_parse} from "./xml.ts";
import {readTextFile, writeTextFile} from "./io.ts";

export async function test() {
    xml_test();
    await nntp_test();
    //await nzb_test();
}

export function xml_test() {
    console.log(xml_parse('<foo><bar attr-name="value">some text</bar></foo>'));
    const xml = xml_parse(readTextFile('./.ignore/a.nzb'));
    writeTextFile('./.ignore/a.nzb.json', JSON.stringify(xml));
}

async function nzb_test() {
    nzb_stat('./.ignore/a.nzb');
}

function to_mb(n: number) {
    return Math.floor(n/1024/1024);
}

async function nntp_test() {
    const c = await nntp_connect();
    await nntp_auth(c);
    await nntp_caps(c);

    const groups = [
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

    for (const g of groups) {
        const gi = await nntp_group(c, g);
        console.log(`Estimated group header size: ${to_mb(gi.count*300)}-${to_mb(gi.count*500)}MB`);
    }

    const g = groups[Math.floor(Math.random() * groups.length)];
    const gi = await nntp_group(c, g);
    await nntp_xover(c, `${gi.high-2}-${gi.high}`);
    //await nntp_xzver(c, `${gi.low}-${gi.high}`);
    await nntp_quit(c);
}