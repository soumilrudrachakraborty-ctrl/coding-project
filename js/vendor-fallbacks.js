// js/vendor-fallbacks.js
// ─────────────────────────────────────────────────────────────────────────────
// Self-contained local fallbacks for every CDN dependency CodeEdit uses.
// Each section is activated only if the real library failed to load.
//
// Load order: this file is the FIRST <script> tag in index.html, before any
// CDN tag.  After all CDN tags have run, index.html calls initVendorFallbacks()
// which wires up whichever fallbacks are still needed.
// ─────────────────────────────────────────────────────────────────────────────

// ═════════════════════════════════════════════════════════════════════════════
//  1.  CODEMIRROR  —  minimal but genuinely functional fallback editor
// ═════════════════════════════════════════════════════════════════════════════
//
//  Implements every method the application actually calls, backed by a
//  <textarea> so the user can actually type and edit code.  Advanced features
//  (syntax highlighting, lint gutter, fold gutter, autocomplete, merge view)
//  degrade silently to no-ops.  The editor remains fully usable for reading
//  and writing files.
//
//  API surface covered:
//    Constructor, getValue/setValue, getCursor/setCursor, getLine, lineCount,
//    on/off (change, cursorActivity, scroll, viewportChange, swapDoc, inputRead)
//    markText (clearable markers), getSearchCursor, getScrollInfo,
//    scrollTo, scrollIntoView, setOption/getOption, refresh, focus,
//    clearHistory, getSelection, setSelection, replaceRange, getWrapperElement,
//    getLineTokens (stub), performLint (stub), foldCode (stub),
//    showHint (stub), annotateScrollbar (stub).
//    Static: CodeMirror.Pass, CodeMirror.cmpPos, CodeMirror.hint,
//            CodeMirror.MergeView (stub), CodeMirror.defineMIME,
//            CodeMirror.resolveMode.

