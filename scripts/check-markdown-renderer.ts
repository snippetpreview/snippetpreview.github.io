import { renderMarkdownView } from '../src/providers/markdown-view'

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message)
  }
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

[guide](./guide.md) ![image](./assets/image.png)`

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
assert(html.includes('<details open>'), 'safe HTML was removed')
assert(!html.includes('<script>alert'), 'unsafe script was preserved')
assert(!html.includes('onclick='), 'event handler was preserved')

const unsafeHtml = renderMarkdownView({
  filename: 'unsafe.md',
  sourceUrl: 'https://gist.githubusercontent.com/user/id/raw/unsafe.md',
  source: '[bad link](javascript:alert(1)) ![bad image](javascript:alert(1))'
})

assert(!unsafeHtml.includes('href="javascript:') && !unsafeHtml.includes('src="javascript:'), 'unsafe URL scheme was preserved')

const invalidMathHtml = renderMarkdownView({
  filename: 'invalid.md',
  sourceUrl: 'https://gist.githubusercontent.com/user/id/raw/invalid.md',
  source: String.raw`Before $\unknowncommand$ after`
})

assert(invalidMathHtml.includes('class="math-error"'), 'invalid math fallback was not rendered')
assert(invalidMathHtml.includes('Before') && invalidMathHtml.includes('after'), 'invalid math broke surrounding Markdown')
