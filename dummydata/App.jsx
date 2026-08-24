import React, { useState, useMemo } from 'react';
import './App.css';
import panwLogo from './assets/panw-logo.png';

// =====================================================================
// CU Intelligence Platform - v2.1.1
// =====================================================================
// Change log:
//   * Both XSIAM and AgentiX packs corrected to 1,000 CU/year at $150
//     (was 365 CU/year - material correction from Glean/deck verification)
//   * Three separate endpoint SKU inputs (BASE-ENT, ADV-EP, ADV-EP-CLOUD-CRS)
//   * Cold storage queries added as XQL query type (1 CU per 35 GB scanned)
//   * All pack pricing displays now show "per year" labels
//   * Tooltips on every input for plain-language explanation
//   * FAQ tab added with contact info and feedback form (mailto)
//   * Subtle positioning disclaimer added
//   * Rate table remains config-driven (single source of truth at top)
//   * Federated search consumption held for v2.2 (per Asaf conversation)
//
// Source of truth: PANW AgentiX Assessment Tool deck (Sam/Parv, PM Enterprise R&D)
// Deck version: July 2026 update
// This file must be updated when the deck moves.
// =====================================================================

// AgentiX Model Rate Table
const AGENTIX_MODELS = {
  GEMINI_2_5_FLASH: {
    label: 'Gemini 2.5 Flash',
    tokensPerCU: 10000000,
    cuMultiplier: 1,
    availableRegions: ['AU', 'CA', 'FR', 'DE', 'KR'],
    isDefault: false,
    plainDescription: 'Fastest, cheapest option. 1 CU = 10M tokens. Available in select regions only.',
  },
  GEMINI_3_5_FLASH: {
    label: 'Gemini 3.5 Flash',
    tokensPerCU: 2000000,
    cuMultiplier: 5,
    availableRegions: ['US', 'EU', 'SG', 'JP', 'IN', 'UK'],
    isDefault: true,
    plainDescription: 'Default in most regions. Burns 5x the CU of Flash 2.5 (1 CU = 2M tokens).',
  },
  CLAUDE_SONNET: {
    label: 'Anthropic Claude Sonnet 4.6',
    tokensPerCU: 2000000,
    cuMultiplier: 5,
    availableRegions: ['US', 'EU'],
    isDefault: false,
    plainDescription: 'Advanced reasoning model. Same CU rate as Flash 3.5. Best for complex hunts and playbooks.',
  },
  CLAUDE_OPUS: {
    label: 'Anthropic Claude Opus 4.8',
    tokensPerCU: 1000000,
    cuMultiplier: 10,
    availableRegions: ['US', 'EU'],
    isDefault: false,
    plainDescription: 'Most capable model. Most expensive - 10x the CU of Flash 2.5.',
  },
};

// AgentiX Licenses
const AGENTIX_LICENSES = {
  ENTERPRISE: {
    label: 'Enterprise',
    sku: 'PAN-AGENTIX-ENTERPRISE',
    listPrice: 300000,
    baseCU: 800,
    includedUsers: 4,
    includesTIM: true,
    hotStorageDays: 180,
    plainDescription: '$300K/year. Includes 4 users, 800 CU, Threat Intel Management (TIM), 180-day hot storage.',
  },
  ACE: {
    label: 'ACE (Base)',
    sku: 'PAN-AGENTIX-BASE',
    listPrice: 150000,
    baseCU: 400,
    includedUsers: 2,
    includesTIM: false,
    hotStorageDays: 180,
    plainDescription: '$150K/year. Includes 2 users, 400 CU, 180-day hot storage. Does NOT include TIM.',
  },
};

// Endpoint SKUs - Three separate inputs per Glean recommendation
const XSIAM_ENDPOINT_SKUS = {
  BASE_ENT: {
    label: 'PAN-XSIAM-BASE-ENT',
    plainLabel: 'Base Enterprise Endpoints',
    cuPer200EPPerDay: 1,
    description: 'Standard XSIAM enterprise endpoint license',
  },
  ADV_EP: {
    label: 'PAN-XSIAM-ADV-EP',
    plainLabel: 'Advanced Endpoints',
    cuPer200EPPerDay: 1,
    description: 'Advanced endpoint coverage',
  },
  ADV_EP_CLOUD_CRS: {
    label: 'PAN-XSIAM-ADV-EP-CLOUD-CRS',
    plainLabel: 'Advanced Cloud CRS Endpoints',
    cuPer200EPPerDay: 1,
    description: 'Cloud runtime security endpoint variant',
  },
};

const FREE_CU_DIVISOR_ENDPOINTS = 200;
const FREE_CU_DIVISOR_GB = 33;
const COLD_RETENTION_DEFAULT_MONTHS = 2;
const DAYS_PER_YEAR = 365;

// CU Packs - CORRECTED per deck: both are 1,000 CU/year at $150
const CU_PACK_PRICE = 150;
const CU_PACK_ANNUAL_YIELD = 1000;
const CU_PACK_MIN = 50;

const CU_PER_ADDITIONAL_USER = 200;
const ADDITIONAL_USER_LIST_PRICE = 25000;

// Activity Buckets
const AGENTIX_ACTIVITIES = {
  INCIDENT_CASE_MGMT: {
    label: 'Incident/Case Management',
    plainDescription: 'Analyst investigating alerts, working cases, closing incidents',
    defaultTimePct: 45,
    promptsPerHourLow: 12,
    promptsPerHourHigh: 16,
    source: 'Palo SOC: 2 cases/hr x 6-8 prompts/case',
  },
  THREAT_HUNTING: {
    label: 'Threat Hunting',
    plainDescription: 'Proactive searching for adversary behavior across data',
    defaultTimePct: 10,
    promptsPerHourLow: 15,
    promptsPerHourHigh: 20,
    source: 'PANW SOC: 15-20 prompts/hr (heavier context work)',
  },
  PLAYBOOK_AUTOMATION: {
    label: 'Playbook Engineering',
    plainDescription: 'Building and refining automation playbooks',
    defaultTimePct: 15,
    promptsPerHourLow: 5,
    promptsPerHourHigh: 10,
    source: 'PANW XSOAR Eng: 5-10 prompts/hr',
  },
  OTHER: {
    label: 'Reporting/Other',
    plainDescription: 'Reports, shift handovers, ad-hoc queries',
    defaultTimePct: 30,
    promptsPerHourLow: 2,
    promptsPerHourHigh: 3,
    source: 'PANW SOC: 2-3 queries/hr',
  },
};

const ANALYST_TOKENS_MEDIUM = 25000;
const ANALYST_TOKENS_HIGH = 100000;
const PLAYBOOK_RUN_TOKENS = 50000;
const PLAYBOOK_AGENTIX_CALLS_LOW = 2;
const PLAYBOOK_AGENTIX_CALLS_HIGH = 3;
const NOTEBOOK_FLAT_CU_PER_DAY = 1000;
const COLD_STORAGE_GB_PER_CU = 35;

