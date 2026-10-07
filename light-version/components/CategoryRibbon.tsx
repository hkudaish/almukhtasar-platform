"use client";

import Link from "next/link";
import { KeyboardEvent, PointerEvent, useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

// The ribbon is rendered separately on the home and category routes. Keep its
// native scroll value outside either instance so navigation does not move a
// ribbon that the reader has positioned themselves (including in RTL).
let preservedRibbonScrollLeft:number|null=null;

export default function CategoryRibbon({categories,activeCategory="",showBreaking=false}:{categories:string[];activeCategory?:string;showBreaking?:boolean}){
  const scroller=useRef<HTMLDivElement>(null),drag=useRef({active:false,startX:0,startScroll:0,moved:false});
  const [canStart,setCanStart]=useState(false),[canEnd,setCanEnd]=useState(false);
  const rememberPosition=useCallback((node=scroller.current)=>{if(node)preservedRibbonScrollLeft=node.scrollLeft;},[]);
  const update=useCallback(()=>{
    const node=scroller.current,items=node?.querySelectorAll<HTMLElement>("[data-category-tab]");
    if(!node||!items?.length)return;
    const viewport=node.getBoundingClientRect(),first=items[0].getBoundingClientRect(),last=items[items.length-1].getBoundingClientRect();
    setCanStart(first.right>viewport.right+2);setCanEnd(last.left<viewport.left-2);
  },[]);
  useLayoutEffect(()=>{
    const node=scroller.current;if(!node)return;
    if(preservedRibbonScrollLeft!==null)node.scrollLeft=preservedRibbonScrollLeft;
    update();const observer=new ResizeObserver(update);observer.observe(node);return ()=>observer.disconnect();
  },[update]);
  useEffect(()=>()=>rememberPosition(),[rememberPosition]);
  function move(toward:"start"|"end"){
    const node=scroller.current,items=[...(node?.querySelectorAll<HTMLElement>("[data-category-tab]")||[])];if(!node)return;
    const viewport=node.getBoundingClientRect(),target=toward==="end"?items.find((item)=>item.getBoundingClientRect().left<viewport.left-2):items.reverse().find((item)=>item.getBoundingClientRect().right>viewport.right+2);
    target?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"});
  }
  function keys(event:KeyboardEvent<HTMLDivElement>){
    if(!["ArrowLeft","ArrowRight","Home","End"].includes(event.key))return;
    const items=[...event.currentTarget.querySelectorAll<HTMLElement>("[data-category-tab]")],current=items.indexOf(document.activeElement as HTMLElement);if(current<0)return;
    event.preventDefault();const index=event.key==="Home"?0:event.key==="End"?items.length-1:event.key==="ArrowLeft"?Math.min(items.length-1,current+1):Math.max(0,current-1);
    items[index]?.focus();items[index]?.scrollIntoView({behavior:"smooth",block:"nearest",inline:"nearest"});
  }
  function pointerDown(event:PointerEvent<HTMLDivElement>){if(event.pointerType!=="mouse"||event.button!==0)return;const node=event.currentTarget;drag.current={active:true,startX:event.clientX,startScroll:node.scrollLeft,moved:false};}
  function pointerMove(event:PointerEvent<HTMLDivElement>){
    if(!drag.current.active)return;const delta=event.clientX-drag.current.startX;
    if(!drag.current.moved&&Math.abs(delta)<=6)return;
    if(!drag.current.moved){drag.current.moved=true;event.currentTarget.setPointerCapture(event.pointerId);}
    event.preventDefault();event.currentTarget.scrollLeft=drag.current.startScroll-delta;
  }
  function pointerUp(event:PointerEvent<HTMLDivElement>){drag.current.active=false;if(event.currentTarget.hasPointerCapture(event.pointerId))event.currentTarget.releasePointerCapture(event.pointerId);update();}
  return <nav className="home-category-bar" aria-label="تصنيفات الأخبار"><div className="container category-ribbon-shell">
    <button type="button" className="category-ribbon-arrow category-ribbon-start" aria-label="التصنيفات السابقة" onClick={()=>move("start")} hidden={!canStart}>›</button>
    <div ref={scroller} className="category-ribbon-scroll" role="list" tabIndex={-1} onScroll={(event)=>{rememberPosition(event.currentTarget);update();}} onKeyDown={keys} onPointerDown={pointerDown} onPointerMove={pointerMove} onPointerUp={pointerUp} onPointerCancel={pointerUp} onPointerLeave={()=>{if(!drag.current.moved)drag.current.active=false;}} onClickCapture={(event)=>{rememberPosition(event.currentTarget);if(drag.current.moved){event.preventDefault();drag.current.moved=false;}}} onWheel={(event)=>{if(Math.abs(event.deltaY)>Math.abs(event.deltaX)){event.preventDefault();event.currentTarget.scrollBy({left:-event.deltaY,behavior:"smooth"});}}}>
      <Link data-category-tab role="listitem" className={!activeCategory?"active":""} aria-current={!activeCategory?"page":undefined} href="/">أحدث الأخبار</Link>
      {showBreaking?<Link data-category-tab role="listitem" className={activeCategory==="الأخبار العاجلة"?"active breaking-tab":"breaking-tab"} aria-current={activeCategory==="الأخبار العاجلة"?"page":undefined} href={`/category/${encodeURIComponent("الأخبار العاجلة")}`}><span aria-hidden="true"/>الأخبار العاجلة</Link>:null}
      {categories.map((category)=><Link data-category-tab role="listitem" className={activeCategory===category?"active":""} aria-current={activeCategory===category?"page":undefined} href={`/category/${encodeURIComponent(category)}`} key={category}><span aria-hidden="true"/>{category}</Link>)}
    </div>
    <button type="button" className="category-ribbon-arrow category-ribbon-end" aria-label="التصنيفات التالية" onClick={()=>move("end")} hidden={!canEnd}>‹</button>
  </div></nav>;
}
