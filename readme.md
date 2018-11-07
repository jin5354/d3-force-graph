# D3-Force-Graph

[![Build Status](https://travis-ci.org/jin5354/d3-force-graph.svg?branch=master)](https://travis-ci.org/jin5354/d3-force-graph)
![version](https://img.shields.io/npm/v/d3-force-graph.svg)
![mit](https://img.shields.io/npm/l/d3-force-graph.svg)


![demo1](https://user-images.githubusercontent.com/6868950/48123497-05427700-e2b5-11e8-8d12-a260870eabe1.png)
![demo2](https://user-images.githubusercontent.com/6868950/48123158-2e163c80-e2b4-11e8-9521-ddc60c295151.png)

## Intro

D3-Force-Graph is a javascript component which can create a force-directed graph using [D3-force](https://github.com/d3/d3-force) and web worker for calculation layout and [ThreeJS](https://github.com/mrdoob/three.js) for rendering. It can support large amount datasets rendering (~ 100k nodes and links) and custom styles.

[Online Demos](https://webgl.run/list/HJPqwNgpX)

## Install

```bash
npm i d3-force-graph --save
```

## Usage

`let chart = new D3ForceGraph(container, data, config)`

Example:

```javascript
import {D3ForceGraph} from 'd3-force-graph'

let $container = document.getElementById('container')
let testData = {
  nodes: [{
    id: 'TestNodeA'
  }, {
    id: 'TestNodeB'
  }],
  links: [{
    source: 'TestNodeA',
    target: 'TestNodeB'
  }]
}
let chart = new D3ForceGraph($container, testData, {
  width: 500,
  height: 500
})
```

### params

- container: HTMLElement
- data: [GraphData](https://github.com/jin5354/d3-force-graph/blob/master/src/index.ts#L29)
```
{
  nodes: [{
    id: 'c2Fkcw',                             // mandatory,   string,   unique node id
    name: 'TestNodeA'                         // optional,    string,   node alias
    scale: 1                                  // optional,    number,   node size scale, default is 1
    image: 'https://example.com/example.jpg'  // optional,    string,   node image url
  }, ...],
  links: [
    source: 'c2Fkcw',                         // mandatory,   string,   link source node id
    target: 'c2Fkcy',                         // mandatory,   string,   link target node id
   color: [255, 255, 255]                     // optional,    array,    link color, [R, G, B] from 0 ~ 255, default is [255, 255, 255]
  ]
}
```
- config: [GraphBaseConfig](https://github.com/jin5354/d3-force-graph/blob/master/src/index.ts#L43)
```
{
  width: 600,                               // mandatory,   number,   chart width
  height: 600,                              // mandatory,   number,   chart height
  nodeSize: 3000,                           // optional,    number,   node size, rendering node size = nodeSize * node.scale, default is 3000
  arrowSize: 1250,                          // optional,    number,   arrow size, default is 1250
  showArrow: true,                          // optional,    boolean,  show arrow, default is true
  zoomNear: 75,                             // optional,    number,   max zoom in, default is 75
  zoomFar: 16000                            // optional,    number,   max zoom out, default is 16000
}
```

### events

You can use `instance.events.on(eventName, callback)` to add event listener.

- tick: triggered after every d3-force tick event
- end: triggered after d3-force end event

## License
MIT
