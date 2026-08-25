# KAMLENDU // DATA PLANE v6
### The Human History of Data

A scroll-driven, cinematic 3D portfolio. One recurring human walks through the
history of data persistence — from a scribe's desk, through punch cards, tape,
floppies and machine rooms, into distributed clusters, cloud, lakehouse,
streaming, orchestration and governance — and arrives at the present day, where
the person you have been following turns out to be the engineer whose portfolio
this is.

Thirteen 3D environments. Fifteen chapters. Six playable era exercises. One
character, one camera rig, one light rig, the whole way.

---

## Run it

```bash
npm install
npm run dev
```

That is the entire setup. There is no build step to run first, no asset pipeline
to prime, no API key, no CDN, and no model files to download.

| Command | What it does |
| --- | --- |
| `npm run dev` | Dev server on `localhost:5173` |
| `npm run build` | Production build into `dist/` |
| `npm run preview` | Serve the production build locally |
| `npm run audit` | Content audit — sources, fabricated metrics, confidentiality |
| `npm test` | The audit plus every scene, every game, and the interface |

---

## Before you publish

Run the content audit. It is the publish gate:

```bash
npm run audit
```

It prints exactly what is still missing, refuses to pass if any claimed metric
has crept into the copy, and warns if an internal system name has appeared in a
day-job entry.

### The five things to supply

Open `src/data/portfolio.js` and search for `NEEDS_SOURCE`. Every one of these
is optional — the interface hides whatever it has no data for, and nothing is
ever filled in with a guess:

| | While it is blank |
| --- | --- |
| `profile.linkedin` | the LinkedIn button does not render |
| `profile.github` | the GitHub button does not render |
| `profile.tenure` | the tenure tile and the experience period stay hidden |
| `profile.certifications` | the certifications block stays hidden |
| `public/…Resume.pdf` | the download button removes itself at runtime |

**On certifications specifically.** It is on record that you hold several AWS
certifications; which ones is not. So none are named. Naming a plausible set
would be inventing a credential, which is the one category of error on a
portfolio that is genuinely unrecoverable — add the real names and they appear.

### The content rule, and why a program enforces it

Nothing in `portfolio.js` may be invented. In particular there are **no metrics
anywhere** — no row counts, no latencies, no cost savings, no team sizes, no
percentages — because none were sourced. `npm run audit` scans every string in
the content for anything that reads like a claimed quantity and fails if it
finds one. That check exists because the risk is not you writing a false number
today; it is a future edit, a copy-paste, or a model helpfully rounding
something up.

### Employer confidentiality

The four day-job entries describe the *category* of the work — streaming
pipelines, lakehouse maintenance, platform migration, master-data governance —
without naming internal platforms, schemas, vendors or volumes. That restraint
is deliberate and the audit enforces it.

It is also the right call commercially. Publishing an employer's internal system
name buys a little credibility and carries a real risk, and the discipline reads
as competence anyway. An interviewer will ask what you did; that is the moment
for detail, not the front page.

### One judgement call the audit flags rather than decides

**UPSC OS** is listed under Lab. It is real engineering and genuinely
interesting work. It also tells a hiring manager you are preparing for the civil
service. That is fine on a general portfolio and less fine on one attached to a
job application. Delete the entry from `projects` and it disappears everywhere —
case study, work list and constellation.

---

## What is actually on the page

The 3D is why someone stays. The words are what they came for, so there are a
lot of them and they are structured to be scanned before they are read.

**Profile chapter** — a one-sentence summary written to be read in isolation,
because it is what gets skimmed, quoted and pasted. Then role, employer and
location as fact tiles; the stack as six labelled groups rather than one wall of
chips; the Barclays role at category level with five lines of what the work
actually is; and **How I Build** — five stated commitments about deterministic
verdict paths, failing closed, evidence as a first-class output, cryptographic
provenance, and where the real engineering sits.

That last section is the one that matters. Everyone lists Spark. Far fewer will
tell you, before being asked, where they refuse to put a model and what their
systems do when a check cannot complete — and those two answers predict how
somebody behaves at three in the morning better than a tool list ever will.

**Work chapter** — ten projects in three groups, because "built at work" and
"built at night" are different claims and running them together weakens both:

| Group | Projects |
| --- | --- |
| At Barclays | Live streaming · Hadoop → AWS · Iceberg lakehouse · Identity & tokenization |
| Independent ventures | Attestic/MAP · Career Autopilot · CHORON · TinkerLab |
| Lab & content | UPSC OS · Katha Factory |

