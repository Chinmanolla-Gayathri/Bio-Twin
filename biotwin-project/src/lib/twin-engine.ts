import {
  type TwinInputs,
  type SimulationState,
  type Severity,
  type OrganId,
  type DiseaseTendency,
  type ActiveTreatment,
  type TreatmentEffects,
  type TreatmentResponse,
  type AIRecommendation,
  ORGAN_META,
  severityFromHealth,
} from "./twin-types";

const clamp = (v: number, a = 0, b = 1) => Math.max(a, Math.min(b, v));

/**
 * Simulate the body forward `day` days based on inputs, including treatment effects.
 * Health Score: 100 = perfectly healthy, 0 = critically damaged.
 * Decay accumulates over time from lifestyle factors.
 * Treatments can reverse decay when applied.
 */
export function simulate(
  inputs: TwinInputs,
  day: number,
  activeTreatments: ActiveTreatment[] = [],
): SimulationState {
  const t = clamp(day / 60, 0, 1); // 0..1 over 60 days

  // ---- Body metrics
  const heightM = inputs.height / 100;
  const tdee =
    10 * inputs.weight + 6.25 * inputs.height - 5 * inputs.age + (inputs.gender === "male" ? 5 : -161);
  const activityMult = 1.2 + inputs.exercise * 0.12;
  const maintenance = tdee * activityMult;
  const dailyDelta = inputs.calories - maintenance;
  const kgChange = (dailyDelta * day) / 7700;
  const projectedWeight = inputs.weight + kgChange;
  const bmi = projectedWeight / (heightM * heightM);
  const fatLevel = clamp((bmi - 22) / 10, -1, 1);

  const sleepDeficit = clamp((7.5 - inputs.sleep) / 4);
  const waterDeficit = clamp((2.2 - inputs.water) / 2);
  const fatigueBase =
    sleepDeficit * 0.5 + (inputs.stress / 10) * 0.35 + waterDeficit * 0.2 + (inputs.alcohol / 30) * 0.2;
  const fatigue = clamp(fatigueBase * (0.6 + 0.6 * t));

  const skinDull = clamp(
    (inputs.smoking / 30) * 0.4 + (inputs.alcohol / 30) * 0.25 + waterDeficit * 0.25 + fatigue * 0.3,
  );
  const posture = clamp(fatigue * 0.6 + Math.max(0, fatLevel) * 0.4);
  const breathing = clamp(
    (inputs.smoking / 30) * 0.5 + Math.max(0, fatLevel) * 0.4 + (inputs.exercise < 1 ? 0.2 : 0),
  );

  const darkCircles = clamp(
    sleepDeficit * 0.35 + fatigue * 0.30 + skinDull * 0.20 + (inputs.stress / 10) * 0.15,
  );

  // ---- Condition modifiers (preset)
  const hasCondition = (name: string) =>
    inputs.conditions.includes(name) || inputs.customConditions.includes(name);
  const condHypertension = hasCondition("Hypertension") ? 0.25 : 0;
  const condDiabetes = hasCondition("Diabetes") ? 0.25 : 0;
  const condAsthma = hasCondition("Asthma") ? 0.30 : 0;
  const condAnxiety = hasCondition("Anxiety") ? 0.20 : 0;
  const condPCOS = hasCondition("PCOS") ? 0.20 : 0;

  // ---- Custom condition modifiers (keyword-based detection)
  const allCustom = [...inputs.customConditions, ...inputs.conditions];
  const notesLower = inputs.notes.toLowerCase();

  // Detect additional conditions from custom text
  const condMigraine = allCustom.some((c) => c.toLowerCase().includes("migraine") || c.toLowerCase().includes("headache")) ? 0.15 : 0;
  const condArthritis = allCustom.some((c) => c.toLowerCase().includes("arthritis") || c.toLowerCase().includes("joint")) ? 0.15 : 0;
  const condDepression = allCustom.some((c) => c.toLowerCase().includes("depression") || c.toLowerCase().includes("depressed")) ? 0.20 : 0;
  const condCOPD = allCustom.some((c) => c.toLowerCase().includes("copd") || c.toLowerCase().includes("chronic bronchitis")) ? 0.30 : 0;
  const condThyroid = allCustom.some((c) => c.toLowerCase().includes("thyroid") || c.toLowerCase().includes("hypothyroid") || c.toLowerCase().includes("hyperthyroid")) ? 0.15 : 0;
  const condObesity = allCustom.some((c) => c.toLowerCase().includes("obesity") || c.toLowerCase().includes("obese")) ? 0.20 : 0;
  const condHeartDisease = allCustom.some((c) => c.toLowerCase().includes("heart disease") || c.toLowerCase().includes("cardiovascular")) ? 0.25 : 0;
  const condKidneyDisease = allCustom.some((c) => c.toLowerCase().includes("kidney disease") || c.toLowerCase().includes("renal")) ? 0.25 : 0;
  const condUlcer = allCustom.some((c) => c.toLowerCase().includes("ulcer") || c.toLowerCase().includes("gastritis")) ? 0.15 : 0;

  // Detect from notes field too
  const notesHasHeartHistory = notesLower.includes("family history of heart") || notesLower.includes("heart disease runs");
  const notesHasDiabetesHistory = notesLower.includes("family history of diabetes") || notesLower.includes("diabetes runs");
  const notesHasCancerHistory = notesLower.includes("family history of cancer") || notesLower.includes("cancer runs");
  const notesHasJointPain = notesLower.includes("joint pain") || notesLower.includes("knee pain") || notesLower.includes("back pain");
  const notesHasBreathing = notesLower.includes("shortness of breath") || notesLower.includes("breathing difficulty");

  // ---- Organ decay (0 = no damage, 1 = critical damage)
  const dmg = (raw: number) => clamp(raw * (0.5 + 0.7 * t));

  const lungsDmg = (inputs.smoking / 25) * 0.9 + (inputs.exercise < 1 ? 0.15 : 0) + condAsthma + condCOPD + (notesHasBreathing ? 0.10 : 0);
  const liverDmg = (inputs.alcohol / 20) * 0.85 + (inputs.calories > maintenance + 600 ? 0.2 : 0) + condDiabetes * 0.3 + condObesity * 0.15 + condThyroid * 0.10;
  const heartDmg =
    Math.max(0, fatLevel) * 0.4 + (inputs.smoking / 30) * 0.35 + (inputs.stress / 10) * 0.25 +
    (inputs.exercise < 1 ? 0.2 : -0.1) + condHypertension + condHeartDisease +
    (notesHasHeartHistory ? 0.10 : 0);
  const brainDmg = (inputs.stress / 10) * 0.5 + sleepDeficit * 0.5 + (inputs.alcohol / 30) * 0.15 + condAnxiety + condDepression + condMigraine;
  const kidneysDmg = waterDeficit * 0.6 + (inputs.alcohol / 30) * 0.3 + Math.max(0, fatLevel) * 0.2 + condDiabetes * 0.2 + condHypertension * 0.2 + condKidneyDisease;
  const stomachDmg =
    (inputs.stress / 10) * 0.35 + (inputs.calories > maintenance + 800 ? 0.3 : 0) +
    (inputs.alcohol / 30) * 0.2 + condAnxiety * 0.15 + condUlcer;
  const reproDmg = (inputs.smoking / 30) * 0.3 + (inputs.alcohol / 30) * 0.3 + fatigue * 0.3 + condPCOS + condThyroid * 0.10;

  // ===== IMPROVED, MORE ACCURATE ORGAN DECAY REASONS =====
  const causes: Record<OrganId, string> = {
    brain: buildBrainCause(inputs, condAnxiety, condDepression, condMigraine, sleepDeficit, notesLower),
    heart: buildHeartCause(inputs, condHypertension, condHeartDisease, notesHasHeartHistory, fatLevel, maintenance),
    lungs: buildLungsCause(inputs, condAsthma, condCOPD, notesHasBreathing),
    liver: buildLiverCause(inputs, condDiabetes, condObesity, maintenance),
    kidneys: buildKidneysCause(inputs, condKidneyDisease, condHypertension, waterDeficit),
    stomach: buildStomachCause(inputs, condUlcer, maintenance),
    reproductive: buildReproCause(inputs, condPCOS, condThyroid, fatigue),
  };

  // Convert damage to health score (100-based)
  const raws: Record<OrganId, number> = {
    brain: brainDmg,
    heart: heartDmg,
    lungs: lungsDmg,
    liver: liverDmg,
    kidneys: kidneysDmg,
    stomach: stomachDmg,
    reproductive: reproDmg,
  };

  // ===== TREATMENT EFFECTS =====
  const treatmentEffects = calculateTreatmentEffects(raws, dmg, activeTreatments, day, t);

  const organs = {} as SimulationState["organs"];
  (Object.keys(raws) as OrganId[]).forEach((id) => {
    const baseDecay = dmg(raws[id]);
    // Apply treatment reversal
    const treatmentImprovement = treatmentEffects.organImprovements[id] || 0;
    const effectiveDecay = Math.max(0, baseDecay - treatmentImprovement / 100);
    const healthScore = Math.round(Math.max(0, Math.min(100, (1 - effectiveDecay) * 100 + treatmentImprovement * 0.3)));

    // Build treatment response info
    const organTreatments = activeTreatments.filter(at =>
      at.treatment.targetOrgans.includes(id) && day >= at.startDay
    );
    const treatmentResponse: TreatmentResponse | undefined = organTreatments.length > 0 ? {
      isReceivingTreatment: true,
      activeTreatments: organTreatments.map(at => at.treatment.name),
      healthImprovement: Math.round(treatmentImprovement),
      reversalRate: organTreatments.reduce((sum, at) => {
        const daysOnTreatment = Math.max(0, day - at.startDay);
        const rampUp = clamp(daysOnTreatment / at.treatment.duration);
        return sum + at.treatment.effectiveness * at.adherence * rampUp * 0.5;
      }, 0),
      projectedRecovery: Math.min(100, healthScore + Math.round(treatmentImprovement * 1.5)),
    } : undefined;

    organs[id] = {
      id,
      name: ORGAN_META[id].name,
      healthScore,
      decay: effectiveDecay,
      severity: severityFromHealth(healthScore),
      cause: causes[id],
      advice: ORGAN_META[id].defaultAdvice,
      treatmentResponse,
    };
  });

  const risks = {
    obesity: clamp((bmi - 24) / 10 + Math.max(0, dailyDelta) / 1500 + condDiabetes * 0.15 + condObesity * 0.2),
    heart: clamp((heartDmg + condHypertension * 0.3 + condHeartDisease * 0.3) * (0.7 + 0.6 * t)),
    diabetes: clamp(
      Math.max(0, fatLevel) * 0.5 + (inputs.exercise < 1 ? 0.2 : 0) +
        (inputs.calories > maintenance + 400 ? 0.3 : 0) + condDiabetes * 0.3 + condObesity * 0.15 +
        (notesHasDiabetesHistory ? 0.15 : 0),
    ),
  };

  // ---- Disease tendency predictions ----
  const diseaseTendencies = predictDiseaseTendencies(inputs, bmi, fatLevel, fatigue, t, notesLower, risks);

  return {
    body: { bmi, fatLevel, fatigue, skinDull, posture, breathing, darkCircles },
    organs,
    risks,
    diseaseTendencies,
    treatmentEffects,
  };
}

