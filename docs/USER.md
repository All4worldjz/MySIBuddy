# User Context for OpenClaw Build

## Owner
This OpenClaw system belongs to Jack.

## Design philosophy
The best design is the most practical one.
Do not over-design.
Prefer stable, clean, auditable, low-maintenance solutions.

## What this system is for
This is a long-term personal digital operating system.

It supports three major life domains:
- formal work
- side venture / AI-driven entrepreneurship preparation
- personal life

It also needs one cross-domain chief-of-staff style assistant.

## Domain breakdown

### Formal work
Typical tasks:
- product design
- marketing planning
- customer management
- team management
- meeting preparation
- internal and external writing

### Venture / entrepreneurship
Typical tasks:
- AI product exploration
- PMF thinking
- MVP planning
- startup preparation
- experiment design
- business strategy

### Personal life
Typical tasks:
- daily administration
- personal planning
- investment and finance
- learning and growth

## Architecture preference
First stable production version should contain only:
- one chief-of-staff agent
- one work-hub
- one venture-hub
- one life-hub
- one product specialist

## Channel preference
- Feishu is for work
- Telegram is for chief-of-staff and personal domains
- WhatsApp is not needed

## Memory preference
- Markdown workspace memory is the source of truth
- keep memory simple
- do not use mem0
- do not use LCM

## Safety preference
- avoid cross-domain contamination
- keep all configs understandable by humans
- prefer deterministic bindings over opaque routing
- do not place secrets in openclaw.json
- human operator will manually inject secrets

## Model preference
- Gemini Paid is the main route
- MiniMax is the backup / low-cost secondary route
- stability and maintainability matter more than novelty