**Every project opens as a case study**, not a card: the problem first, then the
approach, then how it works, then the stack — with a link into the era it
belongs to and, where one exists, into that era's playable exercise. Problem
first is deliberate; anyone can list what they built, far fewer can say clearly
why it needed building.

**Contact chapter** — email, whichever links have been supplied, the full skill
list, and the operator record if any exercises have been played.

**It prints.** A recruiter will hit Ctrl-P, and a WebGL portfolio that prints as
fifteen blank pages has failed at the last step. The print stylesheet drops the
world, unstacks every chapter, and lays the content out as a plain document with
URLs written out in full.

**It is findable.** Open Graph and Twitter card metadata, and a `Person` JSON-LD
block so the name indexes as a person rather than as a string. The structured
data is deliberately conservative — no dates, no credentials, no `sameAs` —
because a search engine will happily index a fabricated credential and the
correction is far harder than the omission.

---

## The era exercises

Six chapters carry a playable mechanic. They exist because scrolling past
twelve eras of storage media should not feel like scrolling past twelve
paragraphs — and because the fastest way to make someone believe you understand
sequential access is to let them feel a tape head travel.

| | Era | What you actually do | What it is really about |
| --- | --- | --- | --- |
| **ENCODE** | Punch cards | Punch Hollerith zone+digit patterns before the carriage passes | A character is a physical pattern, and the reader reads exactly what is on the card |
| **SEEK** | Magnetic tape | Serve read requests with a head that has mass | On sequential media distance is time; greedy-nearest starves the far end |
| **REPLICATE** | Distributed | Place replicas under the real HDFS policy, then survive outages | A copy is only a copy if it fails separately |
| **COMPACT** | Lakehouse | Bin-pack small files into 128 MB targets and commit | Small files tax every read — and commits are not free either |
| **STREAM** | Live streaming | Move a fixed executor pool as the bottleneck migrates; advance watermarks | Backpressure, skew, and completeness traded against memory |
| **GOVERN** | Governed data | Link records that are the same entity, tokenise before release | Matching is precision vs recall with a legal edge |

### The rules these were held to

**No quizzes.** There is not one multiple-choice question anywhere. If a game
could be replaced by a form, it was cut. The concept is something you feel
through the mechanic, never something you get asked about.

**The concept is the difficulty.** Nothing is made hard by an arbitrary timer
laid on top of an easy task. Sequential access is hard because the head has to
travel. Bin-packing is hard because sealing early wastes space and sealing late
costs queries. The tension in each one is the real operational tension.

**Tap-only is always enough.** No drags, no hovers, no keyboard required. Every
game is fully playable with single taps, because half the people who see this
are on a phone. Keyboard shortcuts exist for people who want them.

**Losing is informative.** Every result screen reports what went wrong in the
language of the era — cards misread, records expired, blocks lost, lag
unbounded, raw fields across the boundary — not just a number.

**Skill has to pay, and this is tested.** The game harness plays every game
three ways: nobody touching anything, a monkey tapping at random twelve times a
second, and a scripted competent player. The build fails if the competent player
does not clearly beat the monkey, if doing nothing scores well, or if random
tapping can reach a good rank. That assertion caught a real design failure: the
replication game originally scored well for spraying the cluster, because with
nine node targets a random tapper spreads across racks by luck. It was rebuilt
around the actual HDFS placement policy — first replica anywhere, second on a
different rack, third alongside the second — with non-conforming writes refused
and a retry backoff. Random play went from 82% of a good score to 24%.

### How they sit in the journey

They are **entirely optional**. Nothing — no chapter, project, contact detail
or piece of the story — is locked behind playing one. A visitor who plays none
of them sees the complete site.

Opening one does not leave the page. The scroll position is pinned to the pixel,
the era you are standing in stays live behind the panel, the camera leans in
slightly, and the character stops touring and starts operating the machine. The
panel is tinted with that era's own colour, so the punch-card exercise is burnt
orange and the lakehouse one is violet.

The world reacts to the play. While an exercise is running, its pressure is fed
straight into that era's own interaction — the racks migrate while you are
placing replicas, the packets surge while your pipeline is backing up. It is the
same action a visitor could fire by hand; the game is just pressing it for them.

Results accumulate into an **operator record** kept in `localStorage`. The
finale's skill constellation is dim by default and brightens with how much of it
you have filled in, and the contact chapter reports your standing across the six
disciplines. Coverage is weighted, so one good run at one discipline does not
make you an ARCHITECT.

---

## How it is built

### The stack, and why

**Vite + three.js from npm.** No CDN, no import maps, no runtime fetching of the
renderer. `npm install && npm run dev` works on a plane.

