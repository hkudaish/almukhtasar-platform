import { DatabaseSync } from "node:sqlite";

const database=new DatabaseSync("data/almukhtasar-admin.db");
database.exec("PRAGMA busy_timeout=10000");

const phrase=/وبحسب المادة المنشورة[،,:؛]?\s*/gu;
function clean(value){return String(value||"").replace(phrase,"").replace(/\s+/g," ").trim()}

const rows=database.prepare("SELECT id,title,data FROM admin_records WHERE resource='content' AND deleted=0").all();
const update=database.prepare("UPDATE admin_records SET title=?,data=?,updated_at=? WHERE id=? AND resource='content' AND deleted=0");
let cleaned=0,imagesAssigned=0;
const now=new Date().toISOString();

database.exec("BEGIN IMMEDIATE");
try{
  for(const row of rows){
    const data=JSON.parse(row.data),title=clean(row.title),summary=clean(data.summary);
    const details=Array.isArray(data.details)?data.details.map(clean).filter(Boolean):clean(data.details);
    let next={...data,summary,details};
    const changedText=title!==row.title||summary!==String(data.summary||"")||JSON.stringify(details)!==JSON.stringify(data.details);
    if(data.type==="خبر مستورد"&&!String(data.imageUrl||"").trim()){
      const category=String(data.category||"عام");
      next={...next,imageUrl:`/api/media/category-fallback/${encodeURIComponent(category)}`,originalImageUrl:null,imageIsFallback:true,imageAlt:`صورة افتراضية لتصنيف ${category}`,imageCredit:`المختصر — صورة افتراضية معتمدة لتصنيف ${category}`,imageSourceUrl:null,imageExtractionMethod:"Approved category fallback",imageContentType:"image/svg+xml",imageVerifiedAt:now,imageAuditVersion:3,mediaRights:"صورة تصنيف افتراضية معتمدة"};
      imagesAssigned++;
    }
    if(changedText||next.imageUrl!==data.imageUrl){update.run(title,JSON.stringify(next),now,row.id);cleaned+=changedText?1:0;}
  }
  database.exec("COMMIT");
}catch(error){database.exec("ROLLBACK");throw error}

const imported=database.prepare("SELECT data FROM admin_records WHERE resource='content' AND deleted=0").all().map((row)=>JSON.parse(row.data)).filter((data)=>data.type==="خبر مستورد");
const missingImages=imported.filter((data)=>!String(data.imageUrl||"").trim()).length;
database.close();
console.log(JSON.stringify({checked:rows.length,cleaned,imagesAssigned,retrievedPosts:imported.length,missingImages},null,2));
