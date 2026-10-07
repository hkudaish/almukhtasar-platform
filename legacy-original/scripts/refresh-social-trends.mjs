const origin=(process.env.APP_ORIGIN||process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000").replace(/\/$/,"");
const platform=process.argv[2]||"";
const response=await fetch(`${origin}/api/admin/social-trends/refresh`,{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify(platform?{platform}:{})
});
if(!response.ok)throw new Error(`Social refresh failed: HTTP ${response.status}`);
const result=await response.json();
for(const item of result.results||[])console.log(`${item.platform}: ${item.status} (${item.itemCount}) - ${item.message}`);
if((result.results||[]).some((item)=>item.status==="failed"))process.exitCode=1;
