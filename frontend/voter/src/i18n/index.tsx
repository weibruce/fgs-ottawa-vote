/* eslint-disable react/only-export-components --
   i18n 模組本來就會同時匯出 Provider（元件）與 useI18n / 常數（非元件），
   這是標準用法；此規則只是 Fast Refresh 的開發期提示。 */
/**
 * 投票端 i18n — 繁中（預設）／简中／English
 *
 * 用法：
 *   const { t, lang, setLang } = useI18n()
 *   t('verify.heading')                        // 靜態字串
 *   t('choose.selectedCount', { n: 1, max: 2 }) // 含變數（{name} 佔位）
 *
 * 語言選擇存於 localStorage（key: vote_lang），下次進入沿用。
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'

export type Lang = 'zh-Hant' | 'zh-Hans' | 'en'

export const LANGS: { value: Lang; label: string; short: string }[] = [
  { value: 'zh-Hant', label: '繁中', short: '繁中' },
  { value: 'zh-Hans', label: '简中', short: '简中' },
  { value: 'en', label: 'English', short: 'EN' },
]

export const LANG_STORAGE_KEY = 'vote_lang'

/** 預設語言：繁體中文 */
export const DEFAULT_LANG: Lang = 'zh-Hant'

type Dict = Record<string, string>

const zhHant: Dict = {
  // ── 共用 ──
  'common.retry': '重試',
  'common.cancel': '取消',
  'common.confirm': '確認',
  'common.submitting': '提交中…',
  'common.confirming': '確認中…',
  'common.yes': '是',
  'common.no': '否',
  'common.notProvided': '尚未提供',
  'common.roundN': '第 {n} 輪',
  'common.people': '{voted} / {total} 人',
  'common.votes': '{n} 票',
  'common.langLabel': '語言',

  // ── 品牌 ──
  'app.logoAlt': '國際佛光會',
  'app.orgLine1': '2026 國際佛光會渥太華協會',
  'app.orgLine2': '各分會會務幹部改選',

  // ── P1 身份驗證 ──
  'verify.heading': '會員信息',
  'verify.intro': '請輸入會員資料，以識別您的所屬分區。',
  'verify.nameLabel': '會員姓名',
  'verify.namePlaceholder': '請輸入姓名（簡、繁體均可）',
  'verify.cardLabel': '會員卡號',
  'verify.cardPlaceholder': '例：FGS-2026-0819',
  'verify.proxyLabel': '是否由他人代理投票',
  'verify.proxyNameLabel': '代投人姓名',
  'verify.proxyCardLabel': '代投人佛光會員卡號',
  'verify.submit': '提交',
  'verify.footer': '系統將依姓名與會員卡號比對資料，僅可投本分區選舉。',
  'verify.errNoRound': '尚未取得投票輪次，請稍後再試',
  'verify.errNeedFields': '請輸入會員姓名與佛光會員卡號',
  'verify.errNeedProxy': '代投時請填寫代投人姓名與佛光會員卡號',

  // ── 投票視窗（未開始／已結束） ──
  'window.notStartedTitle': '投票尚未開始',
  'window.notStartedDesc': '投票將於 {time} 開始，請稍後再試。',
  'window.notStartedNoTime': '投票尚未開放，請稍後再試。',
  'window.closedTitle': '投票已結束',
  'window.closedDesc': '本次投票已於 {time} 結束，感謝您的參與。',
  'window.closedNoTime': '本次投票已結束，感謝您的參與。',
  'window.timeUnset': '時間未設定',
  'window.roundLabel': '當前輪次',
  'window.goVote': '前往投票',

  // ── P2 身份核驗完成 ──
  'confirmed.heading': '身份核驗完成',
  'confirmed.cardLabel': '會員卡號',
  'confirmed.divisionLabel': '所屬分區',
  'confirmed.proxyLabel': '代理投票',
  'confirmed.startVote': '開始投票',
  'confirmed.editData': '修改資料',
  'confirmed.viewVote': '查看投票',
  'confirmed.proxyVote': '代他人投票',
  'confirmed.votedNote': '您已完成投票，如需查看請點「查看投票」',
  'confirmed.votedByProxyNote': '您的投票已由 {proxyName} 代投',
  'edit.heading': '修改資料',
  'edit.desc': '以下為本次操作使用的會員資料，可直接修改。',
  'edit.sessionNote': '修改只會更新本次投票流程顯示的資料，不會變更後端會員紀錄。',
  'edit.submit': '儲存',
  'edit.back': '返回',
  'proxy.heading': '代他人投票',
  'proxy.desc': '請輸入要代為投票的會員資料，系統會再次驗證對方身份。',
  'proxy.currentLabel': '當前會員',
  'proxy.targetNameLabel': '他人會員姓名',
  'proxy.targetCardLabel': '他人會員卡號',
  'proxy.submit': '提交',
  'proxy.errAlreadyVoted': '該會員已完成投票，無需重複投票',
  'proxy.errSameAsSelf': '不可代替自己投票',
  'proxy.confirmLine1': '您{division}{name}（卡號：{no}）',
  'proxy.confirmLine2': '正在代表，{division}{name}（卡號：{no}）投票，',
  'proxy.confirmWarn': '提交後不可修改，請核對信息。',
  'proxy.confirmOk': '確認',
  'proxy.confirmCancel': '返回修改',
  'view.heading': '查看投票',
  'view.note': '您已完成投票，以下內容僅供查看，無法修改。',
  'view.back': '返回',
  'done.title': '您已成功完成投票，請等待分會投票結束。',
  'done.back': '返回查看投票',
  // 代投成功提示（第 3 點）
  'confirmed.proxyNoticeTitle': '您正在代表{division}{name}（卡號：{no}）投票。',
  'confirmed.proxyNoticeBy': '代投人：{proxyName}',
  'confirmed.proxyNoticeCard': '佛光卡號：{proxyNo}',
  'confirmed.proxyNoticeWarn': '提交後不可修改，請核對信息。',

  // ── P3 選擇候選人 ──
  'choose.heading': '{division}會長／副會長選舉',
  'choose.voterLine': '投票人：{name} {no}',
  'choose.bannerLabel': '請選擇候選人',
  'choose.selectedCount': '已選 {n}/{max} 票',
  'choose.footer': '至少選擇 {min} 位，最多可選 {max} 位。提交後將無法修改。',
  'choose.submit': '確認投票',
  'choose.modalTitle': '確認投票',
  'choose.modalBody': '您將把票投給',
  'choose.modalNote': '提交後將無法修改。',
  'choose.modalCancel': '再想想',
  'choose.modalConfirm': '確認提交',
  'choose.errMin': '請至少選擇 {n} 位候選人',
  'choose.errMax': '已達 {n} 票上限，如需變更請先取消已選候選人',
  'choose.detailAria': '查看 {name} 詳情',
  'choose.secondaryTerms': '{position} · 第 {n} 屆',

  // ── P4 候選人詳情 ──
  'detail.notFound': '未找到該候選人資料。',
  'detail.back': '返回候選人名單',
  'detail.termsLabel': '現任屆數',
  'detail.termsValue': '{n} 屆',
  'detail.divisionLabel': '所屬',
  'detail.sloganTitle': '競選理念',
  'detail.descTitle': '候選人介紹',

  // ── P5 投票結果（單區） ──
  'results.heading': '投票結果',
  'results.live': '正在更新，每 2 秒同步一次',
  'results.progressTitle': '{division}投票進度',
  'results.turnout': '投票率 {pct}%',
  'results.leading': '目前最高票',
  'results.otherDivisions': '查看其他分區投票',
  'results.footer': '結果僅供投票期間即時查閱；投票結束後將顯示最終統計。',
  'results.error': '即時結果載入失敗，請重試',
  'results.roundStat': '{round}。{division}即時統計',
  'results.thisDivision': '本區',

  // ── P6 各分區投票狀態 ──
  'screen.heading': '各分區投票狀態',
  'screen.sub': '僅顯示各區目前排名前三的候選人',
  'screen.loading': '正在載入各分區投票狀態…',
  'screen.empty': '尚無投票資料',
  'screen.footer': '資料依各區投票進度同步更新；最終結果以投票結束後公告為準。',
  'screen.roundOverview': '{round} · 五區即時總覽',
  'screen.openDivision': '查看{division}投票結果',

  // ── P7 投票成功 ──
  'success.heading': '投票成功',
  'success.viewResults': '查看本區投票結果',
  'success.viewOverview': '查看五區總覽',
  'success.footer': '感謝您的參與，投票已完成。',

  // ── 後端錯誤訊息（以 detail 精確比對） ──
  'err.memberNotFound': '未找到該會員卡號，請核實',
  'err.nameMismatch': '姓名與會員卡號不匹配，請核實',
  'err.windowClosed': '投票已結束',
  'err.windowNotStarted': '投票尚未開始',
  'err.votesOutOfRange': '票數不合法',
  'err.notInWhitelist': '您無許可權參與本輪投票',
  'err.crossDivision': '僅可投本分區候選人',
  'err.alreadyVoted': '您已投過票，無需重複投票',
  'err.proxyAlreadyVoted': '您的投票已被{proxyName}代投，無需重複投票',
  'err.tokenInvalid': '驗證已過期，請重新確認身份',
  'err.submitFail': '提交失敗，請重試',
  'err.system': '系統錯誤，請稍後再試',
  'err.proxyCardNotFound': '未找到代投人的會員卡號，請核實',
  'err.proxyNameMismatch': '代投人姓名與卡號不匹配，請核實',
  'err.proxySameAsMember': '代投人不可與會員本人相同',
  'err.proxyFieldsRequired': '請填寫代投人姓名與佛光會員卡號',
}

