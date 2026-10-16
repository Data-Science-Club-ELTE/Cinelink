const { test } = require('node:test')
const assert = require('node:assert/strict')
const { isValidEmail, checkEmailDomain } = require('../lib/email-validation.cjs')
test('rejects malformed local parts and domains', () => {
  for (const address of ['a@-example.com', 'a@example..com', 'a@domain', '.a@example.com', 'a..b@example.com', 'a@domain.123']) {
    assert.equal(isValidEmail(address), false, address)
  }
  assert.equal(isValidEmail('student+club@inf.elte.hu'), true)
})
test('accepts a domain advertising a mail server', async () => {
  assert.equal(await checkEmailDomain('student@example.com', async () => [{exchange:'mail.example.com',priority:10}]), 'valid')
})
test('rejects nonexistent domains and null MX mail refusal', async () => {
  assert.equal(await checkEmailDomain('student@example.invalid', async () => { throw Object.assign(new Error(), {code:'ENOTFOUND'}) }), 'invalid')
  assert.equal(await checkEmailDomain('student@example.com', async () => [{exchange:'',priority:0}]), 'invalid')
})
test('temporary DNS failures are retryable rather than silently accepted', async () => {
  assert.equal(await checkEmailDomain('student@example.com', async () => { throw Object.assign(new Error(), {code:'ESERVFAIL'}) }), 'unavailable')
})
