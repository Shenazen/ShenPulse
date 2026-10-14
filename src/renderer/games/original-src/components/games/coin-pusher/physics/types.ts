

export type CoinPusherPeg = {
  index: number
  row: number
  x: number
  y: number
}

export type CoinPusherPlinkoBody = {
  id: string
  plinkoAge: number
  plinkoImpactCooldown: number
  plinkoProgressY: number
  plinkoStallSeconds: number
  radius: number
  vx: number
  vy: number
  x: number
  y: number
}

export type CoinPusherCollisionBody = Pick<
  CoinPusherPlinkoBody,
  'id' | 'radius' | 'vx' | 'vy' | 'x' | 'y'
>

export type CoinPusherSettlingBody = Pick<
  CoinPusherCollisionBody,
  'vx' | 'vy' | 'x' | 'y'
> & {
  dropProgress: number
}

export type CoinPusherStackBody = Pick<
  CoinPusherCollisionBody,
  'id' | 'radius' | 'x' | 'y'
> & {
  stackLevel: number
}

export type CoinPusherStackMotionBody = CoinPusherStackBody & Partial<Pick<
  CoinPusherCollisionBody,
  'vx' | 'vy'
>> & {
  stackFalling?: boolean
}

export type CoinPusherStackSpatialEntry<T extends CoinPusherStackBody> = {
  body: T
  cellKey: string
  level: number
  order: number
  x: number
  y: number
}

export type CoinPusherStackSpatialIndex<T extends CoinPusherStackBody> = {
  readonly cellSize: number
  readonly entriesByBody: Map<T, CoinPusherStackSpatialEntry<T>>
  readonly levels: Map<number, Map<string, CoinPusherStackSpatialEntry<T>[]>>
  readonly maximumRadius: number
  readonly normalizeLevels: boolean
  readonly positions?: ReadonlyMap<string, { x: number; y: number }>
}

export type CoinPusherStackSpatialQueryOptions<T extends CoinPusherStackBody> = {
  accept?: (candidate: T) => boolean
  position?: Readonly<{ x: number; y: number }>
  ratio?: number
  supportLevel: number
}

export type CoinPusherPlinkoStepResult = {
  escaped: boolean
  forcedExit: boolean
  impacts: CoinPusherPeg[]
  rescued: boolean
}

export type CoinPusherShelfStepResult = {
  contact: boolean
}

export type CoinPusherUpperTrayStepResult = {
  lostSupport: boolean
  supportEdgeY: number
}

export type CoinPusherUpperTrayBody = CoinPusherCollisionBody & Partial<Pick<
  CoinPusherStackMotionBody,
  'stackFalling' | 'stackLevel'
>>

export type CoinPusherUpperTraySupportState = {
  supported: boolean
}

