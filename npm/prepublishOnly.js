'use strict'

const { promises: fsp } = require('fs')
const README_SRC = 'README.adoc'
const README_HIDDEN = '.' + README_SRC
const README_DEST = 'README.md'
const ADMONITION_EMOJI = { NOTE: '📌', TIP: '💡', IMPORTANT: '❗' }

// eslint-disable-next-line prefer-regex-literals
const RefMacroRx = new RegExp('(image:)?(?:(https?:[^\\[]+)|{([a-z0-9_-]+)}([^[ ]+)?)\\[(|.*?[^\\\\])\\]', 'g')

function markdownify (asciidoc) {
  const attrs = asciidoc
    .split('\n\n')[0]
    .split('\n')
    .filter((line) => line.charAt() === ':')
    .reduce((accum, line) => {
      let [, name, value] = line.match(/^:([^:]+):(?: (.+)|)$/)
      if (value && ~value.indexOf('{')) value = value.replace(/\{([^}]+)\}/, (_, refname) => accum[refname])
      accum[name] = value || ''
      return accum
    }, {})
  let verbatim = false
  let skipping = false
  let prev
  return asciidoc
    .split('\n')
    .reduce((accum, line) => {
      const line_ = line
      const chr0 = line.charAt()
      if (chr0) {
        if (chr0 === ':' || chr0 === '[') {
          line = undefined
        } else if (line === 'endif::[]') {
          line = undefined
          accum.pop()
          skipping = false
        } else if (skipping || line === 'ifdef::badges[]') {
          line = undefined
          skipping = true
        } else if (chr0 === '=') {
          line = line.replace(/^=+(?= \S)/, (m) => '#'.repeat(m.length))
        } else if (chr0 === '.' && line.charAt(1) !== ' ') {
          line = `**${line.substr(1)}**\n`
        } else if (line === '----') {
          line = '````'
          if ((verbatim = !verbatim)) {
            const lang = prev && prev.charAt(0) === '[' ? prev.substr(1, prev.length - 2).split(',')[1] : undefined
            if (lang) line += lang
          }
        } else if (!verbatim && chr0 !== ' ') {
          line = line
            .replace(
              RefMacroRx,
              (_, img, uri, attrname, pathname, content) =>
                `${img ? '!' : ''}[${content.split(',')[0]}](${attrname ? attrs[attrname] : uri}${pathname || ''})`
            )
            .replace(/\*.+?\*/g, '*$&*')
            .replace(/\b_(.+?)_\b/g, '*$1*')
            .replace(/`\\/g, '`')
            .replace(/^(NOTE|TIP|IMPORTANT):\s/, (_, label) => `${ADMONITION_EMOJI[label]} **${label}:** `)
        }
      }
      if (line !== undefined) accum.push(line)
      prev = line_
      return accum
    }, [])
    .join('\n')
}

function writeMarkdown (asciidoc) {
  return fsp.writeFile(README_DEST, markdownify(asciidoc))
}

/**
 * Transforms the AsciiDoc README (README.adoc) in the working directory into
 * Markdown format (README.md) and hides the AsciiDoc README (.README.adoc).
 */
;(async () => {
  const readmeSrc = await fsp.stat(README_SRC).then((stat) => (stat.isFile() ? README_SRC : README_HIDDEN))
  const writeP = fsp.readFile(readmeSrc, 'utf8').then((asciidoc) => writeMarkdown(asciidoc))
  const renameP = readmeSrc === README_SRC ? fsp.rename(README_SRC, README_HIDDEN) : Promise.resolve()
  await Promise.all([writeP, renameP])
})()