// XQL Query Cost estimates (from deck)
const XQL_QUERY_COSTS = {
  LOOKUP: {
    label: 'Lookup Dataset (small)',
    plainDescription: 'Small enrichment queries against VIP lists, threat intel feeds',
    cuLow: 0.0003,
    cuHigh: 0.001,
  },
  NARROW_XDR: {
    label: 'XDR Scan (narrow window + filter)',
    plainDescription: 'Bounded searches with clear filters - cheap and common',
    cuLow: 0.005,
    cuHigh: 0.01,
  },
  WIDE_XDR: {
    label: 'XDR Scan (wide window)',
    plainDescription: 'Broad historical scans across 30-90 days',
    cuLow: 0.1,
    cuHigh: 0.35,
  },
  MULTI_STAGE: {
    label: 'Multi-stage Pipeline',
    plainDescription: 'Broad filter followed by downstream aggregation',
    cuLow: 0.003,
    cuHigh: 0.03,
  },
  IPLOC_ENRICH: {
    label: 'IP Geo Enrichment (iploc)',
    plainDescription: 'Per-row geographic lookup - heavy on wide scans',
    cuLow: 0.1,
    cuHigh: 0.4,
  },
  DEEP_NATIVE: {
    label: '30-Day Native Dataset',
    plainDescription: 'Long-window scans against raw log data',
    cuLow: 0.2,
    cuHigh: 0.4,
  },
  WIDE_PRESETS: {
    label: 'Wide Aggregate Presets',
    plainDescription: 'Summaries across large time windows - can burn a day of budget',
    cuLow: 1,
    cuHigh: 3,
  },
  COLD_STORAGE: {
    label: 'Cold Storage Query',
    plainDescription: '1 CU per 35 GB scanned. Full-day billing. 7-day rewarm cache. Enter typical query volume; cost scales by data scanned.',
    cuLow: 1,
    cuHigh: 1,
  },

};

const SHIFT_HOURS = 8;

// Contact
const CONTACT_EMAIL = 'vad.vadwlas@paloaltonetworks.com';
const FEEDBACK_SUBJECT = 'CU Intelligence Platform - Feedback';
// Document Portfolio - update URLs when each artifact is published
const DOCUMENT_PORTFOLIO = [
  {
    category: 'Cortex XSIAM & AgentiX',
    color: 'green',
    items: [
      {
        title: 'CU Operationalization Guide',
        version: 'v2.0',
        description: 'Field companion to this tool. Sizing, allocation, and governance for MSSP and GSI deployments.',
        url: 'https://docs.google.com/document/d/179Jdjr7ZIrBrrRftMqgzwmqPXQ9eBh9h1oD-tsVU7Hs/edit?usp=drive_link', // Placeholder - update when hosted
        status: 'Current',
      },
      {
        title: 'MSSP Technical Operationalization Guide',
        version: 'v0.3',
        description: 'Multi-tenant XSIAM deployment, parent/child architecture, service tiers to SKUs, AgentiX MSSP readiness.',
        url: 'https://drive.google.com/file/d/1wH9_TO1euUtTdUAnt9t2deAEUbK0fQ02/view?usp=drive_link',
        status: 'Current',
      },
      {
        title: 'AgentiX CU Optimization Guide',
        version: 'v1.0',
        description: 'CU sizing, per-analyst tier modeling, MSSP multi-tenant CU distribution, enforcement readiness.',
        url: 'https://docs.google.com/document/d/1EPcIusH-pUuwvPuBSxmuAL4bT4GDcBfn/edit?usp=sharing&ouid=101938093143937833498&rtpof=true&sd=true',
        status: 'Update pending v2.0',
      },
      {
        title: 'Partner CU Playbook Audit Guide',
        version: 'v1.0',
        description: 'Pre-enforcement audit framework for redesigning playbooks to minimize CU burn.',
        url: 'https://docs.google.com/document/d/1ZO659Ohp6yq0fQ-5c-pCiNMN2Lzoz2DHXszhUdsBM0M/edit?usp=sharing',
        status: 'Update pending v2.0',
      },
    ],
  },
  {
    category: 'Cortex Cloud',
    color: 'blue',
    items: [
      {
        title: 'Cloud-to-SOC Flow (GCP Edition)',
        version: 'v1.2',
        description: 'Reusable lab bundle generating live XSIAM cases across code, cloud, data, runtime, SOC layers.',
        url: 'https://github.com/PaloAltoNetworks/cortex-cloud-partner-toolkit/tree/main/cloud-to-soc-flow-kit-gcp-v1.2',
        status: 'Current',
      },
      {
        title: 'Cortex Cloud AppSec Positioning Guide',
        version: 'v1.0',
        description: 'Partner positioning framework for ASPM service creation on the Cortex Cloud platform.',
        url: 'https://docs.google.com/presentation/d/1qMOl7UjmerCpFuY-pyLjyU3wbp5rXUgG/edit?usp=sharing&ouid=101938093143937833498&rtpof=true&sd=true',
        status: 'Current',
      },
    ],
  },
  {
    category: 'Cortex AES (Koi)',
    color: 'gold',
    items: [
      {
        title: 'AES Partner Service Integration Guide',
        version: 'v2.1',
        description: '15-section framework: Koi architecture, five-pillar capability model, three enforcement layers, demo quick-start.',
        url: 'https://docs.google.com/document/d/1iPRu043_P8a-t6JCT17kXK--9VmDgFWO/edit?usp=drive_link&ouid=101938093143937833498&rtpof=true&sd=true',
        status: 'Current',
      },
       {
        title: 'AES Compass (Koi Compass)',
        version: 'Live Tool',
        description: 'AES partner routing tool. Maps partner AES motions across service integration, managed service, and content pack surfaces.',
        url: 'https://aes-compass.web.app/',
        status: 'Live',
      },
      {
        title: 'MCP Prompt Injection Kill Chain',
        version: 'Hands-On Guide',
        description: 'Two-page partner-deliverable demonstrating four independent Koi detection layers stopping credential exfiltration.',
        url: 'https://github.com/PaloAltoNetworks/cortex-aes-documentation-framework/tree/main/aes-mcp-lab',
        status: 'Current',
      },
         {
        title: 'Browser Extension Exfiltration Lab',
        version: 'Hands-On Demo',
        description: 'Hands-on lab demonstrating browser extension data exfiltration detection and Koi enforcement response.',
        url: 'https://github.com/PaloAltoNetworks/cortex-aes-documentation-framework/tree/main/aes-browser-extension-lab',
        status: 'Current',
      },

    ],
  },
];



