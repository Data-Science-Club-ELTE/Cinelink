const { resolveMx } = require('node:dns/promises')

function isValidEmail(email) {
  if (typeof email !== 'string' || email.length > 254) return false
  const parts = email.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  return local.length > 0 && local.length <= 64 &&
    /^[a-z0-9.!#$%&'*+/=?^_`{|}~-]+$/i.test(local) &&
    !local.startsWith('.') && !local.endsWith('.') && !local.includes('..') &&
    domain.length <= 253 && domain.includes('.') &&
    domain.split('.').every(label => /^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$/i.test(label)) &&
    /^[a-z]{2,}$/i.test(domain.split('.').at(-1))
}

// Domain mail routing is not proof that the person owns the mailbox.
async function checkEmailDomain(email, lookup = resolveMx) {
  if (!isValidEmail(email)) return 'invalid'
  let timer
  try {
    const records = await Promise.race([
      lookup(email.split('@')[1]),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('DNS timeout')), 5000) }),
    ])
    return records.some(record => record.exchange && record.exchange !== '.') ? 'valid' : 'invalid'
  } catch (error) {
    return ['ENOTFOUND', 'ENODATA', 'ENONAME'].includes(error.code) ? 'invalid' : 'unavailable'
  } finally { clearTimeout(timer) }
}

module.exports = { isValidEmail, checkEmailDomain }
