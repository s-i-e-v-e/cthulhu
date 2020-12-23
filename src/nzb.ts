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
import {readTextFile} from "./io.ts";
import {nntp_connect, nntp_stat, nntp_quit, nntp_auth, nntp_init} from "./nntp_client.ts";

export async function nzb_stat(p: string) {
    const xml = readTextFile(p).replaceAll('</segment>', '></segment>');
    const xs = Array.from(xml.matchAll(/>([^>]+>)<\/segment>/gi)).map(x => `<${x[1]}`);

    const se = nntp_init();
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