function App() {
  const [activeTab, setActiveTab] = useState('configure');

  // XSIAM License - three endpoint SKUs
  const [tenantType, setTenantType] = useState('XSIAM');
  const [endpointsBaseEnt, setEndpointsBaseEnt] = useState(4000);
  const [endpointsAdvEp, setEndpointsAdvEp] = useState(2000);
  const [endpointsAdvEpCloud, setEndpointsAdvEpCloud] = useState(400);
  const [dailyGBIngested, setDailyGBIngested] = useState(500);
  const [coldRetentionMonths, setColdRetentionMonths] = useState(2);
  const [purchasedXsiamPacks, setPurchasedXsiamPacks] = useState(0);

  // AgentiX License
  const [enableAgentix, setEnableAgentix] = useState(true);
  const [agentixLicense, setAgentixLicense] = useState('ENTERPRISE');
  const [totalAgentixUsers, setTotalAgentixUsers] = useState(14);
  const [purchasedAgentixPacks, setPurchasedAgentixPacks] = useState(0);

  // Activity + models
  const [activityTimePct, setActivityTimePct] = useState({
    INCIDENT_CASE_MGMT: 45,
    THREAT_HUNTING: 10,
    PLAYBOOK_AUTOMATION: 15,
    OTHER: 30,
  });
  const [activityModel, setActivityModel] = useState({
    INCIDENT_CASE_MGMT: 'GEMINI_3_5_FLASH',
    THREAT_HUNTING: 'GEMINI_3_5_FLASH',
    PLAYBOOK_AUTOMATION: 'GEMINI_3_5_FLASH',
    OTHER: 'GEMINI_3_5_FLASH',
  });
  const [playbookRunsPerDay, setPlaybookRunsPerDay] = useState(200);
  const [playbookModel, setPlaybookModel] = useState('GEMINI_3_5_FLASH');
  const [socMaturity, setSocMaturity] = useState('HIGH');

  // v2.1 features
  const [enableAdoptionCurve, setEnableAdoptionCurve] = useState(false);
  const [adoptionMonth, setAdoptionMonth] = useState(9);
  const [showChargingRisk, setShowChargingRisk] = useState(true);

  // MSSP
  const [enableMSSP, setEnableMSSP] = useState(false);
  const [childTenants, setChildTenants] = useState(5);
  const [parentReservePct, setParentReservePct] = useState(20);

  // XSIAM consumption
  const [activeNotebooks, setActiveNotebooks] = useState(0);
  const [xqlQueriesPerDay, setXqlQueriesPerDay] = useState({
    LOOKUP: 0,
    NARROW_XDR: 20,
    WIDE_XDR: 5,
    MULTI_STAGE: 5,
    IPLOC_ENRICH: 2,
    DEEP_NATIVE: 1,
    WIDE_PRESETS: 0,
    COLD_STORAGE: 0,
  });

  // Derived - total endpoints
  const totalEndpoints = endpointsBaseEnt + endpointsAdvEp + endpointsAdvEpCloud;

  // XSIAM Entitlement
  const xsiamEntitled = useMemo(() => {
    const endpointDailyCU = totalEndpoints / FREE_CU_DIVISOR_ENDPOINTS;
    const ingestionDailyCU = dailyGBIngested / FREE_CU_DIVISOR_GB;
    const coldRetentionDailyCU = ingestionDailyCU * coldRetentionMonths;
    const totalDailyCU = endpointDailyCU + ingestionDailyCU + coldRetentionDailyCU;
    const annualFreeCU = Math.round(totalDailyCU * DAYS_PER_YEAR);
    const purchasedCU = purchasedXsiamPacks * CU_PACK_ANNUAL_YIELD;
    return {
      endpointDailyCU,
      ingestionDailyCU,
      coldRetentionDailyCU,
      totalDailyCU,
      annualFreeCU,
      purchasedCU,
      total: annualFreeCU + purchasedCU,
    };
  }, [totalEndpoints, dailyGBIngested, coldRetentionMonths, purchasedXsiamPacks]);

  // AgentiX Entitlement
  const agentixEntitled = useMemo(() => {
    if (!enableAgentix) return { base: 0, additionalUsers: 0, additionalCU: 0, purchased: 0, total: 0, licenseConfig: null, addUsers: 0 };
    const license = AGENTIX_LICENSES[agentixLicense];
    const addUsers = Math.max(0, totalAgentixUsers - license.includedUsers);
    const additionalCU = addUsers * CU_PER_ADDITIONAL_USER;
    const purchased = purchasedAgentixPacks * CU_PACK_ANNUAL_YIELD;
    return {
      licenseConfig: license,
      base: license.baseCU,
      addUsers,
      additionalCU,
      purchased,
      total: license.baseCU + additionalCU + purchased,
    };
  }, [enableAgentix, agentixLicense, totalAgentixUsers, purchasedAgentixPacks]);

  const totalActivityPct = Object.values(activityTimePct).reduce((s, v) => s + v, 0);
  const licenseConfig = enableAgentix ? AGENTIX_LICENSES[agentixLicense] : null;

  // Adoption curve
  const adoptionFactor = useMemo(() => {
    if (!enableAdoptionCurve) return 1.0;
    if (adoptionMonth <= 3) return 0.25;
    if (adoptionMonth <= 6) return 0.60;
    if (adoptionMonth <= 9) return 0.85;
    return 1.0;
  }, [enableAdoptionCurve, adoptionMonth]);


  // AgentiX Consumption - per-activity model
  const agentixCalc = useMemo(() => {
    if (!enableAgentix) return null;
    const tokensPerInteraction = socMaturity === 'HIGH' ? ANALYST_TOKENS_HIGH : ANALYST_TOKENS_MEDIUM;
    let totalCULow = 0;
    let totalCUHigh = 0;
    const activityBreakdown = {};

    Object.entries(AGENTIX_ACTIVITIES).forEach(([key, activity]) => {
      const timeFrac = (activityTimePct[key] || 0) / 100;
      const hours = SHIFT_HOURS * timeFrac;
      const iLow = totalAgentixUsers * hours * activity.promptsPerHourLow;
      const iHigh = totalAgentixUsers * hours * activity.promptsPerHourHigh;
      const model = AGENTIX_MODELS[activityModel[key]];
      const tokensLow = iLow * tokensPerInteraction * DAYS_PER_YEAR * adoptionFactor;
      const tokensHigh = iHigh * tokensPerInteraction * DAYS_PER_YEAR * adoptionFactor;
      const cuLow = Math.round(tokensLow / model.tokensPerCU);
      const cuHigh = Math.round(tokensHigh / model.tokensPerCU);
      totalCULow += cuLow;
      totalCUHigh += cuHigh;
      activityBreakdown[key] = {
        label: activity.label,
        source: activity.source,
        modelUsed: model.label,
        modelMultiplier: model.cuMultiplier,
        interactionsPerDayLow: Math.round(iLow),
        interactionsPerDayHigh: Math.round(iHigh),
        annualCULow: cuLow,
        annualCUHigh: cuHigh,
      };
    });

    const pbLow = playbookRunsPerDay * PLAYBOOK_AGENTIX_CALLS_LOW;
    const pbHigh = playbookRunsPerDay * PLAYBOOK_AGENTIX_CALLS_HIGH;
    const pbModel = AGENTIX_MODELS[playbookModel];
    const pbTokensLow = pbLow * PLAYBOOK_RUN_TOKENS * DAYS_PER_YEAR * adoptionFactor;
    const pbTokensHigh = pbHigh * PLAYBOOK_RUN_TOKENS * DAYS_PER_YEAR * adoptionFactor;
    const pbCULow = Math.round(pbTokensLow / pbModel.tokensPerCU);
    const pbCUHigh = Math.round(pbTokensHigh / pbModel.tokensPerCU);
    totalCULow += pbCULow;
    totalCUHigh += pbCUHigh;

    const shortfallLow = Math.max(0, totalCULow - agentixEntitled.total);
    const shortfallHigh = Math.max(0, totalCUHigh - agentixEntitled.total);
    const packsLow = shortfallLow > 0 ? Math.max(CU_PACK_MIN, Math.ceil(shortfallLow / CU_PACK_ANNUAL_YIELD)) : 0;
    const packsHigh = shortfallHigh > 0 ? Math.max(CU_PACK_MIN, Math.ceil(shortfallHigh / CU_PACK_ANNUAL_YIELD)) : 0;

    const dailyBurnHigh = totalCUHigh / DAYS_PER_YEAR;
    const daysToExhaust = dailyBurnHigh > 0 ? Math.floor(agentixEntitled.total / dailyBurnHigh) : 9999;
    const exhaustionDate = new Date();
    exhaustionDate.setDate(exhaustionDate.getDate() + daysToExhaust);
    const dailyLimit = agentixEntitled.total / DAYS_PER_YEAR;
    const chargingRiskLevel =
      dailyBurnHigh > dailyLimit * 2 ? 'CRITICAL' :
      dailyBurnHigh > dailyLimit ? 'HIGH' :
      dailyBurnHigh > dailyLimit * 0.8 ? 'MEDIUM' : 'LOW';

    return {
      activityBreakdown,
      playbookCULow: pbCULow,
      playbookCUHigh: pbCUHigh,
      playbookInteractionsLow: pbLow,
      playbookInteractionsHigh: pbHigh,
      playbookModel: pbModel.label,
      totalCULow, totalCUHigh, shortfallLow, shortfallHigh,
      packsLow, packsHigh,
      packsCostLow: packsLow * CU_PACK_PRICE,
      packsCostHigh: packsHigh * CU_PACK_PRICE,
      dailyBurnHigh, dailyLimit, daysToExhaust, exhaustionDate, chargingRiskLevel,
    };
  }, [enableAgentix, socMaturity, activityTimePct, activityModel, totalAgentixUsers, playbookRunsPerDay, playbookModel, adoptionFactor, agentixEntitled]);

  // XSIAM XQL + Notebook Consumption
  const xsiamConsumption = useMemo(() => {
    const notebookDailyCU = activeNotebooks * NOTEBOOK_FLAT_CU_PER_DAY;
    const notebookAnnualCU = notebookDailyCU * DAYS_PER_YEAR;
    let queryDailyCULow = 0;
    let queryDailyCUHigh = 0;
    const queryBreakdown = {};
    Object.entries(xqlQueriesPerDay).forEach(([key, count]) => {
      const cost = XQL_QUERY_COSTS[key];
      const dailyCULow = count * cost.cuLow;
      const dailyCUHigh = count * cost.cuHigh;
      queryDailyCULow += dailyCULow;
      queryDailyCUHigh += dailyCUHigh;
      queryBreakdown[key] = {
        label: cost.label,
        plainDescription: cost.plainDescription,
        queriesPerDay: count,
        dailyCULow, dailyCUHigh,
        annualCULow: Math.round(dailyCULow * DAYS_PER_YEAR),
        annualCUHigh: Math.round(dailyCUHigh * DAYS_PER_YEAR),
      };
    });
    const totalAnnualLow = notebookAnnualCU + Math.round(queryDailyCULow * DAYS_PER_YEAR);
    const totalAnnualHigh = notebookAnnualCU + Math.round(queryDailyCUHigh * DAYS_PER_YEAR);
    const shortfallLow = Math.max(0, totalAnnualLow - xsiamEntitled.total);
    const shortfallHigh = Math.max(0, totalAnnualHigh - xsiamEntitled.total);
    const packsLow = shortfallLow > 0 ? Math.max(CU_PACK_MIN, Math.ceil(shortfallLow / CU_PACK_ANNUAL_YIELD)) : 0;
    const packsHigh = shortfallHigh > 0 ? Math.max(CU_PACK_MIN, Math.ceil(shortfallHigh / CU_PACK_ANNUAL_YIELD)) : 0;
    return {
      notebookDailyCU, notebookAnnualCU, queryBreakdown,
      queryDailyCULow, queryDailyCUHigh,
      totalAnnualLow, totalAnnualHigh,
      shortfallLow, shortfallHigh, packsLow, packsHigh,
      packsCostLow: packsLow * CU_PACK_PRICE,
      packsCostHigh: packsHigh * CU_PACK_PRICE,
    };
  }, [activeNotebooks, xqlQueriesPerDay, xsiamEntitled]);

  const combinedEntitled = xsiamEntitled.total + agentixEntitled.total;
  const msspAllocation = useMemo(() => {
    if (!enableMSSP) return null;
    const parentReserve = Math.round(combinedEntitled * (parentReservePct / 100));
    const availableForChildren = combinedEntitled - parentReserve;
    const perChildAnnual = Math.round(availableForChildren / Math.max(1, childTenants));
    const perChildDaily = Math.round(perChildAnnual / DAYS_PER_YEAR);
    return { parentReserve, availableForChildren, perChildAnnual, perChildDaily };
  }, [enableMSSP, combinedEntitled, parentReservePct, childTenants]);

  // Feedback mailto builder
  const feedbackMailto = `mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent(FEEDBACK_SUBJECT)}&body=${encodeURIComponent('Hi Vad,\n\nFeedback on the CU Intelligence Platform:\n\n[Your feedback here]\n\nThanks')}`;


  // ==============================================================
  // RENDER
  // ==============================================================
  return (
    <div className="app">
      <div className="disclaimer-banner">
       <strong>Estimate for planning purposes, not a quote.</strong> Actual pricing, CU consumption, and licensing decisions require deal desk validation. <br /> Rate table sourced from PANW official assessment snapshot (July 2026). 
    </div>


    <header className="header">
  <div className="header-content">
    <div className="header-top-row">
      <div className="header-brand">
        <img src={panwLogo} alt="Palo Alto Networks" className="panw-logo" />
        <div className="header-title">
          <h1>CU Intelligence Platform</h1>
          <span className="version-badge">v2.1.2 - Aug 2026</span>
        </div>
      </div>
      <div className="author-block">
        <div className="author-name">Built & Maintained by: Vad Vadwlas</div>
        <div className="author-role">Partner Technical Strategy, Cortex XSIAM</div>
      </div>
    </div>
    <p className="header-subtitle">
      Plan XSIAM &amp; AgentiX Compute Units for MSSP and GSI partner deployments. Aligned to PANW official rate table.
    </p>
  </div>
</header>


      <nav className="tabs">
        {[
          { id: 'configure', label: '01 - Configure' },
          { id: 'analyze', label: '02 - Analyze' },
          { id: 'xql', label: '03 - XQL Costs' },
          { id: 'allocate', label: '04 - MSSP Allocate' },
          { id: 'faq', label: '05 - FAQ &amp; Feedback' },
          { id: 'documents', label: '06 - Documents' },
        ].map(tab => (
          <button
            key={tab.id}
            className={`tab ${activeTab === tab.id ? 'tab-active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label.replace('&amp;', '&')}
          </button>
        ))}
      </nav>

      <main className="content">
        {activeTab === 'configure' && renderConfigureTab()}
        {activeTab === 'analyze' && renderAnalyzeTab()}
        {activeTab === 'xql' && renderXQLTab()}
        {activeTab === 'allocate' && renderAllocateTab()}
        {activeTab === 'faq' && renderFAQTab()}
        {activeTab === 'documents' && renderDocumentsTab()}
      </main>

      <footer className="footer">
        <div className="footer-meta">
          Rate table source: PANW AgentiX Assessment Tool deck (Jul 2026 update). Config-driven single source of truth in code. Contact: <a href={`mailto:${CONTACT_EMAIL}`} className="footer-link">{CONTACT_EMAIL}</a>. Hosted on PANW GCP.
        </div>
      </footer>
    </div>
  );

  // ==============================================================
  // TAB: Configure
  // ==============================================================
  function renderConfigureTab() {
    return (
      <div className="tab-content">
        <div className="tab-intro">
          <h2>Configure Your Deployment</h2>
          <p>Enter your XSIAM and AgentiX deployment details. Every input has a tooltip - hover the <span className="q-icon">?</span> icons for plain-language help. Numbers must be <strong>purchased</strong> license quantities, not deployed. Rate math is anchored to what you bought, not what is running.</p>
        </div>

        <div className="config-grid">

          <div className="card">
            <h3>Tenant Type <HelpIcon text="XSIAM is the full platform. XDR-only is a lighter tenant that still supports AgentiX as of July 2026." /></h3>
            <label>
              Tenant Type
              <select value={tenantType} onChange={(e) => setTenantType(e.target.value)}>
                <option value="XSIAM">XSIAM (Full Platform, AgentiX included)</option>
                <option value="XDR">XDR-Only Tenant (AgentiX included)</option>
                <option value="STANDALONE_AGENTIX">Standalone AgentiX</option>
              </select>

            </label>
          </div>

          <div className="card wide">
            <h3>XSIAM Endpoints (Purchased) <HelpIcon text="Enter the QUANTITY purchased in the customer's SFDC record, not the number of agents actually deployed. Entitlement is anchored to what was bought." /></h3>
            <p className="card-desc">Every 200 endpoints = 1 CU per day. Enter each SKU line-item separately.</p>
            <div className="triple-input">
              <label>
                Base Enterprise (PAN-XSIAM-BASE-ENT)
                <input type="number" min="0" value={endpointsBaseEnt}
                  onChange={(e) => setEndpointsBaseEnt(Math.max(0, parseInt(e.target.value) || 0))} />
                <span className="hint">Contributes {(endpointsBaseEnt / FREE_CU_DIVISOR_ENDPOINTS).toFixed(1)} CU/day</span>
              </label>
              <label>
                Advanced (PAN-XSIAM-ADV-EP)
                <input type="number" min="0" value={endpointsAdvEp}
                  onChange={(e) => setEndpointsAdvEp(Math.max(0, parseInt(e.target.value) || 0))} />
                <span className="hint">Contributes {(endpointsAdvEp / FREE_CU_DIVISOR_ENDPOINTS).toFixed(1)} CU/day</span>
              </label>
              <label>
                Adv Cloud CRS (PAN-XSIAM-ADV-EP-CLOUD-CRS)
                <input type="number" min="0" value={endpointsAdvEpCloud}
                  onChange={(e) => setEndpointsAdvEpCloud(Math.max(0, parseInt(e.target.value) || 0))} />
                <span className="hint">Contributes {(endpointsAdvEpCloud / FREE_CU_DIVISOR_ENDPOINTS).toFixed(1)} CU/day</span>
              </label>
            </div>
            <div className="summary-box">
              <div>Total purchased endpoints: {totalEndpoints.toLocaleString()}</div>
              <div className="summary-total">Endpoint contribution: {(totalEndpoints / FREE_CU_DIVISOR_ENDPOINTS).toFixed(1)} CU/day</div>
            </div>
          </div>

          <div className="card">
            <h3>Data Ingestion <HelpIcon text="Daily volume of security data ingested into XSIAM. 1 CU/day granted per 33 GB per PANW official rate." /></h3>
            <label>
              Daily GB Ingested
              <input type="number" min="0" value={dailyGBIngested}
                onChange={(e) => setDailyGBIngested(Math.max(0, parseInt(e.target.value) || 0))} />
              <span className="hint">1 CU/day per 33 GB. Contributes {(dailyGBIngested / FREE_CU_DIVISOR_GB).toFixed(1)} CU/day</span>
            </label>
          </div>

          <div className="card">
            <h3>Cold Retention <HelpIcon text="Months of cold storage purchased. Grants additional CU equal to your daily ingestion CU x months of cold storage." /></h3>
            <label>
              Cold Retention Months Purchased
              <input type="number" min="0" value={coldRetentionMonths}
                onChange={(e) => setColdRetentionMonths(Math.max(0, parseInt(e.target.value) || 0))} />
              <span className="hint">Grants {xsiamEntitled.coldRetentionDailyCU.toFixed(1)} additional CU/day</span>
            </label>
          </div>

          <div className="card">
            <h3>XSIAM Add-on Packs <HelpIcon text="Additional Compute Units above the free entitlement. 1 pack = 1,000 CU/year at $150 list. Minimum 50 packs per order." /></h3>
            <label>
              Number of XSIAM CU Packs Purchased
              <input type="number" min="0" step="50" value={purchasedXsiamPacks}
                onChange={(e) => setPurchasedXsiamPacks(Math.max(0, parseInt(e.target.value) || 0))} />
              <span className="hint">
                Each pack: 1,000 CU/year at $150/year. Minimum 50 packs = $7,500/year for 50,000 CU/year.
                {purchasedXsiamPacks > 0 && ` Current: ${purchasedXsiamPacks} packs = ${(purchasedXsiamPacks * CU_PACK_ANNUAL_YIELD).toLocaleString()} CU/year at $${(purchasedXsiamPacks * CU_PACK_PRICE).toLocaleString()}/year.`}
              </span>
            </label>
            <div className="summary-box">
              <div>Daily entitled: {xsiamEntitled.totalDailyCU.toFixed(1)} CU/day</div>
              <div className="summary-total">XSIAM Annual: {xsiamEntitled.total.toLocaleString()} CU/year</div>
            </div>
          </div>

          <div className="card">
            <h3>AgentiX License <HelpIcon text="Enterprise ($300K) includes 4 users and TIM. ACE/Base ($150K) includes 2 users and does NOT include TIM." /></h3>
            <label className="toggle-label">
              <input type="checkbox" checked={enableAgentix}
                onChange={(e) => setEnableAgentix(e.target.checked)} />
              Deployment includes AgentiX
            </label>
              {enableAgentix && tenantType === 'STANDALONE_AGENTIX' && (
              <>
                <label>
                  License Tier
                  <select value={agentixLicense} onChange={(e) => setAgentixLicense(e.target.value)}>
                    <option value="ENTERPRISE">Enterprise - $300K, 4 users, 800 CU, TIM included</option>
                    <option value="ACE">ACE / Base - $150K, 2 users, 400 CU, no TIM</option>
                  </select>
                </label>
                <label>
                  Total AgentiX Users (including base)
                  <input type="number" min={licenseConfig.includedUsers} value={totalAgentixUsers}
                    onChange={(e) => setTotalAgentixUsers(Math.max(licenseConfig.includedUsers, parseInt(e.target.value) || 0))} />
                  <span className="hint">
                    {licenseConfig.includedUsers} users are included in the base. {agentixEntitled.addUsers} additional users at $25K/year each add 200 CU each.
                  </span>
                </label>
                <label>
                  Number of AgentiX CU Packs Purchased
                  <input type="number" min="0" step="50" value={purchasedAgentixPacks}
                    onChange={(e) => setPurchasedAgentixPacks(Math.max(0, parseInt(e.target.value) || 0))} />
                  <span className="hint">
                    Each pack: 1,000 CU/year at $150/year. Minimum 50 packs per order.
                    {purchasedAgentixPacks > 0 && ` Current: ${purchasedAgentixPacks} packs = ${(purchasedAgentixPacks * CU_PACK_ANNUAL_YIELD).toLocaleString()} CU/year at $${(purchasedAgentixPacks * CU_PACK_PRICE).toLocaleString()}/year.`}
                  </span>
                </label>
                <div className="summary-box">
                  <div>Base license: {agentixEntitled.base.toLocaleString()} CU/year ({licenseConfig.includedUsers} users)</div>
                  {agentixEntitled.additionalCU > 0 && <div>Additional users: +{agentixEntitled.additionalCU.toLocaleString()} CU/year</div>}
                  {agentixEntitled.purchased > 0 && <div>Purchased packs: +{agentixEntitled.purchased.toLocaleString()} CU/year</div>}
                  <div className="summary-total">AgentiX Annual: {agentixEntitled.total.toLocaleString()} CU/year</div>
                </div>
              </>
            )}
          </div>

          {enableAgentix && (
            <div className={`card wide ${!enableAgentix ? 'card-disabled' : ''}`}>
            <h3>Analyst Time &amp; Model Selection <HelpIcon text="Split of an 8-hour SOC shift across activities. Each activity uses its own AI model. Different models burn different amounts of CU per token." /></h3>
            {!enableAgentix && <p className="disabled-hint">Enable AgentiX in the license card above to activate these inputs.</p>}
            <p className="card-desc">A partner can use Flash for quick playbooks and Claude Opus for complex threat hunting. Slide each activity to reflect the customer's actual time split. Total must equal 100%.</p>
              {Object.entries(AGENTIX_ACTIVITIES).map(([key, activity]) => {
                const model = AGENTIX_MODELS[activityModel[key]];
                return (
                  <div key={key} className="activity-row">
                    <div className="activity-label">
                      <strong>{activity.label}</strong>
                      <span className="activity-desc">{activity.plainDescription}</span>
                      <span className="source-hint">Source: {activity.source}</span>
                    </div>
                    <div className="activity-time">
                      <input type="range" min="0" max="100"
                        value={activityTimePct[key]}
                        onChange={(e) => setActivityTimePct({...activityTimePct, [key]: parseInt(e.target.value)})} />
                      <span className="pct-display">{activityTimePct[key]}%</span>
                    </div>
                    <div className="activity-model">
                      <select value={activityModel[key]}
                        onChange={(e) => setActivityModel({...activityModel, [key]: e.target.value})}>
                        {Object.entries(AGENTIX_MODELS).map(([mkey, m]) => (
                          <option key={mkey} value={mkey}>
                            {m.label} ({m.cuMultiplier}x)
                          </option>
                        ))}
                      </select>
                      <span className="multiplier-tag">{model.cuMultiplier}x CU</span>
                    </div>
                  </div>
                );
              })}
              <div className={`total-pct ${totalActivityPct !== 100 ? 'warning' : 'ok'}`}>
                Total: {totalActivityPct}% {totalActivityPct !== 100 && '- must equal 100% for accurate math'}
              </div>
          </div>
          )}

                   <div className={`card ${!enableAgentix ? 'card-disabled' : ''}`}>
            <h3>Playbook Volume &amp; Maturity <HelpIcon text="Playbook runs are automated. Each triggers 2-3 AgentiX calls at 50K tokens each. Maturity changes analyst query token cost (25K vs 100K)." /></h3>
            {!enableAgentix && <p className="disabled-hint">Enable AgentiX in the license card above to activate these inputs.</p>}
              <label>
                Playbook Runs per Day
                <input type="number" min="0" value={playbookRunsPerDay}
                  onChange={(e) => setPlaybookRunsPerDay(Math.max(0, parseInt(e.target.value) || 0))} />
                <span className="hint">Default 200 (100 alerts x 2 playbooks). Each run = 2-3 AgentiX calls at 50K tokens each.</span>
              </label>
              <label>
                Model for Playbook Runs
                <select value={playbookModel} onChange={(e) => setPlaybookModel(e.target.value)}>
                  {Object.entries(AGENTIX_MODELS).map(([mkey, m]) => (
                    <option key={mkey} value={mkey}>{m.label} ({m.cuMultiplier}x)</option>
                  ))}
                </select>
              </label>
              <label>
                SOC Maturity Level
                <select value={socMaturity} onChange={(e) => setSocMaturity(e.target.value)}>
                  <option value="MEDIUM">Medium - typical queries (25,000 tokens each)</option>
                  <option value="HIGH">High - complex investigations (100,000 tokens each)</option>
                </select>
              </label>
          </div>

          <div className="card">
            <h3>XSIAM Notebooks <HelpIcon text="Notebook environments (like Jupyter for SOC) burn a flat 1,000 CU/day per active notebook - regardless of query volume." /></h3>
            <label>
              Active Notebooks
              <input type="number" min="0" value={activeNotebooks}
                onChange={(e) => setActiveNotebooks(Math.max(0, parseInt(e.target.value) || 0))} />
              <span className="hint">1,000 CU/day per active notebook. Query costs on top (see XQL Costs tab).</span>
            </label>
            {activeNotebooks > 0 && (
              <div className="summary-box">
                <div>Notebook flat fee: {xsiamConsumption.notebookAnnualCU.toLocaleString()} CU/year</div>
              </div>
            )}
          </div>

          <div className="card">
            <h3>Optional: 12-Month Adoption Ramp <HelpIcon text="Field observation: CU consumption ramps as analysts get comfortable with the Assistant. Spikes after month 6." /></h3>
            <label className="toggle-label">
              <input type="checkbox" checked={enableAdoptionCurve}
                onChange={(e) => setEnableAdoptionCurve(e.target.checked)} />
              Model gradual adoption (12 months)
            </label>
            {enableAdoptionCurve && (
              <label>
                Current Adoption Month
                <input type="range" min="1" max="12" value={adoptionMonth}
                  onChange={(e) => setAdoptionMonth(parseInt(e.target.value))} />
                <span className="pct-display">Month {adoptionMonth} = {(adoptionFactor * 100).toFixed(0)}% of steady-state</span>
              </label>
            )}
          </div>

          <div className="card">
            <h3>Optional: targeted February 2027 Charging Risk <HelpIcon text="AgentiX CU consumption charging targeted to start targeted February 2027 per PM. Metering is visible today but not enforced yet." /></h3>
            <label className="toggle-label">
              <input type="checkbox" checked={showChargingRisk}
                onChange={(e) => setShowChargingRisk(e.target.checked)} />
              Show charging risk in Analyze tab
            </label>
          </div>

           <div className="card">
            <h3>Optional: MSSP Multi-Tenant <HelpIcon text="For MSSPs distributing capacity across partner-owned child tenants under an MSSP parent. Does not model allocation across customer-owned tenants - that SKU capability is not currently enabled." /></h3>

            <label className="toggle-label">
              <input type="checkbox" checked={enableMSSP}
                onChange={(e) => setEnableMSSP(e.target.checked)} />
              Model MSSP allocation
            </label>
            {enableMSSP && (
              <>
                 <label>
                  Number of Partner-Owned Child Tenants
                  <input type="number" min="1" value={childTenants}

                    onChange={(e) => setChildTenants(Math.max(1, parseInt(e.target.value) || 1))} />
                </label>
                <label>
                  Parent Reserve %
                  <input type="range" min="0" max="50" value={parentReservePct}
                    onChange={(e) => setParentReservePct(parseInt(e.target.value))} />
                  <span className="pct-display">{parentReservePct}%</span>
                  <span className="hint">Recommended: 15-20% held at parent</span>
                </label>
              </>
            )}
          </div>

        </div>
      </div>
    );
  }


  // ==============================================================
  // TAB: Analyze
  // ==============================================================
  function renderAnalyzeTab() {
    const xUtil = xsiamEntitled.total > 0
      ? Math.round((xsiamConsumption.totalAnnualHigh / xsiamEntitled.total) * 100) : 0;
    const aUtil = agentixEntitled.total > 0 && agentixCalc
      ? Math.round((agentixCalc.totalCUHigh / agentixEntitled.total) * 100) : 0;

    return (
      <div className="tab-content">
        <div className="tab-intro">
          <h2>Consumption Analysis</h2>
          <p>XSIAM and AgentiX have <strong>separate entitlement pools</strong>. Each is analyzed independently. Numbers show low-to-high ranges based on your inputs.</p>
        </div>

        <div className="pool-section">
          <h3 className="pool-header">XSIAM Pool</h3>
          <div className="metric-grid">
            <div className="metric-card">
              <div className="metric-label">Entitled</div>
              <div className="metric-value">{xsiamEntitled.total.toLocaleString()}</div>
              <div className="metric-unit">CU/year</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">Projected Consumption</div>
              <div className="metric-value">{xsiamConsumption.totalAnnualLow.toLocaleString()} - {xsiamConsumption.totalAnnualHigh.toLocaleString()}</div>
              <div className="metric-unit">CU/year (XQL + Notebooks)</div>
            </div>
            <div className={`metric-card ${xUtil > 100 ? 'warning' : xUtil > 80 ? 'caution' : 'ok'}`}>
              <div className="metric-label">Utilization (High)</div>
              <div className="metric-value">{xUtil}%</div>
              <div className="metric-unit">of entitled at high burn</div>
            </div>
            <div className={`metric-card ${xsiamConsumption.packsHigh > 0 ? 'caution' : 'ok'}`}>
              <div className="metric-label">Packs Needed</div>
              <div className="metric-value">{xsiamConsumption.packsLow} - {xsiamConsumption.packsHigh}</div>
              <div className="metric-unit">${xsiamConsumption.packsCostLow.toLocaleString()}/yr - ${xsiamConsumption.packsCostHigh.toLocaleString()}/yr</div>
            </div>
          </div>
        </div>

        {enableAgentix && agentixCalc && (
          <div className="pool-section">
            <h3 className="pool-header agentix-header">AgentiX Pool</h3>
            <div className="metric-grid">
              <div className="metric-card">
                <div className="metric-label">Entitled</div>
                <div className="metric-value">{agentixEntitled.total.toLocaleString()}</div>
                <div className="metric-unit">CU/year</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Projected Consumption</div>
                <div className="metric-value">{agentixCalc.totalCULow.toLocaleString()} - {agentixCalc.totalCUHigh.toLocaleString()}</div>
                <div className="metric-unit">CU/year (low - high)</div>
              </div>
              <div className={`metric-card ${aUtil > 100 ? 'warning' : aUtil > 80 ? 'caution' : 'ok'}`}>
                <div className="metric-label">Utilization (High)</div>
                <div className="metric-value">{aUtil}%</div>
                <div className="metric-unit">of entitled at high burn</div>
              </div>
              <div className={`metric-card ${agentixCalc.packsHigh > 0 ? 'caution' : 'ok'}`}>
                <div className="metric-label">Packs Needed</div>
                <div className="metric-value">{agentixCalc.packsLow} - {agentixCalc.packsHigh}</div>
                <div className="metric-unit">${agentixCalc.packsCostLow.toLocaleString()}/yr - ${agentixCalc.packsCostHigh.toLocaleString()}/yr</div>
              </div>
            </div>

            {agentixCalc.daysToExhaust < 365 && (
              <div className="alert-panel alert-warning">
                <div className="alert-title">Shortfall Predictor</div>
                <div className="alert-body">
                  At high consumption estimate, AgentiX entitlement runs out on <strong>
                  {agentixCalc.exhaustionDate.toLocaleDateString(undefined, { month: 'long', day: 'numeric', year: 'numeric' })}</strong>
                  &nbsp;({agentixCalc.daysToExhaust} days from now).
                  Recommend <strong>{agentixCalc.packsHigh} packs</strong> at ${agentixCalc.packsCostHigh.toLocaleString()}/year to cover the gap.
                </div>
              </div>
            )}

            {showChargingRisk && agentixCalc.chargingRiskLevel !== 'LOW' && (
              <div className={`alert-panel alert-${agentixCalc.chargingRiskLevel.toLowerCase()}`}>
                <div className="alert-title">targeted February 2027 Charging Risk: {agentixCalc.chargingRiskLevel}</div>
                <div className="alert-body">
                  Metering visible now (Jul 2026). Charging is targeted to start targeted February 2027 per PM.
                  Daily entitlement: <strong>{agentixCalc.dailyLimit.toFixed(1)} CU/day</strong>.
                  Projected high burn: <strong>{agentixCalc.dailyBurnHigh.toFixed(1)} CU/day</strong>.
                  {agentixCalc.chargingRiskLevel === 'CRITICAL' && ' Queries will exceed daily limit once charging activates.'}
                  {agentixCalc.chargingRiskLevel === 'HIGH' && ' High probability of exceeding daily limit post-charging.'}
                  {agentixCalc.chargingRiskLevel === 'MEDIUM' && ' Approaching daily limit. Monitor and consider adding packs.'}
                </div>
              </div>
            )}

            <div className="card wide">
              <h3>AgentiX Activity Breakdown</h3>
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Activity</th>
                    <th>Model (CU Rate)</th>
                    <th>Interactions/day</th>
                    <th>Annual CU</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(agentixCalc.activityBreakdown).map(([key, a]) => (
                    <tr key={key}>
                      <td><strong>{a.label}</strong><br /><span className="source-cell">{a.source}</span></td>
                      <td>{a.modelUsed} <span className="mult-badge">{a.modelMultiplier}x</span></td>
                      <td>{a.interactionsPerDayLow} - {a.interactionsPerDayHigh}</td>
                      <td>{a.annualCULow.toLocaleString()} - {a.annualCUHigh.toLocaleString()}</td>
                    </tr>
                  ))}
                  <tr>
                    <td><strong>AgentiX Playbook Runs</strong><br /><span className="source-cell">{playbookRunsPerDay} runs/day, 2-3 calls each</span></td>
                    <td>{agentixCalc.playbookModel}</td>
                    <td>{agentixCalc.playbookInteractionsLow} - {agentixCalc.playbookInteractionsHigh}</td>
                    <td>{agentixCalc.playbookCULow.toLocaleString()} - {agentixCalc.playbookCUHigh.toLocaleString()}</td>
                  </tr>
                  <tr className="total-row">
                    <td colSpan="3"><strong>AgentiX Total</strong></td>
                    <td><strong>{agentixCalc.totalCULow.toLocaleString()} - {agentixCalc.totalCUHigh.toLocaleString()}</strong></td>
                  </tr>
                </tbody>
              </table>
            </div>
          </div>
        )}

        <div className="model-note">
          <strong>Rate table source:</strong> PANW official deck (Jul 2026 update).
          Flash 3.5 = 5x. Sonnet = 5x. Opus = 10x. Flash 2.5 = 1x (regional).
          1 pack = 1,000 CU/year at $150. Minimum 50 packs per order.
        </div>
      </div>
    );
  }

  // ==============================================================
  // TAB: XQL Costs
  // ==============================================================
  function renderXQLTab() {
    return (
      <div className="tab-content">
        <div className="tab-intro">
          <h2>XSIAM XQL Query Costs</h2>
          <p>XQL query cost varies by query shape. Enter typical daily volumes for each type. Cost ranges from PANW official deck.</p>
        </div>

        <div className="card wide">
          <h3>Estimated Queries per Day by Type</h3>
          {Object.entries(XQL_QUERY_COSTS).map(([key, cost]) => (
            <div key={key} className="xql-row">
              <div className="xql-label">
                <strong>{cost.label}</strong>
                <span className="source-hint">{cost.plainDescription}</span>
                <span className="cost-range">{cost.cuLow} - {cost.cuHigh} CU per query</span>
              </div>
              <input type="number" min="0" value={xqlQueriesPerDay[key]}
                onChange={(e) => setXqlQueriesPerDay({...xqlQueriesPerDay, [key]: Math.max(0, parseInt(e.target.value) || 0)})} />
            </div>
          ))}
        </div>

        <div className="card wide">
          <h3>Annual XQL Cost Breakdown</h3>
          <table className="data-table">
            <thead>
              <tr><th>Query Type</th><th>Queries/day</th><th>Daily CU</th><th>Annual CU</th></tr>
            </thead>
            <tbody>
              {Object.entries(xsiamConsumption.queryBreakdown).map(([key, q]) => (
                <tr key={key}>
                  <td>{q.label}</td>
                  <td>{q.queriesPerDay}</td>
                  <td>{q.dailyCULow.toFixed(3)} - {q.dailyCUHigh.toFixed(3)}</td>
                  <td>{q.annualCULow.toLocaleString()} - {q.annualCUHigh.toLocaleString()}</td>
                </tr>
              ))}
              {activeNotebooks > 0 && (
                <tr>
                  <td><strong>Notebook Daily Fee</strong> ({activeNotebooks} active)</td>
                  <td>-</td>
                  <td>{xsiamConsumption.notebookDailyCU.toLocaleString()}</td>
                  <td>{xsiamConsumption.notebookAnnualCU.toLocaleString()}</td>
                </tr>
              )}
              <tr className="total-row">
                <td colSpan="3"><strong>XSIAM Total (XQL + Notebooks)</strong></td>
                <td><strong>{xsiamConsumption.totalAnnualLow.toLocaleString()} - {xsiamConsumption.totalAnnualHigh.toLocaleString()}</strong></td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  // ==============================================================
  // TAB: MSSP Allocate
  // ==============================================================
  function renderAllocateTab() {
    return (
      <div className="tab-content">
         <div className="tab-intro">
          <h2>MSSP Multi-Tenant Allocation (Partner-Owned Tenants)</h2>
          <p>Distribution of CU capacity across partner-owned child tenants under the MSSP parent tenant. <strong>Important scope note:</strong> This applies to tenants the MSSP partner owns and operates. It does not model bulk CU purchase at parent level with allocation across customer-owned tenants - that capability is not currently enabled in the SKU. Enable MSSP mode on the Configure tab.</p>
        </div>


        {!enableMSSP ? (
          <div className="empty-state">
            <p><strong>MSSP mode is not enabled.</strong></p>
            <p>Turn on "Model MSSP allocation" in the Configure tab to see per-tenant breakdowns and daily limits.</p>
          </div>
        ) : (
          <>
            <div className="metric-grid">
              <div className="metric-card">
                <div className="metric-label">Parent Reserve</div>
                <div className="metric-value">{msspAllocation.parentReserve.toLocaleString()}</div>
                <div className="metric-unit">CU/year ({parentReservePct}%)</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Available for Children</div>
                <div className="metric-value">{msspAllocation.availableForChildren.toLocaleString()}</div>
                <div className="metric-unit">CU/year</div>
              </div>
              <div className="metric-card">
                <div className="metric-label">Per-Child Annual</div>
                <div className="metric-value">{msspAllocation.perChildAnnual.toLocaleString()}</div>
                <div className="metric-unit">CU across {childTenants} partner-owned tenants</div>

              </div>
              <div className="metric-card">
                <div className="metric-label">Per-Child Daily Cap</div>
                <div className="metric-value">{msspAllocation.perChildDaily}</div>
                <div className="metric-unit">CU/day recommended</div>
              </div>
            </div>

            <div className="card wide">
              <h3>Enforcement Readiness</h3>
              <ul className="checklist">
                <li className={parentReservePct >= 15 && parentReservePct <= 20 ? 'check-ok' : 'check-warn'}>
                  Parent reserve in 15-20% range: {parentReservePct}% {(parentReservePct >= 15 && parentReservePct <= 20) ? '' : '(adjust)'}
                </li>
                <li className={activeNotebooks === 0 ? 'check-ok' : 'check-warn'}>
                  Notebook governance: {activeNotebooks === 0 ? 'no active notebooks' : `${activeNotebooks} active = ${(activeNotebooks * NOTEBOOK_FLAT_CU_PER_DAY * 365).toLocaleString()} CU/year flat cost`}
                </li>
                <li className={msspAllocation.perChildDaily > 0 ? 'check-ok' : 'check-warn'}>
                  Per-child daily limit configured: {msspAllocation.perChildDaily} CU/day
                </li>
              </ul>
              <p className="check-note">
                Configure per-child daily limits in the XSIAM console before targeted February 2027 charging activates.
              </p>
            </div>
          </>
        )}
      </div>
    );
  }

  // ==============================================================
  // TAB: FAQ + Feedback
  // ==============================================================
  function renderFAQTab() {
    return (
      <div className="tab-content">
        <div className="tab-intro">
          <h2>FAQ &amp; Feedback</h2>
          <p>Common questions about the tool and how to reach me.</p>
        </div>

        <div className="faq-section">
          <div className="faq-item">
            <h3>What is this tool?</h3>
            <p>The CU Intelligence Platform helps you size Compute Unit (CU) consumption for XSIAM and AgentiX deployments. It is aimed at partner-facing planning for MSSPs and GSIs preparing ahead of the targeted February 2027 charging window.</p>
          </div>

          <div className="faq-item">
            <h3>Where does the rate table come from?</h3>
            <p>The rate table is sourced from the official PANW AgentiX Assessment Tool deck maintained by the PM Enterprise R&amp;D team. When the deck updates, this tool is updated to match. The single source of truth is at the top of the App.jsx file - one place to change, all outputs update.</p>
          </div>

          <div className="faq-item">
            <h3>Is this a replacement for the official assessment tool?</h3>
            <p>No. This tool complements the official assessment work. The PM assessment tool remains the source of truth for entitlement math and model rates. This tool extends into partner-facing planning surfaces - MSSP multi-tenant allocation, XQL cost modeling by query shape, shortfall predictor with a calendar date, adoption curve modeling, and per-activity model selection - which the assessment tool does not cover.</p>
          </div>

          <div className="faq-item">
            <h3>What is a CU pack? How much does it cost?</h3>
            <p>A CU pack is an add-on that supplements the free entitlement. <strong>1 pack = 1,000 CU per year at $150 list price.</strong> Packs are sold with a 50-unit minimum, so the practical entry point is 50 packs at $7,500/year yielding 50,000 CU/year. This applies to both XSIAM (PAN-XSIAM-COMP-UNT) and AgentiX (PAN-AGENTIX-COMP-UNT).</p>
          </div>

          <div className="faq-item">
            <h3>Why do I enter purchased endpoints, not deployed?</h3>
            <p>CU entitlement is anchored to what the customer <strong>bought</strong>, not what is actually running. A customer with 5,000 purchased endpoints but only 100 deployed still gets entitlement based on 5,000. Enter the SFDC quantity from the customer's license.</p>
          </div>

          <div className="faq-item">
            <h3>Does maturity change consumption?</h3>
            <p>Yes for analyst queries. Medium maturity assumes ~25,000 tokens per interaction. High assumes ~100,000 tokens per interaction. Playbook runs stay flat at 50,000 tokens regardless of maturity.</p>
          </div>

          <div className="faq-item">
            <h3>What is the adoption curve for?</h3>
            <p>Field observation: CU consumption ramps as analysts get comfortable with the Assistant, spiking after month 6. Enable this if you want to model the ramp rather than assume steady-state consumption on day one.</p>
          </div>
            <div className="faq-item">
            <h3>Does MSSP allocation cover customer-owned tenants?</h3>
            <p>No. The MSSP allocation model in this tool applies to tenants the MSSP partner owns and operates as part of their managed service. It does not model bulk CU purchase at parent level with allocation across customer-owned tenants - that SKU capability is not currently enabled in the platform. If PM enables that capability in the future, the tool will be updated to reflect it.</p>
          </div>


          <div className="faq-item">
            <h3>What about federated search?</h3>
            <p>Federated search consumption is being actively reviewed by PM. It is not modeled in v2.1.1 to avoid producing numbers that will need refactoring once the charging mechanic is finalized. Will be added in a future version once PM guidance is settled.</p>
          </div>

          <div className="faq-item">
            <h3>How current is this?</h3>
            <p>Rate table aligned to the PANW deck as of the July 2026 update. Version and last-updated shown in the header. As PM guidance evolves this tool will be updated to match. All outputs are estimates for planning purposes; actual customer pricing and licensing decisions run through the deal desk.</p>
          </div>

          <div className="faq-item highlight">
            <h3>How do I send feedback or ask a question?</h3>
            <p>Two options:</p>
            <p>
              <a href={feedbackMailto} className="feedback-button">Send Feedback via Email</a>
            </p>
            <p>Or reach me directly at <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a> or on Slack (@Vad).</p>
          </div>
        </div>
      </div>
    );
  }


  // ==============================================================
  // TAB: Documents - Portfolio hub
  // ==============================================================
  function renderDocumentsTab() {
    return (
      <div className="tab-content">
        <div className="tab-intro">
          <h2>Document Portfolio</h2>
          <p>Companion documents and related artifacts by product surface. Each opens in a new tab. Rate table and pack economics referenced in these documents are aligned to the same PANW deck as this tool.</p>
        </div>

        <div className="docs-container">
          {DOCUMENT_PORTFOLIO.map((section, idx) => (
            <div key={idx} className={`docs-section docs-${section.color}`}>
              <h3 className="docs-section-header">{section.category}</h3>
              <div className="docs-grid">
                {section.items.map((doc, i) => (
                  <a key={i} href={doc.url}
                     target="_blank" rel="noopener noreferrer"
                     className="doc-card">
                    <div className="doc-card-header">
                      <div className="doc-title">{doc.title}</div>
                      <div className="doc-version">{doc.version}</div>
                    </div>
                    <div className="doc-description">{doc.description}</div>
                    <div className="doc-footer">
                      <span className={`doc-status status-${doc.status.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z-]/g, '')}`}>{doc.status}</span>
                      <span className="doc-open-icon">Open &rarr;</span>
                    </div>
                  </a>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div className="docs-footer-note">
          <p><strong>Note:</strong> Distribution scope varies by document. Some are internal-only, others are approved for partner distribution. Confirm with the author before external sharing. Contact: <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.</p>
        </div>
      </div>
    );
  }

}

// Helper component: Help icon with hover tooltip
function HelpIcon({ text }) {
  return (
    <span className="help-icon-wrapper">
      <span className="help-icon">?</span>
      <span className="help-tooltip">{text}</span>
    </span>
  );
}

export default App;
