# 重型地中海贫血（输血依赖型，TDT）医学证据稿

- 抓取日期：**2026-10-25**（Asia/Shanghai）
- 证据边界：本文只收录**本次实际取到原文/摘要**的内容；未取到的一律写"未取得"，不用"一般认为/临床常用"顶替。
- 不做治疗建议：所有剂量、阈值均为**指南原文摘录**，非处方建议；最终判断由临床医生作出。
- 主要一手来源（均已下载本地 PDF，可复核）：
  - TIF《Guidelines for the Management of Transfusion Dependent Thalassaemia (TDT)》**4th Edition (Version 2.0), 2021**，PDF 351 页，https://thalassaemia.org.cy/wp-content/uploads/2021/06/TDT-4TH-EDITION-Version-2.0.pdf
  - TIF《Management of Transfusion Dependent Thalassaemia (TDT) — A SHORT GUIDE》**2nd edition 2022**（基于上述 4th edition），PDF 152 页，https://thalassaemia.org.cy/wp-content/uploads/2022/08/TDT-GUIDE-2022-FOR-web.pdf
  - Europe PMC REST API（`resultType=core`，仅取 `abstractText`），https://www.ebi.ac.uk/europepmc/webservices/rest/search
- 页码约定：**"PDF 第 N 页"= 下载所得的 PDF 文件页序号**（可用阅读器页码直接跳到）；括注的"印刷页"是该页页脚印的页码，短指南普遍为 `PDF 页 − 2`。两套页码都写在条目里，便于双向核对。

## 概览表

| 主题 | 是否有证据 | 证据等级 / 类型 |
|---|---|---|
| T1 输血治疗 | 有 | 国际指南（TIF 4th ed 2021 + Short Guide 2022），正文+表格 |
| T2 铁负荷监测 | 有 | 国际指南（同上），含 T2* 分级表；+ 队列研究（PMID 19801505） |
| T3 去铁三药 | 有（部分剂量表述受 PDF 表格乱码影响） | 国际指南正文/表格；+ RCT（PMID 16352812、12763939） |
| T4 脾切除 | 有 | 国际指南；+ 文献综述（PMID 11798256） |
| T5 内分泌与生长发育 | 有（部分筛查间隔仅到"每年/每 6 个月"级别） | 国际指南（流行率、甲状腺/糖代谢/生长）；+ 队列（PMID 18505376） |
| T6 心脏并发症 | 有（TAPSE 无指南表述，仅单篇研究） | 国际指南 + AHA 共识（PMID 23775258）；TAPSE：PMID 33953980 |
| T7 输血安全 | 有 | 国际指南（去白细胞、抗原匹配、抗体筛查）；+ 队列（PMID 3920790） |
| T8 治愈性治疗 | 有（中国在研管线未取得） | 国际指南（HSCT/基因治疗）+ NEJM III 期（PMID 34891223、38657265）；EBMT 共识（PMID 24790059） |
| T9 妊娠与生育 | 有 | 国际指南（孕前评估、孕期输血目标、多学科团队） |
| T10 中国可及性 | **无（未取得）** | 无可用核验来源，见末节 |

---

## T1 输血治疗：输血前 Hb 目标、输注量、输血间隔

**结论一句话**：TIF 指南给出的常规区间是**每 2–5 周输注一次、维持输血前 Hb 90–105 g/L**（4th ed 正文写 95–105 g/L），心衰等特殊情况可上调至 110–120 g/L。

