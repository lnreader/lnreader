// Text Vide 1.8.6 (MIT), with a forward scan for tags and entities.
// https://github.com/Gumball12/text-vide/tree/v1.8.6
// prettier-ignore
var textVide=function(e){"use strict";function t(e){let t=e.next().value,n=-1;return({index:i})=>{for(;t&&t[0]<i;)n=t[1],t=e.next().value;return i<n}}const n=e=>null==e||""===e,i=(e,t)=>Object.keys(e).reduce((e,n)=>(t(e[n])&&delete e[n],e),e),o=["<b>","</b>"],r=e=>((e,t)=>({...t,...i(e,n)}))(e,{sep:o,fixationPoint:1,ignoreHtmlTag:!0,ignoreHtmlEntity:!0}),l=[[0,4,12,17,24,29,35,42,48],[1,2,7,10,13,14,19,22,25,28,31,34,37,40,43,46,49],[1,2,5,7,9,11,13,15,17,19,21,23,25,27,29,31,33,35,37,39,41,43,45,47,49],[0,2,4,5,6,8,9,11,14,15,17,18,20,0,21,23,24,26,27,29,30,32,33,35,36,38,39,41,42,44,45,47,48],[0,2,3,5,6,7,8,10,11,12,14,15,17,19,20,21,23,24,25,26,28,29,30,32,33,34,35,37,38,39,41,42,43,44,46,47,48]],c=(e,t)=>{const{length:n}=e,i=l[t-1]??l[0],o=i.findIndex(e=>n<=e);let r=n-o;return-1===o&&(r=n-i.length),Math.max(r,0)},f=(e,t)=>"string"==typeof t?`${t}${e}${t}`:`${t[0]}${e}${t[1]}`,s=new RegExp("(\\p{L}|\\p{Nd})*\\p{L}(\\p{L}|\\p{Nd})*","gu");return e.textVide=(e,n={})=>{if(!e?.length)return"";const{fixationPoint:i,sep:o,ignoreHtmlTag:l,ignoreHtmlEntity:u}=r(n),a=Array.from(e.matchAll(s));let d,x,g="",p=0;l&&(d=t((e=>{const t=[];let n=0;for(;n<e.length;){const i=e.indexOf("<",n);if(-1===i)break;if(e.startsWith("\x3c!--",i)){const o=e.indexOf("--\x3e",i+4);if(-1!==o){t.push([i,o+2]),n=o+3;continue}}const o=e.indexOf(">",i+1);if(-1===o)break;o>i+1&&t.push([i,o]),n=o+1}return t})(e).values())),u&&(x=t(function*(e){for(const t of e.matchAll(/&[\w#]+;/g))yield[t.index,t.index+t[0].length-1]}(e)));for(const t of a){if(d?.(t)||x?.(t))continue;const[n]=t,r=t.index,l=r+c(n,i);g+=e.slice(p,r),r!==l&&(g+=f(e.slice(r,l),o)),p=l}return g+e.slice(p)},Object.defineProperty(e,Symbol.toStringTag,{value:"Module"}),e}({});

/*
MIT License

Copyright (c) 2022 shj

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
*/
