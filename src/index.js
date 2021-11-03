import { obtain, isArray, isEmpty, getType } from "@lsky/tools"

import axios from "axios"
import format from "string-format"

// 每个node字段
// node: {
//   key: String,
//   title: String,
//   _props: Array,
//   children: Array,
//   value: string | number | boolean,
//   type: fetch | static | style | string,  类型， TODO: type === undefined 则为修改；type = fetch 表示请求； type = style, 将会组成一个集合 style； type = static 表示静态数据，value值将有服务端生成，不展示在cake中； type 是其他，则代表组件或者html tag
//   propsName: String,  // 指定 propsName，便于替换
//   requestData: object, // fetch 返回的数据
//   payload: stringFormat | query | data, // stringFormat => 使用 string-format 格式化，详见：string-format； query => url query； data => request data
//   options: {},   // 请参照 axios 请求参数，该参数仅用于 type = fetch
//   path: String,    // 请注意：此字段用于服务端，表示相对于根路径，文件路径，将会根据匹配值替换
//   match: String,   // 请注意：该字段用于服务端，表示匹配参数
// }

const NodeKeys = [
  "key",
  "title",
  "_props",
  "type",
  "children",
  "value",
  "propsName",
  "requestData",
  "payload",
  "options",
  "path",
  "match",
]

// ————————————————————————————————————————

/**
 * 转换 node 的value
 * @param {object} node 节点
 * @returns props
 */
export const transformToProps = (node) => {
  const result = {}
  if (node.type === "fetch") {
    return result
  }
  if (!isEmpty(node.value)) {
    result[obtain(node, "propsName", node.key)] = node.value
    return result
  }
  if (isArray(node._props)) {
    node._props.forEach((n) => {
      if (!isEmpty(n.value) && n.type !== "fetch") {
        if (n.type === "style") {
          // style 将会组合集合 style
          const s = obtain(result, "style", {})
          s[n.key] = n.value
          result.style = s
        } else {
          result[obtain(n, "propsName", n.key)] = n.value
        }
      }
    })
  }
  return result
}

export function getNodeByKeys(key, data) {
  if (isEmpty(key) || isEmpty(data)) return null
  const keys = key.split(".")
  let d = data
  let k = null
  while (!isEmpty(keys)) {
    k = keys.shift()
    // eslint-disable-next-line no-loop-func
    const n = d && d.find((v) => v.key === k)
    d = n
    if (!isEmpty(keys)) {
      d = obtain(d, "children")
    }
  }

  if (obtain(d, "key") === k) {
    return d
  }
  return null
}

/**
 * 通过 key 获取 props
 * 注意：需要特殊处理 type = fetch
 * 注意：需要处理 propsName
 * @param {string} key key；ex: header.top.logoText
 * @param {array} data 数据
 * @param {object} defaultValue 默认值
 * @returns props
 */
export function getValueByKeys(key, data, defaultValue = {}) {
  if (isEmpty(key) || isEmpty(data)) return defaultValue
  const d = getNodeByKeys(key, data)
  if (!isEmpty(d)) {
    const result = transformToProps(d)
    // 如果 node.type === fetch
    // 特殊处理
    if (obtain(d, "type") === "fetch") {
      result[obtain(d, "propsName", d.key)] = obtain(
        d,
        "requestData",
        obtain(defaultValue, obtain(d, "propsName", d.key))
      )
    }
    if (obtain(d, "_props", []).find((v) => v.type === "fetch")) {
      const _p = obtain(d, "_props", []).find((v) => v.type === "fetch")
      const pn = obtain(_p, "propsName", _p.key)
      const requestData = obtain(d, "requestData", obtain(defaultValue, pn))
      result[pn] = requestData
    }
    return result
  }
  return {}
}

// -----------------------------------------------

// 将 tree node 格式化
export const formatTreeNodeToBase = (node) => {
  if (isEmpty(node)) return {}
  return NodeKeys.reduce((acc, cur) => {
    acc[cur] = obtain(node, cur, undefined)
    return acc
  }, {})
}

// 转换节点数据，变为 form value
export const transformToFormValue = (node) => {
  const result = {}
  if (isEmpty(node)) return result
  if (!isEmpty(node.value)) {
    result[node.key] = node.value
    return result
  }
  if (isArray(node._props)) {
    node._props.forEach((v) => {
      result[v.key] = v.value
    })
  }
  return result
}

/**
 * 转换节点，生成指定格式的数据
 * @param {object} node 节点
 * @returns {
 * key,
 * title,
 * value,
 * type,
 * render,
 * }
 */
const transformToRender = (node) => {
  if (isEmpty(node)) return null
  return {
    key: node.key,
    title: node.title,
    value: node.value,
    type: node.type,
    render: getType(node.value),
  }
}

/**
 * 处理节点数据，返回 render 数组
 * @param {object} node 节点数据
 * @returns RenderNode[]
 */
export const handleNodeToRender = (node) => {
  if (isEmpty(node)) return []
  // 如果存在 value，则直接返回
  if (!isEmpty(node.value)) {
    return [transformToRender(node)]
  }
  let res = []
  if (isArray(node._props)) {
    res = node._props.map((n) => transformToRender(n))
  }
  return res
}

// 将 form value 更新到 node 里
export const updateValueToNode = (form, node) => {
  const target = formatTreeNodeToBase(node)
  // form 是一个 object
  // 如果 target 中存在 value 字段，则只需要更新当前字段即可
  if (!isEmpty(target.value)) {
    target.value = form[target.key]
  }
  if (isArray(target._props)) {
    const { _props } = target
    target._props = _props.map((n) => {
      n.value = form[n.key]
      return n
    })
  }
  return [target, node.pos]
}

// 将修改后的 node 更新到 元数据 中
export const updateNodeToRaw = (raw, node, pos) => {
  if (isEmpty(pos)) return raw
  const position = pos.split("-")
  // pos 第一个位置为 0
  let p = position.shift()
  let r = raw
  while (!isEmpty(position)) {
    p = +position.shift()
    r = r[p]
    if (!isEmpty(position)) {
      r = r.children
    }
  }

  if (node.key === obtain(r, "key")) {
    for (const [key, v] of Object.entries(node)) {
      r[key] = v
    }
  }
  return raw
}

// --------------------
// fetch 相关
// ---------
// 判断是否存在 type = fetch，并取出node
export const checkIsexistFetch = (node, match = "type", target = "fetch") => {
  const nn = formatTreeNodeToBase(node)
  let n = {}
  if (isEmpty(nn)) return n
  if (!isEmpty(nn.value)) {
    if (obtain(nn, match) === target) {
      n = nn
    }
  }
  if (isArray(nn._props)) {
    n = nn._props.find((t) => t[match] === target)
  }
  return n
}

export const fetchData = (node) => {
  const { value, payload, options } = node
  let { url } = options
  const { data } = options
  switch (payload) {
    case "stringFormat":
      url = format(url, value)
      break
    case "query":
      // eslint-disable-next-line no-case-declarations
      const query = [`${node.key}=${value}`]
      if (!isEmpty(data)) {
        Object.keys(data).forEach((key) => {
          query.push(`${key}=${data[key]}`)
        })
      }
      url = `${url}?${query.join("&")}`
      break
    case "data":
      break
    default:
      break
  }
  options.url = url
  return axios(options)
}

// 处理元数据，分为静态数据和可修改数据
export const handleRawData = (data) => {
  if (isEmpty(data)) return [null, null]
  const st = []
  const result = []
  data.forEach((node) => {
    if (node.type === "static") {
      st.push(node)
    } else {
      result.push(node)
    }
  })
  return [st, result]
}
