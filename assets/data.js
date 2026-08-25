const IDENTITY = {
  name: 'Kamlendu Kumar',
  role: 'Data Engineer',
  headline: 'AWS · Spark Structured Streaming · Apache Iceberg · Databricks',
  org: 'Barclays',
  location: 'Pune, India',
  availability: 'Open to remote · IST overlap to EU / US-East',
  email: 'kamlendukumar4480@gmail.com',
  phone: '+91 62033 20570',
  resumeUrl: 'Kamlendu_Kumar_Data_Engineer.pdf',
  summary: 'Data engineer with 3+ years at Barclays building AWS-native streaming and lakehouse infrastructure for a centralized customer master-data platform. Owns near-real-time Spark Structured Streaming pipelines, an Apache Iceberg lakehouse, and the on-premise-Hadoop-to-AWS migration that moved it all under KYC/AML, tokenization and disaster-recovery constraints.'
};

const METRICS = [
  { value: '3+', label: 'years at Barclays' },
  { value: '4', label: 'AWS certifications' },
  { value: '30+', label: 'AWS Service Catalog products' },
  { value: '1', label: 'Hadoop → AWS migration led' }
];

const NAV = [
  ['lineage','lineage'],['console','query'],['arcade','arcade'],['migration','migration'],['projects','projects'],['credentials','credentials'],['contact','contact']
];

const LINEAGE_NODES = [
  { id:'hadoop', label:'on_prem.hadoop', kind:'source', x:20, y:90, note:'Legacy on-premise Hadoop estate migrated and hydrated onto AWS.' },
  { id:'s3', label:'aws.s3', kind:'source', x:20, y:250, note:'AWS-native storage in the cloud data platform.' },
  { id:'spark', label:'spark.structured_streaming', kind:'stream', x:260, y:170, note:'Near-real-time ingestion delivering low-latency party updates and downstream synchronization.' },
  { id:'resolve', label:'entity.resolution', kind:'process', x:535, y:55, note:'Entity matching and deduplication to identify and merge duplicate party records.' },
  { id:'token', label:'pii.tokenization', kind:'process', x:535, y:170, note:'PII/CII/CALT tokenization implemented with Ab Initio for regulatory obligations.' },
  { id:'quality', label:'data.quality', kind:'process', x:535, y:285, note:'Quality controls that protect integrity across business lines.' },
  { id:'iceberg', label:'apache.iceberg', kind:'store', x:790, y:115, note:'Lakehouse ownership: automated compaction/deletion and table maintenance.' },
  { id:'databricks', label:'databricks.aws', kind:'store', x:790, y:260, note:'AWS-native Databricks infrastructure design that reduced compute spend.' },
  { id:'search', label:'party.search.api', kind:'serve', x:1035, y:35, note:'Ingestion and preprocessing behind the real-time Party Search REST API.' },
  { id:'detail', label:'party.detail.api', kind:'serve', x:1035, y:150, note:'Ingestion and preprocessing behind Party Detail Retrieval REST APIs.' },
  { id:'redshift', label:'governed.redshift', kind:'serve', x:1035, y:265, note:'Governed Redshift products provisioned through AWS Service Catalog.' },
  { id:'kyc', label:'kyc', kind:'consume', x:1275, y:20, note:'KYC systems consuming trusted customer/party data.' },
  { id:'aml', label:'aml.screening', kind:'consume', x:1275, y:105, note:'AML screening consumers.' },
  { id:'onboarding', label:'onboarding', kind:'consume', x:1275, y:190, note:'Customer onboarding consumers.' },
  { id:'reg', label:'reg.reporting', kind:'consume', x:1275, y:275, note:'Regulatory-reporting consumers.' }
];

const LINEAGE_EDGES = [
  ['hadoop','spark'],['s3','spark'],['spark','resolve'],['spark','token'],['spark','quality'],
  ['resolve','iceberg'],['token','iceberg'],['quality','iceberg'],['databricks','iceberg'],
  ['iceberg','search'],['iceberg','detail'],['iceberg','redshift'],['search','kyc'],['search','aml'],
  ['detail','onboarding'],['detail','reg'],['redshift','reg'],['redshift','aml']
];

