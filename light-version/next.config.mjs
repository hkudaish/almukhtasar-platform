/** @type {import("next").NextConfig} */
const nextConfig={
  reactStrictMode:true,
  ...(process.env.BUILD_STANDALONE ? { output: "standalone" } : {}),
  images:{
    formats:["image/avif","image/webp"],
    qualities:[55,75],
    deviceSizes:[360,640,750,828,1080,1200],
    imageSizes:[64,88,96,104,120,180,240,320],
    localPatterns:[
      {pathname:"/api/media/**"},
      {pathname:"/images/**"}
    ],
    remotePatterns:[
      {protocol:"https",hostname:"**"}
    ]
  },
  async redirects(){
    return [{source:"/light",destination:"/",permanent:true},{source:"/light/:path*",destination:"/:path*",permanent:true}];
  },
  async headers(){
    return [{source:"/:path*",headers:[
      {key:"X-Frame-Options",value:"SAMEORIGIN"},
      {key:"Content-Security-Policy",value:"frame-ancestors 'self'"},
      {key:"X-Content-Type-Options",value:"nosniff"}
    ]}];
  },
  outputFileTracingIncludes:{
    "/**":["./database/light-news.db"]
  },
  outputFileTracingExcludes:{"*":["../legacy-original/**"]}
};
export default nextConfig;
