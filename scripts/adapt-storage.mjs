import fs from 'node:fs/promises'
import path from 'node:path'
import ts from '../frontend/node_modules/typescript/lib/typescript.js'
import { parse } from '../frontend/node_modules/vue/compiler-sfc/index.mjs'

const root = path.resolve('frontend/src')
let changed = 0
async function walk(directory) {
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const filename = path.join(directory, entry.name)
    if (entry.isDirectory()) {
      if (!['__tests__', 'test', 'desktop'].includes(entry.name)) await walk(filename)
      continue
    }
    if (!/\.(ts|vue)$/.test(entry.name) || /\.(spec|test|d)\.ts$/.test(entry.name)) continue
    const source = await fs.readFile(filename, 'utf8')
    if (source.includes('desktopStorage as localStorage')) continue
    let script = source
    let offset = 0
    if (entry.name.endsWith('.vue')) {
      const descriptor = parse(source).descriptor
      const block = descriptor.scriptSetup || descriptor.script
      if (!block) continue
      script = block.content
      offset = block.loc.start.offset
    }
    const ast = ts.createSourceFile(filename + '.ts', script, ts.ScriptTarget.Latest, true)
    let used = false
    const replacements = []
    function visit(node) {
      if (ts.isPropertyAccessExpression(node) && ['window', 'globalThis'].includes(node.expression.getText(ast)) && node.name.text === 'localStorage') {
        replacements.push({ start: offset + node.getStart(ast), end: offset + node.end })
        used = true
        return
      }
      if (ts.isIdentifier(node) && node.text === 'localStorage' && !(ts.isPropertyAccessExpression(node.parent) && node.parent.name === node)) used = true
      ts.forEachChild(node, visit)
    }
    visit(ast)
    if (!used) continue
    let result = source
    for (const replacement of replacements.sort((a, b) => b.start - a.start)) result = result.slice(0, replacement.start) + 'localStorage' + result.slice(replacement.end)
    result = result.slice(0, offset) + "\nimport { desktopStorage as localStorage } from '@/desktop/storage'\n" + result.slice(offset)
    await fs.writeFile(filename, result)
    changed++
  }
}
await walk(root)
console.log(`Adapted ${changed} native storage consumers.`)
