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
import { unzlib, inflate, deflate } from "https://deno.land/x/denoflate/mod.ts";

export function zlib_deflate(p: Uint8Array) {
    return deflate(p, undefined);
}

export function zlib_inflate(p: Uint8Array) {
    if (p[0] === 0x78) return unzlib(p);
    return inflate(p);
}