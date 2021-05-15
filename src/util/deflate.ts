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
import {zlib_raw_deflate, DEFLATE_STORE} from "https://github.com/s-i-e-v-e/nonstd/raw/master/src/ts/io/deflate.ts";
export {zlib_inflate, zlib_raw_inflate_init, zlib_raw_inflate_process, zlib_raw_inflate_term} from "https://github.com/s-i-e-v-e/nonstd/raw/master/src/ts/io/inflate.ts";

export function zlib_deflate(p: Uint8Array) {
    return zlib_raw_deflate(p, DEFLATE_STORE);
}