window._buildCodeMirrorFallback = function () {

    // ── Utility helpers ──────────────────────────────────────────────────────

    function posCmp(a, b) { return a.line !== b.line ? a.line - b.line : a.ch - b.ch; }

    // Convert a {line, ch} doc position to a flat textarea character offset
    function posToOffset(lines, pos) {
        var off = 0;
        for (var i = 0; i < pos.line && i < lines.length; i++) {
            off += lines[i].length + 1; // +1 for \n
        }
        return off + Math.min(pos.ch, (lines[pos.line] || '').length);
    }

    // Convert a flat textarea character offset back to {line, ch}
    function offsetToPos(lines, off) {
        var rem = off;
        for (var i = 0; i < lines.length; i++) {
            if (rem <= lines[i].length) return { line: i, ch: rem };
            rem -= lines[i].length + 1;
        }
        var last = lines.length - 1;
        return { line: Math.max(0, last), ch: (lines[Math.max(0, last)] || '').length };
    }

    // ── SearchCursor ─────────────────────────────────────────────────────────

    function SearchCursor(lines, query, caseFold) {
        this._lines    = lines;
        this._text     = lines.join('\n');
        this._query    = query;
        this._caseFold = caseFold;
        this._pos      = 0;
        this.from      = null;
        this.to        = null;
    }
    SearchCursor.prototype.findNext = function () {
        var src = (this._caseFold && typeof this._query === 'string')
            ? this._text.toLowerCase() : this._text;
        var q   = (this._caseFold && typeof this._query === 'string')
            ? this._query.toLowerCase() : this._query;
        var idx;
        if (q instanceof RegExp) {
            q.lastIndex = this._pos;
            var m = q.exec(src);
            if (!m) { this._pos = this._text.length; return false; }
            idx       = m.index;
            this._pos = idx + m[0].length;
        } else {
            idx = src.indexOf(q, this._pos);
            if (idx === -1) return false;
            this._pos = idx + q.length;
        }
        this.from = offsetToPos(this._lines, idx);
        this.to   = offsetToPos(this._lines, this._pos);
        return true;
    };

    // ── TextMarker ───────────────────────────────────────────────────────────

    function TextMarker(from, to) {
        this._from    = from;
        this._to      = to;
        this._cleared = false;
    }
    TextMarker.prototype.clear = function () { this._cleared = true; };
    TextMarker.prototype.find  = function () {
        return this._cleared ? null : { from: this._from, to: this._to };
    };

    // ── Core editor instance ─────────────────────────────────────────────────

    function CMFallback(place, options) {
        options = options || {};

        // Outer wrapper div (mirrors real CM structure enough for getWrapperElement)
        this._wrapper = document.createElement('div');
        this._wrapper.className = 'CodeMirror cm-s-' + (options.theme || 'default') +
            ' CodeMirror-fallback';
        this._wrapper.style.cssText =
            'position:relative;height:100%;display:flex;flex-direction:column;' +
            'font-family:"Fira Code",Consolas,Monaco,monospace;font-size:13px;' +
            'background:var(--bg-color,#272822);color:var(--text-color,#f8f8f2);';

        // Notice banner
        var notice = document.createElement('div');
        notice.style.cssText =
            'background:#7a4f00;color:#fff3cd;font-size:11px;padding:3px 10px;' +
            'text-align:center;flex-shrink:0;font-family:sans-serif;letter-spacing:0.01em;';
        notice.textContent =
            '⚠ CodeMirror unavailable — basic fallback editor active ' +
            '(syntax highlighting and advanced features disabled)';
        this._wrapper.appendChild(notice);

        // Scroll row: gutter + textarea
        var row = document.createElement('div');
        row.style.cssText = 'flex:1;display:flex;overflow:hidden;min-height:0;';

        // Line-number gutter
        this._gutter = document.createElement('div');
        this._gutter.style.cssText =
            'width:44px;flex-shrink:0;overflow:hidden;text-align:right;' +
            'padding:4px 6px 4px 0;font-size:12px;line-height:1.6;' +
            'color:rgba(255,255,255,0.25);user-select:none;white-space:pre;' +
            'background:rgba(0,0,0,0.18);box-sizing:border-box;';

        // Textarea
        this._ta = document.createElement('textarea');
        this._ta.style.cssText =
            'flex:1;background:transparent;color:inherit;border:none;outline:none;' +
            'resize:none;font-family:inherit;font-size:inherit;line-height:1.6;' +
            'padding:4px 8px;box-sizing:border-box;overflow:auto;' +
            'white-space:' + (options.lineWrapping ? 'pre-wrap' : 'pre') + ';' +
            'tab-size:' + (options.tabSize || 4) + ';';
        this._ta.spellcheck = false;

        row.appendChild(this._gutter);
        row.appendChild(this._ta);
        this._wrapper.appendChild(row);

        // Internal state
        this._options  = Object.assign({
            lineNumbers: true, tabSize: 4, mode: 'text/plain',
            theme: 'default', lineWrapping: false, readOnly: false,
        }, options);
        this._handlers = {};

        // DOM event wiring
        var self = this;
        this._ta.addEventListener('input', function () {
            var change = { origin: '+input', text: [self._ta.value] };
            self._updateGutter();
            self._emit('change', self, change);
            self._emit('inputRead', self, change);
            self._emit('cursorActivity', self);
        });
        this._ta.addEventListener('keydown', function (e) {
            if (e.key === 'Tab') {
                e.preventDefault();
                var spaces = ' '.repeat(self._options.tabSize || 4);
                var s = self._ta.selectionStart, en = self._ta.selectionEnd;
                var v = self._ta.value;
                self._ta.value = v.slice(0, s) + spaces + v.slice(en);
                self._ta.selectionStart = self._ta.selectionEnd = s + spaces.length;
                self._emit('change', self, { origin: '+input', text: [spaces] });
                self._updateGutter();
            }
        });
        this._ta.addEventListener('scroll', function () { self._emit('scroll', self); });
        this._ta.addEventListener('click',  function () { self._emit('cursorActivity', self); });
        this._ta.addEventListener('keyup',  function () { self._emit('cursorActivity', self); });

        // Mount into the DOM (duck-type check rather than instanceof HTMLElement
        // so this works in environments where HTMLElement may not be defined)
        if (place && typeof place.appendChild === 'function') {
            place.appendChild(this._wrapper);
        } else if (typeof place === 'function') {
            place(this._wrapper);
        }
    }

    CMFallback.prototype._emit = function (event) {
        var args = Array.prototype.slice.call(arguments, 1);
        (this._handlers[event] || []).forEach(function (fn) {
            try { fn.apply(null, args); } catch (e) { console.error('[CM-fallback]', e); }
        });
    };

    CMFallback.prototype._updateGutter = function () {
        if (!this._options.lineNumbers) { this._gutter.style.display = 'none'; return; }
        var count = this._ta.value.split('\n').length;
        var nums = '';
        for (var i = 1; i <= count; i++) nums += i + '\n';
        this._gutter.textContent = nums;
        // keep gutter scroll in sync
        this._gutter.scrollTop = this._ta.scrollTop;
    };

    // ── Public API ───────────────────────────────────────────────────────────

    CMFallback.prototype.getValue = function () { return this._ta.value; };

    CMFallback.prototype.setValue = function (val) {
        this._ta.value = val == null ? '' : String(val);
        this._updateGutter();
        this._emit('change', this, { origin: 'setValue', text: [this._ta.value] });
        this._emit('cursorActivity', this);
    };

    CMFallback.prototype.getLine = function (n) {
        return this._ta.value.split('\n')[n] || '';
    };

    CMFallback.prototype.lineCount = function () {
        return this._ta.value.split('\n').length;
    };

    CMFallback.prototype.getCursor = function (which) {
        var off   = (which === 'to') ? this._ta.selectionEnd : this._ta.selectionStart;
        var lines = this._ta.value.split('\n');
        return offsetToPos(lines, off);
    };

    CMFallback.prototype.setCursor = function (lineOrPos, ch) {
        var pos = (typeof lineOrPos === 'object')
            ? lineOrPos : { line: lineOrPos || 0, ch: ch || 0 };
        var lines = this._ta.value.split('\n');
        var off   = posToOffset(lines, pos);
        try { this._ta.focus(); this._ta.setSelectionRange(off, off); } catch (_) {}
        this._emit('cursorActivity', this);
    };

    CMFallback.prototype.getSelection = function () {
        var s = this._ta.selectionStart, e = this._ta.selectionEnd;
        return s === e ? '' : this._ta.value.slice(s, e);
    };

    CMFallback.prototype.setSelection = function (from, to) {
        var lines = this._ta.value.split('\n');
        var s = posToOffset(lines, from);
        var e = posToOffset(lines, to);
        try { this._ta.setSelectionRange(s, e); } catch (_) {}
    };

    CMFallback.prototype.replaceRange = function (text, from, to) {
        var lines = this._ta.value.split('\n');
        var s = posToOffset(lines, from);
        var e = to ? posToOffset(lines, to) : s;
        var v = this._ta.value;
        this._ta.value = v.slice(0, s) + text + v.slice(e);
        this._updateGutter();
        this._emit('change', this, { origin: '+input', text: [text] });
    };

    CMFallback.prototype.getSearchCursor = function (query, _start, opts) {
        var caseFold = opts && opts.caseFold;
        var lines = this._ta.value.split('\n');
        return new SearchCursor(lines, query, caseFold);
    };

    CMFallback.prototype.markText = function (from, to /*, opts */) {
        return new TextMarker(from, to);
    };

    CMFallback.prototype.getScrollInfo = function () {
        var el = this._ta;
        return {
            top: el.scrollTop, left: el.scrollLeft,
            height: el.scrollHeight, width: el.scrollWidth,
            clientHeight: el.clientHeight, clientWidth: el.clientWidth,
        };
    };

    CMFallback.prototype.scrollTo = function (x, y) {
        if (x != null) this._ta.scrollLeft = x;
        if (y != null) this._ta.scrollTop  = y;
        this._updateGutter();
        this._emit('scroll', this);
    };

    CMFallback.prototype.scrollIntoView = function (posOrRange) {
        var pos = posOrRange && posOrRange.line != null ? posOrRange
                : (posOrRange && posOrRange.from ? posOrRange.from : null);
        if (!pos) return;
        var lines = this._ta.value.split('\n');
        var off   = posToOffset(lines, pos);
        try { this._ta.setSelectionRange(off, off); } catch (_) {}
    };

    CMFallback.prototype.on  = function (ev, fn) {
        if (!this._handlers[ev]) this._handlers[ev] = [];
        this._handlers[ev].push(fn);
    };
    CMFallback.prototype.off = function (ev, fn) {
        if (!this._handlers[ev]) return;
        this._handlers[ev] = this._handlers[ev].filter(function (f) { return f !== fn; });
    };

    CMFallback.prototype.setOption = function (key, val) {
        this._options[key] = val;
        if (key === 'lineWrapping')
            this._ta.style.whiteSpace = val ? 'pre-wrap' : 'pre';
        if (key === 'readOnly') {
            this._ta.readOnly = !!val;
            this._ta.style.opacity = val ? '0.65' : '1';
        }
        if (key === 'tabSize')
            this._ta.style.tabSize = val;
        if (key === 'theme')
            this._wrapper.className = this._wrapper.className
                .replace(/cm-s-\S+/, 'cm-s-' + val);
    };
    CMFallback.prototype.getOption = function (key) { return this._options[key]; };

    CMFallback.prototype.refresh      = function () {};
    CMFallback.prototype.focus        = function () { try { this._ta.focus(); } catch (_) {} };
    CMFallback.prototype.clearHistory = function () {};

    CMFallback.prototype.getWrapperElement = function () { return this._wrapper; };

    // Stubs — the app guards these with typeof or they return safely ignorable values
    CMFallback.prototype.performLint       = function () {};
    CMFallback.prototype.foldCode          = function () {};
    CMFallback.prototype.showHint          = function () {};
    CMFallback.prototype.annotateScrollbar = function () {
        return { update: function () {}, clear: function () {} };
    };
    CMFallback.prototype.getLineTokens = function (lineNo) {
        var text = this.getLine(lineNo) || '';
        return [{ string: text, type: null, start: 0, end: text.length }];
    };

    // ── Factory + statics ────────────────────────────────────────────────────

    function CMFactory(place, options) { return new CMFallback(place, options); }

    CMFactory.Pass     = { toString: function () { return 'CodeMirror.Pass'; } };
    CMFactory.cmpPos   = posCmp;
    CMFactory.hint     = { javascript: null, css: null, html: null, sql: null };
    // MergeView requires the real CM diff addon — stub returns null so layout.js
    // typeof-guards trigger the "Diff tool library not loaded" notification.
    CMFactory.MergeView    = undefined;
    CMFactory.defineMIME   = function () {};
    CMFactory.resolveMode  = function () { return { name: 'null' }; };

    // Minimal CSS injected once so the fallback wrapper looks reasonable
    var style = document.createElement('style');
    style.id = 'cm-fallback-style';
    style.textContent = [
        '.CodeMirror-fallback textarea { caret-color: var(--accent-color, #a6e22e); }',
        '.CodeMirror { height: 100%; }',
    ].join('\n');
    document.head.appendChild(style);

    return CMFactory;
};


