import * as THREE from 'three'
import * as v3 from 'v3js'
import * as nodesVS from './shaders/nodes.vs'
import * as nodesFS from './shaders/nodes.fs'
import * as linesFS from './shaders/lines.fs'
import * as linesVS from './shaders/lines.vs'
import * as arrowsVS from './shaders/arrows.vs'
import * as arrowsFS from './shaders/arrows.fs'
import * as imageVS from './shaders/image.vs'
import * as imageFS from './shaders/image.fs'
import * as hlNodesVS from './shaders/hlNodes.vs'
import * as hlNodesFS from './shaders/hlNodes.fs'
import * as hlLinesVS from './shaders/hlLines.vs'
import * as hlLinesFS from './shaders/hlLines.fs'
import * as hlArrowsVS from './shaders/hlArrows.vs'
import * as hlArrowsFS from './shaders/hlArrows.fs'
import * as worker from './worker.js'
import * as arrowPNG from '../assets/arrow.png'
import * as nodePNG from '../assets/node.png'
import mitt from 'mitt'

import './index.css'

window.THREE = THREE
require('three/examples/js/controls/MapControls.js')

type RGB = [number, number, number]

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
    color?: RGB
  }>
}

interface GraphBaseConfig {
  width: number,
  height: number,
  nodeSize?: number,
  arrowSize?: number,
  lineWidth?: number,
  showArrow?: boolean,
  backgroundColor?: RGB,
  highLightColor?: RGB,
  showStatTable?: boolean,
  roundedImage?: boolean,
  zoomNear?: number,
  zoomFar?: number,
  debug?: boolean
}

interface D3ForceData {
  nodes: Array<{
    id: string
  }>,
  links: Array<D3Link>
}

interface D3Link {
  source: string,
  target: string
}

interface ProcessedData extends D3ForceData {
  nodeInfoMap: {
    [key: string]: {
      index: number,
      scale?: number,
      image?: string,
      name?: string,
      imageTexture?: THREE.Texture,
      imagePoint?: ShaderMesh
    }
  },
  linkInfoMap: {
    [key: string]: {
      color?: RGB
    }
  },
  linkBuffer: Int32Array,
  statTable: Array<{
    source: string,
    count: number
  }>
}

interface Mesh {
  geometry: THREE.BufferGeometry,
  material: THREE.Material,
  mesh: THREE.Mesh | THREE.Points | THREE.LineSegments
}

interface ShaderMesh extends Mesh {
  material: THREE.ShaderMaterial,
  positions: Float32Array,
  scale?: Float32Array,
  rotates?: Float32Array,
  colors?: Float32Array
}

interface GraphPerfInfo {
  nodeCounts: number,
  linkCounts: number,
  layoutPastTime: number,
  layoutProgress: string,
  layoutStartTime: number,
  prevTickTime: number,
  targetTick: number,
  intervalTime: number,
  layouting: boolean
}

interface MouseStatus {
  mouseOnChart: boolean,
  mousePosition: THREE.Vector2
}

interface ViewportRect {
  left: number,
  right: number,
  top: number,
  bottom: number
}

interface VisibleNode {
  id: string,
  x: number,
  y: number
}

const GRAPH_BASE_CONFIG: GraphBaseConfig = {
  width: 400,
  height: 400,
  nodeSize: 3000,
  arrowSize: 1250,
  lineWidth: 1,
  showArrow: true,
  backgroundColor: [0, 0, 16],
  highLightColor: [255, 0, 0],
  showStatTable: true,
  roundedImage: true,
  zoomNear: 75,
  zoomFar: 16000,
  debug: false
}

const GRAPH_DEFAULT_PERF_INFO: GraphPerfInfo = {
  nodeCounts: 0,
  linkCounts: 0,
  layoutPastTime: 0,
  layoutProgress: '',
  layoutStartTime: 0,
  prevTickTime: 0,
  targetTick: 0,
  intervalTime: 0,
  layouting: false
}

const textureLoader: THREE.TextureLoader = new THREE.TextureLoader()
const ARROW_TEXTURE = textureLoader.load(arrowPNG)
const NODE_TEXTURE = textureLoader.load(nodePNG)
const BASE_HEIGHT = 500

export class D3ForceGraph {

  $container: HTMLElement
  containerRect: ClientRect
  data: GraphData
  config: GraphBaseConfig
  perfInfo: GraphPerfInfo
  processedData: ProcessedData
  worker: Worker
  targetPositionStatus: Float32Array
  currentPositionStatus: Float32Array
  cachePositionStatus: Float32Array
  mouseStatus: MouseStatus = {
    mouseOnChart: false,
    mousePosition: new THREE.Vector2(-9999, -9999)
  }
  rafId: number
  highlighted: string
  throttleTimer: number
  events: mitt.Emitter
  lockHighlightToken: false

  scene: THREE.Scene
  renderer: THREE.WebGLRenderer
  camera: THREE.PerspectiveCamera
  controls: any

