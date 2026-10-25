/* 面板参数唯一源（starter 02/20 号）：customFrame + 右侧 35%（可调 25%–45%）。
 * 业务宽度按容器算，不按整窗断点假设。
 */
export const PANEL = Object.freeze({
  customFrame: true,
  businessSide: 'left',
  businessWidth: 0.65,
  minContainerPx: 0,
})

export const AGENT_PANE = Object.freeze({ min: 25, max: 45, default: 35, step: 2, drawerBelowPx: 760 })

export function clampAgentWidth(pct) {
  const n = Number(pct)
  if (!Number.isFinite(n)) return AGENT_PANE.default
  return Math.min(AGENT_PANE.max, Math.max(AGENT_PANE.min, Math.round(n)))
}

/** 业务区像素宽度：宿主给的是容器宽，不是窗口宽。 */
export function businessPanePx(containerWidth, agentPct = AGENT_PANE.default) {
  const w = Math.max(0, Number(containerWidth) || 0)
  const pct = clampAgentWidth(agentPct)
  return Math.round(w * (1 - pct / 100))
}

export function assertPanelConfig(panel = PANEL, pane = AGENT_PANE) {
  const problems = []
  if (!panel || panel.customFrame !== true) problems.push('PANEL.customFrame 必须为 true（否则宿主不提供 AI 按钮位与拖宽）')
  if (!(pane.min >= 25 && pane.max <= 45)) problems.push('AGENT_PANE 区间必须落在 25%–45%')
  if (!(pane.default >= pane.min && pane.default <= pane.max)) problems.push('AGENT_PANE.default 必须落在区间内')
  return problems
}
