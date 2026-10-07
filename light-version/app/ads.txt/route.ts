export const dynamic="force-dynamic";

export function GET(){
  const publisher=process.env.NEXT_PUBLIC_ADSENSE_PUBLISHER_ID||"";
  const account=publisher.replace(/^ca-/,"");
  if(!/^pub-\d+$/.test(account))return new Response("",{status:404});
  return new Response(`google.com, ${account}, DIRECT, f08c47fec0942fa0\n`,{headers:{"Content-Type":"text/plain; charset=utf-8","Cache-Control":"public, max-age=3600"}});
}