- **证据类型**：指南章节 — TIF Short Guide 2022，第 2 章 "Blood transfusion / Transfusion programmes"，PDF 第 26 页（印刷页 24）；TIF 4th ed 2021，同章，PDF 第 44–45 页（印刷页 43–44）。
- **原文摘录**（PDF 26 页）："The recommended treatment for thalassaemia major involves lifelong regular blood transfusions, usually administered every two to five weeks, to maintain the pre-transfusion haemoglobin level 90-105 g/L."
- **原文摘录**（4th ed，PDF 44 页）："…usually administered every two to four weeks, to maintain the pre-transfusion haemoglobin level 95-105 g/l."
- **原文摘录**（4th ed，PDF 45 页）："A higher target pre-transfusion haemoglobin level of 110-120 g/l may be appropriate for patients with heart disease…"
- **输注量（按目标 Hb 升幅与供者红细胞压积查表）**，4th ed PDF 第 45 页 Table 4：目标升 Hb 20 g/l 时，Hct 50%/60%/75%/80% 分别对应 **12 / 10 / 8 / 7.5 ml/kg**；升 30 g/l 对应 18 / 15 / 12 / 11.2 ml/kg；升 40 g/l 对应 24 / 20 / 16 / 15 ml/kg。同页给公式："(Desired – actual Hb (g/l)) x weight (kg) x 0.3 = ml to be transfused assuming the haematocrit of the unit is 0.58"。
- **年输注量参照**：Short Guide PDF 第 28 页（印刷页 26）："as the annual transfusion requirements rise above 200 ml/kg/year of pure red cells, splenectomy may be considered…"；4th ed PDF 第 204 页列各国口径："US: 225-250 ml/kg/yr, Canada: 250-275 ml/kg/yr, UK: 200-220 ml/kg/yr"。
- **是否取得全文**：**是**（两份指南 PDF 全文已下载，可本地复核）。
- **缺口**：Short Guide 与 4th ed 对下限的写法不一致（90 vs 95 g/L），已在上面并列，未做取舍；未取得中国国内输血指南原文，故无中国口径。

---

## T2 铁负荷监测：铁蛋白频率、肝铁/心铁 T2* 频率与判读

**结论一句话**：血清铁蛋白**至少每 3 个月**测一次（目标 500–1000 µg/L）；心肌 T2* 按铁负荷分层复查（>20 ms 每 2 年、10–19 ms 每年、<10 ms 每半年），判读分档为 ≥20 / 10–19 / 6–9 / <6 ms。

- **证据类型**：指南章节 — Short Guide 2022 第 3 章 "Iron overload: pathophysiology, diagnosis and monitoring"，PDF 第 34 页（印刷页 32）与第 36 页（印刷页 34）；分级表注明引自 "Standards for the Clinical Care of Children and Adults with Thalassaemia in the UK (3rd Edition, 2016)"。
- **原文摘录**（PDF 34 页）："SF concentration is measured at least every 3 months (1-3 months). Target value is currently between 500-1000 μg/l."
- **原文摘录**（PDF 36 页，Table 2 分档）："No cardiac iron, low risk of heart failure (HF) ≥ 20 milliseconds / Mild to moderate cardiac iron, low risk of HF 10–19 milliseconds / High cardiac iron, moderate risk of HF 6–9 milliseconds / High cardiac iron, high risk of HF < 6 milliseconds"
- **原文摘录**（PDF 36 页，复查频率）："Stable T2* >20 milliseconds: two yearly / T2* 10- 19 milliseconds: yearly / T2* <10 milliseconds: 6 monthly"
- **原文摘录**（PDF 36 页，起测年龄）："LIC and myocardial iron should be monitored regularly in patients from age 9 or younger if they are able to tolerate MRI scanning without sedation."
- **肝铁判读**：Short Guide PDF 第 61 页（印刷页 59）："LIC values greater than 7 and 15 mg/g dry weight are associated with moderate and severe iron overload, respectively"。
- **T2* 预后证据**：PMID **19801505**，Kirk 等，*Circulation* 2009（652 例 TM、21 中心）——"The relative risk for heart failure with cardiac T2* values <10 ms (compared with >10 ms) was 160 (95% confidence interval, 39 to 653)."
- **是否取得全文**：指南**是**；PMID 19801505 **否**（仅 Europe PMC 摘要，`isOpenAccess: N`）。
- **缺口**：肝铁 LIC 的**单独复查间隔**未在指南正文取到明确数字（未取得）；T2* 与 LIC 的"同步同次"表述有，但肝铁专属频率缺。

