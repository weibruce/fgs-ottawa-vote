/**
 * Mock 數據 —— 與參考稿 voting-admin-system.preview.emergentagent.com 完全一致
 * 用途：UI 先行（不接後台 API），數字/文案與參考站逐項對齊。
 * 後續接 API 時，此檔案整個替換為真實數據層。
 */

/** 五區標識色（與參考站一致） */
export const DIVISION_COLORS: Record<string, string> = {
  東: '#8B1A1A',
  南: '#B8935A',
  西: '#6B4423',
  北: '#8A6D3B',
  中: '#A8896C',
}

export interface MockDivision {
  id: number
  code: string
  name: string
  color: string
  members: number
  candidates: number
  voted: number
  status: string
  address: string
}

export const mockDivisions: MockDivision[] = [
  { id: 1, code: 'east', name: '東區', color: '#8B1A1A', members: 68, candidates: 6, voted: 52, status: '進行中', address: '佛光山總會 東區' },
  { id: 2, code: 'south', name: '南區', color: '#B8935A', members: 54, candidates: 5, voted: 41, status: '進行中', address: '佛光山總會 南區' },
  { id: 3, code: 'west', name: '西區', color: '#6B4423', members: 72, candidates: 7, voted: 48, status: '進行中', address: '佛光山總會 西區' },
  { id: 4, code: 'north', name: '北區', color: '#8A6D3B', members: 58, candidates: 5, voted: 33, status: '進行中', address: '佛光山總會 北區' },
  { id: 5, code: 'center', name: '中區', color: '#A8896C', members: 48, candidates: 6, voted: 29, status: '進行中', address: '佛光山總會 中區' },
]

/** 儀表板 */
export const mockDashboard = {
  roundLabel: 'CURRENT ROUND · 進行中',
  roundTitle: '第一輪 · 五分區同步選舉',
  windowText: '投票視窗：2026-09-04 10:00 – 2026-09-04 12:00',
  progressLabel: '總進度',
  progressPct: 68,
  progressText: '203 / 300 人',
  stats: [
    { label: '總會員人數', value: 300, sub: '五區合計', tone: 'primary' },
    { label: '已投票', value: 203, sub: '投票率 68%', tone: 'gold' },
    { label: '候選人總數', value: 29, sub: '各區合計', tone: 'brown' },
    { label: '代理投票', value: 12, sub: '佔已投票 5.9%', tone: 'gold' },
  ] as { label: string; value: number; sub: string; tone: string }[],
  logs: [
    { text: '第一輪投票結束', time: '10:45' },
    { text: '管理員 admin 修改數據刷新時間為1秒', time: '10:43' },
    { text: '管理員 admin 修改投票視窗', time: '10:40' },
    { text: '第一輪投票開始', time: '10:35' },
    { text: '匯入會員名單 300 筆', time: '10:30' },
  ],
}

/** 候選人（15 人，與參考站一致） */
export interface MockCandidate {
  rank: number
  name: string
  surname: string
  bio: string
  division: string
  position: string
  slogan: string
  terms: string
  votes: number
}

export const mockCandidates: MockCandidate[] = [
  { rank: 1, name: '林明德', surname: '林', bio: '服務佛光會十年，致力弘揚人間佛教。', division: '東區', position: '會長候選人', slogan: '慈悲喜捨，服務大眾', terms: '1 屆', votes: 52 },
  { rank: 2, name: '陳慧儀', surname: '陳', bio: '深耕東區社區服務，熱心公益。', division: '東區', position: '會長候選人', slogan: '同心同願，共創新局', terms: '0 屆', votes: 44 },
  { rank: 3, name: '王志遠', surname: '王', bio: '推動青年活動，資深幹部。', division: '東區', position: '會長候選人', slogan: '傳承文化，接引青年', terms: '1 屆', votes: 31 },
  { rank: 4, name: '李淑芬', surname: '李', bio: '負責財務多年，穩健經營。', division: '東區', position: '會長候選人', slogan: '穩健踏實，永續發展', terms: '0 屆', votes: 22 },
  { rank: 5, name: '張文昌', surname: '張', bio: '長期參與法會活動。', division: '東區', position: '會長候選人', slogan: '菩提道上，攜手同行', terms: '0 屆', votes: 15 },
  { rank: 6, name: '黃美玲', surname: '黃', bio: '積極推動讀書會。', division: '東區', position: '會長候選人', slogan: '智慧開啟，福慧雙修', terms: '0 屆', votes: 8 },
  { rank: 1, name: '蔡婉君', surname: '蔡', bio: '南區資深會員。', division: '南區', position: '會長候選人', slogan: '和敬共處，法喜充滿', terms: '1 屆', votes: 41 },
  { rank: 2, name: '吳文雄', surname: '吳', bio: '推動社區活動。', division: '南區', position: '會長候選人', slogan: '服務奉獻，廣結善緣', terms: '0 屆', votes: 38 },
  { rank: 3, name: '趙淑芬', surname: '趙', bio: '熱心會務。', division: '南區', position: '會長候選人', slogan: '同體大悲，無緣大慈', terms: '0 屆', votes: 27 },
  { rank: 1, name: '郭信宏', surname: '郭', bio: '西區青年代表。', division: '西區', position: '會長候選人', slogan: '青年當自強', terms: '0 屆', votes: 48 },
  { rank: 2, name: '李美華', surname: '李', bio: '婦女會幹部。', division: '西區', position: '會長候選人', slogan: '婦女同心，關懷家庭', terms: '1 屆', votes: 35 },
  { rank: 3, name: '徐德安', surname: '徐', bio: '資深會員。', division: '西區', position: '會長候選人', slogan: '穩健踏實', terms: '0 屆', votes: 29 },
  { rank: 1, name: '周雅琳', surname: '周', bio: '北區代表。', division: '北區', position: '會長候選人', slogan: '慈悲為懷', terms: '0 屆', votes: 33 },
  { rank: 2, name: '許志明', surname: '許', bio: '文教組長。', division: '北區', position: '會長候選人', slogan: '推廣文教', terms: '1 屆', votes: 28 },
  { rank: 1, name: '楊惠芳', surname: '楊', bio: '中區負責人。', division: '中區', position: '會長候選人', slogan: '中道圓融', terms: '0 屆', votes: 29 },
]

