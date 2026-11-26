import assert from 'node:assert/strict'
import { randomBytes, scryptSync } from 'node:crypto'
import { test } from 'node:test'
import { hashPassword, verifyPassword } from './password.server'

test('a hash verifies its own password and no other', async () => {
  const hash = await hashPassword('correct horse battery')
  assert.match(hash, /^scrypt\$32768\$8\$3\$[\w-]{22}\$[\w-]{43}$/)
  assert.equal(await verifyPassword('correct horse battery', hash), true)
  assert.equal(await verifyPassword('correct horse batterY', hash), false)
  assert.equal(await verifyPassword('', hash), false)
})

test('two hashes of one password differ (random salt)', async () => {
  const [a, b] = await Promise.all([
    hashPassword('xxxxxxxx'),
    hashPassword('xxxxxxxx'),
  ])
  assert.notEqual(a, b)
})

test('a hash is checked with the cost it was made with', async () => {
  // An older, cheaper hash: same format, other parameters.
  const salt = randomBytes(16)
  const key = scryptSync('senha secreta', salt, 32, { N: 1024, r: 8, p: 1 })
  const old = [
    'scrypt',
    1024,
    8,
    1,
    salt.toString('base64url'),
    key.toString('base64url'),
  ].join('$')
  assert.equal(await verifyPassword('senha secreta', old), true)
  assert.equal(await verifyPassword('outra senha', old), false)
})

test('anything that is not one of our hashes is rejected', async () => {
  const notOurs = [
    '',
    'bcrypt',
    '$2b$10$abc',
    'scrypt$a$b$c$d$e',
    'scrypt$1024$8$1$$',
  ]
  for (const stored of notOurs) {
    assert.equal(await verifyPassword('anything', stored), false)
  }
})
