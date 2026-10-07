"use client";

import { useEffect } from "react";

export default function ServiceWorkerCleanup(){
  useEffect(()=>{
    async function cleanup(){
      if("serviceWorker" in navigator){
        const registrations=await navigator.serviceWorker.getRegistrations();
        await Promise.all(registrations.map((registration)=>registration.unregister()));
      }
      if("caches" in window){
        const keys=await caches.keys();
        await Promise.all(keys.map((key)=>caches.delete(key)));
      }
    }
    cleanup().catch(()=>undefined);
  },[]);
  return null;
}