const zhHans: Dict = {
  'common.retry': '重试',
  'common.cancel': '取消',
  'common.confirm': '确认',
  'common.submitting': '提交中…',
  'common.confirming': '确认中…',
  'common.yes': '是',
  'common.no': '否',
  'common.notProvided': '尚未提供',
  'common.roundN': '第 {n} 轮',
  'common.people': '{voted} / {total} 人',
  'common.votes': '{n} 票',
  'common.langLabel': '语言',

  'app.logoAlt': '国际佛光会',
  'app.orgLine1': '2026 国际佛光会渥太华协会',
  'app.orgLine2': '各分会会务干部改选',

  'verify.heading': '会员信息',
  'verify.intro': '请输入会员资料，以识别您的所属分区。',
  'verify.nameLabel': '会员姓名',
  'verify.namePlaceholder': '请输入姓名（简、繁体均可）',
  'verify.cardLabel': '会员卡号',
  'verify.cardPlaceholder': '例：FGS-2026-0819',
  'verify.proxyLabel': '是否由他人代理投票',
  'verify.proxyNameLabel': '代投人姓名',
  'verify.proxyCardLabel': '代投人佛光会员卡号',
  'verify.submit': '提交',
  'verify.footer': '系统将依姓名与会员卡号比对资料，仅可投本分区选举。',
  'verify.errNoRound': '尚未取得投票轮次，请稍后再试',
  'verify.errNeedFields': '请输入会员姓名与佛光会员卡号',
  'verify.errNeedProxy': '代投时请填写代投人姓名与佛光会员卡号',

  'window.notStartedTitle': '投票尚未开始',
  'window.notStartedDesc': '投票将于 {time} 开始，请稍后再试。',
  'window.notStartedNoTime': '投票尚未开放，请稍后再试。',
  'window.closedTitle': '投票已结束',
  'window.closedDesc': '本次投票已于 {time} 结束，感谢您的参与。',
  'window.closedNoTime': '本次投票已结束，感谢您的参与。',
  'window.timeUnset': '时间未设定',
  'window.roundLabel': '当前轮次',
  'window.goVote': '前往投票',

  'confirmed.heading': '身份核验完成',
  'confirmed.cardLabel': '会员卡号',
  'confirmed.divisionLabel': '所属分区',
  'confirmed.proxyLabel': '代理投票',
  'confirmed.startVote': '开始投票',
  'confirmed.editData': '修改资料',
  'confirmed.viewVote': '查看投票',
  'confirmed.proxyVote': '代他人投票',
  'confirmed.votedNote': '您已完成投票，如需查看请点「查看投票」',
  'confirmed.votedByProxyNote': '您的投票已由 {proxyName} 代投',
  'edit.heading': '修改资料',
  'edit.desc': '以下为本次操作使用的会员资料，可直接修改。',
  'edit.sessionNote': '修改只会更新本次投票流程显示的资料，不会更改后端会员记录。',
  'edit.submit': '保存',
  'edit.back': '返回',
  'proxy.heading': '代他人投票',
  'proxy.desc': '请输入要代为投票的会员资料，系统会再次验证对方身份。',
  'proxy.currentLabel': '当前会员',
  'proxy.targetNameLabel': '他人会员姓名',
  'proxy.targetCardLabel': '他人会员卡号',
  'proxy.submit': '提交',
  'proxy.errAlreadyVoted': '该会员已完成投票，无需重复投票',
  'proxy.errSameAsSelf': '不可代替自己投票',
  'proxy.confirmLine1': '您{division}{name}（卡号：{no}）',
  'proxy.confirmLine2': '正在代表，{division}{name}（卡号：{no}）投票，',
  'proxy.confirmWarn': '提交后不可修改，请核对信息。',
  'proxy.confirmOk': '确认',
  'proxy.confirmCancel': '返回修改',
  'view.heading': '查看投票',
  'view.note': '您已完成投票，以下内容仅供查看，无法修改。',
  'view.back': '返回',
  'done.title': '您已成功完成投票，请等待分会投票结束。',
  'done.back': '返回查看投票',
  'confirmed.proxyNoticeTitle': '您正在代表{division}{name}（卡号：{no}）投票。',
  'confirmed.proxyNoticeBy': '代投人：{proxyName}',
  'confirmed.proxyNoticeCard': '佛光卡号：{proxyNo}',
  'confirmed.proxyNoticeWarn': '提交后不可修改，请核对信息。',

  'choose.heading': '{division}会长／副会长选举',
  'choose.voterLine': '投票人：{name} {no}',
  'choose.bannerLabel': '请选择候选人',
  'choose.selectedCount': '已选 {n}/{max} 票',
  'choose.footer': '至少选择 {min} 位，最多可选 {max} 位。提交后将无法修改。',
  'choose.submit': '确认投票',
  'choose.modalTitle': '确认投票',
  'choose.modalBody': '您将把票投给',
  'choose.modalNote': '提交后将无法修改。',
  'choose.modalCancel': '再想想',
  'choose.modalConfirm': '确认提交',
  'choose.errMin': '请至少选择 {n} 位候选人',
  'choose.errMax': '已达 {n} 票上限，如需变更请先取消已选候选人',
  'choose.detailAria': '查看 {name} 详情',
  'choose.secondaryTerms': '{position} · 第 {n} 届',

  'detail.notFound': '未找到该候选人资料。',
  'detail.back': '返回候选人名单',
  'detail.termsLabel': '现任届数',
  'detail.termsValue': '{n} 届',
  'detail.divisionLabel': '所属',
  'detail.sloganTitle': '竞选理念',
  'detail.descTitle': '候选人介绍',

  'results.heading': '投票结果',
  'results.live': '正在更新，每 2 秒同步一次',
  'results.progressTitle': '{division}投票进度',
  'results.turnout': '投票率 {pct}%',
  'results.leading': '目前最高票',
  'results.otherDivisions': '查看其他分区投票',
  'results.footer': '结果仅供投票期间即时查阅；投票结束后将显示最终统计。',
  'results.error': '即时结果载入失败，请重试',
  'results.roundStat': '{round}。{division}即时统计',
  'results.thisDivision': '本区',

  'screen.heading': '各分区投票状态',
  'screen.sub': '仅显示各区目前排名前三的候选人',
  'screen.loading': '正在载入各分区投票状态…',
  'screen.empty': '尚无投票资料',
  'screen.footer': '资料依各区投票进度同步更新；最终结果以投票结束后公告为准。',
  'screen.roundOverview': '{round} · 五区即时总览',
  'screen.openDivision': '查看{division}投票结果',

  'success.heading': '投票成功',
  'success.viewResults': '查看本区投票结果',
  'success.viewOverview': '查看五区总览',
  'success.footer': '感谢您的参与，投票已完成。',

  'err.memberNotFound': '未找到该会员卡号，请核实',
  'err.nameMismatch': '姓名与会员卡号不匹配，请核实',
  'err.windowClosed': '投票已结束',
  'err.windowNotStarted': '投票尚未开始',
  'err.votesOutOfRange': '票数不合法',
  'err.notInWhitelist': '您无权限参与本轮投票',
  'err.crossDivision': '仅可投本分区候选人',
  'err.alreadyVoted': '您已投过票，无需重复投票',
  'err.proxyAlreadyVoted': '您的投票已被{proxyName}代投，无需重复投票',
  'err.tokenInvalid': '验证已过期，请重新确认身份',
  'err.submitFail': '提交失败，请重试',
  'err.system': '系统错误，请稍后再试',
  'err.proxyCardNotFound': '未找到代投人的会员卡号，请核实',
  'err.proxyNameMismatch': '代投人姓名与卡号不匹配，请核实',
  'err.proxySameAsMember': '代投人不可与会员本人相同',
  'err.proxyFieldsRequired': '请填写代投人姓名与佛光会员卡号',
}

