import assert from "node:assert/strict";
import test from "node:test";
import { activeNewsWindow, isInActiveNewsWindow, rollingNewsDays } from "../lib/news-window.ts";

test("Riyadh active news window contains seven complete local calendar days",()=>{
  const now=new Date("2026-08-12T18:00:00.000Z"),window=activeNewsWindow("Asia/Riyadh",now);
  assert.equal(window.start,"2026-08-05T21:00:00.000Z");
  assert.equal(window.end,now.toISOString());
  assert.equal(window.nextArchiveAt,"2026-08-12T21:00:00.000Z");
  assert.equal(isInActiveNewsWindow("2026-08-05T21:00:00.000Z","Asia/Riyadh",now),true);
  assert.equal(isInActiveNewsWindow("2026-08-05T20:59:59.999Z","Asia/Riyadh",now),false);
  assert.deepEqual(rollingNewsDays("Asia/Riyadh",now).map((day)=>day.date),["2026-08-12","2026-08-11","2026-08-10","2026-08-09","2026-08-08","2026-08-07","2026-08-06"]);
});

test("window conversion respects daylight-saving timezone boundaries",()=>{
  const window=activeNewsWindow("America/New_York",new Date("2024-03-10T16:00:00.000Z"));
  assert.equal(window.start,"2024-03-04T05:00:00.000Z");
  assert.equal(window.nextArchiveAt,"2024-03-11T04:00:00.000Z");
});
