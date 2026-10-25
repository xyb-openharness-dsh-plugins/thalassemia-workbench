/* 演示数据播种：幂等、单事务、失败整体回滚。
 *
 * 唯一源是 demo/build-demo-data.mjs 的 buildDemoProfiles()（被 import 时不碰磁盘）。
 * 这里只做"把纯数据写进库"，不造数据、不改形状。
 */
import { buildDemoProfiles } from '../demo/build-demo-data.mjs'

const now = () => new Date().toISOString()

export function hasDemoData(db) {
  try { return db.prepare('SELECT COUNT(*) AS n FROM profile').get().n > 0 } catch { return false }
}

/** @returns {{inserted: boolean, profiles: string[]}} */
export function seedDemo(db) {
  if (hasDemoData(db)) return { inserted: false, profiles: [] }
  const data = buildDemoProfiles()
  const ts = now()
  db.exec('BEGIN')
  try {
    const insProfile = db.prepare(`INSERT INTO profile (id,display_name,relation,sex,birth_date,dx_date,genotype_text,transfusion_start,note,section_title,created_at,updated_at,meta_text,headline_text,mindset_text,dash_keys)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`)
    const insT = db.prepare(`INSERT INTO transfusion (id,profile_id,date,hb_before,units,volume_ml,product_type,reaction_text,site,note,section_title,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`)
    const insI = db.prepare(`INSERT INTO iron_lab (id,profile_id,date,ferritin,ref_low,ref_high,lab_name,report_text,section_title,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
    const insG = db.prepare(`INSERT INTO growth_measure (id,profile_id,date,height_cm,weight_kg,age_months,note,section_title,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
    const insS = db.prepare(`INSERT INTO screening_item (id,profile_id,item_text,category,planned_date,done_date,result_text,source_text,section_title,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?)`)
    const insA = db.prepare(`INSERT INTO antibody_record (id,profile_id,date,antibody_text,crossmatch_text,note,section_title,created_at)
      VALUES (?,?,?,?,?,?,?,?)`)
    const insC = db.prepare(`INSERT INTO cost_record (id,profile_id,date,category,amount_cents,insurance_flag,note,section_title,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)
    const insQ = db.prepare(`INSERT INTO question_item (id,profile_id,text,source_page,status,created_at,section_title)
      VALUES (?,?,?,?,?,?,?)`)
    const insD = db.prepare(`INSERT INTO docs (id,profile_id,filename,kind,sha256,imported_at,note,section_title)
      VALUES (?,?,?,?,?,?,?,?)`)
    const insK = db.prepare(`INSERT INTO candidates (id,doc_id,profile_id,field,value,status,page_no,created_at,note)
      VALUES (?,?,?,?,?,?,?,?,?)`)
    const insPlan = db.prepare(`INSERT INTO chelation_plan (id,profile_id,drug_text,dose_text,route,start_date,end_date,change_reason,in_use,section_title,created_at)
      VALUES (?,?,?,?,?,?,?,?,?,?,?)`)
    const insT2 = db.prepare(`INSERT INTO t2star_report (id,profile_id,date,organ,t2star_ms,report_text,hospital,section_title,created_at)
      VALUES (?,?,?,?,?,?,?,?,?)`)

    const keys = []
    for (const [key, p] of Object.entries(data.profiles)) {
      keys.push(key)
      insProfile.run(p.id, p.name, p.relation, p.sex === '男' ? 'male' : 'female', p.birth_date, p.dx_date,
        p.genotype, p.transfusion_start, p.mindset, '病情档案', ts, ts,
        p.meta, p.headline, p.mindset, JSON.stringify(p.dash_keys || []))
      p.transfusions.forEach((t, i) => insT.run(`${key}-T${i + 1}`, key, t.date, t.hb_before, t.units, t.volume_ml,
        t.product_type, t.reaction_text, t.site, t.note, '输血记录', ts))
      p.iron.forEach((t, i) => insI.run(`${key}-I${i + 1}`, key, t.date, t.ferritin, t.ref_low, t.ref_high,
        t.lab_name, t.report_text, '铁蛋白趋势', ts))
      p.growth.forEach((g, i) => insG.run(`${key}-G${i + 1}`, key, g.date, g.height_cm, g.weight_kg, g.age_months,
        g.note, '身高体重', ts))
      p.screening.forEach((s, i) => insS.run(`${key}-S${i + 1}`, key, s.item_text, s.category, s.planned_date,
        s.done_date, s.result_text, s.source_text, '筛查清单', ts))
      p.antibodies.forEach((a, i) => insA.run(`${key}-AB${i + 1}`, key, a.date, a.antibody_text,
        a.crossmatch_text, a.note, '抗体与配血', ts))
      p.costs.forEach((c, i) => insC.run(`${key}-C${i + 1}`, key, c.date, c.category, c.amount_cents,
        c.insurance_flag, c.note, '费用记录', ts))
      p.questions.forEach((q, i) => insQ.run(`${key}-Q${i + 1}`, key, q.text, q.source_page, q.status, ts, '就诊问题'))
      p.docs.forEach((d, i) => insD.run(`${key}-D${i + 1}`, key, d.filename, d.kind,
        `seed-${key}-${i + 1}`, d.date + 'T00:00:00+08:00', null, '资料库'))
      p.candidates.forEach((c, i) => insK.run(`${key}-K${i + 1}`, null, key, c.field, c.value, c.status, 1, ts, c.note))
      const plan = p.id === 'A'
        ? { drug: '地拉罗司（分散片）', dose: '按体重调整，医嘱原文：20 mg/kg 每日一次', route: 'oral', start: '2026-03-02', end: null, reason: '因胃肠道反应由去铁胺调整为口服' }
        : { drug: '去铁酮', dose: '医嘱原文：25 mg/kg 每日三次', route: 'oral', start: '2023-04-11', end: null, reason: '夜间泵影响上班，改为口服' }
      insPlan.run(`${key}-P1`, key, plan.drug, plan.dose, plan.route, plan.start, plan.end, plan.reason, 1, '去铁方案', ts)
      const t2 = p.id === 'A'
        ? [{ date: '2025-11-03', organ: 'heart', value: 18.6, report: '心 T2* 18.6 ms（放射科报告原文）' }]
        : [{ date: '2026-01-18', organ: 'heart', value: 26.1, report: '心 T2* 26.1 ms（放射科报告原文）' },
           { date: '2026-01-18', organ: 'liver', value: null, report: '肝铁 3.1 mg/g dw（报告原文）' }]
      t2.forEach((t, i) => insT2.run(`${key}-R${i + 1}`, key, t.date, t.organ, t.value, t.report, null, '心肝铁报告', ts))
    }
    db.exec('COMMIT')
    return { inserted: true, profiles: keys }
  } catch (error) {
    db.exec('ROLLBACK')
    throw error
  }
}