const en: Dict = {
  'common.retry': 'Retry',
  'common.cancel': 'Cancel',
  'common.confirm': 'Confirm',
  'common.submitting': 'Submitting…',
  'common.confirming': 'Verifying…',
  'common.yes': 'Yes',
  'common.no': 'No',
  'common.notProvided': 'Not provided',
  'common.roundN': 'Round {n}',
  'common.people': '{voted} / {total} people',
  'common.votes': '{n} votes',
  'common.langLabel': 'Language',

  'app.logoAlt': 'BLIA',
  'app.orgLine1': '2026 BLIA Ottawa Chapter',
  'app.orgLine2': 'Chapter Officer Election',

  'verify.heading': 'Member Information',
  'verify.intro': 'Enter your membership details so we can identify your division.',
  'verify.nameLabel': 'Member name',
  'verify.namePlaceholder': 'Enter your name (Traditional or Simplified)',
  'verify.cardLabel': 'Membership no.',
  'verify.cardPlaceholder': 'e.g. FGS-2026-0819',
  'verify.proxyLabel': 'Someone is voting on my behalf',
  'verify.proxyNameLabel': 'Proxy voter name',
  'verify.proxyCardLabel': 'Proxy voter membership no.',
  'verify.submit': 'Submit',
  'verify.footer':
    'Your name and membership no. are matched against the register. You may only vote in your own division.',
  'verify.errNoRound': 'Voting round unavailable, please try again later',
  'verify.errNeedFields': 'Please enter your name and membership no.',
  'verify.errNeedProxy': "Please enter the proxy voter's name and membership no.",

  'window.notStartedTitle': 'Voting has not started',
  'window.notStartedDesc': 'Voting opens at {time}. Please come back later.',
  'window.notStartedNoTime': 'Voting is not open yet. Please come back later.',
  'window.closedTitle': 'Voting has ended',
  'window.closedDesc': 'Voting closed at {time}. Thank you for taking part.',
  'window.closedNoTime': 'Voting has ended. Thank you for taking part.',
  'window.timeUnset': 'Time not set',
  'window.roundLabel': 'Current round',
  'window.goVote': 'Go to voting',

  'confirmed.heading': 'Identity verified',
  'confirmed.cardLabel': 'Membership no.',
  'confirmed.divisionLabel': 'Division',
  'confirmed.proxyLabel': 'Proxy vote',
  'confirmed.startVote': 'Start voting',
  'confirmed.editData': 'Edit details',
  'confirmed.viewVote': 'View my vote',
  'confirmed.proxyVote': 'Vote for someone else',
  'confirmed.votedNote': 'You have already voted. Tap “View my vote” to see it.',
  'confirmed.votedByProxyNote': 'Your vote was cast by {proxyName}',
  'edit.heading': 'Edit details',
  'edit.desc': 'These are the member details used for this session. You can edit them directly.',
  'edit.sessionNote': 'Changes only affect what is shown during this voting flow; the server record is not changed.',
  'edit.submit': 'Save',
  'edit.back': 'Back',
  'proxy.heading': 'Vote for someone else',
  'proxy.desc': 'Enter the member you are voting for. Their identity will be verified too.',
  'proxy.currentLabel': 'Current member',
  'proxy.targetNameLabel': 'Member name',
  'proxy.targetCardLabel': 'Member no.',
  'proxy.submit': 'Submit',
  'proxy.errAlreadyVoted': 'This member has already voted',
  'proxy.errSameAsSelf': 'You cannot vote on behalf of yourself',
  'proxy.confirmLine1': 'You, {name} ({division}, no. {no})',
  'proxy.confirmLine2': 'are voting on behalf of {name} ({division}, no. {no}),',
  'proxy.confirmWarn': 'This cannot be changed after submission. Please double-check.',
  'proxy.confirmOk': 'Confirm',
  'proxy.confirmCancel': 'Go back',
  'view.heading': 'View my vote',
  'view.note': 'You have already voted. This is read-only and cannot be changed.',
  'view.back': 'Back',
  'done.title': 'Your vote has been submitted. Please wait for the division result.',
  'done.back': 'View my vote',
  'confirmed.proxyNoticeTitle':
    'You are voting on behalf of {name} ({division}) — membership no. {no}.',
  'confirmed.proxyNoticeBy': 'Proxy voter: {proxyName}',
  'confirmed.proxyNoticeCard': 'BLIA card no.: {proxyNo}',
  'confirmed.proxyNoticeWarn': 'This cannot be changed after submission. Please double-check.',

  'choose.heading': '{division} President / Vice-President Election',
  'choose.voterLine': 'Voter: {name} {no}',
  'choose.bannerLabel': 'Please select candidates',
  'choose.selectedCount': '{n}/{max} selected',
  'choose.footer': 'Select at least {min} and at most {max}. This cannot be changed after submission.',
  'choose.submit': 'Confirm vote',
  'choose.modalTitle': 'Confirm your vote',
  'choose.modalBody': 'You are voting for',
  'choose.modalNote': 'This cannot be changed after submission.',
  'choose.modalCancel': 'Go back',
  'choose.modalConfirm': 'Confirm & submit',
  'choose.errMin': 'Please select at least {n} candidate(s)',
  'choose.errMax': 'You have reached the limit of {n}. Deselect someone to change.',
  'choose.detailAria': 'View details for {name}',
  'choose.secondaryTerms': '{position} · Term {n}',

  'detail.notFound': 'Candidate not found.',
  'detail.back': 'Back to candidate list',
  'detail.termsLabel': 'Terms served',
  'detail.termsValue': '{n}',
  'detail.divisionLabel': 'Division',
  'detail.sloganTitle': 'Campaign statement',
  'detail.descTitle': 'About the candidate',

  'results.heading': 'Results',
  'results.live': 'Live — refreshes every 2 seconds',
  'results.progressTitle': '{division} turnout',
  'results.turnout': 'Turnout {pct}%',
  'results.leading': 'Currently leading',
  'results.otherDivisions': 'View other divisions',
  'results.footer': 'Live results are for reference during voting; official results are announced after voting closes.',
  'results.error': 'Failed to load live results, please retry',
  'results.roundStat': '{round} · {division} · live count',
  'results.thisDivision': 'This division',

  'screen.heading': 'Division Voting Status',
  'screen.sub': 'Top three candidates in each division',
  'screen.loading': 'Loading division status…',
  'screen.empty': 'No votes yet',
  'screen.footer':
    'Data syncs with each division’s progress; final results follow the official announcement.',
  'screen.roundOverview': '{round} · Live overview',
  'screen.openDivision': 'View {division} results',

  'success.heading': 'Vote submitted',
  'success.viewResults': 'View my division’s results',
  'success.viewOverview': 'View all divisions',
  'success.footer': 'Thank you for taking part. Your vote is complete.',

  'err.memberNotFound': 'Membership no. not found. Please check and try again.',
  'err.nameMismatch': 'The name does not match the membership no.',
  'err.windowClosed': 'Voting has ended',
  'err.windowNotStarted': 'Voting has not started',
  'err.votesOutOfRange': 'Invalid number of votes',
  'err.notInWhitelist': 'You are not eligible to vote in this round',
  'err.crossDivision': 'You may only vote for candidates in your own division',
  'err.alreadyVoted': 'You have already voted',
  'err.proxyAlreadyVoted': 'Your vote was already cast by {proxyName}',
  'err.tokenInvalid': 'Your session has expired. Please verify your identity again.',
  'err.submitFail': 'Submission failed, please retry',
  'err.system': 'System error, please try again later',
  'err.proxyCardNotFound': 'Proxy voter membership no. not found',
  'err.proxyNameMismatch': 'The proxy voter’s name does not match the membership no.',
  'err.proxySameAsMember': 'The proxy voter cannot be the member themselves',
  'err.proxyFieldsRequired': "Please enter the proxy voter's name and membership no.",
}