---

## T3 去铁治疗三药：剂量、途径、主要不良反应

**结论一句话**：指南列出三种可及螯合剂——DFO 皮下/静注 20–60 mg/kg、5–7 天/周；DFP 口服 75–100 mg/kg/日分 3 次；DFX 口服起始 20 mg/kg/日（按输血频次 10 或 30 mg/kg/日）；DFP 的粒细胞缺乏约 1.7%，DFX 的肌酐升高（≥30%，连续两次）见于 38% 患者。

- **证据类型**：指南章节 — Short Guide 2022 第 4 章 "Iron chelation"，Table 1，PDF 第 38–42 页（印刷页 36–40）；4th ed 2021 第 5 章，PDF 第 82、92–99 页。
- **原文摘录（DFO 剂量/途径）**（Short Guide PDF 40 页 Table 1）："s.c./i.m. or i.v injection — 20-60 mg/kg 5-7 d/week, 50 mg/kg in EU — Children's dose up to 40 mg/kg"
- **原文摘录（DFP 剂量/途径）**（同页）："Oral, tablet or liquid — 75-100 mg/kg/day in 3 divided doses daily"
- **原文摘录（DFX 起始剂量按输血频次）**（4th ed PDF 82 页）："The initial dose of deferasirox (original formulation) was 20 mg/kg/day for patients receiving 2-4 packed red blood cell units/month, and 10 or 30 mg/kg/day for patients receiving less or more frequent transfusions, respectively."
- **原文摘录（DFP 粒细胞缺乏）**（4th ed PDF 97 页）："Agranulocytosis (absolute neutrophil count or ANC <0.5 × 10 9/l) is a serious and potentially fatal adverse event… is reported in approximately 1.7% of patients."
- **原文摘录（DFP 监测节奏）**（4th ed PDF 93 页）："First six months of therapy: Monitor ANC weekly; Next six mont…"（该句在页末被截断，后续内容未取得完整文本）
- **原文摘录（DFX 肾）**（4th ed PDF 99 页）："An increase in serum creatinine ≥30% on at least two consecutive readings was observed in 38% of patients receiving DFX, most frequently at doses of 20 mg/kg and 30 mg/kg of DT"
- **原文摘录（DFX 肾小管）**（同页）："Case reports of renal tubular acidosis (Fanconi syndrome) with electrolyte imbalance, and metabolic acidosis due to tubular dysfunction have been rarely reported…"
- **原文摘录（DFX 肝）**（4th ed PDF 97 页）："the FDA noted that 7.5% of 642 subjects developed increased AL T val…"（页内截断）
- **原文摘录（DFO 眼/耳）**（Short Guide PDF 41 页）："Monitor audiometry regularly, particularly as ferritin falls — Monitor eyes regularly including electroretinography if on high doses"
- **RCT 佐证（DFX vs DFO 3 期）**：PMID **16352812**，*Blood* 2006——"The most common adverse events included rash, gastrointestinal disturbances, and mild nonprogressive increases in serum creatinine."
- **RCT 佐证（DFP 4 年安全性）**：PMID **12763939**，*Blood* 2003——"The rates of agranulocytosis (ANC < 500 x 10(9)/L) and milder forms of neutropenia (ANC, 500-1500 x 10(9)/L) were 0.2 and 2.8 per 100 patient-years, respectively."
- **是否取得全文**：指南**是**；两篇 PMID **否**（仅摘要）。
- **缺口**：① Short Guide 的 Table 1 是多列表格，PDF 文本层因字体子集编码部分乱码（如 DFX 列单元格），**DFX 的完整剂量行未能逐格读出**，只能用 4th ed 正文的 20/10/30 mg/kg/日表述替代；② DFP 在中国、欧盟、美国三地许可差异散落在表内，未取得整格完整表述；③ 未取得三种药物在中国说明书的剂量表述。

---

## T4 脾切除：指征、术前疫苗、术后感染风险

