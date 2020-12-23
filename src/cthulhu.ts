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

import {nntp_test} from "./nntp_client.ts";

const println = console.log;

function version() {
    println('cthulhu 0.1');
    println('Copyright (C) 2020 Sieve (https://github.com/s-i-e-v-e)');
    println('This is free software; see the source for copying conditions.  There is NO');
    println('warranty; not even for MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.');
}

function help() {
    version();
    println('Usage:');
    println('help,    --help,          Display this information.');
    println('version, --version        Display version information.');
}

export function main(args: string[]) {
    const cmd = args[0];
    switch(cmd) {
        case "--version":
        case "version": version(); break;
        case "--help":
        case "help":
        default: help(); break;
    }

    nntp_test();
}

if (import.meta.main) main(Deno.args);