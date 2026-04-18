export type Gender = "male" | "female";
export type Severity = "good" | "mild" | "moderate" | "severe";

export type OrganId =
  | "brain"
  | "heart"
  | "lungs"
  | "liver"
  | "kidneys"
  | "stomach"
  | "reproductive";

export interface TwinInputs {
  gender: Gender;
  age: number;
  height: number; // cm
  weight: number; // kg
  calories: number; // daily
  water: number; // liters/day
  sleep: number; // hours
  exercise: number; // 0-5 (sedentary -> athlete)
  smoking: number; // cigs/day 0-40
  alcohol: number; // drinks/week 0-30
  stress: number; // 0-10
  junkFood: number; // 0-7 (days per week junk food is consumed)
  periodCycle: "regular" | "irregular" | "missed" | ""; // female only: period regularity
  periodIssues: string[]; // female only: e.g. cramps, heavy bleeding, PCOS symptoms
  conditions: string[]; // preset conditions
  customConditions: string[]; // user-added custom conditions
  notes: string; // free-form notes / extra details
}

// ===== TREATMENT SYSTEM =====
export type TreatmentCategory = "medication" | "lifestyle" | "therapy" | "supplement";

export interface Treatment {
  id: string;
  name: string;
  category: TreatmentCategory;
  description: string;
  targetOrgans: OrganId[]; // which organs this treatment affects
  effectiveness: number; // 0-1, how effective it is at reversing damage
  sideEffects?: string; // potential side effects
  duration: number; // days to show effect
  icon: string; // icon name for UI
}

export interface ActiveTreatment {
  treatment: Treatment;
  startDay: number; // when treatment was started (0-60)
  adherence: number; // 0-1, how well the patient follows the treatment
}

export interface OrganState {
  id: OrganId;
  name: string;
  severity: Severity;
  healthScore: number; // 100 = perfectly healthy, 0 = critically damaged
  decay: number; // 0 = no decay, 1 = severe decay (internal: 1 - healthScore/100)
  cause: string;
  advice: string;
  treatmentResponse?: TreatmentResponse; // how organ responds to treatments
}

export interface TreatmentResponse {
  isReceivingTreatment: boolean;
  activeTreatments: string[]; // treatment names
  healthImprovement: number; // 0-100, how much the treatment has helped
  reversalRate: number; // % of decay being reversed per day
  projectedRecovery: number; // projected health score if treatment continues
}

export interface BodyState {
  bmi: number;
  fatLevel: number; // -1 underweight, 0 normal, 1 obese
  fatigue: number; // 0-1
  skinDull: number; // 0-1
  posture: number; // 0 upright -> 1 slouched
  breathing: number; // 0 calm -> 1 heavy
  darkCircles: number; // 0-1, 0 = no dark circles, 1 = severe
}

export interface RiskState {
  obesity: number;
  heart: number;
  diabetes: number;
}

export interface DiseaseTendency {
  name: string;
  tendency: number; // 0-1 (0 = no tendency, 1 = very high tendency)
  reason: string; // why this tendency is predicted
  category: "lifestyle" | "genetic" | "age-related" | "gender-specific" | "custom";
}

export interface AIRecommendation {
  id: string;
  category: "critical" | "warning" | "improvement" | "preventive";
  title: string;
  description: string;
  actionItems: string[];
  affectedOrgans: OrganId[];
  priority: number; // 1-5, 1 is highest
}

export interface SimulationState {
  body: BodyState;
  organs: Record<OrganId, OrganState>;
  risks: RiskState;
  diseaseTendencies: DiseaseTendency[];
  treatmentEffects?: TreatmentEffects;
  aiRecommendations?: AIRecommendation[];
}

export interface TreatmentEffects {
  totalImprovement: number; // 0-100 overall improvement
  organImprovements: Record<OrganId, number>; // per-organ improvement
  riskReductions: { obesity: number; heart: number; diabetes: number };
}

export const DEFAULT_INPUTS: TwinInputs = {
  gender: "male",
  age: 30,
  height: 175,
  weight: 75,
  calories: 2400,
  water: 2,
  sleep: 7,
  exercise: 2,
  smoking: 0,
  alcohol: 2,
  stress: 4,
  junkFood: 2,
  periodCycle: "",
  periodIssues: [],
  conditions: [],
  customConditions: [],
  notes: "",
};

