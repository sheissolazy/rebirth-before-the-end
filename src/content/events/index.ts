import type { EventDef } from '../../engine/types'
import { prologueEvents } from './prologue'
import { apocalypseEvents } from './apocalypse'
import { storyEvents } from './story'

export const events: EventDef[] = [...prologueEvents, ...apocalypseEvents, ...storyEvents]
