/* Problem cards: one card per lab tab, kept in sync with the selected tab. Data: window.LAB_CARDS[labId][tabKey]. */
(function(){
  var D=window.LAB_CARDS||{},ATTRS=['data-lt','data-bp','data-cxt','data-tm','data-ww','data-k'],closed={};
  var MODES={'':['The problem','Example','Idea','On screen'],cost:['What this measures','Result','Watch for','On screen'],sd:['The scenario','Setup','Watch for','On screen']};
  function keyOf(sec){
    var b=sec.querySelector(':scope>.opts .tab[aria-pressed="true"]');
    if(!b)return '-';
    for(var i=0;i<ATTRS.length;i++){var v=b.getAttribute(ATTRS[i]);if(v!=null)return v}
    return '-';
  }
  function body(c){
    var L=MODES[c.m||'']||MODES[''],h='<summary><span class="lp-t">'+L[0]+'</span>'+(c.tag?'<span class="lp-tag">'+c.tag+'</span>':'')+'<span class="lp-x"></span>'+(c.mini?'<span class="lp-mini">'+c.mini+'</span>':'')+'</summary><div class="lp-b"><div class="lp-m">';
    if(c.p)h+='<p class="lp-q">'+c.p+'</p>';
    if(c.e)h+='<p class="lp-r"><span class="lp-h">'+L[1]+'</span><span>'+c.e+'</span></p>';
    if(c.i)h+='<p class="lp-r"><span class="lp-h">'+L[2]+'</span><span>'+c.i+'</span></p>';
    h+='</div>';
    if(c.s&&c.s.length){h+='<div class="lp-s"><span class="lp-h">'+L[3]+'</span><ul>';
      for(var i=0;i<c.s.length;i++)h+='<li>'+(c.s[i][0]?'<span class="lp-k">'+c.s[i][0]+'</span>':'')+'<span>'+c.s[i][1]+'</span></li>';
      h+='</ul></div>'}
    return h+'</div>';
  }
  function render(sec){
    var lab=D[sec.id];if(!lab)return;
    var k=keyOf(sec),c=lab[k]||lab['-'],card=sec.querySelector(':scope>.lp');
    if(!c){if(card)card.remove();sec.classList.remove('lp-on');return}
    if(card&&card.getAttribute('data-k')===k)return;
    if(!card){
      card=document.createElement('details');card.className='lp';
      card.addEventListener('toggle',function(){closed[sec.id]=!card.open;sec.classList.toggle('lp-on',card.open&&!card.hasAttribute('data-keep'))});
    }
    card.setAttribute('data-k',k);
    if(c.keep)card.setAttribute('data-keep','');else card.removeAttribute('data-keep');
    card.innerHTML=body(c);
    card.open=!closed[sec.id];
    var after=sec.querySelector(':scope>.opts')||sec.querySelector(':scope>.lab-head');
    if(card.parentNode!==sec||card.previousElementSibling!==after){if(after)after.after(card);else sec.prepend(card)}
    sec.classList.toggle('lp-on',card.open&&!c.keep);
  }
  function watch(sec){
    if(sec.__lp)return;sec.__lp=1;
    new MutationObserver(function(){render(sec)}).observe(sec,{childList:true});
    new MutationObserver(function(){render(sec)}).observe(sec,{subtree:true,attributes:true,attributeFilter:['aria-pressed']});
    render(sec);
  }
  function start(){var s=document.querySelectorAll('section.lab[id]');for(var i=0;i<s.length;i++)if(D[s[i].id])watch(s[i])}
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',start);else start();
})();