**结论一句话**：指南把脾切除限定为"输血需求量升高（各国口径 200–275 ml/kg/年纯红细胞）且螯合无法维持"等情形，**5 岁以下避免**；术后主要致死风险是肺炎链球菌、b 型流感嗜血杆菌、脑膜炎奈瑟菌感染，需术前疫苗+抗生素预防。

- **证据类型**：指南章节 — Short Guide 2022 第 12 章 "Splenomegaly and splenectomy care"，PDF 第 102–105 页（印刷页 100–103）；4th ed 2021 第 13 章，PDF 第 204–207 页。
- **原文摘录（指征表述）**（Short Guide PDF 103 页，Table 1 注）："Guidelines vary slightly as to what constitutes increased requirements: (US: 225-250 ml/kg/yr; Canada: 250 -275 ml/kg/yr, UK: 200-220 ml/kg/yr). Physicians should make a decision based on all clinical parameters."
- **原文摘录（年龄限制）**（同页）："Splenectomy should be avoided in children less than 5 years of age because of a considerably greater risk of fulminant post-splenectomy sepsis."
- **原文摘录（术后风险病原）**（Short Guide PDF 104 页）："The most frequent pathogens that cause infections in splenectomised patients are Streptococcus pneumoniae, Haemophilus influenzae type b, and Neisseria meningitidis, all of which are associated with a high mortality rate."
- **原文摘录（感染风险时程）**（同页）："The increased risk of infection after splenectomy remains throughout life, but is highest in the first few years post-operatively."
- **原文摘录（疫苗时机）**（4th ed PDF 206 页）："Meningococcal Group C conjugate vaccine 4-6 weeks pre-splenectomy"；同页脚注："Patients undergoing emergency splenectomy can still benefit from vaccination TWO WEEKS post splenectomy."；同页另注："a second pneumococcal vaccine, PCV13, should also be given 2 months prior to the 23 valent vaccine."
- **原文摘录（抗生素预防）**（4th ed PDF 207 页）："life-long prophylactic antibiotics should be offered to patients considered at continued high risk of pneumococcal infection using oral penicillins or macrolides."
- **感染风险量化**：PMID **11798256**，*J Infect* 2001（19,680 例脾切除文献汇总）——"The incidence of infection was highest among patients with thalassemia major (8.2%)… The highest mortality rates were observed among patients with thalassaemia major (5.1%)"。
- **是否取得全文**：指南**是**；PMID 11798256 **否**（仅摘要）。
- **缺口**：Short Guide 的 Table 2（免疫预防表）为图/表混排，文本层部分乱码，**完整疫苗清单与剂次未逐项取得**；已用 4th ed 正文的肺炎球菌/流感/脑膜炎表述替代，Hib 剂次细节未取得。

---

## T5 内分泌与生长发育：筛查项目与频率

**结论一句话**：指南给出 TDT 内分泌并发症的流行率区间（性腺 50–100%、甲状腺 6–35%、糖代谢 10–24%、甲旁减 1–19%），并要求**甲状腺功能自 9 岁起每年查**、**每年 OGTT**、**每 6 个月测身高体重与生长速度**、骨密度与骨代谢标志物年度评估。

