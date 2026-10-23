import { sha256, toHex } from './sha256'
import { encodeUtf8 } from './utf8'

test.each([
  ['', 'e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855'],
  ['abc', 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'],
  [
    'abcdbcdecdefdefgefghfghighijhijkijkljklmklmnlmnomnopnopq',
    '248d6a61d20638b8e5c026930c3e6039a33ce45964ff2167f6ecedd419db06c1',
  ],
])('sha256(%j)', (input, expected) => {
  expect(toHex(sha256(encodeUtf8(input)))).toBe(expected)
})

test('um milhão de "a" (atravessa muitos blocos)', () => {
  expect(toHex(sha256(new Uint8Array(1_000_000).fill(0x61)))).toBe(
    'cdc76e5c9914fb9281a1c7e284d73e67f1809a48a497200e046d39ccc7112cd0',
  )
})