// ═════════════════════════════════════════════════════════════════════════════
//  2.  LOCALFORAGE  —  localStorage-backed async shim
// ═════════════════════════════════════════════════════════════════════════════

window._localforageFallback = (function () {
    var P = 'lf_fb_';
    return {
        getItem: async function (key) {
            try { var r = localStorage.getItem(P + key); return r ? JSON.parse(r) : null; }
            catch (e) { return null; }
        },
        setItem: async function (key, value) {
            try { localStorage.setItem(P + key, JSON.stringify(value)); }
            catch (e) { console.warn('[localforage-fb] setItem failed:', e); }
        },
        removeItem: async function (key) {
            try { localStorage.removeItem(P + key); } catch (_) {}
        },
    };
})();


// ═════════════════════════════════════════════════════════════════════════════
//  3.  FILESAVER / saveAs  —  anchor-download fallback
// ═════════════════════════════════════════════════════════════════════════════

window._saveAsFallback = function (blob, filename) {
    try {
        var url = URL.createObjectURL(blob);
        var a   = document.createElement('a');
        a.href = url; a.download = filename || 'download';
        document.body.appendChild(a); a.click();
        setTimeout(function () { URL.revokeObjectURL(url); a.remove(); }, 1500);
    } catch (e) {
        console.error('[saveAs-fb]', e);
        if (typeof showNotification === 'function')
            showNotification('Download failed: browser blocked the save.', true);
    }
};


