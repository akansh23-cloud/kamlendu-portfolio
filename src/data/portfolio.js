/**
 * portfolio.js — the single source of truth for everything the visitor reads.
 *
 * ===========================================================================
 * CONTENT RULE
 * ===========================================================================
 * Nothing in this file may be invented. Every line is either stated by
 * Kamlendu or is a neutral description of work he has described. Specifically:
 *
 *   - No employment dates, tenures or durations are asserted.
 *   - No certification names are listed. "Multiple AWS certifications" is
 *     known; which ones is not, so none are named.
 *   - No metrics. No row counts, latencies, cost savings, team sizes or
 *     percentages appear anywhere, because none were sourced. A portfolio
 *     with invented numbers is worse than one with none.
 *   - No client names, no internal Barclays system names, no architecture
 *     details of employer-owned platforms beyond the public-facing shape of
 *     the work. See the note on EMPLOYER CONFIDENTIALITY below.
 *
 * Anything missing is registered in NEEDS_SOURCE and the interface hides the
 * element that would have displayed it. `npm run audit` prints the outstanding
 * list. Nothing is ever filled in with a guess.
 *
 * ===========================================================================
 * EMPLOYER CONFIDENTIALITY — read before adding to this file
 * ===========================================================================
 * The day-job entries describe the *category* of work (streaming pipelines,
 * lakehouse maintenance, platform migration, master-data governance) without
 * naming internal platforms, schemas, vendors or volumes. That restraint is
 * deliberate and should be preserved. Publishing an employer's internal system
 * name on a public portfolio is a genuine risk and is rarely worth the small
 * amount of extra credibility it buys — the discipline reads as competence
 * anyway, and it is what an interviewer will actually ask about.
 */

/* ---------------------------------------------------------------------------
 * NEEDS_SOURCE — supply these and they appear automatically. Every one of them
 * is checked by tools/content-audit.mjs, so nothing silently stays blank.
 * ------------------------------------------------------------------------ */
export const NEEDS_SOURCE = [
  { key: 'profile.linkedin', what: 'LinkedIn profile URL', effect: 'the LinkedIn button stays hidden' },
  { key: 'profile.github', what: 'GitHub profile URL', effect: 'the GitHub button stays hidden' },
  { key: 'profile.tenure', what: 'e.g. "2021 — PRESENT"', effect: 'the tenure tile stays hidden' },
  { key: 'profile.certifications', what: 'the exact AWS certification names held', effect: 'the certifications block stays hidden' },
  { key: 'public/Kamlendu_Kumar_Resume.pdf', what: 'the résumé PDF itself', effect: 'the download button removes itself at runtime' },
];

