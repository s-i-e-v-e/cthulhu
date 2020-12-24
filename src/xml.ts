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

interface CharacterStream {
    xs: string,
    index: number,
}

function cs_eof(cs: CharacterStream) {
    return cs.index >= cs.xs.length;
}

function cs_peek(cs: CharacterStream) {
    return cs_eof(cs) ? undefined : cs.xs[cs.index];
}

function cs_next(cs: CharacterStream) {
    return cs_eof(cs) ? undefined : cs.xs[cs.index++];
}

function skip_ws(cs: CharacterStream) {
    for (;;) {
        const c = cs_peek(cs);
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n') {
            cs_next(cs);
            continue;
        }
        break;
    }
}

function normalize(x: string) {
    x = x.replace('&lt;', '<');
    x = x.replace('&gt;', '>');
    return x;
}

function parse_text(cs: CharacterStream) {
    const xs = [];
    for (;;) {
        const c = cs_peek(cs);
        if (c === '<') break;
        error_on_eof(c);
        xs.push(cs_next(cs));
    }
    return normalize(xs.join(''));
}

function parse_name(cs: CharacterStream) {
    skip_ws(cs);
    const xs = [];
    for (;;) {
        const c = cs_peek(cs);
        if (c === ' ' || c === '\t' || c === '\r' || c === '\n' || c === '=' || c === '<' || c === '>'|| c === '!'|| c === '?') break;
        error_on_eof(c);
        xs.push(cs_next(cs));
    }
    return xs.join('');
}

function parse_value(cs: CharacterStream) {
    const xs = [];
    for (;;) {
        const c = cs_peek(cs);
        if (c === '"') break;
        error_on_eof(c);
        xs.push(cs_next(cs));
    }
    return normalize(xs.join(''));
}

function error_on_eof(c?: string) {
    if (!c) throw new Error();
}

function expect_t(cs: CharacterStream, c: string) {
    if (cs_next(cs) !== c) throw new Error();
}

function parse_attr(cs: CharacterStream) {
    const name = parse_name(cs);
    skip_ws(cs);
    expect_t(cs, '=');
    expect_t(cs, '"');
    const value = parse_value(cs);
    expect_t(cs, '"');
    return [name, value];
}

type Attribute = string[];
type Node = string|Element;
interface Element {
    name: string,
    attrs: Attribute[],
    nodes: Node[],
}

function parse_el(cs: CharacterStream):Element {
    const c = cs_peek(cs);

    if (c === '?' || c === '!') {
        for (;;) {
            const c = cs_next(cs);
            if (!c) break;
            if (c === '>') break;
        }
        return {
            name: c,
            attrs : [],
            nodes : [],
        };
    }
    else {
        const name = parse_name(cs);
        const el: Element = {
            name: name,
            attrs : [],
            nodes : [],
        };

        // parse attrs
        for (;;) {
            if (cs_next(cs) === '>') break;
            const [k, v] = parse_attr(cs);
            el.attrs.push([k,v]);
        }

        for (;;) {
            skip_ws(cs);
            if (cs_peek(cs) !== '<') el.nodes.push(parse_text(cs));
            if (cs_peek(cs) === '<') {
                cs_next(cs);
                if (cs_peek(cs) === '/') {
                    // parse end
                    expect_t(cs, '/');
                    const n = parse_name(cs);
                    if (name !== n) throw new Error();
                    expect_t(cs, '>');
                    break;
                }
                else {
                    el.nodes.push(parse_el(cs));
                }
            }
        }
        return el;
    }
}

export function xml_parse(xs: string): Element {
    const cs = {
        xs: xs,
        index: 0,
    };

    const ys = [];
    for (;!cs_eof(cs);) {
        skip_ws(cs);
        expect_t(cs, '<');
        ys.push(parse_el(cs));
        skip_ws(cs);
    }
    return {
        name: 'root',
        attrs: [],
        nodes: ys,
    };
}

export function xml_e(e: Element, n: string) {
    return e.nodes
        .filter(x => {
            const y = x as Element;
            return y.name && y.name === n;
        })
        .map(x => x as Element);
}

export function xml_a(e: Element, a: string) {
    return e.attrs
        .filter(xs => xs[0] === a)[0];
}