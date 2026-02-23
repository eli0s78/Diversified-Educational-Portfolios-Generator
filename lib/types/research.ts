/**
 * Research & Data Collection Types
 *
 * Types for the automated research pipeline that generates
 * sector reports and metric data for any occupation.
 */

// ============================================================================
// OCCUPATION TAXONOMY
// ============================================================================

/**
 * International Standard Classification of Occupations (ISCO-08)
 */
export interface ISCOOccupation {
  code: string; // e.g., "4110" for general office clerks
  title: string;
  description: string;
  unit_group: string; // e.g., "411 General office clerks"
  minor_group: string; // e.g., "41 General and keyboard clerks"
  sub_major_group: string; // e.g., "4 Clerical support workers"
  major_group: string; // e.g., "4 Clerical support workers"
}

/**
 * O*NET Standard Occupational Classification (SOC)
 */
export interface ONETOccupation {
  code: string; // e.g., "43-9061.00" for office clerks
  title: string;
  description: string;
  alternate_titles?: string[];
  tags?: string[];
}

/**
 * European Skills, Competences, Qualifications and Occupations (ESCO)
 */
export interface ESCOOccupation {
  uri: string; // e.g., "http://data.europa.eu/esco/occupation/..."
  code?: string;
  preferredLabel: {
    en: string;
    [lang: string]: string;
  };
  description?: {
    en: string;
    [lang: string]: string;
  };
  altLabels?: string[];
  iscoGroup?: string;
}

/**
 * Unified occupation representation
 */
export interface OccupationTaxonomy {
  input: string; // User's original input
  isco?: ISCOOccupation;
  onet?: ONETOccupation;
  esco?: ESCOOccupation;
  nace_codes?: string[]; // Industry sector codes (EU)
  naics_codes?: string[]; // Industry sector codes (US)
  keywords: string[]; // Search keywords generated from occupation
  synonyms: string[]; // Alternative terms
  region: 'US' | 'EU' | 'Global';
}

// ============================================================================
// ACADEMIC LITERATURE
// ============================================================================

/**
 * Academic paper metadata (matches 20_enriched_records.csv format)
 */
export interface AcademicPaper {
  id: string; // e.g., "SCOPUS_ID:105028003443"
  doi?: string;
  title: string;
  abstract?: string;
  year: number;
  venue?: string; // Journal/conference name
  authors: string[]; // Array of author names
  url?: string;
  source: 'Semantic Scholar' | 'OpenAlex' | 'arXiv' | 'PubMed' | 'Exa' | 'Scopus';
  fields?: string[]; // Academic fields
  citationCount?: number;
  referenceCount?: number;
  influentialCitationCount?: number;

  // Topic modeling assignments (added after BERTopic)
  topicNumber?: number; // -1 for NO_TOPIC, 0-14 for topics
  rarityLabel?: 'COMMON' | 'RARE' | 'NO_TOPIC';
}

/**
 * Literature collection request parameters
 */
export interface LiteratureCollectionRequest {
  occupation: string;
  keywords: string[];
  year_from: number;
  year_to: number;
  max_papers: number;
  sources?: Array<'semantic-scholar' | 'openalex' | 'arxiv' | 'pubmed' | 'exa'>;
  filters?: {
    language?: string[]; // e.g., ['en']
    peer_reviewed?: boolean;
    min_citations?: number;
    fields?: string[]; // Academic fields to focus on
  };
}

/**
 * Literature collection response
 */
export interface LiteratureCollectionResponse {
  papers: AcademicPaper[];
  metadata: {
    total_found: number;
    total_returned: number;
    sources_used: string[];
    duplicates_removed: number;
    query_time_ms: number;
  };
}

// ============================================================================
// TOPIC MODELING (BERTopic)
// ============================================================================

/**
 * BERTopic topic information (matches 10_topic_info.csv format)
 */
export interface TopicInfo {
  topicNumber: number; // -1 for outliers, 0-N for topics
  count: number; // Number of papers in this topic
  name: string; // e.g., "0_concrete_glass_properties_mechanical"
  representation: string[]; // Top keywords
  representativeDocs: string[]; // Sample paper titles/abstracts
  rarityLabel: 'COMMON' | 'RARE' | 'NO_TOPIC';
}

