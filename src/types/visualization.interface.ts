export interface VisualizationPoint {
  readonly id: string
  readonly x: number
  readonly y: number
}

export interface VisualizationSnapshot {
  readonly type: 'snapshot'
  readonly points: readonly VisualizationPoint[]
  readonly total: number
}

export interface VisualizationPointMessage {
  readonly type: 'point'
  readonly point: VisualizationPoint
  readonly total: number
}
