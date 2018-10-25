importScripts('/_/d3-collection.v1.min.js')
importScripts('/_/d3-dispatch.v1.min.js')
importScripts('/_/d3-quadtree.v1.min.js')
importScripts('/_/d3-timer.v1.min.js')
importScripts('/_/d3-force.v1.min.js')

let simulation = null
let n = 0
let i = 0

onmessage = function(event) {
  if(event.data.type === 'start') {
    let nodes = []
    for(let i = 0; i < event.data.nodes; i++) {
      nodes.push({
        id: i
      })
    }
    let links = []
    let buffer = new Int32Array(event.data.linksBuffer)

    for(let i = 0; i < buffer.length / 2; i++) {
      links.push({
        source: buffer[2 * i],
        target: buffer[2 * i + 1]
      })
    }

    simulation = d3.forceSimulation(nodes)
      .force("charge", d3.forceManyBody().strength(event.data.STRENGTH))
      .force("link", d3.forceLink(links).id(d => d.id).distance(event.data.DISTANCE).strength(1))
      .force('center', d3.forceCenter(0, 0))
      .force('collision', d3.forceCollide().radius(event.data.COL))
      .stop()

    let maxN = Math.ceil(Math.log(simulation.alphaMin()) / Math.log(1 - simulation.alphaDecay()))

    if(nodes.length > 5000) {
      n = 50
    }else {
      n = maxN
    }

    for (i = 1; i <= n; ++i) {
      let bufferNode = []
      nodes.forEach(e => {
        bufferNode.push(e.x, e.y)
      })
      let message = {
        type: 'tick',
        progress: i / n,
        currentTick: i,
        nodes: new Float32Array(bufferNode).buffer
      }
      postMessage(message, [message.nodes])
      simulation.tick()
      if(i === n) {
        let message = {
          type: 'end',
          nodes: new Float32Array(bufferNode).buffer
        }
        postMessage(message, [message.nodes])
      }
    }
  }else if(event.data.type === 'stop') {
    simulation.stop()
  }
}