- **证据类型**：指南章节 — Short Guide 2022 第 7 章 "Growth abnormalities"、第 8 章 "Endocrine disease"，PDF 第 67–68、75–80 页（印刷页 65–78）；4th ed 2021 第 9–10 章，PDF 第 66、147、155、189 页。
- **原文摘录（流行率）**（Short Guide PDF 75 页）："Delayed puberty and hypogonadism… 50% to 100%… Hypothyroidism: It varies from 6% to 35%… Impaired glucose tolerance and diabetes mellitus… 10% to 24%… Hypoparathyroidism: It varies from 1% to 19%."
- **原文摘录（甲状腺筛查频率）**（Short Guide PDF 77 页）："Investigation of thyroid function should be performed annually, beginning at the age of 9 years (unless symptomatic hypothyroidism is observed)."
- **原文摘录（糖代谢筛查）**（4th ed PDF 66 页）："…diabetes mellitus (yearly oral glucose tolerance test (OGTT)), hypothyroidism and hypoparathyroidism."
- **原文摘录（OGTT 起始年龄）**（4th ed PDF 155 页）："The oral glucose tolerance test (OGTT) should be done in every patient with thalassaemia after the age of ten or earlier if needed"
- **原文摘录（生长监测）**（4th ed PDF 147 页）："Patients' growth should be assessed every 6 months by accurate measurement of standing and sitting height and weight."
- **原文摘录（矮小定义）**（Short Guide PDF 68 页）："Short stature – height below the 3rd centile for sex and age (based on national growth charts), and/or Slow growth rates – growth velocity expressed in cm/year, below 1 SD for age and sex"
- **骨密度证据**：PMID **18505376**，*J Bone Miner Res* 2009（Thalassemia Clinical Research Network，361 例）——"Spine and femur BMD Z-scores < -2 occurred in 46% and 25% of participants, respectively."
- **是否取得全文**：指南**是**；PMID 18505376 **否**（仅摘要）。
- **缺口**：① **甲旁减（PTH）与性腺轴的推荐复查间隔**未在指南正文取到明确"每 N 月"表述（4th ed 附录监测表 PDF 第 350 页把 OGTT/甲状腺/IGF-1/PTH 等列在一起，但频率列与检查项在文本层错行，无法可靠配对，故不引用配对结果）；② 青春期 Tanner 分期的推荐频次未取得明确数字。

---

## T6 心脏并发症：心功能评估、心铁与心衰监测

**结论一句话**：指南要求**每年**做静息 ECG + 经胸超声（含 LVEF 等指标），心铁 T2* 首次在开始输血后 7–10 年、其后每 2 年（并随铁负荷加密）；T2* <10 ms 是最强的心衰预测因子。

- **证据类型**：指南章节 — Short Guide 2022 第 5 章 "Cardiovascular disease"，PDF 第 54–55 页（印刷页 52–53）；4th ed 2021 第 6 章，PDF 第 115、121 页；AHA 共识 PMID 23775258。
- **原文摘录（年度基础评估内容）**（Short Guide PDF 54 页）："The regular annual basic CV assessment consists of (Figure 3): history taking; physical examination; resting electrocardiogram (ECG); transthoracic echocardiography (TTE)."
- **原文摘录（心铁首查时点与复查）**（Short Guide PDF 54–55 页）："Typically, the first MRI T2* scan is performed 7-10 years after the initiation of blood transfusions and repeated every 2 years thereafter."
- **原文摘录（LVEF 与 T2* 的关系）**（Short Guide PDF 52 页）："The risk of LV ejection fraction decline, heart failure and arrhythmias increase with the severity of cardiac iron overload, as evaluated by MRI T2*"
- **原文摘录（4th ed 同期表述）**（PDF 115 页）："Reduction in systolic function in the presence of significant myocardial iron overload (T2* <20ms), from the often supra-normal ejection fraction (EF) associated with thalassaemia (EF >60%), have a potentially dire prognosis."
- **AHA 共识原句**（PMID **23775258**，*Circulation* 2013;128:281-308，Practice Guideline/Consensus Statement）："Cardiac T2* <10 ms is the most important predictor of development of heart failure. Serum ferritin and liver iron concentration are not adequate surrogates for cardiac iron measurement."
- **TAPSE 单篇证据**（PMID **33953980**，*Anemia* 2021，66 例 TDT）："youth and adult TDT patients whose serum ferritin >5000 ng/mL had significantly lower tricuspid annular plane systolic excursion (TAPSE)…"
- **是否取得全文**：指南**是**；两篇 PMID **否**（仅摘要；33953980 标注 `isOpenAccess: Y` 且有 PMCID PMC8062201，但本次未下载全文）。
- **缺口**：**TAPSE 在 TIF 指南全文（两份 PDF）中 0 命中**——即指南未把 TAPSE 写成推荐指标，本主题只能给单篇研究证据，无法给指南级 TAPSE 阈值（未取得）。心衰的超声随访间隔（3/6 个月）只写"按严重程度",无硬性数字。