// ═════════════════════════════════════════════════════════════════════════════
//  4.  MARKDOWN-IT  —  lightweight renderer covering the common syntax
//      (headings, bold, italic, inline code, fenced code, blockquote,
//       ordered/unordered lists, horizontal rules, links, images)
// ═════════════════════════════════════════════════════════════════════════════

window._markdownitFallback = function () {
    return {
        render: function (src) {
            var esc = function (s) {
                return s.replace(/&/g,'&amp;').replace(/</g,'&lt;')
                        .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
            };
            var inline = function (s) {
                s = s.replace(/\*\*([^*\n]+)\*\*/g, '<strong>$1</strong>');
                s = s.replace(/__([^_\n]+)__/g,     '<strong>$1</strong>');
                s = s.replace(/\*([^*\n]+)\*/g,      '<em>$1</em>');
                s = s.replace(/_([^_\n]+)_/g,        '<em>$1</em>');
                s = s.replace(/`([^`\n]+)`/g,         '<code>$1</code>');
                s = s.replace(/!\[([^\]]*)\]\(([^)]+)\)/g,
                    '<img alt="$1" src="$2" style="max-width:100%">');
                s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g,
                    '<a href="$2" target="_blank">$1</a>');
                return s;
            };

            var lines = src.split('\n');
            var out   = [];
            var i     = 0;

            while (i < lines.length) {
                var line = lines[i];

                // Fenced code block
                if (/^```/.test(line)) {
                    var lang = esc(line.slice(3).trim());
                    var code = [];
                    i++;
                    while (i < lines.length && !/^```/.test(lines[i])) {
                        code.push(esc(lines[i])); i++;
                    }
                    out.push('<pre><code' + (lang ? ' class="language-' + lang + '"' : '') +
                        '>' + code.join('\n') + '</code></pre>');
                    i++; continue;
                }

                // Heading
                var hm = line.match(/^(#{1,6})\s+(.*)/);
                if (hm) {
                    var lv = hm[1].length;
                    out.push('<h' + lv + '>' + inline(esc(hm[2])) + '</h' + lv + '>');
                    i++; continue;
                }

                // Horizontal rule
                if (/^(-{3,}|\*{3,}|_{3,})\s*$/.test(line)) {
                    out.push('<hr>'); i++; continue;
                }

                // Blockquote
                if (/^>\s?/.test(line)) {
                    var bq = [];
                    while (i < lines.length && /^>\s?/.test(lines[i]))
                        bq.push(inline(esc(lines[i++].replace(/^>\s?/, '')))).length;
                    out.push('<blockquote><p>' + bq.join('<br>') + '</p></blockquote>');
                    continue;
                }

                // Unordered list
                if (/^[-*+]\s/.test(line)) {
                    var ul = [];
                    while (i < lines.length && /^[-*+]\s/.test(lines[i]))
                        ul.push('<li>' + inline(esc(lines[i++].replace(/^[-*+]\s/, ''))) + '</li>');
                    out.push('<ul>' + ul.join('') + '</ul>');
                    continue;
                }

                // Ordered list
                if (/^\d+\.\s/.test(line)) {
                    var ol = [];
                    while (i < lines.length && /^\d+\.\s/.test(lines[i]))
                        ol.push('<li>' + inline(esc(lines[i++].replace(/^\d+\.\s/, ''))) + '</li>');
                    out.push('<ol>' + ol.join('') + '</ol>');
                    continue;
                }

                // Blank line
                if (line.trim() === '') { out.push(''); i++; continue; }

                // Paragraph — consume until blank or block-level marker
                var para = [];
                while (i < lines.length && lines[i].trim() !== '' &&
                       !/^(#{1,6}\s|>|[-*+]\s|\d+\.\s|```|[-*_]{3})/.test(lines[i]))
                    para.push(inline(esc(lines[i++])));
                out.push('<p>' + para.join(' ') + '</p>');
            }
            return out.join('\n');
        }
    };
};


