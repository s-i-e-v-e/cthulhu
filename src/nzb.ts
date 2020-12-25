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
import {readTextFile} from "./util/io.ts";
import {nntp_connect, nntp_stat, nntp_quit, nntp_auth} from "./nntp_client.ts";
import {xml_a, xml_e, xml_parse} from "./util/xml.ts";
import {ServerEntry} from "./util/config.ts";

interface Segment {
    bytes: number,
    number: number,
    id: string,
}

interface Head {
    title: string,
    tag: string,
    category: string,
}

interface File {
    poster: string,
    date: number,
    subject: string,
    segments: Segment[],
    groups: string[],
}

interface NZB {
    head: Head,
    files: File[]
}

function to_jnzb(x: string): NZB {
    const xml = xml_parse(x);
    const nzb = xml_e(xml, 'nzb')[0];
    const head = xml_e(nzb, 'head')[0];
    const meta = xml_e(head, 'head').map(x => [xml_a(x, 'type')[1], x.nodes[0] as string]);
    const files = xml_e(nzb, 'file');

    const get_meta = (n: string) => {
        const x = meta.filter(x => x[0] === n)[0];
        return x ? x[1]: '';
    };

    return {
        head: {
            title: get_meta('title') || get_meta('name'),
            tag: get_meta('tag'),
            category: get_meta('category'),
        },
        files: files.map(x => {
            const f: File = {
                poster: xml_a(x, 'poster')[1],
                subject: xml_a(x, 'subject')[1],
                date: Number(xml_a(x, 'date')[1]),
                groups: xml_e(xml_e(x, 'groups')[0], 'group').map(x => x.nodes[0] as string),
                segments: xml_e(xml_e(x, 'segments')[0], 'segment').map(x => { return {
                    bytes: Number(xml_a(x, 'bytes')[1]),
                    number: Number(xml_a(x, 'number')[1]),
                    id: `<${x.nodes[0] as string}>`,
                };}),
            };
            return f;
        }),
    };
}

export async function nzb_stat(se: ServerEntry, p: string) {
    const jnzb = to_jnzb(readTextFile(p));
    const xs = jnzb.files.map(x => x.segments).flat().map(x => x.id);

    const maxCons = se.maxCons ? se.maxCons : 1;

    const fn = async (xs: string[], fo: string[], nf: string[], total: number) => {
        const c = await nntp_connect(se);
        await nntp_auth(c);
        let i = 0;
        for (const x of xs) {
            const r = await nntp_stat(c, x);
            if (r.code === 223) {
                fo.push(x);
            }
            else {
                nf.push(x);
            }
            i++;
            const j = fo.length + nf.length;
            if (j % 10 === 0) console.log(`${j}/${total}`);
        }

        await nntp_quit(c);
    }

    const xss = [];
    const n = Math.floor(xs.length / maxCons);
    let a = 0;
    let b = 0;
    for (let i = 0; i < maxCons;) {
        b += n;
        xss.push(xs.slice(a, b));
        i++;
        if (i === maxCons) break;
        a = b;
    }
    if (b < xs.length) {
        xss[xss.length-1] = xs.slice(a);
    }
    console.log(xs.length);
    xss.forEach(z => console.log(z.length));

    const fo: string[] = [];
    const nf: string[] = [];
    await Promise.all(xss.map(async z => fn(z, fo, nf, xs.length)));
    console.log(`Found: ${fo.length}/${xs.length}`);
    console.log(`Not found: ${nf.length}/${xs.length}`);
}