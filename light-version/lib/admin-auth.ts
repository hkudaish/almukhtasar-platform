import { NextResponse } from "next/server";

export function requireAdmin(request:Request){
  const secret=process.env.ADMIN_API_SECRET;
  if(!secret)return {ok:false,response:NextResponse.json({error:"admin_api_not_configured"},{status:503})};
  if(request.headers.get("x-admin-key")!==secret)return {ok:false,response:NextResponse.json({error:"unauthorized"},{status:401})};
  return {ok:true as const};
}