const MIGRATION_STEPS = [
  {id:'01',title:'Legacy estate',kicker:'on-premise Hadoop',body:'The platform began on an on-premise Hadoop estate. The migration challenge was not just copying data; it was moving a customer master-data platform without losing business continuity.',tags:['Hadoop','ETL/ELT','Customer master data']},
  {id:'02',title:'Hydrate AWS',kicker:'migration + cutover',body:'Led migration and hydration onto AWS, including disaster-recovery and resiliency server setup, sustaining high availability through cutover.',tags:['AWS','S3','DR','Resiliency']},
  {id:'03',title:'Stream the change',kicker:'near-real-time',body:'Spark Structured Streaming turns incoming change into low-latency party updates and cross-platform synchronization for downstream systems.',tags:['Spark Structured Streaming','PySpark','Near-real-time']},
  {id:'04',title:'Make the lakehouse reliable',kicker:'Apache Iceberg',body:'Own the Iceberg layer: automated compaction and deletion plus table maintenance; AWS-native Databricks infrastructure design reduced compute spend.',tags:['Apache Iceberg','Databricks','Compaction']},
  {id:'05',title:'Serve governed data',kicker:'APIs + self-service',body:'Pipelines serve Party Search and Party Detail Retrieval APIs. 30+ AWS Service Catalog products, including governed Redshift clusters, enable compliant self-service infrastructure.',tags:['REST APIs','Redshift','AWS Service Catalog']}
];

const SCENARIOS = [
  {id:'late',title:'Late-event surge',alert:'Events arrive out of order; freshness is falling and duplicates begin to appear.',choices:[
    {label:'Tune watermark + keep writes idempotent',score:25,impact:{q:8,l:8,c:5,g:7},note:'Best balance: tolerate late data without sacrificing correctness.'},
    {label:'Drop every late record',score:8,impact:{q:-8,l:10,c:7,g:-4},note:'Fast, but silently wrong data is a bad trade.'},
    {label:'Restart the whole stream',score:12,impact:{q:3,l:-8,c:-4,g:2},note:'May clear symptoms without addressing event-time behavior.'}
  ]},
  {id:'files',title:'Iceberg small-file storm',alert:'Reads are getting expensive. Thousands of tiny files are slowing planning and scans.',choices:[
    {label:'Schedule compaction + table maintenance',score:25,impact:{q:7,l:8,c:9,g:5},note:'The lakehouse answer: fix file layout and keep maintenance routine.'},
    {label:'Scale compute permanently',score:9,impact:{q:4,l:8,c:-10,g:2},note:'It can mask the symptom while cost keeps climbing.'},
    {label:'Convert everything to CSV',score:0,impact:{q:-10,l:-8,c:-5,g:-10},note:'You just deleted the properties you wanted from a lakehouse.'}
  ]},
  {id:'pii',title:'Sensitive fields heading downstream',alert:'A new payload includes PII/CII/CALT fields before regulated consumers are served.',choices:[
    {label:'Tokenize before serving + keep governance gate',score:25,impact:{q:6,l:3,c:2,g:10},note:'Correctness includes regulatory handling, not just row counts.'},
    {label:'Let consumers mask it themselves',score:4,impact:{q:-3,l:7,c:3,g:-10},note:'Pushes a critical control to every downstream consumer.'},
    {label:'Log the raw payload for debugging',score:0,impact:{q:-4,l:0,c:-2,g:-10},note:'Debugging must not create a second data-risk problem.'}
  ]},
  {id:'recon',title:'Migration reconciliation mismatch',alert:'Source and target row-level checks disagree during a cloud migration cutover rehearsal.',choices:[
    {label:'Stop promotion, reconcile deterministically, preserve evidence',score:25,impact:{q:10,l:-2,c:0,g:10},note:'Auditability and reproducibility beat a cosmetically green cutover.'},
    {label:'Accept a small mismatch as noise',score:2,impact:{q:-10,l:8,c:4,g:-8},note:'A mismatch without explanation is unresolved data risk.'},
    {label:'Re-run until the counts happen to match',score:5,impact:{q:-5,l:-4,c:-7,g:-5},note:'Non-deterministic success is not evidence.'}
  ]}
];