---

## T7 输血安全：不规则抗体筛查/交叉配血、去白细胞

**结论一句话**：指南要求输**去白细胞红细胞**（每单位残余白细胞 ≤1×10⁶/L），输血前须有**有效的血型与抗体筛查**，并做 ABO + Rh(C,c,D,E,e) + Kell 相容性输注以减少同种免疫。

- **证据类型**：指南章节 — Short Guide 2022 第 2 章 "Blood transfusion"，"Recommended blood products" 与 "Compatibility Testing"，PDF 第 24、26 页（印刷页 22、24）。
- **原文摘录（去白细胞阈值）**（PDF 24 页）："Patients with transfusion dependent thalassaemia should receive leuco reduced packed red blood cells. Reduction to 1 x 106/L or less leucocytes per unit is considered the critical threshold…"
- **原文摘录（过滤方式）**（同页）："Leucoreduction can be achieved by pre-storage, pre-transfusion or bedside filtration with pre-storage filtration being the preferred method."
- **原文摘录（抗原匹配）**（PDF 26 页）："All patients with thalassaemia should be transfused with ABO and Rh (C, c, D, E, e) and Kell compatible blood in order to avoid alloimmunisation against these antigens."
- **原文摘录（抗体筛查前置条件）**（同页）："There should be a valid group and antibody screen available prior to transfusion being administered"
- **原文摘录（初始广谱分型）**（同页）："Before embarking on transfusion therapy, patients should have extended red cell antigen typing that includes at least C, c, D, E, e, and Kell"
- **同种免疫率**：PMID **3920790**，*Transfusion* 1985（意大利 19 中心 1435 例 TM）——"Overall, 5.2 percent of the patients had clinically significant red cell alloantibodies (136 alloantibodies in 74 patients)."
- **是否取得全文**：指南**是**；PMID 3920790 **否**（仅摘要，1985 年文献）。
- **缺口**：中国《临床输血技术规范》等国内文件未取得（未核实）；抗体筛查的**推荐频次**（每次输血前 vs 定期）指南只写"输血前须有有效筛查"，未给固定间隔。

---

## T8 治愈性治疗：HSCT 适应证、基因治疗（含中国在研）

**结论一句话**：指南称**异基因 HSCT 是目前唯一被写明的治愈手段**（今日治愈率 80–90%），并按 Pesaro 危险分层选择；基因治疗方面， lentiviral 产品 Zynteglo 于 2019-06 获欧盟条件性批准，三代产品在 NEJM III 期达到输血独立。

- **证据类型**：指南章节 — Short Guide 2022 第 16 章 "Haematopoietic stem cell transplantation for thalassaemia"（PDF 123–124 页，印刷页 121–122）、第 17 章 "Gene therapy for thalassemia"（PDF 127–128 页，印刷页 125–126）；EBMT 专家共识 PMID 24790059；NEJM 三项 III 期/关键研究。
- **原文摘录（HSCT 地位与疗效）**（Short Guide PDF 123 页）："Up to date, allogeneic haematopoietic stem cell transplantation (HSCT) is the only curative treatment option for thalassaemia major… a cure of thalassemia achieved in 80% to 90% of patients today."
- **原文摘录（危险分层依据）**（Short Guide PDF 124 页）："factors associated with significantly reduced probability of survival included (i) hepatomegaly >2 cm below the costal margin, (ii) portal fibrosis, and (iii) irregular chelation history."
- **EBMT 共识原句**（PMID **24790059**，*Haematologica* 2014，Practice Guideline）："hematopoietic stem cell transplantation is still the only available curative option… more than 90% of patients now survive hematopoietic stem cell transplantation and disease-free survival is around 80%."
- **原文摘录（Zynteglo 欧盟批件）**（Short Guide PDF 128 页）："The European Commission granted conditional approval, in June 2019, for the Bluebird bio gene therapy product… under the commercial name Zynteglo©, to treat transfusion-dependent β+ thalassaemia in patients 12 years and older…"
- **beti-cel III 期**（PMID **34891223**，*N Engl J Med* 2022）："Transfusion independence occurred in 20 of 22 patients who could be evaluated (91%)… The average hemoglobin level during transfusion independence was 11.7 g per deciliter"
- **exa-cel III 期（CRISPR）**（PMID **38657265**，*N Engl J Med* 2024）："A total of 52 patients with transfusion-dependent β-thalassemia received exa-cel and were included in this prespecified interim analysis; the median follow-up was 20.4 months"
- **CRISPR BCL11A 首例**（PMID **33283989**，*N Engl J Med* 2021）："two patients - one with TDT and the other with SCD - received autologous CD34+ cells edited with CRISPR-Cas9 targeting the same BCL11A enhancer."
- **是否取得全文**：指南**是**；三篇 NEJM **否**（仅摘要；均为非 OA）。
- **缺口**：**中国在研基因治疗管线（如国产 BCL11A 编辑、慢病毒载体产品）本次未取得任何可核验来源**——未做 ClinicalTrials.gov/NMPA 检索，写作"未取得"，不列具体产品名。指南的 Pesaro 分层具体生存数字位于 PDF 第 124 页的表格图中，文本层乱码，未引用具体百分比。