  nodes: ShaderMesh = {
    geometry: null,
    positions: null,
    scale: null,
    material: null,
    mesh: null
  }
  lines: ShaderMesh = {
    geometry: null,
    positions: null,
    colors: null,
    material: null,
    mesh: null
  }
  arrows: ShaderMesh = {
    geometry: null,
    positions: null,
    rotates: null,
    material: null,
    mesh: null
  }
  hlLines: ShaderMesh = {
    geometry: null,
    positions: null,
    material: null,
    mesh: null
  }
  hlNodes: ShaderMesh = {
    geometry: null,
    positions: null,
    scale: null,
    material: null,
    mesh: null
  }
  hlArrows: ShaderMesh = {
    geometry: null,
    positions: null,
    rotates: null,
    material: null,
    mesh: null
  }
  hlText: Mesh = {
    geometry: null,
    material: null,
    mesh: null
  }

  constructor(dom: HTMLElement, data: GraphData, graphBaseConfig: GraphBaseConfig = GRAPH_BASE_CONFIG) {
    this.$container = dom
    this.data = data
    this.config = Object.assign({}, GRAPH_BASE_CONFIG, graphBaseConfig)
    this.perfInfo = GRAPH_DEFAULT_PERF_INFO
    this.events = new mitt()

    this.init()
  }

  init() {
    try {
      this.processedData = this.preProcessData()
      this.perfInfo.nodeCounts = this.processedData.nodes.length
      this.perfInfo.linkCounts = this.processedData.links.length

      this.prepareScene()
      this.prepareBasicMesh()
      this.installControls()
      this.bindEvent()

      this.initWorker()
      this.start()
    }catch(e) {
      console.log(e)
    }
  }

  /**
   * preProcessData
   * preprocess data
   *
   * @returns {ProcessedData}
   * @memberof D3ForceGraph
   */
  preProcessData(): ProcessedData {
    let result: ProcessedData = {
      nodes: [],
      links: [],
      nodeInfoMap: {},
      linkInfoMap: {},
      statTable: [],
      linkBuffer: null
    }

    let nodeCount = 0

    this.data.nodes.forEach(e => {
      if(!result.nodeInfoMap[e.id]) {
        result.nodes.push({
          id: e.id
        })
        result.nodeInfoMap[e.id] = {
          index: nodeCount,
          scale: e.scale,
          image: e.image,
          name: e.name
        }
        nodeCount++
      }
    })

    let linkCountMap: {
      [key: string]: number
    } = {}
    let linkBuffer: Array<number> = []

    this.data.links.forEach(e => {
      let linkInfoKey = `${e.source}-${e.target}`
      if(!result.linkInfoMap[linkInfoKey]) {
        result.links.push({
          source: e.source,
          target: e.target
        })
        linkBuffer.push(result.nodeInfoMap[e.source].index, result.nodeInfoMap[e.target].index)
        result.linkInfoMap[linkInfoKey] = {
          color: e.color && e.color.map(e => e / 255) as RGB
        }
        linkCountMap[e.source] = (linkCountMap[e.source] || 0) + 1
      }
    })

    result.linkBuffer = new Int32Array(linkBuffer)

    result.statTable = Object.keys(linkCountMap).map(e => {
      return {
        source: e,
        count: linkCountMap[e]
      }
    }).sort((a, b) => {
      return b.count - a.count
    })

    if(result.statTable.length > 20) {
      result.statTable.length = 20
    }

    return result
  }

  prepareScene(): void {
    this.scene = new THREE.Scene()
    this.scene.background = new THREE.Color(this.config.backgroundColor[0] / 255, this.config.backgroundColor[1] / 255, this.config.backgroundColor[2] / 255)
    this.renderer = new THREE.WebGLRenderer({
      antialias: true,
      logarithmicDepthBuffer: true
    })
    this.renderer.setSize(this.config.width, this.config.height)
    this.renderer.setPixelRatio(window.devicePixelRatio)
    this.$container.appendChild(this.renderer.domElement)
    this.camera = new THREE.PerspectiveCamera(45, this.config.width / this.config.height, 40, 18000)
    this.camera.position.set(0, 0, this.getPositionZ(this.processedData.nodes.length))
    this.camera.up = new THREE.Vector3(0, 0, 1)
    this.camera.updateProjectionMatrix()
    this.renderer.render(this.scene, this.camera)
    this.containerRect = this.$container.getBoundingClientRect()
    this.$container.classList.add('d3-force-graph-container')
  }