// ===== DETAILED ORGAN CAUSE BUILDERS =====

function buildBrainCause(
  inputs: TwinInputs,
  condAnxiety: number,
  condDepression: number,
  condMigraine: number,
  sleepDeficit: number,
  _notesLower: string,
): string {
  const factors: string[] = [];

  if (inputs.stress > 7) {
    factors.push("chronic high stress elevating cortisol levels, impairing hippocampal neurogenesis and prefrontal cortex function");
  } else if (inputs.stress > 4) {
    factors.push("moderate stress increasing cortisol baseline, gradually reducing cognitive reserve");
  }

  if (inputs.sleep < 5) {
    factors.push("severe sleep deprivation preventing glymphatic clearance of beta-amyloid and tau proteins");
  } else if (inputs.sleep < 7) {
    factors.push("insufficient sleep reducing glymphatic system efficiency and memory consolidation");
  }

  if (inputs.alcohol > 10) {
    factors.push("heavy alcohol consumption causing neuroinflammation and excitotoxic damage to GABAergic neurons");
  } else if (inputs.alcohol > 4) {
    factors.push("regular alcohol intake subtly altering neurotransmitter balance");
  }

  if (condAnxiety > 0) factors.push("clinical anxiety maintaining HPA axis hyperactivation and amygdala sensitization");
  if (condDepression > 0) factors.push("depression reducing BDNF (brain-derived neurotrophic factor) production and serotonergic tone");
  if (condMigraine > 0) factors.push("migraine pathophysiology causing cortical spreading depression and trigeminal nerve sensitization");

  if (factors.length === 0) {
    return inputs.stress > 3 || inputs.sleep < 7
      ? "Suboptimal stress-sleep balance gradually reducing neural plasticity and cognitive resilience"
      : "Normal age-related neural processing within expected parameters";
  }
  return factors.join("; ");
}

