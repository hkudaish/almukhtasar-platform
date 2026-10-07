const formatterCache=new Map<string,Intl.DateTimeFormat>();
export const ROLLING_NEWS_DAYS=7;

function formatter(timeZone:string){
  let value=formatterCache.get(timeZone);
  if(!value){
    value=new Intl.DateTimeFormat("en-CA",{timeZone,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"});
    formatterCache.set(timeZone,value);
  }
  return value;
}

function zonedParts(value:Date,timeZone:string){
  const parts=Object.fromEntries(formatter(timeZone).formatToParts(value).filter((part)=>part.type!=="literal").map((part)=>[part.type,Number(part.value)]));
  return {year:parts.year,month:parts.month,day:parts.day,hour:parts.hour,minute:parts.minute,second:parts.second};
}

function zonedMidnight(year:number,month:number,day:number,timeZone:string){
  const target=Date.UTC(year,month-1,day),targetDate=new Date(target);
  let instant=target;
  for(let attempt=0;attempt<4;attempt++){
    const observed=zonedParts(new Date(instant),timeZone),observedAsUtc=Date.UTC(observed.year,observed.month-1,observed.day,observed.hour,observed.minute,observed.second);
    const correction=target-observedAsUtc;
    instant+=correction;
    if(correction===0)break;
  }
  if(!Number.isFinite(instant))return targetDate.toISOString();
  return new Date(instant).toISOString();
}

export function activeNewsWindow(timeZone="Asia/Riyadh",now=new Date()){
  let current;
  try{current=zonedParts(now,timeZone);}catch{timeZone="Asia/Riyadh";current=zonedParts(now,timeZone);}
  return {
    start:zonedMidnight(current.year,current.month,current.day-(ROLLING_NEWS_DAYS-1),timeZone),
    end:now.toISOString(),
    nextArchiveAt:zonedMidnight(current.year,current.month,current.day+1,timeZone),
    timeZone
  };
}

export function rollingNewsDays(timeZone="Asia/Riyadh",now=new Date()){
  let current;
  try{current=zonedParts(now,timeZone);}catch{timeZone="Asia/Riyadh";current=zonedParts(now,timeZone);}
  return Array.from({length:ROLLING_NEWS_DAYS},(_,offset)=>{
    const start=zonedMidnight(current.year,current.month,current.day-offset,timeZone);
    const previousDay=new Date(Date.UTC(current.year,current.month-1,current.day-offset+1));
    const end=zonedMidnight(previousDay.getUTCFullYear(),previousDay.getUTCMonth()+1,previousDay.getUTCDate(),timeZone);
    const local=zonedParts(new Date(start),timeZone),date=`${local.year}-${String(local.month).padStart(2,"0")}-${String(local.day).padStart(2,"0")}`;
    return {offset,date,start,end:offset===0?now.toISOString():end};
  });
}

export function isInActiveNewsWindow(value:string,timeZone="Asia/Riyadh",now=new Date()){
  const timestamp=Date.parse(value),window=activeNewsWindow(timeZone,now);
  return Number.isFinite(timestamp)&&timestamp>=Date.parse(window.start)&&timestamp<=Date.parse(window.end);
}