  prepareBasicMesh(): void {
    // 预准备节点与线，使用BufferGeometry，位置先定到-9999
    // z 关系
    // 高亮节点：0.0001
    // 头像：0.00005
    // 节点: 0
    // 高亮箭头：-0.0004
    // 箭头：-0.0007
    // 高亮线：-0.0009
    // 线：-0.001
    this.perfInfo.layoutStartTime = Date.now()

    this.nodes.geometry = new THREE.BufferGeometry()
    this.nodes.positions = new Float32Array(this.perfInfo.nodeCounts * 3)
    this.nodes.scale = new Float32Array(this.perfInfo.nodeCounts)

    this.nodes.material = new THREE.ShaderMaterial({
      uniforms: {
        texture: {
          type: 't',
          value: NODE_TEXTURE
        },
        'u_compensation': {
          value: window.devicePixelRatio * this.config.height / BASE_HEIGHT
        }
      },
      vertexShader: nodesVS({
        nodeSize: this.config.nodeSize.toFixed(8)
      }),
      fragmentShader: nodesFS()
    })

    this.nodes.material.extensions.derivatives = true

    this.processedData.nodes.forEach((e, i) => {
      this.nodes.positions[i * 3] = -9999
      this.nodes.positions[i * 3 + 1] = -9999
      this.nodes.positions[i * 3 + 2] = 0
      this.nodes.scale[i] = this.processedData.nodeInfoMap[e.id].scale || 1
    })

    this.nodes.geometry.addAttribute('position', new THREE.BufferAttribute(this.nodes.positions, 3))
    this.nodes.geometry.addAttribute('scale', new THREE.BufferAttribute(this.nodes.scale, 1))
    this.nodes.geometry.computeBoundingSphere()
    this.nodes.mesh = new THREE.Points(this.nodes.geometry, this.nodes.material)
    this.nodes.mesh.name = 'basePoints'
    this.scene.add(this.nodes.mesh)

    this.lines.geometry = new THREE.BufferGeometry()
    this.lines.positions = new Float32Array(this.perfInfo.linkCounts * 6)
    this.lines.colors = new Float32Array(this.perfInfo.linkCounts * 6)

    this.lines.material = new THREE.ShaderMaterial({
      transparent: true,
      opacity: 0.6,
      vertexShader: linesVS(),
      fragmentShader: linesFS()
    })

    this.processedData.links.forEach((e, i) => {
      this.lines.positions[i * 6] = -9999
      this.lines.positions[i * 6 + 1] = -9999
      this.lines.positions[i * 6 + 2] = -0.001
      this.lines.positions[i * 6 + 3] = -9999
      this.lines.positions[i * 6 + 4] = -9999
      this.lines.positions[i * 6 + 5] = -0.001

      if(this.processedData.linkInfoMap[`${e.source}-${e.target}`].color) {
        this.lines.colors[i * 6] = this.processedData.linkInfoMap[`${e.source}-${e.target}`].color[0]
        this.lines.colors[i * 6 + 1] = this.processedData.linkInfoMap[`${e.source}-${e.target}`].color[1]
        this.lines.colors[i * 6 + 2] = this.processedData.linkInfoMap[`${e.source}-${e.target}`].color[2]
        this.lines.colors[i * 6 + 3] = this.processedData.linkInfoMap[`${e.source}-${e.target}`].color[0]
        this.lines.colors[i * 6 + 4] = this.processedData.linkInfoMap[`${e.source}-${e.target}`].color[1]
        this.lines.colors[i * 6 + 5] = this.processedData.linkInfoMap[`${e.source}-${e.target}`].color[2]
      }else {
        this.lines.colors[i * 6] = 1
        this.lines.colors[i * 6 + 1] = 1
        this.lines.colors[i * 6 + 2] = 1
        this.lines.colors[i * 6 + 3] = 1
        this.lines.colors[i * 6 + 4] = 1
        this.lines.colors[i * 6 + 5] = 1
      }
    })

    this.lines.geometry.addAttribute('position', new THREE.BufferAttribute(this.lines.positions, 3))
    this.lines.geometry.addAttribute('color', new THREE.BufferAttribute(this.lines.colors, 3))
    this.lines.geometry.computeBoundingSphere()

    this.lines.mesh = new THREE.LineSegments(this.lines.geometry, this.lines.material)
    this.lines.mesh.name = 'baseLines'
    this.scene.add(this.lines.mesh)
  }

  initWorker(): void {
    let blob = new Blob([worker], {
      type: 'text/javascript'
    })

    this.worker = new Worker(window.URL.createObjectURL(blob))
  }

  start(): void {
    let message = {
      type: 'start',
      nodes: this.perfInfo.nodeCounts,
      DISTANCE: this.getDistance(this.perfInfo.nodeCounts),
      STRENGTH: this.getStrength(this.perfInfo.nodeCounts),
      COL: this.getCol(this.perfInfo.nodeCounts),
      linksBuffer: this.processedData.linkBuffer.buffer
    }

    this.worker.postMessage(message, [message.linksBuffer])

    this.worker.onmessage = (event) => {
      switch (event.data.type) {
        case('tick'): {
          // 每次 tick 时，记录该次 tick 时间和与上次 tick 的时间差，用于补间动画
          let now = Date.now()
          this.perfInfo.layouting = true
          this.perfInfo.layoutProgress = (event.data.progress * 100).toFixed(2)
          this.perfInfo.layoutPastTime = now - this.perfInfo.layoutStartTime

          this.perfInfo.intervalTime = now - (this.perfInfo.prevTickTime || now)
          this.perfInfo.prevTickTime = now

          if(event.data.currentTick === 1) {
            // 第一帧不画，只记录
            this.targetPositionStatus = new Float32Array(event.data.nodes)
          }else {
            // 第二帧开始画第一帧，同时启动补间
            if(event.data.currentTick === 2) {
              this.currentPositionStatus = this.targetPositionStatus
              this.startRender()
            }

            this.targetPositionStatus = new Float32Array(event.data.nodes)
            // 缓存当前 this.currentPositionStatus
            if(this.currentPositionStatus) {
              let len = this.currentPositionStatus.length
              if(!this.cachePositionStatus) {
                this.cachePositionStatus = new Float32Array(len)
              }
              for(let i = 0; i < len; i++) {
                this.cachePositionStatus[i] = this.currentPositionStatus[i]
              }
            }
            this.perfInfo.targetTick = event.data.currentTick
          }

          this.events.emit('tick', {
            layoutProgress: this.perfInfo.layoutProgress
          })

          break
        }
        case('end'): {
          this.targetPositionStatus = new Float32Array(event.data.nodes)

          this.$container.addEventListener('mousemove', this.mouseMoveHandlerBinded, false)
          this.$container.addEventListener('mouseout', this.mouseOutHandlerBinded, false)

          // 布局结束后，如果鼠标不在图像区域，就停止渲染（节能）
          setTimeout(() => {
            this.perfInfo.layouting = false
            if(this.config.showArrow) {
              this.renderArrow()
            }

            this.events.emit('end')

            setTimeout(() => {
              if(!this.mouseStatus.mouseOnChart) {
                this.stopRender()
              }
            }, 2000)
          }, 2000)
          break
        }
      }
    }
  }