function buildHeartCause(
  inputs: TwinInputs,
  condHypertension: number,
  condHeartDisease: number,
  notesHasHeartHistory: boolean,
  fatLevel: number,
  maintenance: number,
): string {
  const factors: string[] = [];

  if (fatLevel > 0.5) {
    factors.push("significant visceral adiposity increasing cardiac workload and promoting atherogenic dyslipidemia");
  } else if (fatLevel > 0.2) {
    factors.push("elevated body fat contributing to increased cardiac output demand and early atherosclerotic changes");
  }

  if (inputs.smoking > 10) {
    factors.push("heavy smoking causing endothelial dysfunction, carbon monoxide-induced myocardial hypoxia, and accelerated plaque formation");
  } else if (inputs.smoking > 0) {
    factors.push("smoking introducing carboxyhemoglobin and free radicals that damage coronary endothelium");
  }

  if (inputs.stress > 7) {
    factors.push("sustained high stress activating the sympathetic nervous system, causing persistent tachycardia and vasoconstriction");
  } else if (inputs.stress > 4) {
    factors.push("moderate stress contributing to sympathetic overdrive and elevated resting heart rate");
  }

  if (inputs.exercise < 1) {
    factors.push("sedentary lifestyle reducing cardiorespiratory fitness (VO2max decline) and promoting cardiac remodeling");
  }

  if (condHypertension > 0) factors.push("existing hypertension causing left ventricular hypertrophy and increased afterload");
  if (condHeartDisease > 0) factors.push("diagnosed cardiovascular disease with ongoing myocardial strain and remodeling");
  if (notesHasHeartHistory) factors.push("genetic predisposition to coronary artery disease from family history");

  if (factors.length === 0) return "Cardiovascular system functioning within normal hemodynamic parameters";
  return factors.join("; ");
}

function buildLungsCause(
  inputs: TwinInputs,
  condAsthma: number,
  condCOPD: number,
  notesHasBreathing: boolean,
): string {
  const factors: string[] = [];

  if (inputs.smoking > 15) {
    factors.push("heavy smoking destroying alveolar septae and impairing mucociliary clearance, accelerating emphysematous changes");
  } else if (inputs.smoking > 0) {
    factors.push(`smoking ${inputs.smoking} cigarettes/day depositing tar and paralyzing ciliary epithelium, reducing airway clearance`);
  }

  if (inputs.exercise < 1) {
    factors.push("sedentary lifestyle reducing tidal volume and vital capacity, promoting atelectasis in basal lung segments");
  }

  if (condAsthma > 0) factors.push("asthma causing chronic airway inflammation, eosinophilic infiltration, and bronchial hyperresponsiveness");
  if (condCOPD > 0) factors.push("COPD with irreversible airflow limitation, loss of elastic recoil, and air trapping");
  if (notesHasBreathing) factors.push("reported dyspnea suggesting compromised pulmonary gas exchange efficiency");

  if (factors.length === 0) return "Pulmonary function within normal spirometric parameters";
  return factors.join("; ");
}