---

## T9 妊娠与生育：TDT 女性妊娠的多学科管理

**结论一句话**：指南要求孕前多学科评估（血液、心脏、生殖医学、产科、专科护士），孕期**输血前 Hb 维持在 100 g/L 以上**，并指出**母体最主要风险是心脏并发症**，需孕前优化心功能与铁负荷。

- **证据类型**：指南章节 — Short Guide 2022 第 13 章 "Fertility and pregnancy"，PDF 第 109–114 页（印刷页 107–112）；4th ed 2021 第 14 章，PDF 第 221 页。
- **原文摘录（孕期输血目标）**（4th ed PDF 221 页）："The aim during pregnancy is to maintain pre-transfusion haemoglobin concentration above 100 g/l. Once pregnancy is confirmed, the patient should be managed in a multidisciplinary setting with a team consisting of an obstetrician, midwife, physician, haematologist, cardiologist…"
- **原文摘录（母体主风险）**（Short Guide PDF 113 页）："the main risk to the mother is cardiac complications, which can be minimized by ensuring optimal cardiac function and good control of iron overload before initiation of pregnancy."
- **原文摘录（孕前团队构成）**（Short Guide PDF 109 页）："pre-pregnancy counselling involving the various members of the multidisciplinary team: the haematologist, the reproductive medicine specialist, the cardiologist and the obstetrician, in conjunction with the specialist nurse."
- **原文摘录（孕前评估清单，节选）**（Short Guide PDF 112 页，Table 3）："Cardiac function: ECG, echocardiogram… Iron status assessment and optimisation of iron chelation therapy… Screen for acquired red cell antibodies (risk of haemolytic disease of the fetus and newborn)."
- **原文摘录（产后血栓预防）**（Short Guide PDF 114 页）："Women with thalassaemia should be considered at high risk for venous thromboembolism and should receive low-molecular-weight heparin prophylaxis while in hospital."
- **是否取得全文**：**是**（指南 PDF 全文）。
- **缺口**：Short Guide 的 Table 7「孕期照护要点」整块在 PDF 文本层为字体子集乱码（仅个别词可辨，如 "blood transfusion"、"iron chelation"），**未能逐条取得**；故孕期去铁药停用/重启的具体表述未取得（4th ed 相应段落未逐句核到，不引用）。

---

## T10 中国可及性：已上市去铁药与其他药物

**结论一句话**：**未取得**——本次没有拿到任何可核验的中国上市/批件来源，故不列具体药品名与厂家。

