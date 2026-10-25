/* 临床试验匹配：只做"登记库里真有的字段对得上多少"，不是入组资格。
 *
 * 合同来源：starter docs/35-CLINICAL-TRIAL-MATCHING.md（2026-10-25 新增）与 templates/TRIALS-MATCH.md。
 * 唯一允许的算法（35 号 §2.2）：
 *   对每个维度 d：患者未知 → score=null 且不进分母；登记库没这个字段 → null 不进分母；
 *   两边都有 → score ∈ [0,1]；index = round(100 * Σscore / count(非 null))；
 *   全部未知 → index=null（界面不显示 0，只显示缺口与补资料建议）。
 *
 * 三条不做的：不并入入排标准；不推断分型（只认标题/适应症明写）；不把 IHC/基因阈值/年龄算进分母。
 */
export const RULE_VERSION = 'dtm-1.0.0'

export const MATCH_NOTICE = '指数只说明"登记库里能对上的字段有多少"，不是入组资格，也不是疗效或安全性的判断；登记状态未核实。'

const RECRUIT_SCORE = {
  RECRUITING: 1,
  NOT_YET_RECRUITING: 0.6,
  ACTIVE_NOT_RECRUITING: 0.4,
  ENROLLING_BY_INVITATION: 0.4,
  UNKNOWN: null,
}

const THAL_TYPES = new Set(['alpha', 'beta', 'both', 'unknown'])
const TRIAL_TYPES = new Set(['alpha', 'beta', 'both', 'unspecified'])

/** 三态事实：known 才有值；untested/not_applicable 一律当"没有这个事实"。 */
function fact(input, allowed) {
  if (!input || typeof input !== 'object') return { state: 'untested', value: null }
  const state = input.state === 'known' || input.state === 'untested' || input.state === 'not_applicable' ? input.state : 'untested'
  if (state !== 'known') return { state, value: null }
  const value = input.value === undefined || input.value === null ? null : String(input.value).trim()
  if (!value || (allowed && !allowed.has(value))) return { state: 'untested', value: null }
  return { state: 'known', value, source: input.source ?? null, date: input.date ?? null }
}

export function normalizeBioProfile(input = {}) {
  return {
    country: fact(input.country),
    thalassemiaType: fact(input.thalassemiaType, THAL_TYPES),
    transfusionDependence: fact(input.transfusionDependence, new Set(['dependent', 'non_dependent'])),
    ruleVersion: RULE_VERSION,
  }
}

/** 指数：只对传入的已知维度求平均；数组里 null 表示该维度未知（不进分母）。 */
export function computeMatchIndex(scores = []) {
  const known = scores.filter((s) => typeof s === 'number' && Number.isFinite(s) && s >= 0 && s <= 1)
  if (!known.length) return { index: null, knownDims: 0, totalDims: scores.length }
  return { index: Math.round((100 * known.reduce((a, b) => a + b, 0)) / known.length), knownDims: known.length, totalDims: scores.length }
}

const sameCountry = (a, b) => {
  const norm = (v) => String(v || '').toLowerCase()
  const china = ['中国', 'china', 'cn', '中国大陆']
  return china.includes(norm(a)) && china.includes(norm(b)) ? true
    : norm(a) === norm(b) && Boolean(norm(a))
}

/**
 * 一条登记记录 vs 一个患者档案。
 * trial 只接受"登记记录里明写"的字段；未写的字段按 null 处理（不进分母）。
 */
export function computeMatch(profileInput = {}, trial = {}) {
  const profile = profileInput.ruleVersion ? profileInput : normalizeBioProfile(profileInput)
  const dims = []
  const missing = []
  const warnings = []

  // 1 地区
  const trialCountry = trial.country ? String(trial.country).trim() : ''
  if (profile.country.value && trialCountry) {
    dims.push({ code: 'country', label: '地区', score: sameCountry(profile.country.value, trialCountry) ? 1 : 0, patient: profile.country.value, trial: trialCountry })
  } else missing.push({ code: 'country', label: '地区', reason: profile.country.value ? '登记记录未写国家' : '患者未填所在国家' })

  // 2 招募状态：**登记侧事实，不算匹配维度**（与 35 号 §2.2 的差异见 docs/TRIALS-MATCH.md §3）
  //    理由：它对任何患者都给同一个分，算进分母会出现"患者零已知事实仍得 100 分"。
  const statusScore = RECRUIT_SCORE[trial.status] ?? null
  const recruit = statusScore === null
    ? { value: trial.status || null, score: null, known: false, reason: trial.status ? `未识别的登记状态：${trial.status}` : '登记记录未写招募状态' }
    : { value: trial.status, score: statusScore, known: true, reason: null }
  if (!recruit.known) missing.push({ code: 'status', label: '招募状态', reason: recruit.reason })

  // 3 明写分型线索（只在标题/适应症明写时才计）
  const trialType = TRIAL_TYPES.has(trial.thalassemiaType) && trial.thalassemiaType !== 'unspecified' ? trial.thalassemiaType : null
  if (profile.thalassemiaType.value && trialType) {
    const p = profile.thalassemiaType.value
    const score = trialType === 'both' || p === 'both' ? 1 : trialType === p ? 1 : 0
    dims.push({ code: 'thalassemiaType', label: '明写分型', score, patient: p, trial: trialType })
  } else missing.push({ code: 'thalassemiaType', label: '明写分型', reason: profile.thalassemiaType.value ? '登记记录没有明写 α/β 分型' : '患者未填分型（未测不等于阴性）' })

  // 4 明写输血依赖线索
  const trialTd = trial.transfusionDependence === 'dependent' || trial.transfusionDependence === 'non_dependent' ? trial.transfusionDependence : null
  if (profile.transfusionDependence.value && trialTd) {
    dims.push({ code: 'transfusionDependence', label: '明写输血依赖', score: profile.transfusionDependence.value === trialTd ? 1 : 0, patient: profile.transfusionDependence.value, trial: trialTd })
  } else missing.push({ code: 'transfusionDependence', label: '明写输血依赖', reason: profile.transfusionDependence.value ? '登记记录没有明写输血依赖' : '患者未填输血依赖状态' })

  // 永远不进分母的缺口（登记库里没有结构化字段）
  const fixedGaps = [
    { code: 'eligibility', label: '入排标准', reason: '登记导出没有结构化入排字段，且只能由研究者判定' },
    { code: 'biomarker', label: '基因/生物标志阈值', reason: '登记记录只有散文描述，没有结构化阈值' },
    { code: 'age', label: '年龄区间', reason: '多数登记记录没有该字段' },
  ]

  const { index, knownDims, totalDims } = computeMatchIndex(dims.map((d) => d.score))
  const mismatches = dims.filter((d) => d.score === 0)
  if (mismatches.length) warnings.push('本记录有明写字段与你的资料不符：' + mismatches.map((d) => `${d.label}（你 ${d.patient} / 登记 ${d.trial}）`).join('；'))
  if (!knownDims) warnings.push('没有任何可对照的已知字段：先补档案（未测不等于阴性），这里不显示分数')

  // 分型不符不能被高分掩盖：给出显著提示（仍不给结论）
  const hasMismatch = mismatches.some((d) => d.code === 'thalassemiaType' || d.code === 'transfusionDependence')

  return {
    index,
    knownDims,
    totalDims,
    dims,
    recruit,
    missing: [...missing, ...fixedGaps],
    warnings,
    hasMismatch,
    headline: index === null ? '暂无可对照字段' : `可对照 ${knownDims} 项，匹配指数 ${index}`,    ruleVersion: RULE_VERSION,
    notice: MATCH_NOTICE,
  }
}