function buildLiverCause(
  inputs: TwinInputs,
  condDiabetes: number,
  condObesity: number,
  maintenance: number,
): string {
  const factors: string[] = [];

  if (inputs.alcohol > 14) {
    factors.push("heavy alcohol consumption driving hepatic stellate cell activation, progressing from steatosis toward fibrosis/cirrhosis");
  } else if (inputs.alcohol > 4) {
    factors.push("regular alcohol intake causing oxidative stress in hepatocytes and depleting glutathione reserves");
  }

  if (inputs.calories > maintenance + 600) {
    factors.push("significant caloric surplus promoting hepatic de novo lipogenesis and non-alcoholic fatty liver disease (NAFLD)");
  } else if (inputs.calories > maintenance + 300) {
    factors.push("moderate caloric excess contributing to intrahepatic lipid accumulation");
  }

  if (condDiabetes > 0) factors.push("diabetes causing insulin resistance-driven hepatosteatosis and progression to NASH");
  if (condObesity > 0) factors.push("obesity-associated chronic inflammation activating Kupffer cells and promoting hepatic insulin resistance");

  if (factors.length === 0) return "Hepatic function within normal enzymatic and synthetic parameters";
  return factors.join("; ");
}

function buildKidneysCause(
  inputs: TwinInputs,
  condKidneyDisease: number,
  condHypertension: number,
  waterDeficit: number,
): string {
  const factors: string[] = [];

  if (waterDeficit > 0.6) {
    factors.push("significant chronic dehydration reducing GFR and concentrating nephrotoxic substances in renal tubules");
  } else if (waterDeficit > 0.3) {
    factors.push("inadequate hydration impairing optimal glomerular filtration and tubular function");
  }

  if (inputs.alcohol > 8) {
    factors.push("alcohol acting as a diuretic while also increasing uric acid production, straining renal filtration");
  } else if (inputs.alcohol > 0) {
    factors.push("regular alcohol consumption increasing renal processing load");
  }

  if (inputs.smoking > 10) {
    factors.push("smoking causing renal vasoconstriction and accelerating glomerulosclerosis");
  }

  if (condKidneyDisease > 0) factors.push("existing kidney disease with progressive nephron loss and declining filtration capacity");
  if (condHypertension > 0) factors.push("hypertension causing glomerular capillary hypertension and progressive nephrosclerosis");

  if (factors.length === 0) return "Renal function within normal GFR and creatinine clearance parameters";
  return factors.join("; ");
}

function buildStomachCause(
  inputs: TwinInputs,
  condUlcer: number,
  maintenance: number,
): string {
  const factors: string[] = [];

  if (inputs.stress > 7) {
    factors.push("severe stress activating vagal pathways, increasing gastric acid secretion and reducing mucosal blood flow");
  } else if (inputs.stress > 4) {
    factors.push("moderate stress altering gut-brain axis signaling and gastric motility patterns");
  }

  if (inputs.calories > maintenance + 800) {
    factors.push("excessive caloric intake causing gastric distension and delaying gastric emptying");
  } else if (inputs.calories > maintenance + 400) {
    factors.push("caloric surplus disrupting normal gastric rhythm and acid-base balance");
  }

  if (inputs.alcohol > 8) {
    factors.push("heavy alcohol irritating gastric mucosa and disrupting the mucus-bicarbonate barrier");
  } else if (inputs.alcohol > 2) {
    factors.push("regular alcohol intake increasing gastric acid production and reducing mucosal protection");
  }

  if (condUlcer > 0) factors.push("existing ulcer/gastritis with compromised mucosal integrity and H. pylori-associated inflammation");

  if (factors.length === 0) return "Gastrointestinal function within normal digestive parameters";
  return factors.join("; ");
}

function buildReproCause(
  inputs: TwinInputs,
  condPCOS: number,
  condThyroid: number,
  fatigue: number,
): string {
  const factors: string[] = [];

  if (inputs.smoking > 10) {
    factors.push("heavy smoking introducing reproductive toxins that impair gametogenesis and hormonal synthesis");
  } else if (inputs.smoking > 0) {
    factors.push("smoking-associated oxidative stress affecting reproductive hormone receptors");
  }

  if (inputs.alcohol > 10) {
    factors.push("heavy alcohol disrupting HPG axis signaling and causing direct gonadal toxicity");
  } else if (inputs.alcohol > 4) {
    factors.push("regular alcohol intake altering estrogen/testosterone metabolism");
  }

  if (fatigue > 0.6) {
    factors.push("high fatigue indicating HPA axis dysregulation that suppresses GnRH pulsatility and reproductive hormone output");
  } else if (fatigue > 0.3) {
    factors.push("moderate fatigue subtly affecting hormonal balance and reproductive function");
  }

  if (condPCOS > 0) factors.push("PCOS causing hyperandrogenism, anovulation, and insulin resistance affecting ovarian function");
  if (condThyroid > 0) factors.push("thyroid dysfunction disrupting the hypothalamic-pituitary-gonadal axis and sex hormone binding globulin production");

  if (factors.length === 0) return "Reproductive system within normal hormonal and functional parameters";
  return factors.join("; ");
}

