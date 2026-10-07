import test from "node:test";
import assert from "node:assert/strict";
import { classifySourcePage } from "../lib/source-status.ts";

const base={originalUrl:"https://news.example/article/1",finalUrl:"https://news.example/article/1"};
test("404 and 410 confirm removal",()=>{for(const httpStatus of [404,410])assert.equal(classifySourcePage({...base,httpStatus}).status,"Removed");});
test("temporary failures never confirm removal",()=>{for(const httpStatus of [429,500,502,503])assert.equal(classifySourcePage({...base,httpStatus}).status,"Temporarily Unreachable");assert.equal(classifySourcePage({...base,httpStatus:null,networkError:"timeout"}).status,"Temporarily Unreachable");});
test("RSS-style absence is not used and an available page stays active",()=>assert.equal(classifySourcePage({...base,httpStatus:200,html:"<title>خبر منشور</title>"}).status,"Active"));
test("explicit removal page confirms removal",()=>assert.equal(classifySourcePage({...base,httpStatus:200,html:"<title>تم حذف الخبر</title>"}).status,"Removed"));
test("changed validators update the existing article",()=>{const result=classifySourcePage({...base,httpStatus:200,etag:'"v2"',previousEtag:'"v1"'});assert.equal(result.status,"Updated");assert.equal(result.contentChanged,true);});
test("a followed redirect is tracked without treating it as removal",()=>assert.equal(classifySourcePage({...base,httpStatus:200,finalUrl:"https://news.example/new/1"}).status,"Redirected"));
