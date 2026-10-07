const targetType=(process.argv[2]||"all") as "all"|"source"|"category"|"failing"|"recovery";
const thirdArgument=process.argv[3]||"",targetId=/^https?:\/\//i.test(thirdArgument)?"":thirdArgument;
const baseUrl=(process.argv[4]||(/^https?:\/\//i.test(thirdArgument)?thirdArgument:"")||process.env.RETRIEVAL_API_URL||process.env.NEXT_PUBLIC_APP_URL||"http://localhost:3000").replace(/\/$/,"");

fetch(`${baseUrl}/api/retrieval/run`,{
  method:"POST",
  headers:{"Content-Type":"application/json"},
  body:JSON.stringify({targetType,targetId})
}).then(async(response)=>{
  const result=await response.json() as {errors?:string[];error?:string};
  process.stdout.write(`${JSON.stringify(result)}\n`);
  if(!response.ok||result.error||(result.errors?.length||0)>0)process.exitCode=1;
}).catch((error)=>{process.stderr.write(`${error instanceof Error?error.stack:error}\n`);process.exitCode=1;});