// ===== TREATMENT EFFECT CALCULATION =====

function calculateTreatmentEffects(
  raws: Record<OrganId, number>,
  dmg: (raw: number) => number,
  activeTreatments: ActiveTreatment[],
  currentDay: number,
  timeProgress: number,
): TreatmentEffects {
  const organImprovements: Record<OrganId, number> = {
    brain: 0, heart: 0, lungs: 0, liver: 0, kidneys: 0, stomach: 0, reproductive: 0,
  };

  activeTreatments.forEach((at) => {
    const daysOnTreatment = Math.max(0, currentDay - at.startDay);
    if (daysOnTreatment <= 0) return;

    // Treatment ramp-up: effectiveness increases over duration until full effect
    const rampUp = clamp(daysOnTreatment / at.treatment.duration);
    // Base improvement from this treatment
    const baseImprovement = at.treatment.effectiveness * at.adherence * rampUp * 25; // max ~25 points per treatment

    at.treatment.targetOrgans.forEach((organId) => {
      // Only improve organs that have actual damage
      const currentDecay = dmg(raws[organId]);
      if (currentDecay > 0) {
        // Improvement scales with how much damage exists (treatments are more effective when there's more to fix)
        const damageFactor = clamp(currentDecay * 1.5);
        organImprovements[organId] += baseImprovement * damageFactor;
      }
    });
  });

  // Cap improvements
  (Object.keys(organImprovements) as OrganId[]).forEach((id) => {
    organImprovements[id] = Math.min(40, organImprovements[id]); // Max 40 points improvement per organ
  });

  const totalImprovement = Object.values(organImprovements).reduce((a, b) => a + b, 0) / 7;

  // Risk reductions from treatments
  const riskReductions = {
    obesity: clamp(activeTreatments.filter(at => at.treatment.id === "mediterranean_diet" || at.treatment.id === "cardio_exercise")
      .reduce((sum, at) => sum + at.treatment.effectiveness * at.adherence * 0.15, 0)),
    heart: clamp(activeTreatments.filter(at => at.treatment.targetOrgans.includes("heart"))
      .reduce((sum, at) => sum + at.treatment.effectiveness * at.adherence * 0.12, 0)),
    diabetes: clamp(activeTreatments.filter(at => at.treatment.targetOrgans.includes("liver") || at.treatment.id === "insulin_sensitizer")
      .reduce((sum, at) => sum + at.treatment.effectiveness * at.adherence * 0.10, 0)),
  };

  return {
    totalImprovement: Math.round(totalImprovement),
    organImprovements: Object.fromEntries(
      Object.entries(organImprovements).map(([k, v]) => [k, Math.round(v)])
    ) as Record<OrganId, number>,
    riskReductions,
  };
}

/**
 * Predict disease tendencies based on current parameters.
 */