/** 會員名單（10 筆，與參考站一致） */
export interface MockMember {
  card: string
  nameTrad: string
  nameSimp: string
  division: string
  phone: string
  voted: boolean
  votedAt: string
}

export const mockMembers: MockMember[] = [
  { card: 'BGS-2024-0001', nameTrad: '林明德', nameSimp: '林明德', division: '東區', phone: '0912-345-678', voted: true, votedAt: '2026-09-04 10:23' },
  { card: 'BGS-2024-0002', nameTrad: '陳慧儀', nameSimp: '陈慧仪', division: '東區', phone: '0912-345-679', voted: true, votedAt: '2026-09-04 10:25' },
  { card: 'BGS-2024-0003', nameTrad: '王志遠', nameSimp: '王志远', division: '東區', phone: '0912-345-680', voted: false, votedAt: '—' },
  { card: 'BGS-2024-0104', nameTrad: '蔡婉君', nameSimp: '蔡婉君', division: '南區', phone: '0922-111-222', voted: true, votedAt: '2026-09-04 10:30' },
  { card: 'BGS-2024-0105', nameTrad: '吳文雄', nameSimp: '吴文雄', division: '南區', phone: '0922-111-223', voted: true, votedAt: '2026-09-04 10:32' },
  { card: 'BGS-2024-0206', nameTrad: '郭信宏', nameSimp: '郭信宏', division: '西區', phone: '0933-000-111', voted: true, votedAt: '2026-09-04 10:35' },
  { card: 'BGS-2024-0207', nameTrad: '李美華', nameSimp: '李美华', division: '西區', phone: '0933-000-112', voted: true, votedAt: '2026-09-04 10:37' },
  { card: 'BGS-2024-0308', nameTrad: '周雅琳', nameSimp: '周雅琳', division: '北區', phone: '0944-333-444', voted: false, votedAt: '—' },
  { card: 'BGS-2024-0409', nameTrad: '楊惠芳', nameSimp: '杨惠芳', division: '中區', phone: '0955-666-777', voted: true, votedAt: '2026-09-04 10:40' },
  { card: 'BGS-2024-0110', nameTrad: '趙淑芬', nameSimp: '赵淑芬', division: '南區', phone: '0922-111-224', voted: false, votedAt: '—' },
]

/** 實時計票（東區示例，與參考站一致） */
export const mockTally = {
  division: '東區',
  title: '會長/副會長選舉',
  voted: 52,
  total: 68,
  pct: 76,
  candidates: [
    { rank: 1, name: '林明德', label: '會長候選人', votes: 52 },
    { rank: 2, name: '陳慧儀', label: '會長候選人', votes: 44 },
    { rank: 3, name: '王志遠', label: '會長候選人', votes: 31 },
    { rank: 4, name: '李淑芬', label: '會長候選人', votes: 22 },
    { rank: 5, name: '張文昌', label: '會長候選人', votes: 15 },
    { rank: 6, name: '黃美玲', label: '會長候選人', votes: 8 },
  ],
  detailNote: '匿名模式下不顯示投票人身份',
  detailRows: [
    { card: 'BGS-2024-0001', name: '林明德', proxy: '—', votedFor: '陳慧儀、王志遠', time: '2026-09-04 10:23:15' },
    { card: 'BGS-2024-0002', name: '陳慧儀', proxy: '—', votedFor: '林明德、王志遠', time: '2026-09-04 10:25:33' },
  ],
}

