import test from 'node:test'
import assert from 'node:assert/strict'
import { computeMatch, computeMatchIndex, normalizeBioProfile, RULE_VERSION, MATCH_NOTICE } from '../lib/trial-matching.js'

const known = (value, extra = {}) => ({ state: 'known', value, source: '门诊病历 2026-10', date: '2026-10-20', ...extra })

const fullProfile = () => ({
  country: known('中国'),
  thalassemiaType: known('beta'),
  transfusionDependence: known('dependent'),
})

const trial = (over = {}) => ({
  key: 'ictrp:1', title: 'Transfusion-dependent beta-thalassaemia study',
  country: 'China', status: 'RECRUITING', thalassemiaType: 'beta', transfusionDependence: 'dependent', ...over,
})

test('全部未知时 index 为 null，不是 0 分', () => {
  const r = computeMatch({}, trial())
  assert.equal(r.index, null)
  assert.equal(r.knownDims, 0)
  assert.match(r.warnings.join(''), /不显示分数/)
  assert.match(r.headline, /暂无可对照字段/)
})

test('分母只累加已知维度：补一个已知维度必须改变分母与分数', () => {
  const one = computeMatch({ country: known('中国') }, trial({ thalassemiaType: null, transfusionDependence: null }))
  assert.equal(one.knownDims, 1, '只有地区是患者—登记对照维度（招募状态是登记侧事实，不进分母）')
  const two = computeMatch(fullProfile(), trial())
  assert.equal(two.knownDims, 3)
  assert.ok(two.index >= 0 && two.index <= 100)
})

test('未知字段不进分母，也不当 0（未测不等于阴性）', () => {
  const r = computeMatch({ country: known('中国'), thalassemiaType: { state: 'untested' } }, trial())
  assert.equal(r.dims.some((d) => d.code === 'thalassemiaType'), false)
  assert.ok(r.missing.some((m) => m.code === 'thalassemiaType' && /未测不等于阴性/.test(m.reason)))
})

test('招募状态用固定档，不做连续插值', () => {
  const scores = ['RECRUITING', 'NOT_YET_RECRUITING', 'ACTIVE_NOT_RECRUITING', 'ENROLLING_BY_INVITATION'].map((status) => {
    const r = computeMatch({}, trial({ status, thalassemiaType: null, transfusionDependence: null, country: null }))
    return r.recruit.score
  })
  assert.deepEqual(scores, [1, 0.6, 0.4, 0.4])
})

test('未识别的登记状态记为缺口，不猜', () => {
  const r = computeMatch(fullProfile(), trial({ status: 'Not Recruiting' }))
  assert.equal(r.recruit.known, false)
  assert.equal(r.recruit.score, null)
  assert.ok(r.missing.some((m) => m.code === 'status' && /未识别/.test(m.reason)))
})

test('明写分型不符必须显著提示，且不能被高分掩盖', () => {
  const r = computeMatch(fullProfile(), trial({ thalassemiaType: 'alpha' }))
  assert.equal(r.hasMismatch, true)
  assert.match(r.warnings.join(''), /不符/)
  const ok = computeMatch(fullProfile(), trial())
  assert.equal(ok.hasMismatch, false)
  assert.ok(r.index < ok.index, '不符必须让指数更低，而不是只看总分')
})

test('both / beta 视为相容；unspecified 不进分母', () => {
  assert.equal(computeMatch(fullProfile(), trial({ thalassemiaType: 'both' })).hasMismatch, false)
  const r = computeMatch(fullProfile(), trial({ thalassemiaType: 'unspecified' }))
  assert.equal(r.dims.some((d) => d.code === 'thalassemiaType'), false)
})

test('入排、基因阈值、年龄永远不进分母，但必须列在缺口里', () => {
  const r = computeMatch(fullProfile(), trial())
  for (const code of ['eligibility', 'biomarker', 'age']) {
    assert.ok(r.missing.some((m) => m.code === code), '缺口缺 ' + code)
  }
  assert.equal(r.dims.length, 3, '可参与计算的维度只有患者—登记对照 3 类（招募状态单列）')
})

test('结果带规则版本与不构成入组资格的声明', () => {
  const r = computeMatch(fullProfile(), trial())
  assert.equal(r.ruleVersion, RULE_VERSION)
  assert.equal(r.notice, MATCH_NOTICE)
  assert.match(r.notice, /不是入组资格/)
})

test('输入不被修改，非法分数被忽略', () => {
  const p = fullProfile()
  const snapshot = JSON.stringify(p)
  computeMatch(p, trial())
  assert.equal(JSON.stringify(p), snapshot, '不得就地修改患者档案')
  assert.deepEqual(computeMatchIndex([null, NaN, 2, -1]), { index: null, knownDims: 0, totalDims: 4 })
  assert.deepEqual(computeMatchIndex([]), { index: null, knownDims: 0, totalDims: 0 })
  assert.deepEqual(computeMatchIndex([1, 0]), { index: 50, knownDims: 2, totalDims: 2 })
})

test('三态可区分：known / untested / not_applicable 不能互相冒充', () => {
  const p = normalizeBioProfile({ country: { state: 'not_applicable' }, thalassemiaType: { state: 'known', value: 'Gamma' } })
  assert.equal(p.country.state, 'not_applicable')
  assert.equal(p.country.value, null)
  assert.equal(p.thalassemiaType.state, 'untested', '非法枚举值降级为未测，不猜')
})