- **证据类型**：无。
- **原文摘录**：无（不引用）。
- **是否取得全文**：否。
- **缺口与原因**：NMPA（nmpa.gov.cn）已知返回 412，按任务约定不再重试；CNKI 不可用；未找到可替代的、能核到"批准文号/上市时间"的中文一手来源。**因此本主题结论为"未核实/未取得"，不写"国内常用地拉罗司/去铁酮"之类无出处表述。**

---

## 未取得清单

| # | 未取得的项目 | 卡在哪 |
|---|---|---|
| 1 | NCCN 地中海贫血指南（任何版本/章节） | NCCN 指南分类页 https://www.nccn.org/guidelines/category_1 可访问（HTTP 200，114,322 字节），但整页 **0 处 "thalass" 匹配**；未取得任何 NCCN 地中海贫血指南文件。**不能据此断言"NCCN 永远没有"**，只能说本次未取得。 |
| 2 | TAPSE 的指南级推荐/阈值 | TIF 4th ed（351 页）与 Short Guide（152 页）全文检索 "TAPSE"/"tricuspid annular"，**0 命中**；仅单篇研究 PMID 33953980 有 TAPSE 数据，无阈值。 |
| 3 | 中国已上市去铁药清单（药名/厂家/批准文号/上市年份） | NMPA 返回 412（任务已标注不可用，未重试）；无替代一手来源。 |
| 4 | 中国在研基因治疗管线（产品代号、期别、注册号） | 未检索 ClinicalTrials.gov / 药企公告；Europe PMC 亦未取到可核验的中国管线论文。 |
| 5 | TIF Short Guide Table 1（三药完整剂量/监测表）逐格文本 | PDF 文本层字体子集编码，DFX 列等单元格乱码；只能引用可读正文（20/10/30 mg/kg/日）。 |
| 6 | TIF Short Guide Table 7（孕期照护要点）逐条 | 同上，整块乱码，仅个别词可辨。 |
| 7 | TIF Short Guide Table 2（脾切除免疫预防表）完整疫苗清单与剂次 | 表为图文混排，文本层部分乱码；已用 4th ed 正文替代部分内容。 |
| 8 | 4th ed 附录「GENERAL TIMETABLE」（PDF 349–350 页）中"检查项 ↔ 频率"的可靠配对 | 表格多列，文本提取后列错行（3-Monthly/6-Monthly/12-Monthly 与检查项无法可靠对齐）；**为避免编造，本文不引用该表的配对结果**。 |
| 9 | 肝铁 LIC 的单独复查间隔（明确数字） | 指南正文只给"regular LIC assessment"与 T2* 分层频率，LIC 专属间隔未取到。 |
| 10 | 甲旁减（PTH）/性腺轴的推荐筛查间隔 | 指南正文无"每 N 月"表述；附录表错行无法引用。 |
| 11 | DFP 粒细胞缺乏监测的完整表述（6 个月后如何） | 4th ed PDF 93 页该句在页末截断（"Next six mont…"），后续页未逐句核到。 |
| 12 | 各指南/共识的**全文 PDF**（PMID 23775258、19801505、16352812、12763939、11798256、18505376、3920790、24790059、34891223、38657265、33283989、33953980） | Europe PMC 仅给 `abstractText`；多数标注 `isOpenAccess: N`，未下载出版社全文。**所有引用均限于摘要原句。** |
| 13 | 中国输血/地贫诊疗指南（任何中文官方文件） | 未取得；CNKI 不可用，未找到可访问的中文一手 PDF。 |
| 14 | 妊娠期去铁药停用/重启的指南原句 | Short Guide Table 7 乱码；4th ed 对应段落未逐句核到，不引用。 |

---

## 复核方式（给下游用）

1. 下载两份 TIF PDF（URL 见文首），按"PDF 第 N 页"跳页即可看到本文每条摘录。
2. PMID 条目可用 `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=EXT_ID:<PMID>%20AND%20SRC:MED&format=json&resultType=core` 复核 `abstractText` 原句。
3. 所有摘录均为**逐字**（含原文的拼写/空格异常，如 "AL T"、"leuco reduced"），未做润色；`…` 表示省略，不代表原文有省略号。
