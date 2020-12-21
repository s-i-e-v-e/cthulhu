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

interface FileName {
    dir: string,
    name: string,
    ext: string,
}

function parse_path(file: string) {
    let n = file.lastIndexOf("/");
    const dir = n === -1 ? "." : file.substring(0, n);
    file = n === -1 ? file : file.substring(n + 1);

    n = file.lastIndexOf(".");
    const name = n === -1 ? file : file.substring(0, n);
    const ext = n === -1 ? '' : file.substring(n);
    return {
        dir: dir,
        name: name,
        ext: ext,
    };
}

function mkdir(dir: string) {
    if (!exists(dir)) Deno.mkdirSync(dir, { recursive: true });
}

export function writeTextFile(p: string, data: string) {
    const fp = parse_path(p);
    mkdir(fp.dir);
    Deno.writeTextFileSync(p, data);
}

export function readTextFile(p: string) {
    const fp = parse_path(p);
    mkdir(fp.dir);
    return Deno.readTextFileSync(p);
}

export function exists(p: string) {
    try {
        Deno.statSync(p as string);
        return true;
    }
    catch (e) {
        if (e instanceof Deno.errors.NotFound) {
            return false;
        }
        else {
            throw e;
        }
    }
}