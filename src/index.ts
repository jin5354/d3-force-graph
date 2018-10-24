import THREE from 'three'

type RGBA = [number, number, number, number]

interface GraphData {
  nodes: Array<{
    id: string
    name?: string,
    scale?: number,
    image?: string
  }>,
  links: Array<{
    source: string,
    target: string,
    color: RGBA
  }>
}

interface GraphBaseConfig {
  nodeSize: number,
  lineWidth: number,
  showArrow: boolean,
  highLightColor: RGBA,
  showStatTable: boolean,
  roundedImage: boolean
}

interface D3ForceData {
  nodes: Array<string>,
  links: Array<D3Link>
}

interface D3Link {
  source: string,
  target: string
}

interface ProcessedData extends D3ForceData {
  featureInfo: {
    hasName: boolean,
    hasImage: boolean,
    hasLineCustomColor: boolean
  },
  nodeInfoMap: {
    [key: string]: {
      index: number,
      scale: number,
      image: string
    }
  }
}

const GRAPH_BASE_CONFIG: GraphBaseConfig = {
  nodeSize: 20,
  lineWidth: 1,
  showArrow: true,
  highLightColor: [255, 0, 0, 0.6],
  showStatTable: true,
  roundedImage: true
}

export default class D3ForceGraph {
  container: HTMLElement
  data: GraphData

  constructor(dom: HTMLElement, data: GraphData, graphBaseConfig: GraphBaseConfig = GRAPH_BASE_CONFIG) {
    this.container = dom
    this.data = data
  }

  init() {

  }

  preProcessData() {

  }
}
