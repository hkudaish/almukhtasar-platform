import { copyFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { DatabaseSync } from "node:sqlite";

const databasePath=path.resolve(import.meta.dirname,"../database/light-news.db");
const sourceDatabasePath=process.env.SOURCE_DATABASE_PATH||databasePath;
const backupDirectory=path.resolve(import.meta.dirname,"../database/backups");
const now=new Date().toISOString();
const backupPath=path.join(backupDirectory,`before-arabic-content-cleanup-${now.replace(/[:.]/g,"-")}.db`);
const arabicCharacters=(value)=>((value.match(/[\u0600-\u06FF]/g)||[]).length);
const latinCharacters=(value)=>((value.match(/[A-Za-z]/g)||[]).length);

function plainText(value){
  let text=value;
  for(let index=0;index<2;index++)text=text.replace(/&nbsp;/gi," ").replace(/&amp;/gi,"&").replace(/&quot;/gi,'"').replace(/&#39;/gi,"'").replace(/&lt;/gi,"<").replace(/&gt;/gi,">");
  return text.replace(/<[^>]*>/g," ").replace(/\s+/g," ").trim();
}
function isArabicText(value){
  const arabic=arabicCharacters(value),latin=latinCharacters(value);
  return arabic>=12&&arabic>=latin*.7;
}
function clip(value,limit){
  if(value.length<=limit)return value;
  const part=value.slice(0,limit-1),boundary=Math.max(part.lastIndexOf(". "),part.lastIndexOf("؟"),part.lastIndexOf(".\n"),part.lastIndexOf("،"),part.lastIndexOf(" "));
  return `${part.slice(0,boundary>limit*.55?boundary:limit-1).trim()}…`;
}
function arabicSentences(value){
  return plainText(value).split(/(?<=[.!؟…])\s+/u).map((sentence)=>sentence.trim()).filter(isArabicText);
}
function conciseParagraphs(value){
  const raw=Array.isArray(value)?value:[];
  const paragraphs=[];
  for(const item of raw){
    const arabic=arabicSentences(String(item));
    if(!arabic.length)continue;
    const paragraph=clip(arabic.join(" "),420);
    if(paragraph.length<45||paragraphs.some((saved)=>saved===paragraph))continue;
    paragraphs.push(paragraph);
    if(paragraphs.length===4)break;
  }
  return paragraphs;
}

await mkdir(backupDirectory,{recursive:true});
await copyFile(databasePath,backupPath);
const db=new DatabaseSync(databasePath);
const sourceDb=sourceDatabasePath===databasePath?db:new DatabaseSync(sourceDatabasePath,{readOnly:true});
const rows=sourceDb.prepare("SELECT id,title,summary,content FROM articles WHERE publication_status='published'").all();
const update=db.prepare("UPDATE articles SET summary=?,content=?,updated_at=? WHERE id=?");
let changed=0,removedEnglish=0,shortened=0,summaryRebuilt=0;
db.exec("BEGIN IMMEDIATE");
try{
  for(const row of rows){
    let original=[];
    try{original=JSON.parse(String(row.content||"[]"));}catch{}
    const originalText=original.map(String).join(" ");
    const content=conciseParagraphs(original);
    const originalSummary=plainText(String(row.summary||""));
    let summary=clip(arabicSentences(originalSummary).join(" "),360);
    if(summary.length<70){summary=clip(content.join(" "),360);summaryRebuilt++;}
    if(latinCharacters(originalText)>latinCharacters(content.join(" "))||latinCharacters(originalSummary)>latinCharacters(summary))removedEnglish++;
    if(content.join(" ").length<originalText.length)shortened++;
    if(summary!==String(row.summary||"")||JSON.stringify(content)!==JSON.stringify(original)){update.run(summary,JSON.stringify(content),now,String(row.id));changed++;}
  }
  db.exec("COMMIT");
}catch(error){db.exec("ROLLBACK");throw error;}
console.log(JSON.stringify({published:rows.length,changed,removedEnglish,shortened,summaryRebuilt,backupPath,sourceDatabasePath},null,2));