**No R3F, no GSAP, no scroll library.** The camera work here is a deterministic
function of scroll position, and every animation library worth using is built
around a *timer*. Mixing the two produces a site that keeps moving after you
stop scrolling, which is the single most common failure of this genre. The
scroll timeline is ~200 lines and it does exactly one thing.

**100% procedural geometry and runtime canvas textures.** There is not a single
`.gltf`, `.glb`, `.jpg` or `.hdr` in this repository. Every punch card, tape
reel, platter, rack and crystal is generated in code. That is partly a load-time
argument and mostly a reliability one: there is no asset that can fail to
download, no texture that can arrive after the scene it belongs to, and no
licence to track.

### Directory map

```
src/
  app/          Renderer, capabilities, camera rig, light rig, action bus, App loop
  character/    The guide: skeleton, pose model, animation clips, controller
  scenes/       Thirteen environments + shared props and camera-keyframe helpers
  transitions/  The authored morph between every pair of eras
  timeline/     Scroll → chapter → act → scene-local progress
  games/        Six era exercises, the 2D host, and the operator record
  ui/           Boot, content, strata rail, dock, palette, portal, sound, diagnostics
  data/         portfolio.js — every word the visitor reads
  lib/          Maths, canvas-texture generation, shared scratch objects
tools/          Headless test harnesses
```

### The four ideas that hold it together

**1. One character, literally.**
`HumanGuide` is instantiated once by `App` and lives for the entire session. It
is not re-created per scene, and there is no second model for the modern eras.
Continuity is not simulated by using a similar-looking rig in each scene; it is
the same object, moved. The costume evolves by interpolating eight sets of
material colours and growing or shrinking four accessories, so the scribe
becomes the archivist becomes the operator without a single swap.

**2. The gait is driven by distance, not by time.**
`CharacterController` advances the walk cycle by metres travelled, not by a
clock. Stop scrolling halfway down a corridor and the guide comes to rest and
breathes, instead of marching on the spot. This one decision is most of why the
character reads as *being moved by you* rather than as a looping animation
playing nearby.

**3. Every scene is authored at the world origin.**
Scenes do not sit at different places in a large world; they all occupy the same
space and only one or two are ever visible. That is what makes the morphs
possible: an object leaving the outgoing era and an object arriving in the
incoming one are on the same pixels at the same moment, so a cross-dissolve
reads as a transformation. `TransitionDirector` owns the window in which those
two halves overlap, tuned per pair — the punch-hole-into-tape-reel cut is short
and bright, the racks-into-cluster-topology one is long and soft, because one is
a hard cut through a light source and the other is a re-reading of the same
objects.

**4. Scenes describe; they never control.**
A scene owns geometry and nothing else. It *describes* a camera (as keyframes),
it *declares* a lighting mood (as a descriptor), and it *directs* the character
(by asking for a position and a clip). It does not own the camera, the lights or
the human. That separation is what let thirteen environments get built without
them becoming thirteen private engines — and it is why the guide is
automatically lit by warm lamplight at the scribe's desk and steel blue in the
machine room without any scene containing a line of code about the character's
appearance.

---

## Performance

Quality is decided once at start-up from device memory, core count and WebGL
version, and then continuously adjusted:

| | low | mid | high |
| --- | --- | --- | --- |
| instance/particle density | 32% | 55% | 100% |
| geometry subdivision | 50% | 70% | 100% |
| extra scene lights | 1 | 2 | 4 |
| shadow maps | off | off | on |
| max device pixel ratio | 1.25 | 1.6 | 2 |

`AdaptiveQuality` then watches real frame cost and walks the pixel ratio down if
the device cannot hold the target, recovering slowly once there is headroom, so
one expensive transition does not permanently degrade the page. A low battery
quietly costs resolution and some particles — never the scene.

At most **three eras exist in memory at once**. The timeline builds a scene when
the reading position gets close and disposes it (geometry, materials, textures)
when it moves away.

Every tier keeps the character and the primary geometry of every era. Nothing is
ever silently replaced with text.

---

## Mobile

Mobile is a separate layout, not a squeezed desktop one. The screen is split:
the story plays in the upper band, the words sit in a glass panel below it, and
the camera rig applies a vertical bias that lifts the subject into the visible
band so the character is never hidden behind the text. The 15-layer strata rail
— which is lovely on a wide screen and unusable on a narrow one — is replaced by
a dock with prev/next and a progress bar rather than being shrunk.

Pointer parallax is desktop-only, and it never orbits.

---

## Accessibility and escape hatches