  installControls(): void {
    this.controls = new (THREE as any).MapControls(this.camera, this.renderer.domElement)
    this.controls.enableDamping = true
    this.controls.dampingFactor = 0.25
    this.controls.screenSpacePanning = false
    this.controls.maxPolarAngle = Math.PI / 2
  }

  // 启动渲染
  startRender(): void {
    if(!this.rafId) {
      this.rafId = requestAnimationFrame(this.render.bind(this))
    }
  }

  // 停止渲染，节约性能
  stopRender(): void {
    if(this.rafId) {
      cancelAnimationFrame(this.rafId)
      this.rafId = null
    }
  }

  render(): void {
    this.rafId = null
    // 限制放大缩小距离，最近75，最远16000
    if(this.camera.position.z < this.config.zoomNear) {
      this.camera.position.set(this.camera.position.x, this.camera.position.y, this.config.zoomNear)
    }
    if(this.camera.position.z > this.config.zoomFar) {
      this.camera.position.set(this.camera.position.x, this.camera.position.y, this.config.zoomFar)
    }
    // 节点数大于1000时，执行补间动画
    if(this.perfInfo.nodeCounts > 1000) {
      let now = Date.now()
      let stepTime = now - this.perfInfo.prevTickTime
      if(stepTime <= this.perfInfo.intervalTime) {
        for(let i = 0; i < this.currentPositionStatus.length; i++) {
          this.currentPositionStatus[i] = (this.targetPositionStatus[i] - this.cachePositionStatus[i]) / this.perfInfo.intervalTime * stepTime + this.cachePositionStatus[i]
        }
        this.updatePosition(this.currentPositionStatus)
      }
    }else {
      if(this.currentPositionStatus && this.currentPositionStatus[0] !== this.targetPositionStatus[0]) {
        this.currentPositionStatus = this.targetPositionStatus
        this.updatePosition(this.currentPositionStatus)
      }
    }
    this.checkFinalStatus()
    this.updateHighLight()
    if(!this.perfInfo.layouting && this.camera.position.z < 300) {
      // todo 智能卸载
      this.loadImage()
    }
    this.renderer.render(this.scene, this.camera)
    this.controls && this.controls.update()
    this.startRender()
  }

  checkFinalStatus() {
    if(!this.perfInfo.layouting && this.currentPositionStatus && (this.currentPositionStatus[0] !== this.targetPositionStatus[0])){
      this.currentPositionStatus = this.targetPositionStatus
      this.updatePosition(this.currentPositionStatus)
    }
  }

