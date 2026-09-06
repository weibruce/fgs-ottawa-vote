/**
 * 投票端 mock 數據（開發期解耦前後端）
 * import.meta.env.DEV 時啟用；後端 API 就緒後切真實接口
 * 對齊 plan 5.2 Mock 策略
 */
import type {
  Division,
  Candidate,
  DivisionResult,
  OverviewResult,
  Round,
} from '../types'

const DIVISIONS: Division[] = [
  { id: 1, name: '東區', code: '東', color: '#b22222', min_votes: 1, max_votes: 2, start_time: null, end_time: null, status: 'active' },
  { id: 2, name: '南區', code: '南', color: '#c85a1e', min_votes: 1, max_votes: 2, start_time: null, end_time: null, status: 'active' },
  { id: 3, name: '西區', code: '西', color: '#286eb4', min_votes: 1, max_votes: 2, start_time: null, end_time: null, status: 'active' },
  { id: 4, name: '北區', code: '北', color: '#5a3c96', min_votes: 1, max_votes: 2, start_time: null, end_time: null, status: 'active' },
  { id: 5, name: '中區', code: '中', color: '#28825a', min_votes: 1, max_votes: 2, start_time: null, end_time: null, status: 'active' },
]

function candidatesFor(divisionId: number): Candidate[] {
  const samples: Record<number, Array<[string, string | null, string, number]>> = {
    1: [
      ['王大明', 'Wang Daming', '現任總幹事 · 第 2 屆', 2],
      ['李美玲', 'Li Meiling', '東區分會 前會長 · 第 1 屆', 1],
      ['陳國華', 'Chen Guohua', '青年組 召集人 · 初任', 0],
      ['林雅婷', 'Lin Yating', '文教組 組長 · 第 1 屆', 1],
      ['張建國', 'Zhang Jianguo', '慈善組 幹事 · 初任', 0],
    ],
    2: [
      ['黃志偉', 'Huang Zhiwei', '現任財務 · 第 3 屆', 3],
      ['劉淑芬', 'Liu Shufen', '南區分會 副會長', 1],
      ['周明德', 'Zhou Mingde', '總務組 幹事 · 初任', 0],
    ],
    3: [
      ['吳俊傑', 'Wu Junjie', '現任祕書 · 第 2 屆', 2],
      ['徐麗華', 'Xu Lihua', '西區分會 會長', 1],
      ['鄭家豪', 'Zheng Jiahao', '青年組 幹事 · 初任', 0],
    ],
    4: [
      ['許文雄', 'Xu Wenxiong', '現任總幹事 · 第 4 屆', 4],
      ['蔡美華', 'Cai Meihua', '北區分會 副會長 · 第 1 屆', 1],
    ],
    5: [
      ['楊建國', 'Yang Jianguo', '現任會長 · 第 3 屆', 3],
      ['郭秀英', 'Guo Xiuying', '中區分會 幹事', 1],
      ['林大衛', 'Lin Dawei', '文教組 召集人 · 初任', 0],
    ],
  }
  const list = samples[divisionId] ?? samples[1]
  return list.map(([name, nameEn, position, termCount], i) => ({
    id: divisionId * 100 + i,
    division_id: divisionId,
    name,
    name_en: nameEn,
    position,
    avatar_url: null,
    description: `我承諾將全心服務${DIVISIONS[divisionId - 1].name}會員，推動協會發展，凝聚力量，回饋社會。`,
    slogan: `${name}，用心服務，與您同行。`,
    term_count: termCount,
    sort_order: i,
  }))
}

function divisionResult(divisionId: number): DivisionResult {
  const div = DIVISIONS[divisionId - 1]
  const cands = candidatesFor(divisionId)
  // mock 結果：依 sort_order 遞減得票
  const base = [28, 24, 18, 12, 6]
  const maxVotes = 30
  const results = cands.map((c, i) => ({
    candidate_id: c.id,
    name: c.name,
    votes: base[i] ?? base[base.length - 1],
    is_leading: i === 0,
  }))
  void maxVotes
  return {
    division: div,
    voted_count: 56,
    total_count: 78,
    results,
    status: 'active',
  }
}

export const mock = {
  round: (id: number): Round => ({
    id,
    name: '第一輪・五區選舉',
    is_runoff: false,
    parent_round_id: null,
    status: 'active',
    min_votes: 1,
    max_votes: 2,
    anonymous: false,
    start_time: null,
    end_time: null,
    allowed_member_nos: null,
  }),
  divisions: DIVISIONS,
  candidates: (divisionId: number) => candidatesFor(divisionId),
  divisionResult: (divisionId: number) => divisionResult(divisionId),
  overview: (roundId: number): OverviewResult => ({
    round_id: roundId,
    divisions: DIVISIONS.map((d) => divisionResult(d.id)),
  }),
}
