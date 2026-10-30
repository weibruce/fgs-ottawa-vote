-- ═══════════════════════════════════════════════════════════════════
--  設定「大屏公布頁」要排除的測試會員
--  對應頁面：/screen/official
-- ═══════════════════════════════════════════════════════════════════
--
--  大屏公布頁的計票口徑：
--    分母 = 該分會「帳號啟用 + 已繳 2026 會費」的會員
--    分子 = 該分會的票數
--    兩者都會排除下面名單裡的會員（測試資料）
--
--  排除後：
--    · 這些人不列入「應投票人數」
--    · 他們投出的票也不計入任何候選人的得票
--    · 其他頁面（後台即時計票、投票端結果頁）**不受影響**
--
--  注意：測試會員如果直接刪除，就不需要放進這份名單。
--        名單是給「想保留資料但不想計入公布數字」的情況用的。
-- ═══════════════════════════════════════════════════════════════════


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ① 先確認這些人是誰（只查詢）                                    │
-- └─────────────────────────────────────────────────────────────────┘
SELECT m.id, m.member_no, m.name_trad, d.name AS 分會, m.paid_2026_dues AS 已繳費,
       (SELECT count(*) FROM votes v WHERE v.member_no = m.member_no) AS 已投票數
FROM members m
LEFT JOIN divisions d ON d.id = m.division_id
WHERE m.name_trad IN ('張三', '李四', '知印法師')
ORDER BY m.id;

-- 確認姓名與分會正確。若「已投票數」是 0，其實不影響公布數字，
-- 但放進名單也無害（只會少算一個「應投票人數」）。


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ② 寫入排除名單（以姓名自動帶出卡號）                            │
-- └─────────────────────────────────────────────────────────────────┘
-- ⚠️ 這會「覆蓋」整份名單。如果之前已經設過其他卡號，請先跑 ③ 查看、
--    再手動合併。
INSERT INTO app_settings (key, value)
SELECT 'official_excluded_member_nos',
       COALESCE(string_agg(member_no, ',' ORDER BY member_no), '')
FROM members
WHERE name_trad IN ('張三', '李四', '知印法師')
ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value
RETURNING key, value;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ③ 查看目前設定                                                  │
-- └─────────────────────────────────────────────────────────────────┘
SELECT value AS 目前排除的卡號
FROM app_settings
WHERE key = 'official_excluded_member_nos';

-- 逐筆確認名單裡的人是誰
SELECT m.member_no, m.name_trad, d.name AS 分會
FROM members m
LEFT JOIN divisions d ON d.id = m.division_id
WHERE m.member_no IN (
    SELECT unnest(string_to_array(value, ','))
    FROM app_settings WHERE key = 'official_excluded_member_nos'
)
ORDER BY m.member_no;


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ④ 清空名單（恢復成「不排除任何人」）                            │
-- └─────────────────────────────────────────────────────────────────┘
-- UPDATE app_settings SET value = '' WHERE key = 'official_excluded_member_nos';


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ ⑤ 手動指定卡號（不靠姓名比對時用這個）                          │
-- └─────────────────────────────────────────────────────────────────┘
-- INSERT INTO app_settings (key, value)
-- VALUES ('official_excluded_member_nos', 'B20200300000852,B20200300014349')
-- ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value;


-- ═══════════════════════════════════════════════════════════════════
--  驗證：改完後打開大屏頁，數字應該立刻變
--    https://ibpsottawavote.org/screen/official
--  （頁面每 5 秒自動更新，不需要重新整理）
--
--  也可以用 API 確認：
--    curl -s "https://ibpsottawavote.org/api/votes/results/official?round_id=27"
--    → 回傳裡的 excluded_count 就是名單人數
-- ═══════════════════════════════════════════════════════════════════