/**
 * Topic modeling request
 */
export interface TopicModelingRequest {
  papers: Array<{
    id: string;
    title: string;
    abstract?: string;
  }>;
  options?: {
    min_topic_size?: number; // Default: 8 (for RARE threshold)
    n_topics?: number; // Auto-detect if not specified
    embedding_model?: string; // Default: 'all-MiniLM-L6-v2'
  };
}

/**
 * Topic modeling response
 */
export interface TopicModelingResponse {
  topics: TopicInfo[];
  papers_with_topics: AcademicPaper[]; // Papers with topicNumber assigned
  metadata: {
    n_topics: number;
    n_outliers: number;
    processing_time_ms: number;
  };
}

// ============================================================================
// LABOR MARKET DATA
// ============================================================================

/**
 * Employment statistics
 */
export interface EmploymentData {
  total_employment: number;
  employment_trends?: Array<{
    year: number;
    employment: number;
  }>;
  geographic_distribution?: Array<{
    region: string;
    employment: number;
    percentage: number;
  }>;
}

/**
 * Wage data
 */
export interface WageData {
  median_wage: number; // Annual
  wage_distribution?: {
    percentile_10: number;
    percentile_25: number;
    percentile_50: number; // Median
    percentile_75: number;
    percentile_90: number;
  };
  currency: string; // e.g., "USD", "EUR"
}

/**
 * Demographic breakdown
 */
export interface DemographicData {
  age_distribution?: Array<{
    age_range: string; // e.g., "15-29", "30-44", "45-64", "65+"
    percentage: number;
  }>;
  education_distribution?: Array<{
    level: string; // e.g., "Primary", "Secondary", "Tertiary"
    percentage: number;
  }>;
  gender_distribution?: {
    male: number;
    female: number;
    other?: number;
  };
}

/**
 * Skills and competencies (from O*NET/ESCO)
 */
export interface SkillsData {
  core_skills: Array<{
    name: string;
    importance: number; // 0-100
    level: number; // 0-100
    category: 'technical' | 'soft' | 'digital' | 'green' | 'foundational';
  }>;
  technology_skills: Array<{
    name: string;
    category: string; // e.g., "Software", "Hardware", "Tools"
    examples: string[];
  }>;
  work_activities: Array<{
    name: string;
    importance: number;
    level: number;
  }>;
  knowledge_requirements: Array<{
    name: string;
    importance: number;
    level: number;
  }>;
}

/**
 * Automation risk assessment
 */
export interface AutomationRisk {
  automation_probability: number; // 0-1
  routine_task_intensity: number; // 0-1
  technology_adoption_trend: 'high' | 'medium' | 'low';
  time_horizon: string; // e.g., "5-10 years"
  vulnerable_tasks: string[];
  resilient_tasks: string[];
}

/**
 * Complete labor market data
 */
export interface LaborMarketData {
  occupation: OccupationTaxonomy;
  employment: EmploymentData;
  wages: WageData;
  demographics: DemographicData;
  skills: SkillsData;
  automation_risk: AutomationRisk;
  growth_projection?: {
    outlook_years: number; // e.g., 10
    projected_growth_rate: number; // e.g., 0.05 for 5%
    projected_openings_annual: number;
  };
  metadata: {
    region: 'US' | 'EU' | 'Global';
    data_sources: string[]; // e.g., ["O*NET", "BLS"]
    last_updated: string; // ISO date
  };
}

// ============================================================================
// SECTOR TRENDS & TECHNOLOGY
// ============================================================================

/**
 * Technology trend
 */
export interface Technology {
  name: string;
  category: string; // e.g., "Software", "Hardware", "Platform", "Framework"
  description: string;
  how_used: string; // How it's used in the occupation
  contribution: string; // Contribution to productivity/quality/safety
  adoption_level: 'emerging' | 'growing' | 'mature' | 'declining';
  sources: string[]; // Where this tech was identified
}

/**
 * Exogenous forces (social, technological, environmental)
 */
export interface ExogenousForces {
  social: Array<{
    force: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    sources: string[];
  }>;
  technological: Array<{
    force: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    sources: string[];
  }>;
  environmental: Array<{
    force: string;
    description: string;
    impact: 'high' | 'medium' | 'low';
    sources: string[];
  }>;
}