export const profile = {
  name: 'KAMLENDU KUMAR',
  role: 'CLOUD DATA ENGINEER',
  employer: 'BARCLAYS',
  location: 'PUNE, INDIA · IST',
  email: 'kamlendukumar4480@gmail.com',

  linkedin: '',        // NEEDS_SOURCE
  github: '',          // NEEDS_SOURCE
  tenure: '',          // NEEDS_SOURCE
  certifications: [],  // NEEDS_SOURCE — "multiple AWS certifications" is known; the names are not

  /** One sentence. It is the first thing read and the last thing remembered. */
  summary:
    'Cloud data engineer working on customer master data at Barclays — streaming pipelines, lakehouse table maintenance, and the migration of distributed on-premise processing onto managed cloud services. Outside the day job, builds verification and evidence systems: platforms whose primary output is a defensible record of what was decided and why.',

  /** The flat list the finale constellation and the contact chapter use. */
  skills: [
    'AWS', 'SPARK', 'PYSPARK', 'SPARK STRUCTURED STREAMING', 'KAFKA',
    'APACHE ICEBERG', 'DATABRICKS', 'SNOWFLAKE', 'AB INITIO',
    'AIRFLOW', 'ASTRONOMER', 'REDSHIFT', 'GLUE', 'EMR',
    'POSTGRESQL', 'PYTHON', 'FASTAPI', 'GOVERNANCE', 'TOKENIZATION', 'CUSTOMER 360',
  ],

  /**
   * The same skills, grouped. A recruiter scanning for one keyword finds it
   * faster in a labelled group than in a wall of chips, and the grouping is
   * itself a claim about how the work is organised in his head.
   */
  stack: [
    {
      group: 'PROCESSING',
      items: ['Spark', 'PySpark', 'Spark Structured Streaming', 'Kafka', 'Ab Initio'],
    },
    {
      group: 'STORAGE & FORMAT',
      items: ['Apache Iceberg', 'Redshift', 'Snowflake', 'PostgreSQL', 'S3'],
    },
    {
      group: 'CLOUD & COMPUTE',
      items: ['AWS', 'Glue', 'EMR', 'Lambda', 'Fargate', 'Databricks'],
    },
    {
      group: 'ORCHESTRATION',
      items: ['Airflow', 'Astronomer'],
    },
    {
      group: 'GOVERNANCE',
      items: ['Tokenization', 'Master data management', 'Lineage', 'Audit trails', 'Access scoping'],
    },
    {
      group: 'BUILDING',
      items: ['Python', 'FastAPI', 'TypeScript', 'Node', 'Next.js', 'Ed25519 provenance'],
    },
  ],

  focus: [
    'Customer 360',
    'Real-time and near-real-time systems',
    'Streaming pipelines',
    'Hadoop → AWS migration',
    'Apache Iceberg maintenance',
    'Databricks',
    'Governance and tokenization',
  ],

  /**
   * How he builds, stated as commitments rather than adjectives.
   *
   * This is the part of a portfolio that actually distinguishes one engineer
   * from another. Everyone lists Spark. Far fewer will tell you, before being
   * asked, where they refuse to put a model and what they do when a check
   * cannot be completed — and those two answers predict how someone behaves at
   * three in the morning far better than a tool list does.
   */
  principles: [
    {
      title: 'DETERMINISTIC VERDICT PATHS',
      body: 'Models may summarise, rank and explain. They do not decide. Anything that produces a verdict, a score or a pass/fail runs as deterministic code that can be re-executed and will give the same answer — because a decision you cannot reproduce is not a decision, it is an opinion with a timestamp.',
    },
    {
      title: 'FAIL CLOSED',
      body: 'When a gate cannot complete its check, it refuses rather than waves the work through. Systems that degrade to "allow" under load are the ones that fail silently and are discovered months later by an auditor rather than by a monitor.',
    },
    {
      title: 'EVIDENCE AS A FIRST-CLASS OUTPUT',
      body: 'A migration that moved the data and cannot prove it moved the data has done half the job. Verification artefacts are produced by the run itself, signed, and independently checkable without the system that produced them.',
    },
    {
      title: 'CRYPTOGRAPHIC PROVENANCE',
      body: 'Ed25519 signatures and hash-chained logs, so a record can be shown to be the one that was written and an offline verifier can confirm it without trusting the platform or its operator.',
    },
    {
      title: 'THE BORING PART IS THE PRODUCT',
      body: 'Candidate generation is rarely the hard bit. Filtering, qualification and custody are. Most of the engineering in these projects sits in deciding what does not pass.',
    },
  ],
};

/**
 * ---------------------------------------------------------------------------
 * EXPERIENCE
 *
 * Deliberately category-level. No internal platform names, no volumes, no
 * dates — see the confidentiality note at the top of this file.
 * ------------------------------------------------------------------------ */
export const experience = [
  {
    org: 'BARCLAYS',
    role: 'CLOUD DATA ENGINEER',
    place: 'Pune, India',
    period: '',            // NEEDS_SOURCE — profile.tenure
    summary: 'Customer master data: the platform that decides which records describe the same party, and keeps that answer current for everything downstream.',
    work: [
      'Streaming ingestion and stateful transformation with Kafka and Spark Structured Streaming, so downstream customer state reflects events rather than last night\'s batch.',
      'Apache Iceberg table maintenance — snapshot management, compaction and file hygiene — keeping lakehouse tables queryable as they grow.',
      'Migration of distributed on-premise storage and processing onto managed AWS services, with validation running alongside the movement.',
      'Governance and tokenization on identity attributes, so resolved records can be used downstream without carrying raw restricted fields.',
      'Batch and orchestration work across Airflow / Astronomer, Databricks, Redshift, Glue and EMR.',
    ],
  },
];