const t=(columns,rows)=>({columns,rows});
const DB = {
  experience:t([
    {name:'company',type:'text'},{name:'role',type:'text'},{name:'started',type:'date'},{name:'ended',type:'date'},{name:'location',type:'text'},{name:'platform',type:'text'}
  ],[{company:'Barclays',role:'Cloud Data Engineer',started:'2023-07',ended:null,location:'Pune, India',platform:'Open Party Platform — centralized party/customer master-data platform'}]),
  skills:t([{name:'category',type:'text'},{name:'skill',type:'text'},{name:'context',type:'text'}],[
    ['Streaming & Processing','Apache Spark','processing'],['Streaming & Processing','PySpark','processing'],['Streaming & Processing','Spark Structured Streaming','near-real-time ingestion'],['Streaming & Processing','Hadoop','legacy + migration source'],
    ['Lakehouse & Warehousing','Apache Iceberg','lakehouse ownership + maintenance'],['Lakehouse & Warehousing','Delta Lake','lakehouse'],['Lakehouse & Warehousing','Databricks','AWS-native compute'],['Lakehouse & Warehousing','Snowflake','warehouse'],['Lakehouse & Warehousing','Amazon Redshift','governed warehouse'],
    ['AWS','Amazon S3','storage'],['AWS','AWS Glue','data services'],['AWS','Amazon EMR','data processing'],['AWS','AWS Lambda','serverless'],['AWS','AWS Service Catalog','governed self-service products'],['AWS','IAM','access control'],
    ['Pipelines & Migration','ETL/ELT design','pipeline design'],['Pipelines & Migration','Ab Initio','tokenization + ETL'],['Pipelines & Migration','Cloud migration & data hydration','Hadoop to AWS'],['Pipelines & Migration','Entity resolution','matching + deduplication'],['Pipelines & Migration','Data quality','integrity controls'],
    ['Governance & Interfaces','PII/CII/CALT tokenization','regulatory obligations'],['Governance & Interfaces','KYC/AML regulatory reporting','regulated banking'],['Governance & Interfaces','RESTful APIs','Party Search + Party Detail'],
    ['Languages','Python','language'],['Languages','SQL','language'],['Languages','C++','language'],['Languages','C#','language']
  ].map(([category,skill,context])=>({category,skill,context}))),
  projects:t([
    {name:'name',type:'text'},{name:'type',type:'text'},{name:'collaboration',type:'text'},{name:'status',type:'text'},{name:'what',type:'text'},{name:'stack',type:'text[]'}
  ],[
    {name:'Attestic',type:'Migration Assurance Platform',collaboration:'Kamlendu Kumar × Akansh Mowar',status:'shipped',what:'Migration assurance for regulated BFSI that produces deterministic, cryptographically signed, reproducible proof that a data migration landed correctly.',focus:'Hold one invariant absolutely: no model in the verdict or evidence-hash path. Identical inputs must produce identical evidence.',architecture:['source connectors','deterministic reconciliation','evidence bundle','Ed25519 signature'],stack:['Node ESM','Ed25519','Docker','SCIM 2.0'],signal:'Oracle · SQL Server · Db2 · Snowflake · Databricks · BigQuery · Iceberg / Delta'},
    {name:'Career Autopilot',type:'AI Job-Search / Resume OS',collaboration:'Kamlendu Kumar × Akansh Mowar',status:'building',what:'A job-search and resume operating system that matches a resume to live opportunities, tailors application material, and keeps a hard boundary against invented candidate facts.',focus:'Make fabrication structurally difficult rather than merely asking an LLM to behave; evidence from the candidate profile stays separate from generated wording.',architecture:['resume + profile evidence','requirement graph','job discovery + scoring','tailoring + proof-of-work'],stack:['Next.js','Python','Postgres','LLM APIs','Microservices'],signal:'Resume tailoring · job discovery · ATS fit · signed proof-of-work'},
    {name:'TinkerLab',type:'Material Replacement & Discovery OS',collaboration:'Kamlendu Kumar × Akansh Mowar',status:'building',what:'Evidence-first material replacement and discovery platform: define a material you want to replace, explore bounded candidates, and advance only when the evidence supports the decision.',focus:'Candidate generation is not the moat. The hard problem is synthesisability filtering, uncertainty, and custody of the evidence behind every material claim.',architecture:['evidence graph','bounded candidate generation','prediction + uncertainty','simulation + industrial viability'],stack:['FastAPI','Pydantic v2','SQLAlchemy 2','PostgreSQL','Next.js 15','Docker'],signal:'Evidence custody · material identity · uncertainty · conservative decision engine'},
    {name:'UPSC OS',type:'Adaptive Study System',collaboration:'Kamlendu Kumar × Akansh Mowar',status:'in use',what:'Single-user study operating system combining current-affairs ingestion, adaptive testing, spaced repetition and answer evaluation.',focus:'Encode the learning discipline into the system: the next useful revision, question or evaluation should emerge from state rather than willpower.',architecture:['content ingestion','knowledge state','adaptive testing','spaced repetition + evaluation'],stack:['FastAPI','Postgres','Multi-model router'],signal:'Adaptive testing · current affairs · spaced repetition · answer evaluation'},
    {name:'Bharat Radar',type:'Options Analytics',collaboration:'Kamlendu Kumar × Akansh Mowar',status:'selected project',what:'Options analytics for NSE F&O with Black-Scholes pricing, full Greeks and a model-evaluation layer that grades trade setups using confidence tiers and web-search augmentation.',focus:'Pricing is deterministic; the interesting engineering problem is separating calculated market quantities from model confidence and supporting evidence.',architecture:['market inputs','Black-Scholes + Greeks','setup evaluation','confidence + evidence layer'],stack:['Python','JavaScript','LLM APIs','Black-Scholes','NSE F&O'],signal:'Greeks · confidence tiers · model evaluation · web augmentation'},
    {name:'Katha Factory',type:'Creative Automation Pipeline',collaboration:'Kamlendu Kumar × Akansh Mowar',status:'publishing',what:'Hindi mythology storytelling pipeline for children, produced through a deterministic assembler rather than editing every episode by hand.',focus:'Turn creative production into a repeatable data-style pipeline while keeping timing and output deterministic enough for frame-accurate assembly.',architecture:['script + assets','deterministic assembly','FFmpeg render','publishable episode'],stack:['Python','FFmpeg','PWA'],signal:'Automation · deterministic assembly · frame-accurate rendering'}
  ]),
  certifications:t([{name:'name',type:'text'},{name:'issuer',type:'text'},{name:'status',type:'text'}],[
    ['Solutions Architect – Associate','AWS','certified'],['Generative AI Developer – Professional','AWS','certified'],['AI Practitioner','AWS','certified'],['Cloud Practitioner','AWS','certified'],['Snowflake Pro Associate','Snowflake','certified'],['Oracle Certified Expert (SOA)','Oracle','certified'],['Databricks Certified Data Engineer Associate','Databricks','in progress']
  ].map(([name,issuer,status])=>({name,issuer,status}))),
  education:t([{name:'qualification',type:'text'},{name:'institution',type:'text'},{name:'years',type:'text'}],[
    {qualification:'B.Tech, Computer Science & Engineering (Cloud Computing & Virtualization)',institution:'UPES Dehradun, India',years:'2019–2023'}
  ])
};
const TABLE_NAMES=Object.keys(DB);
