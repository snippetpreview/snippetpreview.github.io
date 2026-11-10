import { renderMarkdownView } from '../src/providers/markdown-view'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
}

// The rendered document embeds the escaped source in a textarea, so assertions
// about markup have to look at the article body only.
function renderedBody(html: string): string {
  const start = html.indexOf('<article class="markdown-content">')
  const end = html.lastIndexOf('</article>')
  return start >= 0 && end > start ? html.slice(start, end) : html
}

const source = `# Guide

| Name | Value |
| --- | --- |
| one | **two** |

- [x] done
- [ ] todo

Inline math $a^2 + b^2 = c^2$ and bracket math \\(x + 1\\).

$$
\\frac{1}{2}
$$

\\[
E = mc^2
\\]

\`\`\`js
const value = '$not math$'
\`\`\`

\`\`\`mermaid
graph TD
  A --> B
\`\`\`

<details open><summary>More</summary><script>alert('bad')</script></details>

[guide](./guide.md) ![image](./assets/image.png)
[bare guide](guide.md) ![bare image](assets/image.png) [bare file](docs/notes.md)`

const html = renderMarkdownView({
  filename: 'README.md',
  sourceUrl: 'https://gist.githubusercontent.com/user/id/raw/README.md',
  source
})

assert(html.includes('<h1>Guide</h1>'), 'heading was not rendered')
assert(html.includes('<table>'), 'table was not rendered')
assert(html.includes('task-list-item-checkbox'), 'task list was not rendered')
assert(html.includes('class="math-inline"'), 'inline math wrapper was not rendered')
assert(html.includes('class="math-display"'), 'display math wrapper was not rendered')
assert((html.match(/class="math-inline"/g) || []).length === 2, 'both inline math delimiter forms were not rendered')
assert((html.match(/class="math-display"/g) || []).length === 2, 'both display math delimiter forms were not rendered')
assert(html.includes('class="mermaid"'), 'Mermaid fallback was not rendered')
assert(html.includes('class="language-js"'), 'language class was not rendered')
assert(html.includes('$not math$'), 'fenced code was altered')
assert(html.includes('href="./guide.md"'), 'relative link was not preserved')
assert(html.includes('src="./assets/image.png"'), 'relative image was not preserved')
assert(html.includes('href="guide.md"'), 'bare relative link without a leading ./ was not preserved')
assert(html.includes('src="assets/image.png"'), 'bare relative image without a leading ./ was not preserved')
assert(html.includes('href="docs/notes.md"'), 'bare relative link with a directory prefix was not preserved')
assert(html.includes('<details open>'), 'safe HTML was removed')
assert(!html.includes('<script>alert'), 'unsafe script was preserved')
assert(!html.includes('onclick='), 'event handler was preserved')

const unsafeHtml = renderMarkdownView({
  filename: 'unsafe.md',
  sourceUrl: 'https://gist.githubusercontent.com/user/id/raw/unsafe.md',
  source: '[bad link](javascript:alert(1)) ![bad image](javascript:alert(1))'
})

assert(!unsafeHtml.includes('href="javascript:') && !unsafeHtml.includes('src="javascript:'), 'unsafe URL scheme was preserved')

const obfuscatedUrlHtml = renderMarkdownView({
  filename: 'obfuscated.md',
  sourceUrl: 'https://gist.githubusercontent.com/user/id/raw/obfuscated.md',
  source: '<a href="jav&#x09;ascript:alert(1)">x</a><a href="data:text/html,<b>x</b>">y</a>'
})

assert(!/href="[^"]*ascript:/i.test(obfuscatedUrlHtml), 'obfuscated URL scheme was preserved')
assert(!obfuscatedUrlHtml.includes('href="data:'), 'unsafe data URL was preserved')

const invalidMathHtml = renderMarkdownView({
  filename: 'invalid.md',
  sourceUrl: 'https://gist.githubusercontent.com/user/id/raw/invalid.md',
  source: String.raw`Before $\unknowncommand$ after`
})

assert(invalidMathHtml.includes('class="math-error"'), 'invalid math fallback was not rendered')
assert(invalidMathHtml.includes('Before') && invalidMathHtml.includes('after'), 'invalid math broke surrounding Markdown')

const dollarInHtmlTable = renderedBody(renderMarkdownView({
  filename: 'table.md',
  sourceUrl: 'https://gist.githubusercontent.com/user/id/raw/table.md',
  source: `<table>
<tr><td>math mode</td><td><code>$</code></td></tr>
</table>

A paragraph after the table.

### Heading after the table

\`\`\`latex
% \$ x_1^2 \$ stays code
\`\`\`

Inline \`\$...\$\` stays code.`
}))

assert(dollarInHtmlTable.includes('<table>'), 'raw HTML table was escaped')
assert(!dollarInHtmlTable.includes('&lt;table'), 'raw HTML table was escaped into text')
assert(dollarInHtmlTable.includes('<h3>Heading after the table</h3>'), 'a lone dollar swallowed following Markdown')
assert(dollarInHtmlTable.includes('<code>$</code>'), 'a code element inside a raw HTML block was rewritten as math')
assert(dollarInHtmlTable.includes('% $ x_1^2 $ stays code'), 'a fenced code block was treated as math')
assert(dollarInHtmlTable.includes('<code>$...$</code>'), 'an inline code span was treated as math')

const displayMathHtml = renderedBody(renderMarkdownView({
  filename: 'display.md',
  sourceUrl: 'https://gist.githubusercontent.com/user/id/raw/display.md',
  source: `$$
a^2 + b^2
$$

Text after display math.`
}))

assert(displayMathHtml.includes('class="math-display"'), 'display math block was not rendered')
assert(displayMathHtml.includes('<p>Text after display math.</p>'), 'display math block swallowed following Markdown')