function predictDiseaseTendencies(
  inputs: TwinInputs,
  bmi: number,
  fatLevel: number,
  fatigue: number,
  timeProgress: number,
  notesLower: string,
  risks: { obesity: number; heart: number; diabetes: number },
): DiseaseTendency[] {
  const tendencies: DiseaseTendency[] = [];
  const hasCondition = (name: string) =>
    inputs.conditions.includes(name) || inputs.customConditions.some((c) => c.toLowerCase().includes(name.toLowerCase()));
  const isFemale = inputs.gender === "female";

  // --- Hypertension tendency ---
  if (!hasCondition("Hypertension")) {
    const tendency = clamp(
      (inputs.stress / 10) * 0.3 +
      Math.max(0, fatLevel) * 0.25 +
      (inputs.smoking / 30) * 0.2 +
      (inputs.alcohol / 30) * 0.15 +
      (inputs.age > 45 ? 0.15 : inputs.age > 35 ? 0.08 : 0) +
      (bmi > 28 ? 0.15 : bmi > 25 ? 0.08 : 0) +
      (notesLower.includes("family history of heart") || notesLower.includes("hypertension") ? 0.15 : 0),
    );
    if (tendency > 0.1) {
      tendencies.push({
        name: "Hypertension",
        tendency,
        reason: buildTendencyReason(tendency, [
          [inputs.stress > 6, "high stress levels"],
          [bmi > 28, "elevated BMI"],
          [inputs.smoking > 5, "smoking habit"],
          [inputs.alcohol > 8, "regular alcohol consumption"],
          [inputs.age > 45, "age factor (>45)"],
          [notesLower.includes("family history of heart"), "family history"],
        ]),
        category: "lifestyle",
      });
    }
  }

  // --- Type 2 Diabetes tendency ---
  if (!hasCondition("Diabetes")) {
    const tendency = clamp(
      Math.max(0, fatLevel) * 0.35 +
      (inputs.exercise < 1 ? 0.2 : inputs.exercise < 2 ? 0.1 : 0) +
      (inputs.calories > 2800 ? 0.2 : inputs.calories > 2400 ? 0.1 : 0) +
      (bmi > 30 ? 0.2 : bmi > 27 ? 0.12 : 0) +
      (inputs.age > 40 ? 0.12 : 0) +
      (notesLower.includes("family history of diabetes") ? 0.2 : 0),
    );
    if (tendency > 0.1) {
      tendencies.push({
        name: "Type 2 Diabetes",
        tendency,
        reason: buildTendencyReason(tendency, [
          [bmi > 28, "high BMI"],
          [inputs.exercise < 2, "low physical activity"],
          [inputs.calories > 2600, "high caloric intake"],
          [notesLower.includes("family history of diabetes"), "family history"],
          [inputs.age > 40, "age factor"],
        ]),
        category: "lifestyle",
      });
    }
  }

  // --- COPD / Lung disease tendency ---
  if (!hasCondition("Asthma") && !hasCondition("COPD")) {
    const tendency = clamp(
      (inputs.smoking / 20) * 0.6 +
      (inputs.exercise < 1 ? 0.12 : 0) +
      (inputs.age > 50 ? 0.1 : 0) +
      (fatigue > 0.5 ? 0.1 : 0),
    );
    if (tendency > 0.1) {
      tendencies.push({
        name: "COPD / Chronic Lung Disease",
        tendency,
        reason: buildTendencyReason(tendency, [
          [inputs.smoking > 0, `smoking ${inputs.smoking}/day`],
          [inputs.exercise < 1, "sedentary lifestyle"],
          [inputs.age > 50, "age factor"],
        ]),
        category: "lifestyle",
      });
    }
  }

  // --- Anxiety / Depression tendency ---
  if (!hasCondition("Anxiety") && !hasCondition("Depression")) {
    const tendency = clamp(
      (inputs.stress / 10) * 0.4 +
      (inputs.sleep < 6 ? 0.25 : inputs.sleep < 7 ? 0.12 : 0) +
      (inputs.alcohol > 10 ? 0.15 : 0) +
      (inputs.exercise < 1 ? 0.1 : 0),
    );
    if (tendency > 0.1) {
      tendencies.push({
        name: "Anxiety / Depression",
        tendency,
        reason: buildTendencyReason(tendency, [
          [inputs.stress > 6, "elevated stress"],
          [inputs.sleep < 7, "insufficient sleep"],
          [inputs.alcohol > 8, "alcohol as coping mechanism"],
          [inputs.exercise < 1, "lack of exercise (natural mood booster)"],
        ]),
        category: "lifestyle",
      });
    }
  }

  // --- Liver Disease (Cirrhosis/NAFLD) tendency ---
  const tendencyLiver = clamp(
    (inputs.alcohol / 15) * 0.5 +
    Math.max(0, fatLevel) * 0.25 +
    (inputs.calories > maintenance(inputs) + 600 ? 0.15 : 0) +
    (bmi > 30 ? 0.15 : 0),
  );
  if (tendencyLiver > 0.15) {
    tendencies.push({
      name: "Fatty Liver / Cirrhosis",
      tendency: tendencyLiver,
      reason: buildTendencyReason(tendencyLiver, [
        [inputs.alcohol > 8, `alcohol ${inputs.alcohol}/week`],
        [bmi > 28, "elevated BMI"],
        [inputs.calories > 2600, "excess caloric intake"],
      ]),
      category: "lifestyle",
    });
  }

  // --- Kidney Disease tendency ---
  const tendencyKidney = clamp(
    (inputs.water < 1.5 ? 0.25 : inputs.water < 2 ? 0.12 : 0) +
    (inputs.alcohol / 30) * 0.2 +
    (inputs.smoking / 30) * 0.1 +
    (bmi > 30 ? 0.12 : 0) +
    (hasCondition("Hypertension") ? 0.15 : 0) +
    (hasCondition("Diabetes") ? 0.15 : 0),
  );
  if (tendencyKidney > 0.15) {
    tendencies.push({
      name: "Chronic Kidney Disease",
      tendency: tendencyKidney,
      reason: buildTendencyReason(tendencyKidney, [
        [inputs.water < 2, "low hydration"],
        [inputs.alcohol > 5, "alcohol consumption"],
        [hasCondition("Hypertension"), "existing hypertension"],
        [hasCondition("Diabetes"), "existing diabetes"],
      ]),
      category: "lifestyle",
    });
  }

  // --- Obesity tendency ---
  if (!hasCondition("Obesity") && bmi < 30) {
    const tendency = clamp(risks.obesity);
    if (tendency > 0.15) {
      tendencies.push({
        name: "Obesity",
        tendency,
        reason: buildTendencyReason(tendency, [
          [bmi > 25, "already overweight"],
          [inputs.calories > 2600, "caloric surplus"],
          [inputs.exercise < 2, "low physical activity"],
        ]),
        category: "lifestyle",
      });
    }
  }

  // --- PCOS tendency (female only) ---
  if (isFemale && !hasCondition("PCOS")) {
    const tendency = clamp(
      (bmi > 28 ? 0.2 : bmi > 25 ? 0.1 : 0) +
      (inputs.stress > 6 ? 0.12 : 0) +
      (fatLevel > 0.3 ? 0.15 : 0) +
      (inputs.age >= 18 && inputs.age <= 45 ? 0.08 : 0),
    );
    if (tendency > 0.1) {
      tendencies.push({
        name: "PCOS",
        tendency,
        reason: buildTendencyReason(tendency, [
          [bmi > 25, "elevated BMI is a risk factor"],
          [inputs.stress > 6, "high stress affects hormonal balance"],
          [fatLevel > 0.3, "body fat percentage"],
          [inputs.age >= 18 && inputs.age <= 45, "reproductive age range"],
        ]),
        category: "gender-specific",
      });
    }
  }

  // --- Osteoporosis tendency (age-related, higher for females) ---
  const tendencyOsteo = clamp(
    (inputs.age > 50 ? 0.25 : inputs.age > 40 ? 0.12 : 0) +
    (isFemale ? 0.12 : 0) +
    (inputs.exercise < 1 ? 0.1 : 0) +
    (inputs.water < 1.5 ? 0.05 : 0) +
    (inputs.smoking > 10 ? 0.08 : 0),
  );
  if (tendencyOsteo > 0.1) {
    tendencies.push({
      name: "Osteoporosis",
      tendency: tendencyOsteo,
      reason: buildTendencyReason(tendencyOsteo, [
        [inputs.age > 50, "age-related bone density loss"],
        [isFemale, "women at higher risk post-menopause"],
        [inputs.exercise < 1, "weight-bearing exercise protects bones"],
        [inputs.smoking > 10, "smoking accelerates bone loss"],
      ]),
      category: "age-related",
    });
  }

  // --- Stroke tendency ---
  const tendencyStroke = clamp(
    risks.heart * 0.5 +
    (inputs.smoking / 30) * 0.2 +
    (inputs.age > 55 ? 0.15 : inputs.age > 45 ? 0.08 : 0) +
    (bmi > 30 ? 0.12 : 0) +
    (hasCondition("Hypertension") ? 0.2 : 0) +
    (notesLower.includes("family history of heart") ? 0.1 : 0),
  );
  if (tendencyStroke > 0.15) {
    tendencies.push({
      name: "Stroke",
      tendency: tendencyStroke,
      reason: buildTendencyReason(tendencyStroke, [
        [hasCondition("Hypertension"), "uncontrolled hypertension"],
        [inputs.smoking > 5, "smoking damages blood vessels"],
        [inputs.age > 55, "age is a major risk factor"],
        [bmi > 28, "obesity increases stroke risk"],
      ]),
      category: "age-related",
    });
  }

  // --- Custom condition tendencies ---
  inputs.customConditions.forEach((c) => {
    const existing = tendencies.find((t) => t.name.toLowerCase() === c.toLowerCase());
    if (!existing) {
      const baseTendency = clamp(
        (inputs.stress / 10) * 0.15 +
        (inputs.sleep < 6 ? 0.1 : 0) +
        Math.max(0, fatLevel) * 0.1 +
        (inputs.exercise < 1 ? 0.08 : 0),
      );
      tendencies.push({
        name: c,
        tendency: clamp(baseTendency + 0.2),
        reason: `Current lifestyle factors may exacerbate your ${c.toLowerCase()}. Stress, sleep, and exercise all play a role in managing this condition.`,
        category: "custom",
      });
    }
  });

  // Sort by tendency (highest first)
  tendencies.sort((a, b) => b.tendency - a.tendency);

  return tendencies;
}

