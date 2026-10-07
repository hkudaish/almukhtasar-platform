"use client";

import { useRef } from "react";

export default function HeaderSearch({compact=false}:{compact?:boolean}){
  const inputRef=useRef<HTMLInputElement>(null);
  function submit(event:React.FormEvent<HTMLFormElement>){
    if(inputRef.current?.value.trim())return;
    event.preventDefault();inputRef.current?.focus();
  }
  return <form className="header-search" action="/search" onSubmit={submit}><input ref={inputRef} name="q" aria-label="بحث" placeholder="بحث…"/><button type="submit" aria-label="تنفيذ البحث">{compact?<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m21 21-4.35-4.35m2.35-5.65a8 8 0 1 1-16 0 8 8 0 0 1 16 0Z"/></svg>:"بحث"}</button></form>;
}