/**
 * Sector trends data
 */
export interface SectorTrendsData {
  occupation: string;
  technologies: Technology[];
  exogenous_forces: ExogenousForces;
  trends_summary: string; // AI-generated summary
  news_highlights: Array<{
    title: string;
    url: string;
    date: string;
    summary: string;
  }>;
  patent_activity?: {
    total_patents: number;
    recent_growth: number; // Percentage
    top_innovators: string[];
  };
  metadata: {
    data_sources: string[]; // e.g., ["O*NET", "Google Trends", "Tavily", "Firecrawl"]
    collection_date: string; // ISO date
  };
}

// ============================================================================
// SECTOR REPORT
// ============================================================================

/**
 * Future scenario (2nd generation scenarios)
 */
export interface FutureScenario {
  name: string;
  description: string;
  key_technologies: string[];
  emerging_roles: Array<{
    role: string;
    description: string;
  }>;
  required_skills: string[];
  key_competencies: string[];
}

/**
 * Complete sector report
 */
export interface SectorReport {
  // Metadata
  occupation: OccupationTaxonomy;
  generated_at: string; // ISO date
  language: 'en' | 'el';

  // Sector definition
  sector_definition: {
    name: string;
    description: string; // 300-500 words
    nace_codes?: string[];
    naics_codes?: string[];
    subsectors: string[];
  };

  // Exogenous forces analysis
  exogenous_forces: ExogenousForces;

  // Technology catalog
  technologies: Technology[];

  // Labor market structure
  labor_market: LaborMarketData;

  // Future scenarios
  scenarios: FutureScenario[];

  // Topics from academic literature
  topics: TopicInfo[];

  // Affinity matrix (15×6 mapping topics to training directions)
  affinity_matrix?: Record<number, number[]>; // Generated by existing /api/analyze

  // Citations
  references: AcademicPaper[];

  // Report content (can be exported to PDF/DOCX)
  report_sections?: {
    sector_definition_html?: string;
    exogenous_forces_html?: string;
    technologies_html?: string;
    labor_market_html?: string;
    scenarios_html?: string;
  };
}

// ============================================================================
// API KEY MANAGEMENT
// ============================================================================

/**
 * Research API keys (extension of existing AppSettings)
 */
export interface ResearchAPIKeys {
  // Literature collection
  semantic_scholar_api_key?: string;
  openalex_api_key?: string; // Optional (no key needed for public API)
  exa_api_key?: string; // Optional (paid)
  arxiv_api_key?: string; // No key needed
  pubmed_api_key?: string; // No key needed

  // Labor market data
  onet_api_key?: string; // Free with registration
  bls_api_key?: string; // Free with registration
  esco_api_key?: string; // No key needed
  eurostat_api_key?: string; // No key needed

  // Trends & web data
  google_trends_api_key?: string; // No key needed (unofficial)
  news_api_key?: string; // Free tier available
  tavily_api_key?: string; // Free tier available
  firecrawl_api_key?: string; // Free tier available

  // BERTopic microservice
  bertopic_service_url?: string; // URL of separate microservice (e.g., Railway)
}

// ============================================================================
// RESEARCH WIZARD STATE
// ============================================================================

/**
 * Research wizard step
 */
export type ResearchWizardStep =
  | 'occupation-input'
  | 'taxonomy-mapping'
  | 'literature-collection'
  | 'topic-modeling'
  | 'labor-market-data'
  | 'sector-trends'
  | 'report-generation'
  | 'complete';

/**
 * Research wizard state (stored in ProjectData)
 */
export interface ResearchWizardData {
  current_step: ResearchWizardStep;
  occupation_input?: string;
  taxonomy?: OccupationTaxonomy;
  papers?: AcademicPaper[];
  topics?: TopicInfo[];
  labor_market_data?: LaborMarketData;
  sector_trends?: SectorTrendsData;
  sector_report?: SectorReport;
  errors?: Array<{
    step: ResearchWizardStep;
    message: string;
    timestamp: string;
  }>;
  progress: {
    [K in ResearchWizardStep]?: {
      status: 'pending' | 'in_progress' | 'completed' | 'error';
      started_at?: string;
      completed_at?: string;
      duration_ms?: number;
    };
  };
}