export const ORGAN_META: Record<OrganId, { name: string; defaultAdvice: string }> = {
  brain:        { name: "Brain",        defaultAdvice: "Reduce stress, sleep 7-9h, mindful breaks." },
  heart:        { name: "Heart",        defaultAdvice: "Cardio 150 min/week, lower sodium, manage stress." },
  lungs:        { name: "Lungs",        defaultAdvice: "Quit smoking, breathing exercises, fresh air." },
  liver:        { name: "Liver",        defaultAdvice: "Limit alcohol, hydrate, reduce processed food." },
  kidneys:      { name: "Kidneys",      defaultAdvice: "Drink 2-3L water, lower salt, control blood pressure." },
  stomach:      { name: "Stomach",      defaultAdvice: "Balanced meals, fiber, avoid late-night eating." },
  reproductive: { name: "Reproductive", defaultAdvice: "Balanced lifestyle, sleep, limit alcohol & smoking." },
};

// ===== TREATMENT DEFINITIONS =====
export const AVAILABLE_TREATMENTS: Treatment[] = [
  // Medications
  {
    id: "antihypertensive",
    name: "Antihypertensive",
    category: "medication",
    description: "Blood pressure medication (ACE inhibitors/ARBs) to reduce cardiovascular strain and protect heart, kidneys.",
    targetOrgans: ["heart", "kidneys"],
    effectiveness: 0.75,
    sideEffects: "Possible dizziness, dry cough (ACE inhibitors), mild fatigue",
    duration: 7,
    icon: "Pill",
  },
  {
    id: "statin",
    name: "Statin Therapy",
    category: "medication",
    description: "Cholesterol-lowering medication to reduce plaque buildup and protect cardiovascular system.",
    targetOrgans: ["heart", "liver"],
    effectiveness: 0.65,
    sideEffects: "Muscle aches, potential liver enzyme elevation",
    duration: 14,
    icon: "Pill",
  },
  {
    id: "bronchodilator",
    name: "Bronchodilator",
    category: "medication",
    description: "Inhaled medication that opens airways, improving lung capacity and oxygen flow.",
    targetOrgans: ["lungs"],
    effectiveness: 0.70,
    sideEffects: "Tremors, increased heart rate, dry mouth",
    duration: 5,
    icon: "Pill",
  },
  {
    id: "ppi",
    name: "Proton Pump Inhibitor",
    category: "medication",
    description: "Reduces stomach acid production, allowing gastric lining to heal and preventing ulcers.",
    targetOrgans: ["stomach"],
    effectiveness: 0.80,
    sideEffects: "Long-term may reduce B12/magnesium absorption",
    duration: 5,
    icon: "Pill",
  },
  {
    id: "anxiolytic",
    name: "Anxiolytic Therapy",
    category: "medication",
    description: "Anti-anxiety medication (SSRIs/benzodiazepines) to manage stress response and protect brain health.",
    targetOrgans: ["brain"],
    effectiveness: 0.60,
    sideEffects: "Drowsiness, potential dependency, initial worsening",
    duration: 14,
    icon: "Pill",
  },
  {
    id: "insulin_sensitizer",
    name: "Insulin Sensitizer",
    category: "medication",
    description: "Metformin or similar to improve insulin sensitivity and reduce metabolic load on liver and kidneys.",
    targetOrgans: ["liver", "kidneys"],
    effectiveness: 0.55,
    sideEffects: "GI discomfort, rare lactic acidosis",
    duration: 14,
    icon: "Pill",
  },

  // Lifestyle interventions
  {
    id: "cardio_exercise",
    name: "Cardio Exercise Program",
    category: "lifestyle",
    description: "Structured 150 min/week moderate cardio: walking, swimming, cycling. Improves heart, lungs, and metabolism.",
    targetOrgans: ["heart", "lungs", "brain"],
    effectiveness: 0.70,
    sideEffects: "Start slow to avoid injury, muscle soreness initially",
    duration: 10,
    icon: "HeartPulse",
  },
  {
    id: "smoking_cessation",
    name: "Smoking Cessation",
    category: "lifestyle",
    description: "Nicotine replacement + behavioral therapy to quit smoking. Immediate benefits to lungs, heart, and skin.",
    targetOrgans: ["lungs", "heart", "reproductive"],
    effectiveness: 0.85,
    sideEffects: "Withdrawal symptoms: irritability, cravings, weight gain",
    duration: 7,
    icon: "CigaretteOff",
  },
  {
    id: "alcohol_reduction",
    name: "Alcohol Reduction",
    category: "lifestyle",
    description: "Gradual alcohol reduction to safe limits (<7 drinks/week women, <14 men). Protects liver, brain, stomach.",
    targetOrgans: ["liver", "brain", "stomach", "kidneys"],
    effectiveness: 0.80,
    sideEffects: "Possible withdrawal if heavy drinker, social adjustment",
    duration: 10,
    icon: "WineOff",
  },
  {
    id: "hydration_therapy",
    name: "Hydration Therapy",
    category: "lifestyle",
    description: "Structured water intake of 2.5-3L/day. Critical for kidney filtration and skin health.",
    targetOrgans: ["kidneys", "stomach", "brain"],
    effectiveness: 0.60,
    sideEffects: "Frequent urination initially, electrolyte balance needs monitoring",
    duration: 5,
    icon: "Droplets",
  },
  {
    id: "sleep_hygiene",
    name: "Sleep Hygiene Program",
    category: "lifestyle",
    description: "Consistent 7-9h sleep schedule, screen-free wind-down, dark cool room. Essential for brain recovery.",
    targetOrgans: ["brain", "heart"],
    effectiveness: 0.65,
    sideEffects: "Initial adjustment period, may feel more tired initially",
    duration: 7,
    icon: "Moon",
  },
  {
    id: "mediterranean_diet",
    name: "Mediterranean Diet",
    category: "lifestyle",
    description: "Rich in olive oil, fish, vegetables, whole grains. Anti-inflammatory, protects heart, liver, and gut.",
    targetOrgans: ["heart", "liver", "stomach"],
    effectiveness: 0.65,
    sideEffects: "Dietary adjustment, meal planning required",
    duration: 14,
    icon: "Apple",
  },

  // Therapy
  {
    id: "cbt",
    name: "Cognitive Behavioral Therapy",
    category: "therapy",
    description: "Structured therapy to manage stress, anxiety, and depression. Rewires negative thought patterns.",
    targetOrgans: ["brain"],
    effectiveness: 0.70,
    sideEffects: "Emotional discomfort during sessions, requires commitment",
    duration: 21,
    icon: "Brain",
  },
  {
    id: "breathing_therapy",
    name: "Breathing Therapy",
    category: "therapy",
    description: "Diaphragmatic breathing, pursed-lip breathing, and pranayama. Improves lung capacity and reduces stress.",
    targetOrgans: ["lungs", "brain"],
    effectiveness: 0.55,
    sideEffects: "Lightheadedness if done incorrectly",
    duration: 7,
    icon: "Wind",
  },
  {
    id: "physical_therapy",
    name: "Physical Therapy",
    category: "therapy",
    description: "Targeted exercises and stretching to improve posture, reduce pain, and enhance mobility.",
    targetOrgans: ["heart", "brain"],
    effectiveness: 0.50,
    sideEffects: "Muscle soreness, gradual improvement",
    duration: 14,
    icon: "Activity",
  },

  // Supplements
  {
    id: "omega3",
    name: "Omega-3 Fatty Acids",
    category: "supplement",
    description: "Fish oil or algae-based EPA/DHA. Reduces inflammation, supports heart and brain health.",
    targetOrgans: ["heart", "brain"],
    effectiveness: 0.40,
    sideEffects: "Fishy aftertaste, mild GI upset",
    duration: 21,
    icon: "Fish",
  },
  {
    id: "vitamin_d",
    name: "Vitamin D + Calcium",
    category: "supplement",
    description: "Essential for bone health, immune function, and mood regulation. Often deficient in sedentary lifestyles.",
    targetOrgans: ["brain", "kidneys"],
    effectiveness: 0.35,
    sideEffects: "Rare hypercalcemia with excessive intake",
    duration: 21,
    icon: "Sun",
  },
  {
    id: "probiotics",
    name: "Probiotics",
    category: "supplement",
    description: "Beneficial bacteria to restore gut microbiome. Improves digestion and immune function.",
    targetOrgans: ["stomach"],
    effectiveness: 0.45,
    sideEffects: "Initial bloating, gas during adjustment",
    duration: 10,
    icon: "FlaskConical",
  },
  {
    id: "milk_thistle",
    name: "Milk Thistle (Silymarin)",
    category: "supplement",
    description: "Herbal liver protectant. Supports liver cell regeneration and detoxification.",
    targetOrgans: ["liver"],
    effectiveness: 0.40,
    sideEffects: "Mild laxative effect, rare allergic reactions",
    duration: 21,
    icon: "Leaf",
  },
];

// Score thresholds for the 100-based system
export function severityFromHealth(score: number): Severity {
  if (score >= 75) return "good";
  if (score >= 50) return "mild";
  if (score >= 25) return "moderate";
  return "severe";
}