- **`prefers-reduced-motion`** — the world stays, the movement stops. Damping
  goes near-instant, parallax and shake are disabled, film grain is removed, and
  copy stops animating in. The visitor still gets every era; it just does not
  glide.
- **Recruiter mode** — the honest admission that the most impressive thing on
  the page is also the thing most likely to make a busy person leave. It
  collapses every chapter toward one screen, tightens the camera, and drops you
  at the present day. One press puts the full journey back.
- **⌘K / Ctrl-K** — jump straight to any era, project, section or exercise.
- **G** — play the current chapter's exercise, if it has one.
- **Keyboard** — ← / → and PageUp / PageDown step chapters; Escape closes any
  dialog; the boot sequence is skippable with a click or any of Esc/Enter/Space.
- **Deep links** — `/#lakehouse`, `/#choron`, `/#contact` land in place.
- **No WebGL** — a designed fallback: it says what happened, keeps every chapter
  exactly where it was, and gives the words the space the 3D was using. It does
  not silently swap the site for a text dump and pretend that was the plan.
- **No JavaScript** — the `<noscript>` block carries the essentials and a
  working mailto.

Sound is **off by default**, ships zero audio files (everything is synthesized
with oscillators and filtered noise), and removes its own toggle if the Web
Audio API is unavailable.

---

## Testing

There is no browser in CI, so the tests do the part a browser cannot do quickly:

```bash
npm test
```

`tools/smoke.mjs` constructs every scene at both the highest and lowest quality
tier, builds it, steps it across its entire local timeline twice, fires every
era interaction partway through, choreographs the character, asks for a camera
pose at every step, audits every instanced matrix and colour buffer for `NaN`,
and then disposes it and checks nothing was left attached.

`tools/content-audit.mjs` is the publish gate described above: outstanding
sources, fabricated metrics, confidentiality exposure, and structural
completeness of every case study.

`tools/games-smoke.mjs` plays all six exercises at two stage sizes, three ways
each, checking every frame that the score and every meter stay finite and in
range and that no control has drifted outside the stage — then asserts that
skill pays, that idling does not, and that the rank thresholds mean something in
both directions.

`tools/ui-smoke.mjs` renders the full content layer, supplies a synthetic
layout, and walks the entire document 400 times over — asserting that progress
stays monotonic, that local progress never leaves 0…1, that every chapter is
reachable, that the finale's three chapters really do produce one continuous
scene progress, that no more than three scenes are ever held in memory, and that
the strata layer thicknesses sum to exactly 100%. It also asserts the content
rule: that the LinkedIn CTA and the tenure tile do **not** render while their
source data is blank.

Both harnesses found real bugs during development, which is the only reason to
have written them.

---

## What this does not do

Worth saying plainly, since a portfolio that oversells itself is a bad
advertisement for an engineer:

- **CHORON is presented as a concept, not an architecture.** The source material
  did not describe its internals, so the scene is deliberately abstract and the
  copy says so out loud. It is the one place where the visual language is
  non-literal, and that is a content decision rather than a design one.
- **There is no post-processing stack.** No bloom, no SSAO, no TAA. Every glow
  in this project is an additive sprite or an emissive material, because a
  full-screen effect pass is the first thing that puts a mid-range phone under
  30fps and the visual gain did not justify it.
- **Shadows are high-tier only.** Everywhere else the character is grounded by a
  fake contact shadow, which costs almost nothing and — honestly — reads better
  than a low-resolution shadow map at these camera distances.
- **There is not a game per era.** Nine of the thirteen chapters have nothing a
  person can meaningfully *do*, and a mediocre mechanic bolted onto a chapter is
  worse than none, because it teaches the visitor that the buttons are
  decorative.
- **The games are canvas, not 3D.** They need crisp text, exact hit targets and
  a readable layout at 390px. Picking a twelve-row punch card with a raycaster
  would have been worse in every way that matters and cost five times the code.
- **The 3D is not a substitute for a CV.** It is why someone stays; the words
  are what they came for. That is why the copy is real DOM text at every stage,
  and why recruiter mode exists.

---

## Content

`src/data/portfolio.js` is the source of truth for the profile, the experience,
the ten projects, the engineering principles and all fifteen chapters. It is the
only file to audit for invented facts, which is what makes the content rule
enforceable rather than aspirational.

Chapter `span` values control both the scroll length of a section and the
thickness of its layer in the strata rail, so editing one number changes the
pacing and the navigation together.

Everything the site knows about Kamlendu came from him. If any line in that file
does not match what you would say out loud in an interview, change the file —
the site is downstream of it, and the audit will keep it honest.

Contact: **kamlendukumar4480@gmail.com**
