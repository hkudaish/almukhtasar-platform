import assert from "node:assert/strict";
import test from "node:test";
import { featuredImageCandidates, isClearlyNonEditorialImage } from "../lib/featured-images.ts";

test("featured image candidates preserve the required source priority",()=>{
  const html=`
    <meta property="og:image" content="/media/og-story.jpg">
    <meta property="og:image:alt" content="صورة الخبر من Open Graph">
    <meta name="twitter:image" content="/media/twitter-story.jpg">
    <figure class="featured-image"><img src="/media/featured.jpg" alt="الصورة الرئيسية"><figcaption>تعليق الصورة الرئيسية</figcaption></figure>`;
  const articleScope=`<p>نص الخبر</p><img src="/media/content.jpg" width="1200" height="800" alt="صورة داخل الخبر">`;
  const candidates=featuredImageCandidates({html,articleScope,structured:{image:{url:"/media/structured.jpg",caption:"تعليق من البيانات المنظمة",creditText:"وكالة الأنباء"}},baseUrl:"https://news.example/article/1",title:"عنوان الخبر",explicitUrls:[]});
  assert.deepEqual(candidates.map((item)=>item.origin),["og","twitter","structured","featured","content"]);
  assert.equal(candidates[2].credit,"وكالة الأنباء");
  assert.equal(candidates[3].caption,"تعليق الصورة الرئيسية");
});

test("candidate discovery excludes page graphics and keeps article-scoped high-resolution images",()=>{
  const html=`<img src="/assets/unrelated-page.jpg"><meta property="og:image" content="/assets/site-logo.png">`;
  const articleScope=`
    <img src="/assets/tracking-pixel.gif" width="1" height="1">
    <img src="/assets/author-avatar.jpg" width="600" height="600">
    <img src="/media/story-small.jpg" srcset="/media/story-small.jpg 480w, /media/story-large.jpg 1600w" width="1200" height="800" alt="صورة الحدث">`;
  const candidates=featuredImageCandidates({html,articleScope,baseUrl:"https://news.example/article/1",title:"عنوان الخبر"});
  assert.deepEqual(candidates.map((item)=>item.url),["https://news.example/media/story-large.jpg"]);
  assert.equal(isClearlyNonEditorialImage("https://news.example/images/favicon-512.png"),true);
});

test("author portraits are accepted only when article metadata designates them as featured",()=>{
  const html=`<meta property="og:image" content="https://news.example/uploads/authors/1112.jpg">`;
  const articleScope=`<img src="https://news.example/uploads/authors/2222.jpg" width="800" height="488">`;
  const candidates=featuredImageCandidates({html,articleScope,baseUrl:"https://news.example/articles/authors/1",title:"عمود رأي"});
  assert.deepEqual(candidates.map((item)=>item.url),["https://news.example/uploads/authors/1112.jpg"]);
  assert.equal(isClearlyNonEditorialImage("https://news.example/uploads/authors/1112.jpg"),true);
  assert.equal(isClearlyNonEditorialImage("https://news.example/uploads/authors/1112.jpg",true),false);
});