function buildTendencyReason(
  tendency: number,
  factors: [boolean, string][],
): string {
  const activeFactors = factors.filter(([active]) => active).map(([, desc]) => desc);
  const level = tendency > 0.6 ? "High" : tendency > 0.35 ? "Moderate" : "Low";
  if (activeFactors.length === 0) return `${level} tendency based on overall profile.`;
  return `${level} tendency due to ${activeFactors.join(", ")}.`;
}

function maintenance(inputs: TwinInputs): number {
  const tdee =
    10 * inputs.weight + 6.25 * inputs.height - 5 * inputs.age + (inputs.gender === "male" ? 5 : -161);
  const activityMult = 1.2 + inputs.exercise * 0.12;
  return tdee * activityMult;
}

// ===== AI RECOMMENDATION GENERATOR =====
// Generates recommendations based on simulation state (used as fallback when API is unavailable)

export function generateLocalRecommendations(state: SimulationState): AIRecommendation[] {
  const recommendations: AIRecommendation[] = [];
  const organEntries = Object.values(state.organs);
  const worstOrgans = organEntries.sort((a, b) => a.healthScore - b.healthScore);
  const worst = worstOrgans[0];

  // Critical recommendations for severely damaged organs
  organEntries.forEach((organ) => {
    if (organ.healthScore < 25) {
      recommendations.push({
        id: `critical-${organ.id}`,
        category: "critical",
        title: `Urgent: ${organ.name} at Critical Level`,
        description: `Your ${organ.name.toLowerCase()} health score of ${organ.healthScore}/100 indicates severe damage requiring immediate medical attention. ${organ.cause}`,
        actionItems: [
          `Consult a specialist for ${organ.name.toLowerCase()} assessment immediately`,
          organ.advice,
          "Follow up with emergency care if symptoms worsen",
        ],
        affectedOrgans: [organ.id],
        priority: 1,
      });
    } else if (organ.healthScore < 50) {
      recommendations.push({
        id: `warning-${organ.id}`,
        category: "warning",
        title: `${organ.name} Health Declining`,
        description: `Your ${organ.name.toLowerCase()} is showing moderate decline at ${organ.healthScore}/100. ${organ.cause}. Early intervention can reverse this trend.`,
        actionItems: [
          `Schedule a medical check-up focused on ${organ.name.toLowerCase()} function`,
          organ.advice,
          "Track symptoms and report changes to your healthcare provider",
        ],
        affectedOrgans: [organ.id],
        priority: 2,
      });
    }
  });

  // Lifestyle improvement recommendations
  if (state.risks.obesity > 0.4) {
    recommendations.push({
      id: "improve-obesity",
      category: "improvement",
      title: "Reduce Obesity Risk",
      description: `Your obesity risk is at ${Math.round(state.risks.obesity * 100)}%. Excess body fat drives insulin resistance, cardiovascular strain, and systemic inflammation. A structured approach combining diet and exercise is most effective.`,
      actionItems: [
        "Aim for 150+ minutes of moderate-intensity exercise weekly",
        "Reduce caloric intake by 300-500 kcal/day for sustainable weight loss",
        "Focus on whole foods, lean proteins, and fiber-rich vegetables",
        "Monitor waist circumference as a key metabolic health indicator",
      ],
      affectedOrgans: ["heart", "liver", "kidneys"],
      priority: 2,
    });
  }

  if (state.risks.heart > 0.4) {
    recommendations.push({
      id: "improve-heart",
      category: "improvement",
      title: "Cardiovascular Protection Plan",
      description: `Heart disease risk at ${Math.round(state.risks.heart * 100)}%. Your cardiovascular system is under significant strain from multiple risk factors. A comprehensive approach targeting modifiable risks can substantially reduce your 10-year cardiovascular event probability.`,
      actionItems: [
        "Begin a progressive cardio exercise program (start with 20 min walks, build to 150 min/week)",
        "Reduce sodium intake to <2,300mg/day and increase potassium-rich foods",
        "Practice stress management: 10 min daily meditation or deep breathing",
        "Monitor blood pressure at home weekly",
      ],
      affectedOrgans: ["heart", "kidneys"],
      priority: 2,
    });
  }

  if (state.risks.diabetes > 0.3) {
    recommendations.push({
      id: "improve-diabetes",
      category: "improvement",
      title: "Diabetes Prevention Strategy",
      description: `Type 2 diabetes risk at ${Math.round(state.risks.diabetes * 100)}%. Insulin resistance is progressive but reversible in early stages through lifestyle modification. The Diabetes Prevention Program showed 58% risk reduction through diet and exercise alone.`,
      actionItems: [
        "Adopt a low-glycemic diet: replace refined carbs with whole grains and legumes",
        "Increase physical activity to improve insulin sensitivity",
        "Get fasting glucose and HbA1c tested within the next month",
        "Consider meeting with a registered dietitian for a personalized meal plan",
      ],
      affectedOrgans: ["liver", "kidneys"],
      priority: 2,
    });
  }

  // Preventive recommendations for moderate risk areas
  const topTendency = state.diseaseTendencies?.[0];
  if (topTendency && topTendency.tendency > 0.2 && !recommendations.some(r => r.category === "critical" || r.category === "warning")) {
    recommendations.push({
      id: "preventive-tendency",
      category: "preventive",
      title: `Prevent ${topTendency.name}`,
      description: `Your highest disease tendency is ${topTendency.name} at ${Math.round(topTendency.tendency * 100)}%. ${topTendency.reason}. Preventive measures now can significantly reduce your long-term risk.`,
      actionItems: [
        "Schedule an annual health screening including relevant biomarkers",
        "Maintain consistent sleep, exercise, and nutrition routines",
        "Track and manage stress levels proactively",
        "Stay informed about family health history and genetic risks",
      ],
      affectedOrgans: worstOrgans.slice(0, 3).map(o => o.id),
      priority: 3,
    });
  }

  // General wellness if things are going well
  if (worst.healthScore >= 75 && recommendations.length === 0) {
    recommendations.push({
      id: "wellness-maintain",
      category: "preventive",
      title: "Maintain Your Health Trajectory",
      description: `Your overall health profile is strong with all organs above 75/100. Continue your current lifestyle to maintain this positive trajectory. Focus on consistency and gradual optimization.`,
      actionItems: [
        "Continue regular exercise routine and balanced nutrition",
        "Schedule annual preventive health screenings",
        "Prioritize sleep quality (7-9 hours) and stress management",
        "Stay hydrated and maintain current healthy habits",
      ],
      affectedOrgans: [],
      priority: 4,
    });
  }

  return recommendations.sort((a, b) => a.priority - b.priority);
}