// ═════════════════════════════════════════════════════════════════════════════
//  5.  FFLATE  —  minimal synchronous ZIP builder (store / no compression)
//
//  Covers the fflate.zipSync + fflate.strToU8 surface used by the zip workers.
//  Output is a valid ZIP that opens in all modern archive tools; files are
//  stored uncompressed (method 0) which is correct and reliable.
// ═════════════════════════════════════════════════════════════════════════════

window._fflateFallback = (function () {

    function strToU8(str) {
        if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(str);
        var out = new Uint8Array(str.length);
        for (var i = 0; i < str.length; i++) out[i] = str.charCodeAt(i) & 0xff;
        return out;
    }

    // Build CRC-32 table on first call
    var _crcTable = null;
    function crc32(buf) {
        if (!_crcTable) {
            _crcTable = new Uint32Array(256);
            for (var i = 0; i < 256; i++) {
                var c = i;
                for (var j = 0; j < 8; j++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
                _crcTable[i] = c >>> 0;
            }
        }
        var crc = 0xffffffff;
        for (var k = 0; k < buf.length; k++)
            crc = _crcTable[(crc ^ buf[k]) & 0xff] ^ (crc >>> 8);
        return (crc ^ 0xffffffff) >>> 0;
    }

    function u16(n) { return [n & 0xff, (n >> 8) & 0xff]; }
    function u32(n) { return [n & 0xff, (n >>> 8) & 0xff, (n >>> 16) & 0xff, (n >>> 24) & 0xff]; }

    function concat(arrays) {
        var total = 0;
        for (var i = 0; i < arrays.length; i++) total += arrays[i].length;
        var out = new Uint8Array(total), off = 0;
        for (var j = 0; j < arrays.length; j++) {
            out.set(arrays[j], off); off += arrays[j].length;
        }
        return out;
    }

    function toU8(a) {
        // Accept plain number[] or Uint8Array
        return (a instanceof Uint8Array) ? a : new Uint8Array(a);
    }

    function zipSync(zippable) {
        var localParts = [];
        var cdParts    = [];
        var offset     = 0;
        var count      = 0;

        var names = Object.keys(zippable);
        for (var i = 0; i < names.length; i++) {
            var name      = names[i];
            var entry     = zippable[name];
            var fileData  = entry[0] instanceof Uint8Array ? entry[0] : toU8(entry[0]);
            var nameBytes = strToU8(name);
            var crc       = crc32(fileData);
            var size      = fileData.length;

            // Local file header (signature 0x04034b50)
            var lh = toU8([].concat(
                [0x50,0x4b,0x03,0x04],   // sig
                u16(20), u16(0), u16(0), // version, flags, method (store)
                u16(0), u16(0),          // mod time, date
                u32(crc),
                u32(size), u32(size),    // compressed = uncompressed
                u16(nameBytes.length), u16(0) // name len, extra len
            ));

            // Central directory entry (signature 0x02014b50)
            var cd = toU8([].concat(
                [0x50,0x4b,0x01,0x02],
                u16(20), u16(20), u16(0), u16(0),
                u16(0), u16(0),
                u32(crc),
                u32(size), u32(size),
                u16(nameBytes.length), u16(0), u16(0), // name, extra, comment
                u16(0), u16(0),                         // disk, int attr
                u32(name.endsWith('/') ? 0x10 : 0),     // ext attr (dir flag)
                u32(offset)                              // local header offset
            ));

            var localRecord = concat([lh, nameBytes, fileData]);
            var cdEntry     = concat([cd, nameBytes]);

            localParts.push(localRecord);
            cdParts.push(cdEntry);
            offset += localRecord.length;
            count++;
        }

        var cdOffset = offset;
        var cdBlob   = cdParts.length ? concat(cdParts) : new Uint8Array(0);
        var local    = localParts.length ? concat(localParts) : new Uint8Array(0);

        // End of central directory record (signature 0x06054b50)
        var eocd = toU8([].concat(
            [0x50,0x4b,0x05,0x06],
            u16(0), u16(0),
            u16(count), u16(count),
            u32(cdBlob.length),
            u32(cdOffset),
            u16(0)
        ));

        return concat([local, cdBlob, eocd]);
    }

    return { zipSync: zipSync, strToU8: strToU8 };
})();


// ═════════════════════════════════════════════════════════════════════════════
//  6.  PRETTIER  —  stub (formats nothing, but fails visibly rather than
//      silently crashing the app)
// ═════════════════════════════════════════════════════════════════════════════

window._prettierFallback = {
    format: function () { throw new Error('Prettier not available (CDN failed to load).'); }
};


// ═════════════════════════════════════════════════════════════════════════════
//  7.  PRE-DECLARE linter / diff globals to prevent ReferenceErrors
//      CM addon scripts use typeof checks before calling these.
// ═════════════════════════════════════════════════════════════════════════════

if (typeof JSHINT           === 'undefined') window.JSHINT           = null;
if (typeof CSSLint          === 'undefined') window.CSSLint          = null;
if (typeof diff_match_patch === 'undefined') window.diff_match_patch = null;


// ═════════════════════════════════════════════════════════════════════════════
//  initVendorFallbacks()  —  called once from index.html after all CDN tags
// ═════════════════════════════════════════════════════════════════════════════

window.initVendorFallbacks = function () {
    var missing = [];

    // CodeMirror — the big one
    if (typeof CodeMirror === 'undefined') {
        window.CodeMirror = window._buildCodeMirrorFallback();
        missing.push('CodeMirror (basic textarea editor, no syntax highlighting)');
    }

    // localforage
    if (typeof localforage === 'undefined') {
        window.localforage = window._localforageFallback;
        missing.push('localforage (session using localStorage)');
    }

    // FileSaver
    if (typeof saveAs === 'undefined') {
        window.saveAs = window._saveAsFallback;
        missing.push('FileSaver (anchor-download fallback)');
    }

    // markdown-it
    if (typeof markdownit === 'undefined') {
        window.markdownit = window._markdownitFallback;
        missing.push('markdown-it (basic Markdown renderer)');
    }

    // Prettier
    if (typeof prettier === 'undefined') {
        window.prettier = window._prettierFallback;
        window.prettierPlugins = {};
        missing.push('Prettier (code formatting unavailable)');
    }

    // fflate — activate local ZIP implementation
    if (typeof fflate === 'undefined') {
        window.fflate = window._fflateFallback;
        missing.push('fflate (local ZIP, uncompressed)');
    }

    // XLSX — no viable runtime shim; fileOps.js already guards with typeof XLSX
    if (typeof XLSX === 'undefined')
        missing.push('XLSX (Excel support unavailable)');

    if (missing.length > 0) {
        console.warn('[vendor-fallbacks] Active:', missing);
        _showCdnWarningBanner(missing);
    }
};


// ── Warning banner ───────────────────────────────────────────────────────────

window._cdnBannerShown = false;
window._showCdnWarningBanner = function (list) {
    if (window._cdnBannerShown) return;
    window._cdnBannerShown = true;

    function render() {
        var banner = document.createElement('div');
        banner.style.cssText =
            'position:fixed;top:0;left:0;right:0;z-index:99999;' +
            'background:#7a4f00;color:#fff3cd;padding:7px 14px;' +
            'font-size:12px;font-family:sans-serif;' +
            'display:flex;align-items:center;gap:10px;' +
            'box-shadow:0 2px 8px rgba(0,0,0,0.45);';

        var names = list.map(function (s) { return s.split(' (')[0]; }).join(', ');
        var msg = document.createElement('span');
        msg.style.flex = '1';
        msg.innerHTML = '<strong>⚠ CDN fallback active:</strong> ' +
            'Some libraries are running from local fallbacks. ' +
            'Features may be limited. Refresh with a working internet connection to restore full functionality. ' +
            '<em style="opacity:0.7">(' + names + ')</em>';

        var btn = document.createElement('button');
        btn.textContent = '✕';
        btn.style.cssText =
            'background:transparent;border:1px solid rgba(255,243,205,0.4);' +
            'color:#fff3cd;cursor:pointer;padding:2px 7px;border-radius:3px;' +
            'font-size:12px;flex-shrink:0;';
        btn.onclick = function () { banner.remove(); };

        banner.appendChild(msg);
        banner.appendChild(btn);
        document.body.appendChild(banner);
    }

    if (document.body) { render(); }
    else { document.addEventListener('DOMContentLoaded', function () {
        if (document.body) render();
    }); }
};


// ── CodeMirror CDN onerror handler ───────────────────────────────────────────
// Called if the CM <script> tag fires onerror (network failure / 404).
// The local fallback will be activated by initVendorFallbacks() — this just
// logs so the DevTools console clearly explains what happened.

window.onCodeMirrorLoadFailed = function () {
    console.warn('[vendor-fallbacks] CodeMirror CDN request failed — local textarea fallback will be used.');
};