const DICTS: Record<Lang, Dict> = { 'zh-Hant': zhHant, 'zh-Hans': zhHans, en }

/** 後端回傳的中文 detail → i18n key（精確比對） */
const BACKEND_DETAIL_TO_KEY: Record<string, string> = {
  '未找到該會員卡號': 'err.memberNotFound',
  '姓名與卡號不匹配': 'err.nameMismatch',
  '姓名與會員卡號不匹配': 'err.nameMismatch',
  '投票已結束': 'err.windowClosed',
  '投票尚未開始': 'err.windowNotStarted',
  '您已投過票，無需重複投票': 'err.alreadyVoted',
  '您無許可權參與本輪投票': 'err.notInWhitelist',
  '不可投票其他分區的候選人': 'err.crossDivision',
  '投票憑證已過期': 'err.tokenInvalid',
  '投票憑證無效': 'err.tokenInvalid',
  '未找到代投人的會員卡號，請核實': 'err.proxyCardNotFound',
  '代投人姓名與卡號不匹配，請核實': 'err.proxyNameMismatch',
  '代投人不可與會員本人相同': 'err.proxySameAsMember',
  '請填寫代投人姓名與佛光會員卡號': 'err.proxyFieldsRequired',
}

function interpolate(template: string, vars?: Record<string, string | number>): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (_m, k) => (vars[k] !== undefined ? String(vars[k]) : `{${k}}`))
}