export const SEVERITY_COLOR: Record<Severity, string> = {
  good: "var(--sev-good)",
  mild: "var(--sev-mild)",
  moderate: "var(--sev-moderate)",
  severe: "var(--sev-severe)",
};

// Healthy organ colors (anatomically correct)
export const ORGAN_HEALTHY_COLOR: Record<OrganId, string> = {
  brain:   "#e8b4b8", // pinkish-gray
  heart:   "#c0392b", // deep red
  lungs:   "#f1948a", // soft pink
  liver:   "#8b4513", // dark brown-red
  kidneys: "#b5651d", // brown
  stomach: "#f0c27f", // pale yellow-beige
  reproductive: "#e8a0bf", // pink
};

// Damaged organ colors
export const ORGAN_DAMAGED_COLOR: Record<OrganId, string> = {
  brain:   "#4a0e0e", // dark necrotic
  heart:   "#2c0b0b", // dark dead
  lungs:   "#3d1f1f", // dark diseased
  liver:   "#2d1a0e", // dark cirrhotic
  kidneys: "#2d1a0e", // dark damaged
  stomach: "#3d2e0e", // dark ulcerated
  reproductive: "#3d0e2d", // dark damaged
};

export const SEVERITY_HEX: Record<Severity, string> = {
  good: "#4ade80",
  mild: "#facc15",
  moderate: "#fb923c",
  severe: "#ef4444",
};
