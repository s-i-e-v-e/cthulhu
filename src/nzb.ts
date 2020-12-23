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
import {nntp_connect, nntp_stat, nntp_quit, nntp_auth} from "./nntp_client.ts";

export async function nzb_stat(p: string) {
    const xml = readTextFile(p).replaceAll('</segment>', '></segment>');
    const xs = Array.from(xml.matchAll(/>([^>]+>)<\/segment>/gi)).map(x => `<${x[1]}`);

    const c = await nntp_connect();
    await nntp_auth(c);
    const fo = [];
    const nf = [];
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
        if (i % 10 === 0) console.log(`${i}/${xs.length}`);
    }

    console.log(`Found: ${fo.length}/${xs.length}`);
    console.log(`Not found: ${nf.length}/${xs.length}`);

    await nntp_quit(c);
}