export type TFn = (key: string, vars?: Record<string, string | number>) => string

/** 可挑選姓名的實體（會員／候選人皆有這組欄位） */
export interface NameFields {
  name?: string | null
  name_trad?: string | null
  name_simp?: string | null
  name_en?: string | null
  givenname?: string | null
  surname?: string | null
}

/**
 * 依偏好語言挑選要顯示的姓名（需求第 3 點）：
 *   繁中 → 繁體姓名；简中 → 簡體姓名；English → 英文全名
 * 缺值時逐級退回，保證回得出非空字串（後端也提供同名 helper 供匯出使用）。
 */
export function pickName(lang: Lang, e: NameFields | null | undefined): string {
  if (!e) return ''
  const trad = (e.name_trad ?? e.name ?? '').trim()
  const simp = (e.name_simp ?? '').trim()
  const en =
    (e.name_en ?? '').trim() ||
    [(e.givenname ?? '').trim(), (e.surname ?? '').trim()].filter(Boolean).join(' ')
  if (lang === 'en') return en || trad || simp
  if (lang === 'zh-Hans') return simp || trad || en
  return trad || simp || en
}

interface I18nContextValue {
  lang: Lang
  setLang: (l: Lang) => void
  t: TFn
  /** 把後端的中文錯誤訊息翻成當前語言（認不出來就原樣顯示） */
  translateError: (detail: string) => string
  /**
   * 輪次顯示名。
   * 繁中直接用後端名稱（如「第一輪 · 分區選舉」）；简中／English 改用
   * 「第 N 輪 / Round N」，避免中文專有名詞混在譯文裡。
   */
  roundLabel: (name: string | null | undefined, roundNo: number | null | undefined) => string
  /**
   * 輪次短名（取「第一輪 · 分區選舉」的「第一輪」）。
   * 简中／English 同樣改用「第 N 輪 / Round N」。
   */
  roundShort: (name: string | null | undefined, roundNo: number | null | undefined) => string
  /** 依當前語言挑選姓名（pickName 的綁定版） */
  nameOf: (e: NameFields | null | undefined) => string
}

