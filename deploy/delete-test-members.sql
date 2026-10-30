-- ═══════════════════════════════════════════════════════════════════
--  刪除測試會員（投票進行中，後台 DELETE 被鎖，只能走 SQL）
-- ═══════════════════════════════════════════════════════════════════
--
--  為什麼不能用後台刪：
--    members.py 的 _ensure_editable() 在有任何一輪 status=active 時
--    會讓 DELETE /admin/members/{id} 回 409。
--
--  這份腳本會處理三件事：
--    1. 若這些測試會員投過票，先刪票（vote_candidates → votes）
--       否則會留下「票還在、但投票人已不存在」的孤兒資料
--    2. 刪除會員本身
--    3. 寫入 activity_logs 稽核記錄
--
--  ⚠️ 刪完之後如果他們真的投過票，記得清 Redis 計票快取（見最後說明），
--     否則計票頁會顯示刪除前的票數。
-- ═══════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ① 先查出測試會員（只查詢，不改資料）                            │
-- └─────────────────────────────────────────────────────────────────┘
-- 用姓名或卡號特徵找出可疑的測試資料；也可以直接改成 IN ('張三','李四')
SELECT m.id,
       m.member_no,
       m.name_trad,
       d.name AS 分會,
       m.paid_2026_dues AS 已繳費,
       m.created_at     AS 建立時間,
       (SELECT count(*) FROM votes v WHERE v.member_no = m.member_no) AS 已投票數
FROM members m
LEFT JOIN divisions d ON d.id = m.division_id
WHERE m.name_trad IN ('張三', '李四', '王五', '測試', '测试')
   OR m.member_no ~* '^(test|zz|tmp)'
ORDER BY m.id;

-- 順便確認候選人裡有沒有測試資料（若有，另外用候選人管理頁刪除）
SELECT id, name, division_id, is_active
FROM candidates
WHERE name IN ('張三', '李四', '王五', '測試', '测试')
   OR member_no ~* '^(test|zz|tmp)';

-- 把結果裡的 member_no 記下來，填到下面 ② 的清單


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ② 刪除（票 → 會員 → 稽核，同一個交易）                          │
-- └─────────────────────────────────────────────────────────────────┘
-- ↓↓↓ 把下面的卡號換成 ① 查到的實際值 ↓↓↓
BEGIN;

CREATE TEMP TABLE _del ON COMMIT DROP AS
SELECT id, member_no, name_trad
FROM members
WHERE member_no IN (
    'TEST-0001',        -- ← 換成實際卡號
    'TEST-0002',
    'TEST-0003'
);

-- 先看會刪到什麼（這行會印出受影響的會員數與票數）
SELECT (SELECT count(*) FROM _del)                                    AS 將刪會員數,
       (SELECT count(*) FROM votes v
         WHERE v.member_no IN (SELECT member_no FROM _del))           AS 將刪票數;

-- 有票的話，先刪票的候選人明細，再刪票
DELETE FROM vote_candidates
WHERE vote_id IN (
    SELECT v.id FROM votes v
    WHERE v.member_no IN (SELECT member_no FROM _del)
);

DELETE FROM votes
WHERE member_no IN (SELECT member_no FROM _del);

DELETE FROM members
WHERE id IN (SELECT id FROM _del);

-- 稽核（名單為空時不會寫入）
INSERT INTO activity_logs (action, detail, operator, round_id)
SELECT '刪除測試會員',
       'member_no=' || string_agg(member_no || ' ' || name_trad, ', ' ORDER BY member_no),
       'admin',
       (SELECT id FROM rounds WHERE status = 'active' ORDER BY id DESC LIMIT 1)
FROM _del
HAVING count(*) > 0;

COMMIT;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ③ 確認已刪除                                                    │
-- └─────────────────────────────────────────────────────────────────┘
SELECT count(*) AS 剩餘符合的會員數
FROM members
WHERE name_trad IN ('張三', '李四', '王五', '測試', '测试')
   OR member_no ~* '^(test|zz|tmp)';

-- 確認沒有孤兒票（回 0 列才乾淨）
SELECT v.id, v.member_no, v.member_name, v.created_at
FROM votes v
LEFT JOIN members m ON m.member_no = v.member_no
WHERE m.id IS NULL;


-- ═══════════════════════════════════════════════════════════════════
--  ④ 清 Redis 計票快取（★ 只有「測試會員真的投過票」才需要）
-- ═══════════════════════════════════════════════════════════════════
--
--  為什麼要清：
--    計票頁優先讀 Redis 的 vote:count:* / vote:division_cast:*。
--    只有在該分會的 Redis 票數合計為 0 時，才會從 PostgreSQL 重建。
--    所以刪了 PG 的票、Redis 還留著舊數字 → 計票頁會顯示刪除前的票數。
--
--  在 fgs-redis 容器用 Execute 執行（密碼在 YAML 的 --requirepass 後面）：
--
--    redis-cli -a '你的REDIS密碼' --scan --pattern 'vote:count:27:*' \
--      | xargs -r redis-cli -a '你的REDIS密碼' DEL
--
--    redis-cli -a '你的REDIS密碼' --scan --pattern 'vote:division_cast:27:*' \
--      | xargs -r redis-cli -a '你的REDIS密碼' DEL
--
--  或最乾脆（Redis 只是快取，PG 才是唯一來源，清空不會遺失任何票）：
--
--    redis-cli -a '你的REDIS密碼' FLUSHALL
--
--  清完之後第一次打開計票頁，系統會自動從 PostgreSQL 重建正確票數。
-- ═══════════════════════════════════════════════════════════════════