  renderArrow(): void {
    this.arrows.geometry = new THREE.BufferGeometry()
    this.arrows.positions = new Float32Array(this.perfInfo.linkCounts * 3)
    this.arrows.rotates = new Float32Array(this.perfInfo.linkCounts)

    this.arrows.material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        texture: {
          type: 't',
          value: ARROW_TEXTURE
        },
        'u_compensation': {
          value: window.devicePixelRatio * this.config.height / BASE_HEIGHT
        }
      },
      vertexShader: arrowsVS({
        arrowSize: this.config.arrowSize.toFixed(8)
      }),
      fragmentShader: arrowsFS()
    })

    let vec: v3.Vector3 = new v3.Vector3(0, 1, 0)
    let up: v3.Vector3 = new v3.Vector3(0, 1, 0)
    let offsetDistance = (this.config.arrowSize + this.config.nodeSize) / 1125

    this.processedData.links.forEach((e, i) => {

      // 计算箭头的旋转方向与偏移位置
      let vecX = this.currentPositionStatus[this.processedData.nodeInfoMap[e.target].index * 2] - this.currentPositionStatus[this.processedData.nodeInfoMap[e.source].index * 2]
      let vecY = this.currentPositionStatus[this.processedData.nodeInfoMap[e.target].index * 2 + 1] - this.currentPositionStatus[this.processedData.nodeInfoMap[e.source].index * 2 + 1]
      vec.x = vecX
      vec.y = vecY
      let angle = v3.Vector3.getAngle(vec, up)
      let vecNorm = v3.Vector3.getNorm(vec)
      let offsetX = vecX * offsetDistance / vecNorm
      let offsetY = vecY * offsetDistance / vecNorm
      if(vecX < 0) {
        angle = 2 * Math.PI - angle
      }
      this.arrows.rotates[i] = angle

      this.arrows.positions[i * 3] = this.currentPositionStatus[this.processedData.nodeInfoMap[e.target].index * 2] - offsetX
      this.arrows.positions[i * 3 + 1] = this.currentPositionStatus[this.processedData.nodeInfoMap[e.target].index * 2 + 1] - offsetY
      this.arrows.positions[i * 3 + 2] = -0.0007
    })

    this.arrows.geometry.addAttribute('position', new THREE.BufferAttribute(this.arrows.positions, 3))
    this.arrows.geometry.addAttribute('rotate', new THREE.BufferAttribute(this.arrows.rotates, 1))
    this.arrows.geometry.computeBoundingSphere()
    this.arrows.mesh = new THREE.Points(this.arrows.geometry, this.arrows.material)
    this.arrows.mesh.name = 'arrows'
    this.scene.add(this.arrows.mesh)
  }

  // 更新节点与线的位置
  updatePosition(nodesPosition: Float32Array): void {
    for(let i = 0; i < this.perfInfo.nodeCounts; i++) {
      this.nodes.positions[i * 3] = nodesPosition[i * 2]
      this.nodes.positions[i * 3 + 1] = nodesPosition[i * 2 + 1]
    }
    this.nodes.geometry.attributes.position = new THREE.BufferAttribute(this.nodes.positions, 3)
    this.nodes.geometry.attributes.position.needsUpdate = true
    this.nodes.geometry.computeBoundingSphere()
    for(let i = 0; i < this.perfInfo.linkCounts; i++) {
      this.lines.positions[i * 6] = nodesPosition[this.processedData.nodeInfoMap[this.processedData.links[i].source].index * 2]
      this.lines.positions[i * 6 + 1] = nodesPosition[this.processedData.nodeInfoMap[this.processedData.links[i].source].index * 2 + 1]
      this.lines.positions[i * 6 + 3] = nodesPosition[this.processedData.nodeInfoMap[this.processedData.links[i].target].index * 2]
      this.lines.positions[i * 6 + 4] = nodesPosition[this.processedData.nodeInfoMap[this.processedData.links[i].target].index * 2 + 1]
    }
    this.lines.geometry.attributes.position = new THREE.BufferAttribute(this.lines.positions, 3)
    this.lines.geometry.attributes.position.needsUpdate = true
    this.lines.geometry.computeBoundingSphere()
  }

  // 响应鼠标在图表上移动时的交互，指到某个节点上进行高亮
  updateHighLight(): void {
    let normalMouse = new THREE.Vector2()
    normalMouse.x = this.mouseStatus.mousePosition.x * 2 / this.config.width
    normalMouse.y = this.mouseStatus.mousePosition.y * 2 / this.config.height
    let ray = new THREE.Raycaster()
    ray.setFromCamera(normalMouse, this.camera)
    ray.params.Points.threshold = 2
    let intersects = ray.intersectObjects(this.scene.children).filter(e => e.object.type === 'Points' && !e.object.name.startsWith('hl'))
    if(intersects.length > 0) {
      let target = intersects[0]
      let id
      if(target.object && target.object.name === 'basePoints') {
        id = this.processedData.nodes[target.index].id
      }else if(target.object && target.object.name.startsWith('ava-')) {
        id = (target.object as any).nodeId
      }
      if(id) {
        this.highlight(id)
      }
    }else {
      if(!this.lockHighlightToken) {
        this.unhighlight()
      }
    }
  }

  loadImage(): void {
    // 节流
    if(!this.throttleTimer) {
      this.throttleTimer = window.setTimeout(() => {
        if(!this.camera || this.camera.position.z > 300) {
          clearTimeout(this.throttleTimer)
          this.throttleTimer = null
          return
        }

        let nodes = this.getAllVisibleNodes()
        let nullc = 0
        let havec = 0

        for(let i = 0, len = nodes.length; i < len; i++) {
          let id = nodes[i].id
          let x = this.currentPositionStatus[this.processedData.nodeInfoMap[id].index * 2]
          let y = this.currentPositionStatus[this.processedData.nodeInfoMap[id].index * 2 + 1]
          let info = this.processedData.nodeInfoMap[id]

          if(!info.imageTexture) {
            if(info.image){
              havec++
              textureLoader.load(info.image, (texture) => {
                info.imageTexture = texture
                info.imageTexture.needsUpdate = true
                this.generateAvaPoint(info, id, x, y)
              }, undefined, () => {
                info.image = null
              })
            }else {
              nullc++
            }
          }else {
            this.generateAvaPoint(info, id, x, y)
          }
        }
        this.config.debug && console.log(`同屏节点${nodes.length}个，游客${nullc}个，自定义头像${havec}个`)
        clearTimeout(this.throttleTimer)
        this.throttleTimer = null
      }, 1000)
    }
  }
  generateAvaPoint(info: ProcessedData['nodeInfoMap']['key'], id: string, x: number, y: number): void {
    if(!info.imagePoint) {
      info.imagePoint = {
        geometry: null,
        material: null,
        positions: new Float32Array([x, y, 0.00005]),
        mesh: null
      }
      info.imagePoint.geometry = new THREE.BufferGeometry()
      info.imagePoint.material = new THREE.ShaderMaterial({
        uniforms: {
          texture: {
            type: 't',
            value: info.imageTexture
          },
          'u_compensation': {
            value: window.devicePixelRatio * this.config.height / BASE_HEIGHT
          },
          scale: {
            value: info.scale || 1
          }
        },
        vertexShader: imageVS({
          nodeSize: (this.config.nodeSize.toFixed(8))
        }),
        fragmentShader: imageFS()
      })

      info.imagePoint.material.extensions.derivatives = true

      info.imagePoint.geometry.addAttribute('position', new THREE.BufferAttribute(info.imagePoint.positions, 3))
      info.imagePoint.geometry.computeBoundingSphere()

      info.imagePoint.mesh = new THREE.Points(info.imagePoint.geometry, info.imagePoint.material)
      info.imagePoint.mesh.name = `ava-${id}`
      ;(info.imagePoint.mesh as any).nodeId = id
    }
    if(!this.scene.getObjectByName(`ava-${id}`)) {
      this.scene.add(info.imagePoint.mesh)
      this.config.debug && console.log('loadImage:', id)
    }
  }
  // 获取当前 viewport 下所以可视的节点
  getAllVisibleNodes(): Array<VisibleNode> {
    let viewportRect = this.getViewPortRect()
    let result = []
    for(let i = 0, len = this.perfInfo.nodeCounts; i < len; i++) {
      if(this.targetPositionStatus[i * 2] >= viewportRect.left && this.targetPositionStatus[i * 2] <= viewportRect.right && this.targetPositionStatus[i * 2 + 1] >= viewportRect.bottom && this.targetPositionStatus[i * 2 + 1] <= viewportRect.top) {
        result.push({
          id: this.processedData.nodes[i].id,
          x: this.targetPositionStatus[i * 2],
          y: this.targetPositionStatus[i * 2 + 1]
        })
      }
    }
    return result
  }
  // 根据透视投影模型，计算当前可视区域
  getViewPortRect(): ViewportRect {
    let offsetY = this.camera.position.z * Math.tan(Math.PI / 180 * 22.5)
    let offsetX = offsetY * this.camera.aspect
    return {
      left: this.camera.position.x - offsetX,
      right: this.camera.position.x + offsetX,
      top: this.camera.position.y + offsetY,
      bottom: this.camera.position.y - offsetY
    }
  }

  highlight(id: string): void {
    if(this.highlighted !== id) {
      this.unhighlight()
      this.addHighLight(id)
      this.highlighted = id
    }
  }

  unhighlight(): void {
    let node = this.scene.getObjectByName('hlNodes')
    let line = this.scene.getObjectByName('hlLines')
    let text = this.scene.getObjectByName('hlText')
    this.scene.remove(node)
    this.scene.remove(line)
    this.scene.remove(text)
    if(this.config.showArrow) {
      let arrow = this.scene.getObjectByName('hlArrows')
      this.scene.remove(arrow)
    }
    this.highlighted = null
    this.$container.classList.remove('hl')
  }

  // 根据 id 高亮节点
  addHighLight(sourceId: string): void {
    let sourceNode = this.processedData.nodes.find(e => e.id === sourceId)
    let links = this.processedData.links.filter(e => (e.source === sourceId || e.target === sourceId))
    let targetNodes = links.map(e => {
      return e.target === sourceNode.id ? e.source : e.target
    })
    targetNodes.push(sourceNode.id)

    this.hlNodes.geometry = new THREE.BufferGeometry()
    this.hlNodes.positions = new Float32Array(targetNodes.length * 3)
    this.hlNodes.scale = new Float32Array(targetNodes.length)
    this.hlNodes.material = new THREE.ShaderMaterial({
      transparent: true,
      uniforms: {
        texture: {
          type: 't',
          value: NODE_TEXTURE
        },
        'u_compensation': {
          value: window.devicePixelRatio * this.config.height / BASE_HEIGHT
        }
      },
      vertexShader: hlNodesVS({
        nodeSize: (this.config.nodeSize + 25).toFixed(8)
      }),
      fragmentShader: hlNodesFS()
    })

    this.hlNodes.material.extensions.derivatives = true

    targetNodes.forEach((e, i) => {
      this.hlNodes.positions[i * 3] = this.currentPositionStatus[this.processedData.nodeInfoMap[e].index * 2]
      this.hlNodes.positions[i * 3 + 1] = this.currentPositionStatus[this.processedData.nodeInfoMap[e].index * 2 + 1]
      this.hlNodes.positions[i * 3 + 2] = 0.0001
      this.hlNodes.scale[i] = this.processedData.nodeInfoMap[e].scale || 1
    })

    this.hlNodes.geometry.addAttribute('position', new THREE.BufferAttribute(this.hlNodes.positions, 3))
    this.hlNodes.geometry.addAttribute('scale', new THREE.BufferAttribute(this.hlNodes.scale, 1))
    this.hlNodes.geometry.computeBoundingSphere()

    this.hlNodes.mesh = new THREE.Points(this.hlNodes.geometry, this.hlNodes.material)
    this.hlNodes.mesh.name = 'hlNodes'
    this.scene.add(this.hlNodes.mesh)

    this.hlLines.geometry = new THREE.BufferGeometry()
    this.hlLines.positions = new Float32Array(links.length * 6)
    this.hlLines.material = new THREE.ShaderMaterial({
      opacity: 0.6,
      vertexShader: hlLinesVS(),
      fragmentShader: hlLinesFS()
    })

    links.forEach((e, i) => {
      this.hlLines.positions[i * 6] = this.currentPositionStatus[this.processedData.nodeInfoMap[e.source].index * 2]
      this.hlLines.positions[i * 6 + 1] = this.currentPositionStatus[this.processedData.nodeInfoMap[e.source].index * 2 + 1]
      this.hlLines.positions[i * 6 + 2] = -0.0009
      this.hlLines.positions[i * 6 + 3] = this.currentPositionStatus[this.processedData.nodeInfoMap[e.target].index * 2]
      this.hlLines.positions[i * 6 + 4] = this.currentPositionStatus[this.processedData.nodeInfoMap[e.target].index * 2 + 1]
      this.hlLines.positions[i * 6 + 5] = -0.0009
    })

    this.hlLines.geometry.addAttribute('position', new THREE.BufferAttribute(this.hlLines.positions, 3))
    this.hlLines.geometry.computeBoundingSphere()

    this.hlLines.mesh = new THREE.LineSegments(this.hlLines.geometry, this.hlLines.material)
    this.hlLines.mesh.name = 'hlLines'
    this.scene.add(this.hlLines.mesh)

    if(this.config.showArrow) {
      this.hlArrows.geometry = new THREE.BufferGeometry()
      this.hlArrows.positions = new Float32Array(links.length * 3)
      this.hlArrows.rotates = new Float32Array(links.length)

      this.hlArrows.material = new THREE.ShaderMaterial({
        uniforms: {
          texture: {
            type: 't',
            value: ARROW_TEXTURE
          },
          'u_compensation': {
            value: window.devicePixelRatio * this.config.height / BASE_HEIGHT
          }
        },
        vertexShader: hlArrowsVS({
          arrowSize: (this.config.arrowSize + 25).toFixed(8)
        }),
        fragmentShader: hlArrowsFS()
      })

      let vec = new v3.Vector3(0, 1, 0)
      let up = new v3.Vector3(0, 1, 0)
      let offsetDistance = (this.config.arrowSize + this.config.nodeSize) / 1125

      links.forEach((e, i) => {

        // 计算箭头的旋转方向与偏移位置
        let vecX = this.currentPositionStatus[this.processedData.nodeInfoMap[e.target].index * 2] - this.currentPositionStatus[this.processedData.nodeInfoMap[e.source].index * 2]
        let vecY = this.currentPositionStatus[this.processedData.nodeInfoMap[e.target].index * 2 + 1] - this.currentPositionStatus[this.processedData.nodeInfoMap[e.source].index * 2 + 1]
        vec.x = vecX
        vec.y = vecY
        let angle = v3.Vector3.getAngle(vec, up)
        let vecNorm = v3.Vector3.getNorm(vec)
        let offsetX = vecX * offsetDistance / vecNorm
        let offsetY = vecY * offsetDistance / vecNorm
        if(vecX < 0) {
          angle = 2 * Math.PI - angle
        }
        this.hlArrows.rotates[i] = angle

        this.hlArrows.positions[i * 3] = this.currentPositionStatus[this.processedData.nodeInfoMap[e.target].index * 2] - offsetX
        this.hlArrows.positions[i * 3 + 1] = this.currentPositionStatus[this.processedData.nodeInfoMap[e.target].index * 2 + 1] - offsetY
        this.hlArrows.positions[i * 3 + 2] = -0.0004
      })

      this.hlArrows.geometry.addAttribute('position', new THREE.BufferAttribute(this.hlArrows.positions, 3))
      this.hlArrows.geometry.addAttribute('rotate', new THREE.BufferAttribute(this.hlArrows.rotates, 1))
      this.hlArrows.geometry.computeBoundingSphere()
      this.hlArrows.mesh = new THREE.Points(this.hlArrows.geometry, this.hlArrows.material)
      this.hlArrows.mesh.name = 'hlArrows'
      this.scene.add(this.hlArrows.mesh)
    }

    let canvas1 = document.createElement('canvas')
    let context1 = canvas1.getContext('2d')
    canvas1.width = 512
    canvas1.height = 64
    context1.clearRect(0, 0, canvas1.width, canvas1.height)
    context1.font = 'Bold 24px Arial'
    context1.textAlign = 'center'
    context1.fillStyle = 'rgb(255,255,255)'
    let text = sourceId.startsWith('null') ? 'null' : (this.processedData.nodeInfoMap[sourceId].name || sourceId)
    context1.fillText(text, canvas1.width / 2, 50)
    let fontTexture = new THREE.Texture(canvas1)
    fontTexture.needsUpdate = true
    this.hlText.material = new THREE.MeshBasicMaterial({
      map: fontTexture,
      side: THREE.DoubleSide,
      alphaTest: 0.5
    })
    this.hlText.material.transparent = true
    this.hlText.mesh = new THREE.Mesh(
        new THREE.PlaneGeometry(canvas1.width, canvas1.height),
        this.hlText.material as THREE.MeshBasicMaterial
    )
    this.hlText.mesh.scale.set(0.12, 0.12, 0.12)
    let fontMeshPosition = [this.currentPositionStatus[this.processedData.nodeInfoMap[sourceId].index * 2], this.currentPositionStatus[this.processedData.nodeInfoMap[sourceId].index * 2 + 1] - 4, 0.02]
    this.hlText.mesh.position.set(fontMeshPosition[0], fontMeshPosition[1], 0)
    this.hlText.mesh.name = 'hlText'
    this.scene.add(this.hlText.mesh)

    this.$container.classList.add('hl')
  }

  mouseMoveHandler(event: MouseEvent): void {
    this.mouseStatus.mouseOnChart = true
    this.mouseStatus.mousePosition.x = event.clientX - this.containerRect.left - this.config.width / 2
    this.mouseStatus.mousePosition.y = this.config.height - event.clientY + this.containerRect.top - this.config.height / 2
  }
  mouseOutHandler(): void {
    this.mouseStatus.mouseOnChart = false
    this.mouseStatus.mousePosition.x = -9999
    this.mouseStatus.mousePosition.y = -9999
  }

  mouseMoveHandlerBinded = this.mouseMoveHandler.bind(this)
  mouseOutHandlerBinded = this.mouseOutHandler.bind(this)

  chartMouseEnterHandler(): void {
    this.mouseStatus.mouseOnChart = true
    clearTimeout(this.throttleTimer)
    this.throttleTimer = null
    // 开启渲染
    this.startRender()
  }

  chartMouseLeaveHandler(): void {
    this.mouseStatus.mouseOnChart = false
    // 关闭渲染
    if(!this.perfInfo.layouting && !this.lockHighlightToken) {
      this.stopRender()
    }
  }

  chartMouseEnterHandlerBinded = this.chartMouseEnterHandler.bind(this)
  chartMouseLeaveHandlerBinded = this.chartMouseLeaveHandler.bind(this)

  // 绑定事件
  bindEvent(): void {
    this.$container.addEventListener('mouseenter', this.chartMouseEnterHandlerBinded)
    this.$container.addEventListener('mouseleave', this.chartMouseLeaveHandlerBinded)
  }

  // 解绑事件
  unbindEvent(): void {
    this.$container.removeEventListener('mouseenter', this.chartMouseEnterHandlerBinded)
    this.$container.removeEventListener('mouseleave', this.chartMouseLeaveHandlerBinded)
    this.$container.removeEventListener('mousemove', this.mouseMoveHandlerBinded)
    this.$container.removeEventListener('mouseout', this.mouseOutHandlerBinded)
  }

  destroy(): void {
    this.stopRender()
    this.unbindEvent()
    this.scene = null
    this.camera = null
    this.controls = null
    this.targetPositionStatus = null
    this.currentPositionStatus = null
    this.cachePositionStatus = null
    this.nodes = {
      geometry: null,
      positions: null,
      scale: null,
      material: null,
      mesh: null
    }
    this.lines = {
      geometry: null,
      positions: null,
      colors: null,
      material: null,
      mesh: null
    }
    this.arrows = {
      geometry: null,
      positions: null,
      rotates: null,
      material: null,
      mesh: null
    }
    this.hlLines = {
      geometry: null,
      positions: null,
      material: null,
      mesh: null
    }
    this.hlNodes = {
      geometry: null,
      positions: null,
      scale: null,
      material: null,
      mesh: null
    }
    this.hlArrows = {
      geometry: null,
      positions: null,
      rotates: null,
      material: null,
      mesh: null
    }
    this.hlText = {
      geometry: null,
      material: null,
      mesh: null
    }
    this.renderer.domElement.parentElement.removeChild(this.renderer.domElement)
    this.renderer = null
  }

  resize(width: number, height: number) {
    this.camera.aspect = width / height
    // todo: rerender basic mesh
    // this.config.width = width
    // this.config.height = height
    this.camera.updateProjectionMatrix()
    this.renderer.setSize(width, height)
    this.renderer.render(this.scene, this.camera)
  }

  // Fitting equation (Four Parameter Logistic Regression)
  // nodesCount: 14,969,11007,50002
  // z: 500,3000,7500,16000
  // nodesCount: 14,764,11007,50002
  // COL: 2,2.5,3.5,5
  // DISTANCE: 20,25,40,50
  // STRENGTH: 3,5,8,10
  getPositionZ(nodesCount: number): number {
    return (3.04139028390183E+16 - 150.128392537138) / (1 + Math.pow(nodesCount / 2.12316143430556E+31, -0.461309470817812)) + 150.128392537138
  }
  getDistance(nodesCount: number): number {
    return (60.5026920478786 - 19.6364818002641) / (1 + Math.pow(nodesCount / 11113.7184968341, -0.705912886177758)) + 19.6364818002641
  }
  getStrength(nodesCount: number): number {
    return -1 * ((15.0568640234622 - 2.43316256810301) / (1 + Math.pow(nodesCount / 19283.3978670675, -0.422985777119439)) + 2.43316256810301)
  }
  getCol(nodesCount: number): number {
    return (2148936082128.1 - 1.89052009608515) / (1 + Math.pow(nodesCount / 7.81339751933109E+33, -0.405575129002072)) + 1.89052009608515
  }
}