const I18nContext = createContext<I18nContextValue | null>(null)

function readStoredLang(): Lang {
  try {
    const raw = localStorage.getItem(LANG_STORAGE_KEY)
    if (raw === 'zh-Hant' || raw === 'zh-Hans' || raw === 'en') return raw
  } catch {
    /* ignore */
  }
  return DEFAULT_LANG
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(readStoredLang)

  useEffect(() => {
    try {
      localStorage.setItem(LANG_STORAGE_KEY, lang)
    } catch {
      /* ignore */
    }
    document.documentElement.lang = lang === 'en' ? 'en' : lang === 'zh-Hans' ? 'zh-Hans' : 'zh-Hant'
  }, [lang])

  const setLang = useCallback((l: Lang) => setLangState(l), [])

  const t = useCallback<TFn>(
    (key, vars) => {
      const dict = DICTS[lang] ?? zhHant
      const template = dict[key] ?? zhHant[key] ?? key
      return interpolate(template, vars)
    },
    [lang],
  )

  const translateError = useCallback(
    (detail: string) => {
      const text = (detail || '').trim()
      if (!text) return t('err.system')
      // 「您的投票已被 XXX 代投，無需重複投票」→ 取出代投人姓名後套版
      const proxyVoted = /^您的投票已被(.+?)代投，無需重複投票$/.exec(text)
      if (proxyVoted) return t('err.proxyAlreadyVoted', { proxyName: proxyVoted[1] })
      const key = BACKEND_DETAIL_TO_KEY[text]
      if (key) return t(key)
      return text
    },
    [t],
  )

  const roundLabel = useCallback(
    (name: string | null | undefined, roundNo: number | null | undefined) => {
      if (lang === 'zh-Hant' && name) return name
      return t('common.roundN', { n: roundNo ?? 1 })
    },
    [lang, t],
  )

  const roundShort = useCallback(
    (name: string | null | undefined, roundNo: number | null | undefined) => {
      if (lang === 'zh-Hant' && name) {
        return name.split(/[·・.。]/)[0].trim() || name
      }
      return t('common.roundN', { n: roundNo ?? 1 })
    },
    [lang, t],
  )

  const nameOf = useCallback(
    (e: NameFields | null | undefined) => pickName(lang, e),
    [lang],
  )

  const value = useMemo(
    () => ({ lang, setLang, t, translateError, roundLabel, roundShort, nameOf }),
    [lang, setLang, t, translateError, roundLabel, roundShort, nameOf],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n(): I18nContextValue {
  const ctx = useContext(I18nContext)
  if (!ctx) throw new Error('useI18n 必須在 <I18nProvider> 內使用')
  return ctx
}

/** 取當前語言對應的日期時間格式（不依賴 i18n 的場合可用） */
export function formatDateTime(iso: string | null | undefined, lang: Lang): string {
  if (!iso) return ''
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  const p = (n: number) => String(n).padStart(2, '0')
  const date = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
  const time = `${p(d.getHours())}:${p(d.getMinutes())}`
  return lang === 'en' ? `${date} ${time}` : `${date} ${time}`
}
