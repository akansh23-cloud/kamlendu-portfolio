import { WrittenMemoryScene } from './WrittenMemoryScene.js';
import { ArchiveScene } from './ArchiveScene.js';
import { PunchCardScene } from './PunchCardScene.js';
import { MagneticTapeScene } from './MagneticTapeScene.js';
import { DigitalMediaScene } from './DigitalMediaScene.js';
import { EnterpriseScene } from './EnterpriseScene.js';
import { HadoopScene } from './HadoopScene.js';
import { CloudScene } from './CloudScene.js';
import { LakehouseScene } from './LakehouseScene.js';
import { StreamingScene } from './StreamingScene.js';
import { ChoronScene } from './ChoronScene.js';
import { GovernanceScene } from './GovernanceScene.js';
import { ProfileScene } from './ProfileScene.js';

/**
 * The registry. Chapters reference scenes by key, and three chapters
 * (profile / work / contact) deliberately share one scene so the ending plays
 * as a single continuous act rather than three more sections.
 */
export const SCENES = {
  writtenMemory: WrittenMemoryScene,
  archive: ArchiveScene,
  punchCard: PunchCardScene,
  tape: MagneticTapeScene,
  digitalMedia: DigitalMediaScene,
  enterprise: EnterpriseScene,
  hadoop: HadoopScene,
  cloud: CloudScene,
  lakehouse: LakehouseScene,
  streaming: StreamingScene,
  choron: ChoronScene,
  governance: GovernanceScene,
  profile: ProfileScene,
};

export const SCENE_KEYS = Object.keys(SCENES);
