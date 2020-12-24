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
function decode(xs: Uint8Array) {
    const ys = new Uint8Array(xs.byteLength);

    let a = undefined;
    let b;
    let j = 0;
    for (let i = 0; i < xs.length; i++) {
        b = a;
        a = xs[i];
        switch (a) {
            case 0x3D:
            case 0x0D:
            case 0x0A: {
                break;
            }
            default: {
                let c = b === 0x3D ? a - 64 : a;
                c -= 42;
                ys[j] = c;
                j++;
            }
        }
    }
    return ys.subarray(0, j);
}

export function yenc_decode(encoded: Uint8Array) {
    const a = encoded.indexOf(0x0D)+2;
    const b = encoded.lastIndexOf(0x79)-3; // 'y'
    const xs = encoded.subarray(a, b);
    return decode(xs);
}