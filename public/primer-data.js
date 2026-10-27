/* 36 号 · 疾病概要（四段固定顺序：definition → evidence → landscape → trend）
 * 内容只取自本仓 README「? 疾病概要」、docs/SPEC.md、docs/GUIDELINE-BRIDGE.md、
 * docs/CLINICAL-DATA-2026.md 与 guidebooks/manifest.json 的登记信息。
 * 只做事实与原文整理，不写判定、不复制指南条文；链接为官方出版方 PDF 直链。
 */
window.DISEASE_PRIMER = {
  brand: '小铁宝 FerroPal',
  name: '重型地中海贫血（输血依赖型）',
  en: 'Transfusion-Dependent Thalassaemia（TDT）',
  updated: '2026-10-27',
  sections: [
    {
      id: 'definition',
      title: '定义',
      intro: '重型地中海贫血（输血依赖型，TDT）是本台记录的疾病对象。'
        + '这一页说明它是什么、依据哪些文件、指南里列了哪些手段、这些年发生了什么变化；不涉及任何个人情况。',
      points: [
        '地中海贫血是一组因珠蛋白生成不足或缺失导致的遗传性贫血，分为 α 地中海贫血与 β 地中海贫血；本仓资料记载我国长江以南 10 个省份是地中海贫血的高发区。',
        '重型 β 地中海贫血常在婴儿期起病，呈慢性进行性贫血；重型 α 地中海贫血通常在宫内或出生后不久死亡。中文指南 #78 在未特别说明时，「地中海贫血（重型）」专指重型 β 地中海贫血。',
        '输血依赖型指需要长期规律红细胞输注维持血红蛋白水平的一类患者。本仓把长期管理的主线整理为四条：输血周期与间隔、血清铁蛋白序列、去铁治疗记录、生长发育曲线。',
        '本台不根据基因型推断输血依赖，也不把 α 与 β、TDT 与 NTDT 混成一个口径。'
      ],
      sources: [
        { org: '国家卫生健康委员会', doc: '86 个罕见病病种诊疗指南（2025 年版）· 78. 地中海贫血（重型）', version: '2025 年版', original: true, kind: 'pdf', url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf', page: 'PDF p470（印刷 p466）' },
        { org: 'Thalassaemia International Federation', doc: 'Guidelines for the Management of Transfusion Dependent Thalassaemia (TDT)', version: '4th Edition, Version 2.0（2021）', original: true, kind: 'pdf', url: 'https://thalassaemia.org.cy/wp-content/uploads/2021/06/TDT-4TH-EDITION-Version-2.0.pdf', page: '页码待核' }
      ]
    },
    {
      id: 'evidence',
      title: '医学资料规范和指南情况',
      intro: '本台出现的每一条「该查什么、按什么节奏」，都应能追到下面某一份文件。'
        + '原件未取得的在表里如实标出，不假装看过；药物获批状态本台未核实。',
      table: {
        head: ['机构', '文件', '版本 / 年份', '原件', '本台的用途'],
        rows: [
          ['国家卫生健康委员会', '86 个罕见病病种诊疗指南（2025 年版）· 78. 地中海贫血（重型）', '2025 年版（517 页；本节 PDF p470–474 = 印刷 p466–470）',
            { text: '已取得：中国政府网官方 PDF', kind: 'pdf', url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf' },
            '中文口径的 G1 出处层来源'],
          ['Thalassaemia International Federation（TIF）', 'Guidelines for the Management of Transfusion Dependent Thalassaemia (TDT)', '4th Edition, Version 2.0（2021，351 页）',
            { text: '已取得：TIF 官方 PDF', kind: 'pdf', url: 'https://thalassaemia.org.cy/wp-content/uploads/2021/06/TDT-4TH-EDITION-Version-2.0.pdf' },
            'TIF 口径的 G1 出处层来源'],
          ['Thalassaemia International Federation（TIF）', 'Management of Transfusion Dependent Thalassaemia (TDT) — A Short Guide', '2nd edition（2022，152 页）',
            { text: '已取得：TIF 官方 PDF', kind: 'pdf', url: 'https://thalassaemia.org.cy/wp-content/uploads/2022/08/TDT-GUIDE-2022-FOR-web.pdf' },
            '同上，短指南口径'],
          ['中华医学会', '重型β地中海贫血诊断和治疗指南（2017年版）', '2017',
            { text: '未取得原件（仅在 #78 参考文献中见到题录）', nolink: true, note: '未取得全文，本台不引用其条文' },
            '本版暂不作引用依据']
        ]
      },
      sources: [
        { org: '国家卫生健康委员会', doc: '86 个罕见病病种诊疗指南（2025 年版）· 78. 地中海贫血（重型）', version: '2025 年版', original: true, kind: 'pdf', url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf', page: 'PDF p470–474（印刷 p466–470）' },
        { org: 'Thalassaemia International Federation', doc: 'Guidelines for the Management of TDT', version: '4th Edition, Version 2.0（2021）', original: true, kind: 'pdf', url: 'https://thalassaemia.org.cy/wp-content/uploads/2021/06/TDT-4TH-EDITION-Version-2.0.pdf', page: '页码待核' },
        { org: 'Thalassaemia International Federation', doc: 'Management of TDT — A Short Guide', version: '2nd edition（2022）', original: true, kind: 'pdf', url: 'https://thalassaemia.org.cy/wp-content/uploads/2022/08/TDT-GUIDE-2022-FOR-web.pdf', page: '页码待核' }
      ]
    },
    {
      id: 'landscape',
      title: '目前治疗全景概要',
      intro: '下面按本仓资料的分类，列出指南里出现过的长期管理手段。'
        + '各项只写「是什么、用在哪一段」，不排序、不比优劣。',
      groups: [
        {
          label: '长期基础治疗',
          points: [
            '规律红细胞输注：用红细胞替代维持血红蛋白水平，按输血周期安排。中文指南与 TIF 指南对间隔和目标区间各有写法，本台并排保留，不合并成一个目标值。',
            '去铁治疗（铁螯合）：用于处理长期输血带来的铁负荷。本仓资料提到的药物包括去铁胺、去铁酮、地拉罗司；具体用药以医嘱为准，本台不载剂量。'
          ]
        },
        {
          label: '监测与随访',
          points: [
            '血清铁蛋白序列：本台只记录报告数值与日期，不画阈值线。',
            '心铁 T2* MRI 与肝铁 LIC：按影像报告原文归档；复查频率按报告与医嘱记录。',
            '生长发育与内分泌筛查：身高体重、甲状腺功能、糖代谢等，按筛查日历记录。',
            '心脏超声与其他年度筛查：只存报告原文，不推算复查时点。'
          ]
        },
        {
          label: '指南列出的其他治疗方向',
          points: [
            '造血干细胞移植：指南列出的治疗手段之一，适应证与时机由医生评估。',
            '脾切除：指南在特定条件下列为考虑项；本台只记事实，不给条件判断。',
            '基因治疗与新型药物：本台尚未整理，未核实。'
          ]
        }
      ],
      points: [
        '以上是文献与指南里列出的手段，按病期与线序排列，不代表任何一项适合你。选哪一个，这一句需要问你的医生。'
      ],
      sources: [
        { org: '国家卫生健康委员会', doc: '86 个罕见病病种诊疗指南（2025 年版）· 78. 地中海贫血（重型）', version: '2025 年版', original: true, kind: 'pdf', url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf', page: 'PDF p470–474（印刷 p466–470）' },
        { org: 'Thalassaemia International Federation', doc: 'Management of TDT — A Short Guide', version: '2nd edition（2022）', original: true, kind: 'pdf', url: 'https://thalassaemia.org.cy/wp-content/uploads/2022/08/TDT-GUIDE-2022-FOR-web.pdf', page: 'P26（印刷 P24）' }
      ]
    },
    {
      id: 'trend',
      title: '发展趋势',
      intro: '只写已经发生的事实，每条带日期或版本号；不预测、不推荐、不评价。',
      points: [
        '2021 年：Thalassaemia International Federation 发布 TDT 指南第 4 版（Version 2.0，351 页）。',
        '2022 年：同一机构发布 TDT 短指南第 2 版（152 页）。',
        '2025 年：国家卫生健康委员会发布《86 个罕见病病种诊疗指南（2025 年版）》（517 页），其中第 78 节为「地中海贫血（重型）」。',
        '2026-10-25：本台临床试验登记通道状态为「未查过」（unified-trial-mcp 本机未安装），因此没有可报告的在研登记数量与阶段分布。'
      ],
      sources: [
        { org: '国家卫生健康委员会', doc: '86 个罕见病病种诊疗指南（2025 年版）· 78. 地中海贫血（重型）', version: '2025 年版', original: true, kind: 'pdf', url: 'https://www.gov.cn/zhengce/zhengceku/202507/P020250710595668350272.pdf', page: '封面与目录' },
        { org: 'Thalassaemia International Federation', doc: 'Guidelines for the Management of TDT', version: '4th Edition, Version 2.0（2021）', original: true, kind: 'pdf', url: 'https://thalassaemia.org.cy/wp-content/uploads/2021/06/TDT-4TH-EDITION-Version-2.0.pdf', page: '版权页' },
        { org: 'Thalassaemia International Federation', doc: 'Management of TDT — A Short Guide', version: '2nd edition（2022）', original: true, kind: 'pdf', url: 'https://thalassaemia.org.cy/wp-content/uploads/2022/08/TDT-GUIDE-2022-FOR-web.pdf', page: '版权页' }
      ]
    }
  ]
}
