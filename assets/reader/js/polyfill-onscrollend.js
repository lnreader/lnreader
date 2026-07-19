/* eslint-disable eslint-comments/no-unlimited-disable */
/* eslint-disable */
'use strict';
(() => {
  function f(i, o, r, s = !1) {
    if (!(o in i) || typeof r != 'function') return !1;
    let t = i[o];
    return (
      (i[o] = function (...e) {
        return (
          s || t.apply(this, e), (t = t.bind(this)), r.apply(this, [t, ...e])
        );
      }),
      !0
    );
  }
  if (typeof window == 'undefined') throw 'Not in a browser.';
  var p = 'onscrollend' in window;
  if (!p) {
    let s = function (e, u, l) {
        if (u !== 'scrollend') {
          e.apply(this, [u, l]);
          return;
        }
        let c = this,
          n = i.get(c);
        if (!n) {
          let d;
          (n = {
            scrollFn: () => {
              clearTimeout(d),
                (d = setTimeout(() => {
                  l();
                }, 100));
            },
            handlers: [l],
          }),
            e.apply(c, ['scroll', n.scrollFn, !1]),
            i.set(c, n);
        }
      },
      t = function (e, u, l) {
        if (u !== 'scrollend') {
          e.apply(this, [u, l]);
          return;
        }
        let c = this,
          n = i.get(c);
        if (n) {
          if (
            (typeof n.scrollFn == 'function' &&
              e.apply(this, ['scroll', n.scrollFn]),
            typeof l == 'undefined')
          )
            n.handlers = [];
          else {
            let d = n.handlers.indexOf(l);
            d > -1 && n.handlers.splice(d, 1);
          }
          n.handlers.length === 0 && i.delete(c);
        }
      };
    (a = s), (w = t);
    let i = new WeakMap(),
      o = null,
      r = null;
    f(window, 'addEventListener', s, !0),
      f(window, 'removeEventListener', t, !0),
      Object.defineProperty(window, 'onscrollend', {
        set: e => {
          (typeof e != 'function' || o) &&
            t.call(window, window.removeEventListener, 'scrollend', o),
            (o = e),
            e && s.call(window, window.addEventListener, 'scrollend', e);
        },
        get: () => o,
      }),
      f(document, 'addEventListener', s, !0),
      f(document, 'removeEventListener', t, !0),
      Object.defineProperty(document, 'onscrollend', {
        set: e => {
          (typeof e != 'function' || r) &&
            t.call(document, document.removeEventListener, 'scrollend', r),
            (r = e),
            e && s.call(document, document.addEventListener, 'scrollend', e);
        },
        get: () => r,
      });
  }
  var a, w;
})();
