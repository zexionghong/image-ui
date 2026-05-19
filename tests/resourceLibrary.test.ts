import assert from 'node:assert/strict'
import {
  buildResourceAssetPath,
  buildThreeViewGenerationRequests,
  buildThreeViewVideoPrompt,
  extractResourcePaths,
  parseResourcePath,
  THREE_VIEW_ANGLES,
} from '../src/lib/resourceLibrary'

const subject = '\u8d5b\u535a\u670b\u514b\u5973\u6218\u58eb'
const style = '\u7535\u5f71\u7ea7\u5199\u5b9e'
const notes = '\u94f6\u8272\u77ed\u53d1\uff0c\u9ed1\u8272\u673a\u80fd\u670d'

const requests = buildThreeViewGenerationRequests({
  subject,
  style,
  notes,
  size: '1024x1024',
})

assert.equal(requests.length, 3)
assert.deepEqual(requests.map((item) => item.angle), THREE_VIEW_ANGLES)
assert.equal(requests.every((item) => item.size === '1024x1024'), true)
assert.match(requests[0].prompt, /\u6b63\u9762/)
assert.match(requests[1].prompt, /\u4fa7\u9762/)
assert.match(requests[2].prompt, /\u80cc\u9762/)
assert.match(requests[0].prompt, new RegExp(subject))
assert.match(requests[0].prompt, new RegExp(style))
assert.match(requests[0].prompt, /\u94f6\u8272\u77ed\u53d1/)

assert.equal(
  buildThreeViewVideoPrompt(subject),
  '\u4f7f\u7528 @img1 @img2 @img3 \u4f5c\u4e3a\u540c\u4e00\u8d5b\u535a\u670b\u514b\u5973\u6218\u58eb\u7684\u6b63\u9762\u3001\u4fa7\u9762\u3001\u80cc\u9762\u53c2\u8003\uff0c\u751f\u6210\u4e00\u6bb5\u89d2\u8272\u5c55\u793a\u89c6\u9891\u3002\u4fdd\u6301\u4e3b\u4f53\u8eab\u4efd\u3001\u670d\u88c5\u3001\u6bd4\u4f8b\u548c\u6750\u8d28\u4e00\u81f4\uff0c\u955c\u5934\u56f4\u7ed5\u4e3b\u4f53\u5e73\u6ed1\u73af\u7ed5\uff0c\u9002\u5408\u89c6\u9891\u5236\u4f5c\u3002'
)

const frontPath = buildResourceAssetPath(subject, 'front')
assert.equal(frontPath, '@\u8d44\u6e90\u5e93/\u8d5b\u535a\u670b\u514b\u5973\u6218\u58eb/\u4e09\u89c6\u56fe/\u6b63\u9762')
assert.deepEqual(parseResourcePath(frontPath), {
  projectName: subject,
  folder: '\u4e09\u89c6\u56fe',
  assetName: '\u6b63\u9762',
})
assert.deepEqual(extractResourcePaths(`use ${frontPath} and ${frontPath}`), [frontPath])

console.log('resourceLibrary tests passed')
