import type { EventDef } from '../../engine/types'
import { prologueEvents } from './prologue'
import { apocalypseEvents } from './apocalypse'
import { storyEvents } from './story'
import { choiceEvents } from './choices'

export const events: EventDef[] = [...prologueEvents, ...apocalypseEvents, ...storyEvents, ...choiceEvents]