/**
 * ---------------------------------------------------------------------------
 * PROJECTS
 *
 * `kind`  work    — done inside the day job, described at category level
 *         venture — independent products built outside employment
 *         lab     — research, competition and content engineering
 *
 * `scene` picks the era whose colour and world the project is shown against.
 * More than one project may share an era; the mapping is thematic, not unique.
 * ------------------------------------------------------------------------ */
export const projects = [
  {
    id: 'streaming',
    name: 'LIVE STREAMING',
    tag: 'REAL-TIME PIPELINE',
    kind: 'work',
    scene: 'streaming',
    blurb: 'Kafka carries the fabric, Spark Structured Streaming transforms the flow, and customer state stays alive downstream.',
    problem:
      'Customer state assembled by nightly batch is, by construction, always a day stale — and the gap is widest exactly when it matters, during the hours a customer is actually doing something.',
    approach:
      'Treat events as a continuous fabric rather than a scheduled load: ingest to Kafka topics, transform and aggregate statefully in flight, and let the downstream customer view move as the events move.',
    architecture: [
      'Event sources feed Kafka topics as a continuous fabric rather than a nightly batch.',
      'Spark Structured Streaming applies transformation and stateful aggregation in flight.',
      'Windowing and watermarking decide how long the pipeline waits for late-arriving events before emitting.',
      'Downstream customer state is updated as state moves, instead of waiting for the next load.',
    ],
    stack: ['Kafka', 'Spark Structured Streaming', 'PySpark', 'AWS'],
    status: 'Production work at Barclays',
  },
  {
    id: 'migration',
    name: 'HADOOP → AWS',
    tag: 'PLATFORM MIGRATION',
    kind: 'work',
    scene: 'hadoop',
    blurb: 'Moving distributed on-premise storage and processing onto managed cloud infrastructure.',
    problem:
      'A fixed on-premise cluster prices capacity as a permanent decision. Every workload is sized for its worst hour, and that hour is paid for continuously.',
    approach:
      'Move storage and compute onto managed services so capacity follows demand, and validate the destination alongside the movement so the source can be retired on evidence rather than on confidence.',
    architecture: [
      'Legacy distributed cluster storage and compute migrated toward managed AWS services.',
      'Validation runs alongside movement, so the destination can be trusted before the source is retired.',
      'The shape of the platform changes from fixed cluster capacity to elastic services.',
      'Processing surfaces move onto Glue, EMR and Databricks as appropriate to the workload.',
    ],
    stack: ['AWS', 'EMR', 'Glue', 'S3', 'Databricks', 'Spark'],
    status: 'Production work at Barclays',
  },
  {
    id: 'lakehouse',
    name: 'ICEBERG / LAKEHOUSE',
    tag: 'TABLE FORMAT & MAINTENANCE',
    kind: 'work',
    scene: 'lakehouse',
    blurb: 'Apache Iceberg brings structure, metadata, maintenance and compaction to the modern stack.',
    problem:
      'A lake accumulates small files the way a desk accumulates paper. Nothing breaks; every query simply gets a little more expensive, until one day the planner is opening tens of thousands of files to answer a question about last week.',
    approach:
      'Use a table format with real metadata and snapshots, then treat maintenance as ongoing operational work rather than a one-off configuration — compaction, expiry and file hygiene on a schedule.',
    architecture: [
      'Table metadata and snapshots make a data lake behave like a warehouse.',
      'Maintenance work — compaction, snapshot expiry, orphan file cleanup — keeps table state healthy.',
      'Schema and partition evolution handled by the format rather than by rewriting history.',
      'Databricks sits alongside as the processing surface.',
    ],
    stack: ['Apache Iceberg', 'Databricks', 'Spark', 'S3', 'AWS Glue Catalog'],
    status: 'Production work at Barclays',
  },
  {
    id: 'governance',
    name: 'IDENTITY & TOKENIZATION',
    tag: 'MASTER DATA GOVERNANCE',
    kind: 'work',
    scene: 'governance',
    blurb: 'Deciding which records describe the same party, and making the answer safe to use downstream.',
    problem:
      'The same person arrives from a dozen systems under a dozen spellings. Merge too eagerly and you have joined two strangers; merge too cautiously and the customer sees a bank that does not recognise them.',
    approach:
      'Resolution as an explicit precision-and-recall problem with an audit trail, followed by a boundary: resolved identities are tokenised before they are used downstream, so analytics work on structure without carrying raw restricted values.',
    architecture: [
      'Records from multiple source systems reconciled into a single party view.',
      'Tokenization applied at the boundary so downstream consumers keep the shape of a record without its restricted values.',
      'Lineage and audit retained, because tokenization is not deletion — what a record was must remain traceable.',
      'Access scoping so consumers receive only the fields their purpose supports.',
    ],
    stack: ['Spark', 'AWS', 'PostgreSQL', 'Tokenization', 'Lineage'],
    status: 'Production work at Barclays',
  },
  {
    id: 'attestic',
    name: 'ATTESTIC / MAP',
    tag: 'MIGRATION ASSURANCE',
    kind: 'venture',
    scene: 'governance',
    blurb: 'Cryptographic verification for data migration: proving, to someone who does not trust you, that what arrived is what left.',
    problem:
      'Every large migration ends with the same conversation and no good answer to it: how do you know? Row counts agree until they do not, and a spreadsheet asserting reconciliation is not evidence — it is a claim by the same team that did the move.',
    approach:
      'Make the evidence the product. The run emits signed, hash-chained artefacts that a third party can verify offline, without access to the platform, without trusting its operator, and without the platform being online at all.',
    architecture: [
      'Ed25519-signed evidence bundles emitted by the run itself, not assembled afterwards.',
      'Immutable hash-chained audit log, so a removed or altered entry is detectable rather than merely discouraged.',
      'Standalone offline verifier CLI — verification does not depend on the system under scrutiny being available or honest.',
      'Trust Center page for browser-based verification by a reviewer with no tooling installed.',
      'Dialect-aware connector normalization across Oracle, SQL Server and Db2, so differences in type handling are not mistaken for data loss.',
      'Compliance packs mapping evidence to SOX, Basel, RBI, SEBI and GDPR expectations.',
      'SCIM 2.0 provisioning, scoped API keys and tenant isolation for enterprise deployment.',
      'Scheduling plus a redacted outbound webhook event bus for integration without leaking payloads.',
    ],
    stack: ['Ed25519', 'Hash chains', 'Python', 'SCIM 2.0', 'Oracle / SQL Server / Db2'],
    status: 'Independent venture — built outside employment',
  },
  {
    id: 'autopilot',
    name: 'CAREER AUTOPILOT',
    tag: 'RESUME INTELLIGENCE',
    kind: 'venture',
    scene: 'profile',
    blurb: 'A career platform whose central engineering problem is refusing to let a model make a claim the candidate cannot support.',
    problem:
      'Every AI résumé tool has the same defect: asked to tailor a CV to a job, it will quietly invent the experience the job asks for. The output reads beautifully and cannot survive an interview.',
    approach:
      'Build the truth boundary first. Claims are graded against evidence the candidate actually supplied, generation runs inside a deny boundary that cannot reach unverified material, and anything unsupported is surfaced as a gap rather than smoothed over.',
    architecture: [
      'Truth-hardening pipeline: every claim graded against supplied evidence before it may appear.',
      'Requirement graph with explicit evidence states — SUPPORTED, PARTIALLY_SUPPORTED, TRANSFERABLE, UNSUPPORTED — so a gap is visible instead of papered over.',
      'Canonical tailoring service behind an AsyncLocalStorage-based AI deny boundary: generation physically cannot reach unverified material.',
      'Action semantic validation and object-verb collocation scoring, so phrasing is checked for meaning rather than keyword density.',
      'Skill adjacency model with typed implication, substrate and relatedness distinctions, rather than one undifferentiated similarity score.',
      'Template OS: templates as pure data compiled by a layout engine, with a dependency-free vector PDF writer and ATS certification.',
      'Microservices on AWS Fargate; Ed25519-signed credentials; a live comprehension viva as the highest verification tier.',
    ],
    stack: ['Node', 'TypeScript', 'AWS Fargate', 'Ed25519', 'Next.js'],
    status: 'Independent venture — in active development',
  },
  {
    id: 'choron',
    name: 'CHORON',
    tag: 'DETERMINISTIC ENGINE',
    kind: 'venture',
    scene: 'choron',
    blurb: 'A deterministic streaming lakehouse engine in Rust, built with no external dependencies, where the same input always produces the same output.',
    problem:
      'Streaming results are notoriously hard to re-derive. Re-run a pipeline over the same events a week later and non-determinism in ordering, timing and library behaviour means the answer often differs — which makes an incident hard to investigate and an auditor impossible to satisfy.',
    approach:
      'Make determinism the invariant rather than a property you hope for: a core where replaying the same inputs reproduces the same outputs exactly, with no dependency surface underneath it that could quietly change that.',
    architecture: [
      'Written in Rust, with zero external dependencies — nothing beneath the engine can change its behaviour between versions.',
      'Deterministic replay as the central guarantee: identical inputs reproduce identical outputs, so a result can be re-derived rather than merely trusted.',
      'Concerned with orchestration and the temporal behaviour of a platform rather than with a single pipeline.',
      'Built in phases with the core established first; the design is deliberately described here in terms of its guarantees rather than its internals.',
    ],
    stack: ['Rust', 'Streaming', 'Lakehouse', 'Deterministic replay'],
    status: 'Independent venture — early phase',
  },
  {
    id: 'tinkerlab',
    name: 'TINKERLAB',
    tag: 'MATERIALS QUALIFICATION',
    kind: 'venture',
    scene: 'choron',
    blurb: 'Materials replacement and discovery, built on the premise that generating candidates is the easy half.',
    problem:
      'Candidate generation for materials substitution is close to solved and close to worthless on its own. A list of a thousand theoretically superior compounds is not useful if nobody can say which of them can actually be made, or defend that judgement later.',
    approach:
      'Position the system as an evidence-custody and decision-audit layer rather than a generator: every candidate carries the record of what qualified it, what disqualified it, and under which gate.',
    architecture: [
      'Decision state machine with explicit states and severity ordering — a candidate is always at a known, auditable point in its qualification.',
      'Discovery engine using crystal chemistry descriptors with EVOI-based candidate ranking.',
      'Structure and performance qualification: property-specific structural descriptor governance replacing a single characterisation boolean.',
      'Monte Carlo performance gate requiring P(pass) ≥ 0.95 before a candidate advances.',
      'External data ingestion connectors with license enforcement, so provenance and usage rights travel with the data.',
      'Intake bench for material creation and curation.',
      'The moat is deliberately synthesizability filtering, not candidate generation.',
    ],
    stack: ['FastAPI', 'Next.js', 'Python', 'Monte Carlo', 'Materials informatics'],
    status: 'Independent venture — multi-phase build',
  },
  {
    id: 'upsc-os',
    name: 'UPSC OS',
    tag: 'ADAPTIVE LEARNING PLATFORM',
    kind: 'lab',
    scene: 'archive',
    blurb: 'A study platform built around retrieval and scheduling rather than content delivery.',
    problem:
      'Preparation platforms mostly sell material. The binding constraint for a candidate is almost never access to material; it is knowing what to revisit, when, and being marked honestly on long-form written answers.',
    approach:
      'Model the syllabus as a graph, schedule revision by spaced repetition against it, and put the effort into evaluation — including handwritten long-form answers — rather than into more content.',
    architecture: [
      'Syllabus modelled as a graph, so coverage and gaps are computable rather than a checklist.',
      'Adaptive test engine with a spaced-repetition scheduler driving what surfaces next.',
      'Mains answer evaluator for long-form written responses, with handwriting recognition for scanned attempts.',
      'Current-affairs ingestion pipeline and a unified source index.',
      'Multi-provider AI router so no single model vendor is load-bearing.',
    ],
    stack: ['FastAPI', 'Python', 'Spaced repetition', 'OCR'],
    status: 'Personal build',
  },
  {
    id: 'katha',
    name: 'KATHA FACTORY',
    tag: 'CONTENT ENGINEERING',
    kind: 'lab',
    scene: 'writtenMemory',
    blurb: 'A Hindi children\'s mythology channel, run as a production pipeline rather than as a hobby.',
    problem:
      'Episodic children\'s content lives or dies on consistency of voice across dozens of episodes — which is exactly the thing that degrades when a single person is writing all of them under a festival deadline.',
    approach:
      'Treat craft as a documented system: an explicit style specification, repeatable structure per episode, and a production pipeline so quality is a property of the process rather than of how good a given week was.',
    architecture: [
      'Documented craft system covering lyric structure, register and pacing, so voice survives volume.',
      'Episode pipeline from script through to production prompts.',
      'A companion channel, Lulu & Lily World, sharing the same production system.',
    ],
    stack: ['Content pipeline', 'Production automation'],
    status: 'Running',
  },
];

