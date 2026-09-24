/* bloco compartilhado 01 */

(()=>{
  'use strict';
  const root=document.documentElement;
  const nav=navigator;
  const coarse=window.matchMedia&&matchMedia('(pointer:coarse)').matches;
  const anyCoarse=window.matchMedia&&matchMedia('(any-pointer:coarse)').matches;
  const touch=((nav.maxTouchPoints||0)>0)||coarse||anyCoarse;
  if(!touch)return;
  root.classList.add('touch-performance');
  const isiPadOS=/iPad|iPhone|iPod/i.test(nav.userAgent||'')||(nav.platform==='MacIntel'&&(nav.maxTouchPoints||0)>1);
  if(isiPadOS)root.classList.add('ios-webkit-touch');
  const syncVH=()=>{
    const vv=window.visualViewport;
    const h=(vv&&vv.height)||window.innerHeight||document.documentElement.clientHeight||1;
    root.style.setProperty('--stable-vh',(h*.01).toFixed(3)+'px');
  };
  syncVH();
})();

