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

export async function test() {
    //await nntp_test();
    await nzb_test();
}

async function nzb_test() {
    nzb_stat('./.ignore/a.nzb');
}

async function nntp_test() {
    const c = await nntp_connect();
    await nntp_auth(c);
    await nntp_caps(c);
    const gi = await nntp_group(c, 'comp.lang.forth');
    await nntp_xover(c, `${gi.high-20}-${gi.high}`);
    await nntp_xzver(c, `${gi.low}-${gi.high}`);
    await nntp_quit(c);
}