/** 幹部指派（東區示例，與參考站一致） */
export const mockAppointments = {
  division: '東區',
  elected: '當選會長：林明德 · 副會長：陳慧儀 · 任期 2026-2028',
  count: 3,
  items: [
    { name: '劉秀英', surname: '劉', role: '祕書', by: '林明德', term: '2026-2028' },
    { name: '陳建閎', surname: '陳', role: '財務', by: '林明德', term: '2026-2028' },
    { name: '黃志偉', surname: '黃', role: '總務', by: '林明德', term: '2026-2028' },
  ],
}

/** 資料匯出 */
export const mockExports = {
  cards: [
    { title: '各分區投票明細', desc: '姓名、卡號、所屬分區、是否代投、投票時間、投了誰（匿名模式下不顯示身份）', formats: ['Excel', 'CSV'] },
    { title: '第二輪投票明細', desc: '總會副會長選舉完整投票錄', formats: ['Excel', 'CSV'] },
    { title: '幹部指派名單', desc: '按分區匯出各區幹部任命資料', formats: ['Excel'] },
    { title: '五區彙總統計', desc: '各分區投票率、得票分布、平票情況彙總報表', formats: ['Excel', 'PDF'] },
    { title: '會員名單', desc: '包含卡號、簡繁雙存姓名、分區、手機的完整名單', formats: ['Excel', 'CSV'] },
    { title: '完整選舉報告', desc: '包含全部輪次、結果、指派的終局報告文件', formats: ['PDF'] },
  ],
  history: [
    { time: '2026-09-04 11:45', file: '東區投票明細.xlsx', size: '128 KB', by: 'admin' },
    { time: '2026-09-04 10:12', file: '會員名單全量.xlsx', size: '256 KB', by: 'admin' },
    { time: '2026-09-03 16:30', file: '候選人名單.csv', size: '42 KB', by: 'admin' },
  ],
}

/** 輪次管理 */
export const mockRounds = {
  steps: [
    { no: 1, title: '第一輪·分區選舉', desc: '五區並行獨立選舉', state: 'active' },
    { no: 2, title: '平票再投', desc: '若某區平票則觸發加賽', state: 'pending' },
    { no: 3, title: '第二輪·總會副會長', desc: '小範圍白名單選舉', state: 'pending' },
    { no: 4, title: '幹部指派', desc: '各區會長指派會務幹部', state: 'pending' },
    { no: 5, title: '完成', desc: '結果公告', state: 'pending' },
  ],
  current: {
    tag: 'ROUND 1 · 進行中',
    title: '第一輪 · 五分區同步選舉',
    divisions: [
      { name: '東區', text: '52/68人·76%', tie: false },
      { name: '南區', text: '41/54人·76%', tie: true, tieNote: '❗ 最高票平票' },
      { name: '西區', text: '48/72人·67%', tie: false },
      { name: '北區', text: '33/58人·57%', tie: false },
      { name: '中區', text: '29/48人·60%', tie: false },
    ],
  },
  rerun: {
    status: '待啟動',
    rows: [
      { k: '加賽分區', v: '南區（候選）' },
      { k: '平票候選人', v: '吳文雄、趙淑芬（2 人）' },
      { k: '投票人範圍', v: '本區全部會員' },
      { k: '每人票數', v: '1 票' },
      { k: '加賽次數上限', v: '最多 2 次' },
    ],
  },
  round2: {
    status: '未開始',
    rows: [
      { k: '候選人數', v: '尚未設定' },
      { k: '投票人白名單', v: '尚未匯入' },
      { k: '每人票數', v: '1 票（預設）' },
      { k: '投票連結', v: '將獨立產生' },
    ],
  },
  table: [
    { id: 'R1', title: '第一輪 · 五分區選舉', window: '2026-09-04 10:00 → 2026-09-04 12:00', progress: '203 / 300', status: '進行中' },
    { id: 'R2', title: '第二輪 · 總會副會長選舉', window: '2026-09-04 14:00 → 2026-09-04 15:00', progress: '0 / 12', status: '草稿' },
  ],
}

/** 投票配置 */
export const mockVoteConfig = {
  round: '第一輪 · 分區選舉',
  order: '固定順序',
  minVotes: 1,
  maxVotes: 2,
  start: '2026-09-04 10:00',
  end: '2026-09-04 12:00',
  anonymous: true,
  url: 'https://vote.bgs.org/r1',
  participation: [
    { name: '東區', pct: 76 },
    { name: '南區', pct: 76 },
    { name: '西區', pct: 67 },
    { name: '北區', pct: 57 },
    { name: '中區', pct: 60 },
  ],
}