/** Grouping labels for the work chapter. */
export const PROJECT_KINDS = [
  { key: 'work', label: 'AT BARCLAYS', note: 'Described at category level — no internal system names.' },
  { key: 'venture', label: 'INDEPENDENT VENTURES', note: 'Built outside employment.' },
  { key: 'lab', label: 'LAB & CONTENT', note: 'Research, learning systems and content engineering.' },
];

/**
 * The timeline. `span` is the relative share of scroll each chapter occupies —
 * the strata rail draws its layer thickness directly from this number, so the
 * navigation is a true cross-section of the journey rather than even blocks.
 */
export const chapters = [
  {
    id: 'written-memory',
    scene: 'writtenMemory',
    name: 'WRITTEN MEMORY',
    tag: 'ORIGIN',
    medium: 'INK ON PAPER',
    year: 'BEFORE DIGITAL STORAGE',
    color: '#d8b06a',
    span: 1.15,
    side: 'left',
    eyebrow: '01 — ORIGIN / WRITE',
    title: 'BEFORE DATABASES,\nWE WROTE MEMORY\n<DOWN.>',
    body: 'One person, one sheet, one deliberate mark. Every storage system that follows is an argument about how to do this faster, larger, and with less forgetting.',
    chips: ['INK', 'PAPER', 'MANUAL MEMORY'],
  },
  {
    id: 'archive',
    scene: 'archive',
    name: 'PHYSICAL ARCHIVES',
    tag: 'ARCHIVE',
    medium: 'LEDGERS & INDEX CARDS',
    year: 'THE FILING AGE',
    color: '#c9a26a',
    span: 1,
    side: 'right',
    eyebrow: '02 — ARCHIVE / ORGANISE',
    title: 'INFORMATION\nBECAME\n<ORGANISED.>',
    body: 'Sheets became folders, folders became shelves, shelves became corridors. Retrieval turned into a discipline — and the first schema was a label on a drawer.',
    chips: ['LEDGERS', 'FOLDERS', 'INDEX CARDS'],
  },
  {
    id: 'punch-cards',
    game: 'punch',
    scene: 'punchCard',
    name: 'PUNCH CARDS',
    tag: 'ENCODE',
    medium: 'PERFORATED CARD',
    year: 'MACHINE-READABLE MEMORY',
    color: '#c9794b',
    span: 1,
    side: 'left',
    eyebrow: '03 — MACHINE MEMORY / ENCODE',
    title: 'WORDS TURNED\nINTO\n<PATTERNS.>',
    body: 'Handwriting stops being the record. A hole either exists or it does not, and for the first time a machine can read what a person meant.',
    chips: ['PERFORATION', 'ENCODING', 'TABULATION'],
  },
  {
    id: 'magnetic-tape',
    game: 'seek',
    scene: 'tape',
    name: 'MAGNETIC TAPE',
    tag: 'SEQUENCE',
    medium: 'MAGNETIC REEL',
    year: 'THE MAGNETIC ERA',
    color: '#b96a3c',
    span: 1,
    side: 'right',
    eyebrow: '04 — MAGNETIC ERA / MOVE',
    title: 'MEMORY\nSTARTED\n<MOVING.>',
    body: 'Storage acquires a mechanism. The record now has a direction and a speed, and reading it means running the ribbon past the head in order.',
    chips: ['TAPE REELS', 'SEQUENTIAL ACCESS', 'MOTION'],
  },
  {
    id: 'digital-media',
    scene: 'digitalMedia',
    name: 'DIGITAL MEDIA',
    tag: 'PORTABLE',
    medium: 'FLOPPY DISK / CRT',
    year: 'THE PERSONAL DECADE',
    color: '#6ee6a8',
    span: 1,
    side: 'left',
    eyebrow: '05 — EARLY DIGITAL / PORT',
    title: 'BITS GAINED\nA PHYSICAL\n<SHELL.>',
    body: 'A file becomes an object you can carry in one hand. Storage arrives on the desk, and a screen finally shows you what you are holding.',
    chips: ['FLOPPY', 'LOCAL FILES', 'PORTABILITY'],
  },
  {
    id: 'enterprise',
    scene: 'enterprise',
    name: 'ENTERPRISE',
    tag: 'INFRASTRUCTURE',
    medium: 'PLATTER & RACK',
    year: 'THE MACHINE ROOM',
    color: '#7ea7bd',
    span: 1.05,
    side: 'right',
    eyebrow: '06 — ENTERPRISE / SCALE',
    title: 'STORAGE BECAME\n<INFRASTRUCTURE.>',
    body: 'One spinning platter becomes a shelf, a shelf becomes an aisle, and an aisle becomes a room that has to be cooled, powered and staffed.',
    chips: ['HARD DISKS', 'SERVER RACKS', 'DATA CENTRE'],
  },
  {
    id: 'distributed',
    game: 'shard',
    scene: 'hadoop',
    name: 'DISTRIBUTED',
    tag: 'REPLICATE',
    medium: 'CLUSTER BLOCKS',
    year: 'THE CLUSTER',
    color: '#e3a152',
    span: 1.1,
    side: 'left',
    eyebrow: '07 — DISTRIBUTED / REPLICATE',
    title: 'DATA STOPPED\nLIVING IN\n<ONE PLACE.>',
    body: 'A file is split, copied and scattered on purpose. Losing a machine stops being a disaster — and this is the world Kamlendu moved onto AWS.',
    chips: ['HDFS', 'BLOCK REPLICATION', 'HADOOP → AWS'],
    action: { id: 'migrate', label: 'Run migration' },
  },
  {
    id: 'cloud',
    scene: 'cloud',
    name: 'CLOUD',
    tag: 'ELASTIC',
    medium: 'OBJECT STORAGE',
    year: 'THE ELASTIC ERA',
    color: '#62d8ff',
    span: 1,
    side: 'right',
    eyebrow: '08 — CLOUD / ELASTIC',
    title: 'INFRASTRUCTURE\nESCAPED THE\n<ROOM.>',
    body: 'The walls come down. Storage becomes a service with regions and copies instead of a building with a door, and capacity stops being a purchase.',
    chips: ['S3', 'GLUE', 'EMR', 'REDSHIFT'],
  },
  {
    id: 'lakehouse',
    scene: 'lakehouse',
    game: 'compact',
    name: 'LAKEHOUSE',
    tag: 'ORGANISE',
    medium: 'ICEBERG TABLES',
    year: 'THE TABLE FORMAT',
    color: '#a18aff',
    span: 1.05,
    side: 'left',
    eyebrow: '09 — LAKEHOUSE / MAINTAIN',
    title: 'STORAGE LEARNED\nTO ORGANISE\n<ITSELF.>',
    body: 'Apache Iceberg gives the lake metadata, snapshots and a table it can reason about. Maintenance — compaction, file management, deletion — becomes part of the job.',
    chips: ['ICEBERG', 'COMPACTION', 'DATABRICKS'],
    action: { id: 'compact', label: 'Run compaction' },
  },
  {
    id: 'streaming',
    scene: 'streaming',
    game: 'stream',
    name: 'LIVE STREAMING',
    tag: 'CONTINUOUS',
    medium: 'KAFKA / SPARK',
    year: 'ALWAYS ON',
    color: '#ff914d',
    span: 1.15,
    side: 'right',
    eyebrow: '10 — LIVE SYSTEMS / STREAM',
    title: 'DATA BECAME\nCONTINUOUS\n<STATE.>',
    body: 'Nothing waits for a window any more. Kafka carries the fabric, Spark Structured Streaming transforms it in flight, and Customer 360 stays alive downstream.',
    chips: ['KAFKA', 'SPARK STRUCTURED STREAMING', 'CUSTOMER 360'],
    action: { id: 'burst', label: 'Inject event burst' },
  },
  {
    id: 'choron',
    scene: 'choron',
    name: 'CHORON',
    tag: 'ORCHESTRATE',
    medium: 'TEMPORAL LATTICE',
    year: 'THE ORCHESTRATED PLATFORM',
    color: '#b06aff',
    span: 1,
    side: 'left',
    eyebrow: '11 — PLATFORM / ORCHESTRATE',
    title: 'SYSTEMS LEARNED\nTO KEEP\n<TIME.>',
    body: 'CHORON is a deterministic streaming engine written in Rust with no external dependencies. Its one invariant is that replaying the same inputs reproduces the same outputs exactly — so a result can be re-derived rather than merely trusted.',
    chips: ['CHORON', 'RUST', 'DETERMINISTIC REPLAY', 'ZERO DEPENDENCIES'],
    action: { id: 'pulse', label: 'Pulse the core' },
  },
  {
    id: 'governance',
    game: 'resolve',
    scene: 'governance',
    name: 'GOVERNED DATA',
    tag: 'TRUST',
    medium: 'TOKENISED RECORD',
    year: 'THE GOVERNED PLATFORM',
    color: '#6fd8c8',
    span: 1.05,
    side: 'right',
    eyebrow: '12 — GOVERNANCE / RESOLVE',
    title: 'MANY RECORDS,\nONE\n<IDENTITY.>',
    body: 'Fragments of the same person arrive from every direction. Duplicates resolve, raw identifiers cross a boundary, and what leaves is governed and tokenised.',
    chips: ['IDENTITY RESOLUTION', 'TOKENISATION', 'GOVERNANCE'],
    action: { id: 'tokenise', label: 'Tokenise record' },
  },
  {
    id: 'profile',
    scene: 'profile',
    name: 'KAMLENDU KUMAR',
    tag: 'THE ENGINEER',
    medium: 'PRESENT DAY',
    year: 'NOW',
    color: '#e6f57a',
    span: 1.1,
    side: 'left',
    eyebrow: '13 — PRESENT DAY / OPERATE',
    title: 'AND SOMEONE\nHAS TO BUILD\n<WHAT IS NEXT.>',
    body: 'The guide you have been following works at the end of this timeline. Cloud Data Engineer at Barclays — streaming, Customer 360, Hadoop → AWS migration, Iceberg, Databricks, governance.',
    chips: ['BARCLAYS', 'AWS', 'SPARK', 'KAFKA', 'ICEBERG'],
    kind: 'profile',
  },
  {
    id: 'work',
    scene: 'profile',
    name: 'SELECTED WORK',
    tag: 'SYSTEMS',
    medium: 'PROJECT PORTALS',
    year: 'NOW',
    color: '#cfe86a',
    span: 1,
    side: 'right',
    eyebrow: '14 — SELECTED WORK / SYSTEMS',
    title: 'SIX SYSTEMS\nFROM THE\n<SAME WORLD.>',
    body: 'Open one and the camera steps back into the era it belongs to.',
    chips: [],
    kind: 'work',
  },
  {
    id: 'contact',
    scene: 'profile',
    name: 'OPEN CHANNEL',
    tag: 'CONTACT',
    medium: 'HORIZON',
    year: 'NEXT',
    color: '#eaf7c8',
    span: 0.95,
    side: 'center',
    eyebrow: '15 — HORIZON / NEXT',
    title: "LET'S BUILD\nTHE NEXT DATA\n<SYSTEM.>",
    body: 'The timeline is behind us. Everything after this point still has to be built.',
    chips: [],
    kind: 'contact',
  },
];

/**
 * Era exercises. Six chapters carry a `game` id (see src/games/registry.js);
 * the rest deliberately do not, because a mechanic invented to fill a chapter
 * teaches the visitor that the buttons are decorative.
 *
 * Every one of them is optional. No chapter, project, contact detail or piece
 * of the story is gated behind playing any of them.
 */

/** Commands offered by the palette and by recruiter mode. */
export const quickJumps = [
  { label: 'EXPERIENCE', target: 'profile' },
  { label: 'LIVE STREAMING', target: 'streaming' },
  { label: 'CHORON', target: 'choron' },
  { label: 'LAKEHOUSE', target: 'lakehouse' },
  { label: 'MIGRATION', target: 'distributed' },
  { label: 'GOVERNANCE', target: 'governance' },
  { label: 'SELECTED WORK', target: 'work' },
  { label: 'CONTACT', target: 'contact' },
];
